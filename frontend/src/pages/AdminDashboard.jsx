import React, { useState, useEffect, useRef } from 'react';
import { db, storage } from '../lib/firebase';
import { collection, getDocs, addDoc, query, where, serverTimestamp, doc, updateDoc, deleteDoc, setDoc, onSnapshot, orderBy } from 'firebase/firestore';
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { LayoutDashboard, Calendar, Users, Wallet, Plus, Clock, UtensilsCrossed, Coffee, CheckCircle2, Lock, X, Settings, Shield, BarChart2, MessageCircle, Bell, Phone, Trash2, Monitor, Upload, ImageIcon, ClipboardList, CheckSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SLOT_HOURS, getSlotLabel, getAvailableDates, getSlotStatusMap, formatSlotsDisplay, getTodayStr } from '../utils/slots';
import { exportAnalyticsExcel } from '../utils/exportExcel';
import { createNotification, autoCompleteBookings, autoCancelPendingBookings, openAdminWhatsApp, sendBookingConfirmedWhatsApp } from '../utils/firebaseHelpers';
import AdminNotificationBell from '../components/AdminNotificationBell';
import logo43c from '../assets/43C.png';

const BOOKING_STATUSES = ['pending','confirmed','completed','cancelled'];
const ORDER_STATUSES   = ['pending','confirmed','served','cancelled'];

const StatusBadge = ({ s }) => {
  const colors = { pending:'text-yellow-400 bg-yellow-500/10 border-yellow-500/30', confirmed:'text-blue-400 bg-blue-500/10 border-blue-500/30', completed:'text-green-400 bg-green-500/10 border-green-500/30', served:'text-green-400 bg-green-500/10 border-green-500/30', cancelled:'text-red-400 bg-red-500/10 border-red-500/30' };
  return <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${colors[s]||colors.pending}`}>{s}</span>;
};

const AdminDashboard = () => {
  // Auth guard
  if (localStorage.getItem('admin_access') !== 'true') {
    window.location.href = '/admin-login';
    return null;
  }

  const [view, setView] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [analytics, setAnalytics] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [menuItems, setMenuItems] = useState([]);
  const [foodOrders, setFoodOrders] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [analyticsData, setAnalyticsData] = useState({ rows: [], bookingDetails: [], foodDetails: [], totalExpenses: 0 });
  const [analyticsMonth, setAnalyticsMonth] = useState(new Date().getMonth());
  const [analyticsYear, setAnalyticsYear] = useState(new Date().getFullYear());
  const [waNumber, setWaNumber] = useState('9479810400');
  const [waInput, setWaInput] = useState('9479810400');
  const [editPrice, setEditPrice] = useState({});
  const [pricingMap, setPricingMap] = useState({
    'Screen 1': { gold: 299, silver: 399, non_member: 499 },
    'Screen 2': { gold: 299, silver: 399, non_member: 499 },
    'TV Screen': { gold: 199, silver: 299, non_member: 399 }
  });

  const [slotDate, setSlotDate] = useState(getTodayStr());
  const [slotScreen, setSlotScreen] = useState('Screen 1');
  const [slotStatus, setSlotStatus] = useState({});
  const availableDates = getAvailableDates();

  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ title:'', amount:'', date:getTodayStr() });
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingForm, setBookingForm] = useState({ name:'', mobile:'', screen:'Screen 1', slots:[], guest_count:2, date:getTodayStr() });
  const [bookingSlotStatus, setBookingSlotStatus] = useState({});
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [menuForm, setMenuForm] = useState({ id:'', name:'', category:'Drinks', member_price:'', non_member_price:'', image_url:'' });
  const [isEditingMenu, setIsEditingMenu] = useState(false);
  // Menu image upload state
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [imageUploading, setImageUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);
  // Menu category management
  const [menuCategories, setMenuCategories] = useState(['Drinks','Snacks','Main Course','Desserts','Shisha']);
  const [newCategory, setNewCategory] = useState('');
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [menuCatFilter, setMenuCatFilter] = useState('All');
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminForm, setAdminForm] = useState({ name:'', mobile:'', password:'' });

  // New features state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null); // { id, type: 'booking'|'order' }
  const [cancelReason, setCancelReason] = useState('');
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [advanceTarget, setAdvanceTarget] = useState(null);
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDate, setFilterDate] = useState('');
  const [editWaMobile, setEditWaMobile] = useState({});
  const [notifCount, setNotifCount] = useState({ bookings: 0, orders: 0 });

  const [memberFilter, setMemberFilter] = useState('all'); // all | gold | silver | non_member
  const [memberBookings, setMemberBookings] = useState({}); // customerId -> count
  const [memberSpend, setMemberSpend] = useState({});    // customerId -> total spend
  const [showDueModal, setShowDueModal] = useState(false);
  const [dueTarget, setDueTarget] = useState(null);
  const [dueAmount, setDueAmount] = useState('');
  const [newScreenName, setNewScreenName] = useState('');
  const [screens, setScreens] = useState(['Screen 1', 'Screen 2', 'TV Screen']);

  // Task manager state
  const [tasks, setTasks] = useState([]);
  const [taskForm, setTaskForm] = useState({ title: '', time: '10:00' });
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [selectedTaskDate, setSelectedTaskDate] = useState(getTodayStr());

  const fetchTasks = async () => {
    try {
      const snap = await getDocs(collection(db, 'tasks'));
      setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch(e) { console.error(e); }
  };

  const addTask = async (e) => {
    e.preventDefault();
    if (!taskForm.title.trim()) return;
    try {
      const docRef = await addDoc(collection(db, 'tasks'), {
        title: taskForm.title.trim(),
        date: selectedTaskDate,
        time: taskForm.time,
        completed: false,
        created_at: serverTimestamp()
      });
      setTasks([...tasks, { id: docRef.id, title: taskForm.title.trim(), date: selectedTaskDate, time: taskForm.time, completed: false }]);
      setTaskForm({ title: '', time: '10:00' });
    } catch(err) { alert('Failed: ' + err.message); }
  };

  const toggleTask = async (id, currentStatus) => {
    try {
      await updateDoc(doc(db, 'tasks', id), { completed: !currentStatus });
      setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !currentStatus } : t));
    } catch(err) { alert('Failed'); }
  };

  const deleteTask = async (id) => {
    if (!window.confirm('Delete this task?')) return;
    try {
      await deleteDoc(doc(db, 'tasks', id));
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch(err) { alert('Failed'); }
  };

  useEffect(() => {
    if (view==='overview') fetchAnalytics();
    if (view==='bookings') fetchAllBookings();
    if (view==='slots') fetchSlotData();
    if (view==='members') fetchCustomers();
    if (view==='expenses') fetchExpenses();
    if (view==='menu') fetchMenu();
    if (view==='orders') fetchFoodOrders();
    if (view==='analytics') fetchAnalyticsView();
    if (view==='settings') fetchSettings();
    if (view==='tasks') { fetchTasks(); fetchAllBookings(); }
  }, [view, slotDate, slotScreen]);

  useEffect(() => { if (view==='analytics') fetchAnalyticsView(); }, [analyticsMonth, analyticsYear]);
  useEffect(() => { if (showBookingModal) fetchSlotDataForBooking(); }, [showBookingModal, bookingForm.date, bookingForm.screen]);

  const fetchSettings = async () => {
    try {
      const snap = await getDocs(collection(db,'settings'));
      const globals = snap.docs.find(d=>d.id==='global');
      if (globals) { setWaNumber(globals.data().whatsapp_number||'9479810400'); setWaInput(globals.data().whatsapp_number||'9479810400'); }
      const pSnap = await getDocs(collection(db,'pricing'));
      if(!pSnap.empty && pSnap.docs[0].data().screens) {
         const loadedMap = pSnap.docs[0].data().screens;
         setPricingMap(loadedMap);
         setScreens(Object.keys(loadedMap));
      }
    } catch(e){ console.error(e); }
  };

  const saveSettings = async () => {
    try { await setDoc(doc(db,'settings','global'),{whatsapp_number:waInput},{merge:true}); setWaNumber(waInput); alert('Settings saved!'); } catch(e){ alert('Failed'); }
  };

  const savePricing = async () => {
    try { await setDoc(doc(db, 'pricing', 'rates'), { screens: pricingMap }); alert('Pricing updated.'); } catch(e){ alert('Failed to save pricing.'); }
  };

  const fetchAnalytics = async () => {
    try {
      const today = getTodayStr();
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
      const allB = (await getDocs(collection(db,'bookings'))).docs.map(d=>d.data());
      const allE = (await getDocs(collection(db,'expenses'))).docs.map(d=>d.data());
      const allFO = (await getDocs(collection(db,'food_orders'))).docs.map(d=>d.data());
      const todayB = allB.filter(b=>b.booking_date===today);
      const monthB = allB.filter(b=>b.booking_date>=startOfMonth && (b.status==='confirmed'||b.status==='completed'));
      const monthE = allE.filter(e=>e.date>=startOfMonth);
      const mStartTs = new Date(startOfMonth+'T00:00:00').getTime()/1000;
      const tStartTs = new Date(today+'T00:00:00').getTime()/1000;
      const monthFO = allFO.filter(o=>(o.created_at?.seconds||0)>=mStartTs && (o.status==='confirmed'||o.status==='served'));
      const todayFO = allFO.filter(o=>(o.created_at?.seconds||0)>=tStartTs && (o.created_at?.seconds||0)<tStartTs+86400);
      const monthBRev = monthB.reduce((s,b)=>s+(b.final_price||b.price||0),0);
      const monthFRev = monthFO.reduce((s,o)=>s+(o.final_price||o.total||0),0);
      const monthExp = monthE.reduce((s,e)=>s+Number(e.amount||0),0);
      setAnalytics({
        today_bookings: todayB.length,
        today_revenue: todayB.reduce((s,b)=>s+(b.final_price||b.price||0),0) + todayFO.reduce((s,o)=>s+(o.final_price||o.total||0),0),
        monthly_expenses: monthExp,
        monthly_booking_rev: monthBRev,
        monthly_food_rev: monthFRev,
        net_profit: monthBRev + monthFRev - monthExp,
        total_food_orders: allFO.length,
      });
    } catch(e){ console.error(e); }
  };

  const fetchAnalyticsView = async () => {
    setLoading(true);
    try {
      const allB = (await getDocs(collection(db,'bookings'))).docs.map(d=>({id:d.id,...d.data()}));
      const allFO = (await getDocs(collection(db,'food_orders'))).docs.map(d=>({id:d.id,...d.data()}));
      const allE = (await getDocs(collection(db,'expenses'))).docs.map(d=>d.data());
      const mStart = new Date(analyticsYear, analyticsMonth, 1);
      const mEnd = new Date(analyticsYear, analyticsMonth+1, 1);
      const mStartStr = mStart.toISOString().split('T')[0];
      const mEndStr = mEnd.toISOString().split('T')[0];
      const mStartTs = mStart.getTime()/1000;
      const mEndTs = mEnd.getTime()/1000;
      const monthB = allB.filter(b=>b.booking_date>=mStartStr && b.booking_date<mEndStr && (b.status==='confirmed'||b.status==='completed'));
      const monthFO = allFO.filter(o=>(o.created_at?.seconds||0)>=mStartTs && (o.created_at?.seconds||0)<mEndTs && (o.status==='confirmed'||o.status==='served'));
      const monthE = allE.filter(e=>e.date>=mStartStr && e.date<mEndStr);
      const dayMap = {};
      const slotMap = {};
      const foodMap = {};
      monthB.forEach(b=>{ 
        if(!dayMap[b.booking_date]) dayMap[b.booking_date]={bookingTotal:0,foodTotal:0}; 
        dayMap[b.booking_date].bookingTotal+=(b.final_price||b.price||0); 
        if (b.slots && b.slots.length) {
          b.slots.forEach(slot => {
            const label = getSlotLabel(slot).split(' - ')[0];
            slotMap[label] = (slotMap[label] || 0) + 1;
          });
        }
      });
      monthFO.forEach(o=>{ 
        const d=o.created_at?.seconds?new Date(o.created_at.seconds*1000).toISOString().split('T')[0]:null; 
        if(d) {
          if(!dayMap[d]) dayMap[d]={bookingTotal:0,foodTotal:0}; 
          dayMap[d].foodTotal+=(o.final_price||o.total||0); 
        }
        if (o.items && o.items.length) {
          o.items.forEach(item => {
            foodMap[item.name] = (foodMap[item.name] || 0) + item.qty;
          });
        }
      });
      const rows = Object.keys(dayMap).sort().map(date=>({ date, bookingTotal:dayMap[date].bookingTotal, foodTotal:dayMap[date].foodTotal, total:dayMap[date].bookingTotal+dayMap[date].foodTotal }));
      const totalExpenses = monthE.reduce((s,e)=>s+Number(e.amount||0),0);
      const topSlots = Object.entries(slotMap).sort((a,b)=>b[1]-a[1]).slice(0, 5).map(x=>({name:x[0], count:x[1]}));
      const topFood = Object.entries(foodMap).sort((a,b)=>b[1]-a[1]).slice(0, 5).map(x=>({name:x[0], count:x[1]}));
      setAnalyticsData({ rows, bookingDetails:monthB, foodDetails:monthFO, totalExpenses, topSlots, topFood });
    } catch(e){ console.error(e); }
    finally { setLoading(false); }
  };

  const fetchAllBookings = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db,'bookings'));
      const raw = snap.docs.map(d=>({id:d.id,...d.data()}));
      // Sort: pending first (oldest), then others by date desc
      raw.sort((a,b) => {
        if (a.status==='pending' && b.status!=='pending') return -1;
        if (b.status==='pending' && a.status!=='pending') return 1;
        if (a.status==='pending' && b.status==='pending') {
          return (a.created_at?.seconds||0) - (b.created_at?.seconds||0);
        }
        return b.booking_date < a.booking_date ? -1 : 1;
      });
      setBookings(raw);
      setFilterStatus('pending'); // default to pending
      await autoCompleteBookings(raw, (id, status) =>
        setBookings(prev => prev.map(b => b.id===id ? {...b, status} : b))
      );
      await autoCancelPendingBookings(raw, (id, status) =>
        setBookings(prev => prev.map(b => b.id===id ? {...b, status} : b))
      );
      setNotifCount(prev => ({...prev, bookings: raw.filter(b=>b.status==='pending').length}));
    } catch(e){ console.error(e); } finally { setLoading(false); }
  };


  const fetchSlotData = async () => {
    try {
      const bSnap = await getDocs(query(collection(db,'bookings'),where('booking_date','==',slotDate)));
      const cSnap = await getDocs(query(collection(db,'closed_slots'),where('date','==',slotDate)));
      setSlotStatus(getSlotStatusMap(slotDate, bSnap.docs.map(d=>d.data()), cSnap.docs.map(d=>d.data()), slotScreen));
    } catch(e){ console.error(e); }
  };

  const fetchSlotDataForBooking = async () => {
    try {
      const bSnap = await getDocs(query(collection(db,'bookings'),where('booking_date','==',bookingForm.date)));
      const cSnap = await getDocs(query(collection(db,'closed_slots'),where('date','==',bookingForm.date)));
      setBookingSlotStatus(getSlotStatusMap(bookingForm.date, bSnap.docs.map(d=>d.data()), cSnap.docs.map(d=>d.data()), bookingForm.screen));
    } catch(e){ console.error(e); }
  };

  const fetchCustomers = async () => {
    try {
      const cSnap = await getDocs(collection(db,'customers'));
      const memSnap = await getDocs(query(collection(db,'memberships'),where('status','==','active')));
      const memMap = {};
      memSnap.docs.forEach(d => { memMap[d.data().customer_id] = d.data().membership_type || 'silver'; });
      const bSnap = await getDocs(collection(db,'bookings'));
      const bkMap = {}; const spMap = {};
      bSnap.docs.forEach(d => {
        const bd = d.data();
        if (!bkMap[bd.customer_id]) { bkMap[bd.customer_id] = 0; spMap[bd.customer_id] = 0; }
        bkMap[bd.customer_id]++;
        spMap[bd.customer_id] += (bd.final_price||bd.price||0);
      });
      setMemberBookings(bkMap);
      setMemberSpend(spMap);
      setCustomers(cSnap.docs.map(d=>({id:d.id,...d.data(),membership_type:memMap[d.id]||'non_member',is_member:!!memMap[d.id]})));
    } catch(e){ console.error(e); }
  };

  const fetchExpenses = async () => {
    try {
      const snap = await getDocs(collection(db,'expenses'));
      const data = snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>b.date<a.date?-1:1);
      setExpenses(data);
    } catch(e){ console.error(e); }
  };

  const fetchMenu = async () => {
    try { 
      const snap = await getDocs(collection(db,'menu_items')); 
      setMenuItems(snap.docs.map(d=>({id:d.id,...d.data()}))); 
      
      const catSnap = await getDocs(collection(db,'settings'));
      const catDoc = catSnap.docs.find(d => d.id === 'menu_categories');
      if (catDoc && catDoc.data().categories) {
        setMenuCategories(catDoc.data().categories);
      }
    } catch(e){ console.error(e); }
  };

  const fetchFoodOrders = async () => {
    try {
      const snap = await getDocs(collection(db,'food_orders'));
      const data = snap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(b.created_at?.seconds||0)-(a.created_at?.seconds||0));
      setFoodOrders(data);
    } catch(e){ console.error(e); }
  };

  const fetchAdmins = async () => {
    try { const snap=await getDocs(collection(db,'admins')); setAdmins(snap.docs.map(d=>({id:d.id,...d.data()}))); } catch(e){ console.error(e); }
  };

  const updateBookingStatus = async (id, status) => {
    await updateDoc(doc(db,'bookings',id),{status});
    setBookings(prev=>prev.map(b=>b.id===id?{...b,status}:b));
  };

  const updateBookingPrice = async (id, finalPrice) => {
    await updateDoc(doc(db,'bookings',id),{final_price:Number(finalPrice)});
    setBookings(prev=>prev.map(b=>b.id===id?{...b,final_price:Number(finalPrice)}:b));
    setEditPrice(prev=>({...prev,[id]:undefined}));
  };

  const updateOrderStatus = async (id, status) => {
    await updateDoc(doc(db,'food_orders',id),{status});
    setFoodOrders(prev=>prev.map(o=>o.id===id?{...o,status}:o));
  };

  const updateOrderPrice = async (id, finalPrice) => {
    await updateDoc(doc(db,'food_orders',id),{final_price:Number(finalPrice)});
    setFoodOrders(prev=>prev.map(o=>o.id===id?{...o,final_price:Number(finalPrice)}:o));
    setEditPrice(prev=>({...prev,[id]:undefined}));
  };

  const toggleCloseSlot = async (hour) => {
    const status = slotStatus[hour]; if(status==='booked') return alert('Cannot close a booked slot.');
    try {
      if(status==='closed'){ const q=query(collection(db,'closed_slots'),where('date','==',slotDate),where('hour','==',hour),where('screen','==',slotScreen)); (await getDocs(q)).forEach(async d=>await deleteDoc(doc(db,'closed_slots',d.id))); }
      else { await addDoc(collection(db,'closed_slots'),{date:slotDate,hour,screen:slotScreen,reason:'Admin Closed',created_at:serverTimestamp()}); }
      fetchSlotData();
    } catch(e){ alert('Failed'); }
  };

  const manualBooking = async (e) => {
    e.preventDefault();
    if(bookingForm.slots.length===0) return alert('Select at least one slot.');
    try {
      const q=query(collection(db,'customers'),where('mobile_number','==',bookingForm.mobile));
      const snap=await getDocs(q); let custId='';
      if(!snap.empty) custId=snap.docs[0].id;
      else { const ref=await addDoc(collection(db,'customers'),{name:bookingForm.name,mobile_number:bookingForm.mobile,created_at:serverTimestamp()}); custId=ref.id; }
      const totalPrice=499*bookingForm.slots.length;
      const bRef=await addDoc(collection(db,'bookings'),{customer_id:custId,customer_name:bookingForm.name,customer_mobile:bookingForm.mobile,booking_date:bookingForm.date,screen:bookingForm.screen,slots:bookingForm.slots,guest_count:bookingForm.guest_count,original_price:totalPrice,final_price:totalPrice,price:totalPrice,status:'confirmed',created_at:serverTimestamp()});
      await addDoc(collection(db,'payments'),{booking_id:bRef.id,amount:totalPrice,status:'confirmed',created_at:serverTimestamp()});
      alert('Booking created.'); setShowBookingModal(false); setBookingForm({name:'',mobile:'',screen:'Screen 1',slots:[],guest_count:2,date:getTodayStr()});
      if(view==='bookings') fetchAllBookings();
    } catch(e){ alert('Failed: '+e.message); }
  };

  // Upload image file to Firebase Storage and return download URL
  const uploadMenuImage = (file) => new Promise((resolve, reject) => {
    const ext = file.name.split('.').pop();
    const path = `menu_images/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const sRef = storageRef(storage, path);
    const task = uploadBytesResumable(sRef, file);
    task.on('state_changed',
      (snap) => setUploadProgress(Math.round(snap.bytesTransferred / snap.totalBytes * 100)),
      reject,
      () => getDownloadURL(task.snapshot.ref).then(resolve).catch(reject)
    );
  });

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return alert('Please select an image file.');
    if (file.size > 5 * 1024 * 1024) return alert('Image must be under 5MB.');
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const saveMenu = async (e) => {
    e.preventDefault();
    try {
      let imageUrl = menuForm.image_url;
      // Upload new image if selected
      if (imageFile) {
        setImageUploading(true);
        setUploadProgress(0);
        imageUrl = await uploadMenuImage(imageFile);
        setImageUploading(false);
      }
      if(isEditingMenu) {
        await updateDoc(doc(db,'menu_items',menuForm.id), {
          name: menuForm.name,
          category: menuForm.category,
          member_price: Number(menuForm.member_price),
          non_member_price: Number(menuForm.non_member_price),
          image_url: imageUrl
        });
      } else {
        await addDoc(collection(db,'menu_items'),{
          ...menuForm,
          image_url: imageUrl,
          member_price: Number(menuForm.member_price),
          non_member_price: Number(menuForm.non_member_price),
          available: true,
          created_at: serverTimestamp(),
        });
      }
      setShowMenuModal(false);
      setMenuForm({id:'', name:'', category: menuCategories[0]||'Drinks', member_price:'', non_member_price:'', image_url:''});
      setImageFile(null); setImagePreview(''); setUploadProgress(0);
      setIsEditingMenu(false);
      fetchMenu();
    } catch(err) {
      setImageUploading(false);
      alert('Failed: ' + err.message);
    }
  };

  const deleteMenu = async (id) => {
    if(!window.confirm('Delete this item?')) return;
    try { await deleteDoc(doc(db,'menu_items',id)); fetchMenu(); } catch(e){ alert('Failed'); }
  };

  // Save categories to Firestore so they persist
  const saveCategory = async () => {
    const cat = newCategory.trim();
    if (!cat) return;
    if (menuCategories.includes(cat)) return alert('Category already exists.');
    const updated = [...menuCategories, cat];
    setMenuCategories(updated);
    setNewCategory('');
    setShowAddCategory(false);
    try { await setDoc(doc(db,'settings','menu_categories'), { categories: updated }); } catch(e) { /* ignore */ }
  };

  const deleteCategory = async (cat) => {
    const inUse = menuItems.some(m => m.category === cat);
    if (inUse) return alert(`Cannot delete "${cat}" — it has menu items. Reassign them first.`);
    const updated = menuCategories.filter(c => c !== cat);
    setMenuCategories(updated);
    try { await setDoc(doc(db,'settings','menu_categories'), { categories: updated }); } catch(e) { /* ignore */ }
  };

  const logExpense = async (e) => {
    e.preventDefault();
    try { await addDoc(collection(db,'expenses'),{...expenseForm,amount:Number(expenseForm.amount),created_at:serverTimestamp()}); setShowExpenseModal(false); setExpenseForm({title:'',amount:'',date:getTodayStr()}); fetchExpenses(); } catch(e){ alert('Failed'); }
  };

  const saveAdmin = async (e) => {
    e.preventDefault();
    if(adminForm.mobile.length<10) return alert('Enter valid mobile.');
    try { await addDoc(collection(db,'admins'),{...adminForm,created_at:serverTimestamp()}); setShowAdminModal(false); setAdminForm({name:'',mobile:'',password:''}); fetchAdmins(); alert('Admin added.'); } catch(e){ alert('Failed'); }
  };

  const deleteAdmin = async (id) => {
    if(!window.confirm('Remove admin?')) return;
    try { await deleteDoc(doc(db,'admins',id)); fetchAdmins(); } catch(e){ alert('Failed'); }
  };

  // Cancel booking/order
  const openCancelModal = (id, type) => { setCancelTarget({id, type}); setCancelReason(''); setShowCancelModal(true); };
  const confirmCancel = async () => {
    if (!cancelReason.trim()) return alert('Please enter a cancellation reason.');
    const { id, type } = cancelTarget;
    try {
      if (type === 'booking') {
        const b = bookings.find(x => x.id === id);
        if (b?.status === 'completed') return alert('Cannot cancel a completed booking.');
        await updateDoc(doc(db,'bookings',id), { status:'cancelled', cancel_reason: cancelReason });
        setBookings(prev => prev.map(x => x.id===id ? {...x, status:'cancelled', cancel_reason:cancelReason} : x));
        await createNotification({ userId: b.customer_id, type:'booking_cancelled', message:`Your booking on ${b.booking_date} has been cancelled. Reason: ${cancelReason}`, bookingId: id });
      } else {
        const o = foodOrders.find(x => x.id === id);
        await updateDoc(doc(db,'food_orders',id), { status:'cancelled', cancel_reason: cancelReason });
        setFoodOrders(prev => prev.map(x => x.id===id ? {...x, status:'cancelled', cancel_reason:cancelReason} : x));
        if (o) await createNotification({ userId: o.customer_id, type:'order_cancelled', message:`Your food order #${id.slice(0,6)} has been cancelled. Reason: ${cancelReason}`, orderId: id });
      }
    } catch(e) { alert('Failed: '+e.message); }
    setShowCancelModal(false);
  };

  // Advance payment confirmation
  const openAdvanceModal = (booking) => { setAdvanceTarget(booking); setAdvanceAmount(''); setShowAdvanceModal(true); };
  const confirmAdvancePayment = async () => {
    if (!advanceAmount || isNaN(advanceAmount)) return alert('Enter valid amount.');
    const adv = Number(advanceAmount);
    const total = advanceTarget.final_price || advanceTarget.price || 0;
    const remaining = total - adv;
    try {
      await updateDoc(doc(db,'bookings', advanceTarget.id), {
        status: 'confirmed',
        advance_paid: adv,
        remaining_amount: remaining,
        total_amount: total,
      });
      setBookings(prev => prev.map(b => b.id===advanceTarget.id ? {...b, status:'confirmed', advance_paid:adv, remaining_amount:remaining, total_amount:total} : b));
      await createNotification({
        userId: advanceTarget.customer_id,
        type: 'booking_confirmed',
        message: `Your booking at 43C is confirmed! Date: ${advanceTarget.booking_date}, Slots: ${formatSlotsDisplay(advanceTarget.slots)}, Guests: ${advanceTarget.guest_count}. Remaining to pay on arrival: ₹${remaining}. Enjoy your cinematic experience!`,
        bookingId: advanceTarget.id,
      });
      sendBookingConfirmedWhatsApp({
        customerMobile: advanceTarget.customer_mobile,
        customerName: advanceTarget.customer_name,
        slots: advanceTarget.slots,
        date: advanceTarget.booking_date,
        guests: advanceTarget.guest_count,
        totalAmount: total,
        advancePaid: adv,
      });
    } catch(e) { alert('Failed: '+e.message); }
    setShowAdvanceModal(false);
  };

  // Update notification bell counts
  const refreshNotifCounts = (bkList, foList) => {
    setNotifCount({
      bookings: (bkList||bookings).filter(b => b.status==='pending').length,
      orders: (foList||foodOrders).filter(o => o.status==='pending').length,
    });
  };

  // Update order status with notification
  const updateOrderStatusWithNotif = async (id, status) => {
    const o = foodOrders.find(x => x.id===id);
    await updateDoc(doc(db,'food_orders',id),{status});
    const updated = foodOrders.map(x => x.id===id ? {...x,status} : x);
    setFoodOrders(updated);
    refreshNotifCounts(null, updated);
    if (!o) return;
    let msg = '';
    if (status==='confirmed') msg = `✅ Your food order is confirmed and being prepared! Order #${id.slice(0,6)}.`;
    if (status==='served') msg = `🎉 Your order has been served. Enjoy! Order #${id.slice(0,6)}.`;
    if (msg) await createNotification({ userId: o.customer_id, type:`food_${status}`, message: msg, orderId: id });
  };

  // Due amount for completed bookings
  const openDueModal = (booking) => { setDueTarget(booking); setDueAmount(''); setShowDueModal(true); };
  const saveDueAmount = async () => {
    if (!dueAmount || isNaN(dueAmount)) return alert('Enter valid amount.');
    const finalPaid = Number(dueAmount);
    try {
      await updateDoc(doc(db,'bookings', dueTarget.id), {
        status: 'completed',
        final_paid: finalPaid,
        remaining_amount: Math.max(0, (dueTarget.final_price||dueTarget.price||0) - (dueTarget.advance_paid||0) - finalPaid),
      });
      setBookings(prev => prev.map(b => b.id===dueTarget.id ? {...b, status:'completed', final_paid:finalPaid} : b));
      await createNotification({ userId: dueTarget.customer_id, type:'booking_completed', message:`Your visit is complete! Thank you for visiting 43C. Total paid: ₹${(dueTarget.advance_paid||0)+finalPaid}`, bookingId: dueTarget.id });
    } catch(e) { alert('Failed'); }
    setShowDueModal(false);
  };

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const navItems = [
    {id:'overview',icon:<LayoutDashboard size={18}/>,label:'Overview'},
    {id:'tasks',icon:<ClipboardList size={18}/>,label:'Tasks / Calendar'},
    {id:'bookings',icon:<Calendar size={18}/>,label:'Bookings'},
    {id:'slots',icon:<Clock size={18}/>,label:'Slot Control'},
    {id:'orders',icon:<UtensilsCrossed size={18}/>,label:'Food Orders'},
    {id:'menu',icon:<Coffee size={18}/>,label:'Menu'},
    {id:'members',icon:<Users size={18}/>,label:'Members'},
    {id:'expenses',icon:<Wallet size={18}/>,label:'Expenses'},
    {id:'analytics',icon:<BarChart2 size={18}/>,label:'Analytics'},
    {id:'settings',icon:<Settings size={18}/>,label:'Settings'},
    {id:'admins',icon:<Lock size={18}/>,label:'Admins'},
  ];

  const adminName = localStorage.getItem('admin_name') || 'Admin';

  return (
    <div className="flex min-h-screen luxury-bg mesh-pattern relative">
      {/* Sidebar */}
      <div className="w-56 lg:w-64 bg-[#05071A]/90 backdrop-blur-2xl border-r border-[#D4A95F]/10 p-4 lg:p-6 space-y-6 shrink-0 flex flex-col h-screen sticky top-0">
        <div className="flex items-center gap-3">
          <img src={logo43c} alt="43C" className="h-8 w-8 object-contain rounded-lg" onError={e => e.target.style.display='none'} />
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-heading gold-text-gradient font-black truncate">Control</h1>
            <p className="text-[8px] uppercase tracking-[0.3em] text-white/30">Admin Panel</p>
          </div>
          <AdminNotificationBell onNavigate={setView} />
        </div>
        <nav className="space-y-1 flex-1">
          {navItems.map(item=>(
            <button key={item.id} onClick={()=>setView(item.id)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all text-sm ${view===item.id?'bg-accent text-primary font-bold':'text-white/40 hover:text-white hover:bg-white/5'}`}
            >
              <div className="flex items-center gap-3">{item.icon}<span className="uppercase tracking-wider text-[11px]">{item.label}</span></div>
              {item.id==='bookings' && notifCount.bookings > 0 && <span className="bg-red-500 text-white text-[9px] w-5 h-5 flex items-center justify-center rounded-full font-black ml-auto">{notifCount.bookings}</span>}
              {item.id==='orders' && notifCount.orders > 0 && <span className="bg-red-500 text-white text-[9px] w-5 h-5 flex items-center justify-center rounded-full font-black ml-auto">{notifCount.orders}</span>}
            </button>
          ))}
        </nav>
        <button onClick={()=>{localStorage.removeItem('admin_access');window.location.href='/admin-login';}}
          className="w-full py-3 rounded-xl border border-red-500/20 text-red-500 hover:bg-red-500/10 font-bold text-[10px] uppercase tracking-widest transition-all">
          Log Out
        </button>
      </div>

      {/* Main */}
      <div className="flex-1 p-8 overflow-y-auto max-h-screen">
        <AnimatePresence mode="wait">

          {/* ─── OVERVIEW ─── */}
          {view==='overview' && analytics && (
            <motion.div key="ov" initial={{opacity:0}} animate={{opacity:1}} className="space-y-8">
              <div className="flex justify-between items-end">
                <div><h2 className="text-4xl font-heading mb-1">Dashboard <span className="gold-text-gradient italic">Overview</span></h2><p className="text-white/30 text-[10px] uppercase tracking-widest">Current Month Performance</p></div>
                <div className="flex gap-3">
                  <button onClick={()=>setShowExpenseModal(true)} className="glass-card !border-white/5 px-5 py-2.5 flex items-center gap-2 text-xs uppercase tracking-widest font-bold hover:bg-white/5"><Wallet className="w-4 h-4 text-accent"/>Log Expense</button>
                  <button onClick={()=>setShowBookingModal(true)} className="gold-button !px-5 !py-2.5 !text-xs flex items-center gap-2"><Plus className="w-4 h-4"/>Manual Book</button>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                {[
                  {label:"Today's Guests",val:analytics.today_bookings,cls:'text-accent'},
                  {label:"Today's Revenue",val:'₹'+analytics.today_revenue,cls:'text-green-400'},
                  {label:'Monthly Expenses',val:'₹'+analytics.monthly_expenses,cls:'text-red-400'},
                  {label:'Net Profit',val:'₹'+analytics.net_profit,cls:'gold-text-gradient'},
                ].map(c=>(
                  <div key={c.label} className="navy-card p-6"><p className="text-white/30 text-[9px] uppercase tracking-widest font-black mb-2">{c.label}</p><h3 className={`text-2xl font-heading font-black ${c.cls}`}>{c.val}</h3></div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-5">
                <div className="navy-card p-6 border-orange-500/20 bg-orange-500/5"><p className="text-white/30 text-[9px] uppercase tracking-widest font-black mb-2">Monthly Food Revenue</p><h3 className="text-2xl font-heading text-orange-400 font-black">₹{analytics.monthly_food_rev}</h3><p className="text-[9px] text-white/20 mt-1">{analytics.total_food_orders} total orders</p></div>
                <div className="navy-card p-6 border-blue-500/20 bg-blue-500/5"><p className="text-white/30 text-[9px] uppercase tracking-widest font-black mb-2">Monthly Booking Revenue</p><h3 className="text-2xl font-heading text-blue-400 font-black">₹{analytics.monthly_booking_rev}</h3></div>
              </div>
            </motion.div>
          )}

          {/* ─── TASKS & CALENDAR ─── */}
          {view==='tasks' && (
            <motion.div key="tk" initial={{opacity:0}} animate={{opacity:1}} className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-3xl font-heading">Tasks & <span className="gold-text-gradient italic">Calendar</span></h2>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Calendar Side */}
                <div className="glass-card p-6 border-white/10">
                  <div className="flex justify-between items-center mb-6">
                    <button onClick={()=>setCalendarMonth(p=>{if(p===0){setCalendarYear(y=>y-1);return 11;}return p-1;})} className="text-white/40 hover:text-accent font-bold px-3 py-1 bg-white/5 rounded-lg">&lt;</button>
                    <h3 className="font-heading font-black text-lg text-accent uppercase tracking-widest">{MONTHS[calendarMonth]} {calendarYear}</h3>
                    <button onClick={()=>setCalendarMonth(p=>{if(p===11){setCalendarYear(y=>y+1);return 0;}return p+1;})} className="text-white/40 hover:text-accent font-bold px-3 py-1 bg-white/5 rounded-lg">&gt;</button>
                  </div>
                  <div className="grid grid-cols-7 gap-2 text-center text-[10px] font-black uppercase text-white/30 mb-4">
                    {['Sn','Mo','Tu','We','Th','Fr','Sa'].map(d=><div key={d}>{d}</div>)}
                  </div>
                  <div className="grid grid-cols-7 gap-2">
                    {(() => {
                      const daysInMonth = new Date(calendarYear, calendarMonth+1, 0).getDate();
                      const firstDay = new Date(calendarYear, calendarMonth, 1).getDay();
                      const cells = [];
                      for(let i=0; i<firstDay; i++) cells.push(<div key={`e-${i}`}/>);
                      for(let d=1; d<=daysInMonth; d++) {
                        const dateStr = `${calendarYear}-${String(calendarMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                        const isSel = dateStr === selectedTaskDate;
                        const hasTask = tasks.some(t => t.date === dateStr && !t.completed);
                        const hasBooking = bookings.some(b => b.booking_date === dateStr && (b.status === 'confirmed' || b.status === 'completed'));
                        
                        cells.push(
                          <button key={d} onClick={()=>setSelectedTaskDate(dateStr)} className={`relative h-10 rounded-xl flex items-center justify-center font-bold text-sm transition-colors border ${isSel ? 'bg-accent/20 border-accent text-accent' : 'bg-white/5 border-white/10 hover:border-white/30 text-white/70'}`}>
                            {d}
                            <div className="absolute top-1 right-1 flex gap-0.5">
                              {hasBooking && <span className="w-1.5 h-1.5 rounded-full bg-blue-500"/>}
                              {hasTask && <span className="w-1.5 h-1.5 rounded-full bg-orange-500"/>}
                            </div>
                          </button>
                        );
                      }
                      return cells;
                    })()}
                  </div>
                </div>

                {/* Tasks & Bookings for Selected Date */}
                <div className="space-y-6">
                  {/* Selected Date Header */}
                  <div className="p-4 bg-white/5 border border-white/10 border-b-0 rounded-t-2xl flex justify-between items-center -mb-6">
                    <h3 className="font-heading text-lg">{new Date(selectedTaskDate).toLocaleDateString('en-US', {weekday:'long', month:'short', day:'numeric'})}</h3>
                  </div>

                  {/* Combined Timeline View */}
                  <div className="glass-card p-6 !rounded-t-none border-t border-white/10 max-h-[400px] overflow-y-auto space-y-6">
                    {(() => {
                        const dayBookings = bookings.filter(b => b.booking_date === selectedTaskDate && (b.status === 'confirmed' || b.status === 'completed'))
                          .map(b => ({ type: 'booking', time: getSlotLabel(b.slots[0]).split(' - ')[0], rawTime: b.slots[0], data: b }));
                        const dayTasks = tasks.filter(t => t.date === selectedTaskDate)
                          .map(t => ({ type: 'task', time: t.time, rawTime: parseInt((t.time||'0').split(':')[0]) + parseInt((t.time||'0').split(':')[1]||0)/60, data: t }));
                          
                        const allEvents = [...dayBookings, ...dayTasks].sort((a,b) => a.rawTime - b.rawTime);
                        
                        if (allEvents.length === 0) return <p className="text-white/30 text-xs text-center py-10 font-bold uppercase tracking-widest">No scheduled events</p>;
                        
                        return allEvents.map((ev, idx) => (
                           <div key={idx} className="flex gap-4">
                              <div className="w-14 flex-shrink-0 text-right pt-2 mt-0.5">
                                <span className={`text-[10px] font-black tracking-widest uppercase ${ev.type==='booking' ? 'text-blue-400' : 'text-orange-400'}`}>{ev.time}</span>
                              </div>
                              <div className="flex-1 border-l-2 border-white/10 pl-4 py-1 relative">
                                <div className={`absolute -left-[5px] top-3 w-2 h-2 rounded-full ${ev.type==='booking' ? 'bg-blue-400 shadow-[0_0_8px_#3b82f6]' : 'bg-orange-400 shadow-[0_0_8px_#f97316]'}`}/>
                                {ev.type === 'booking' ? (
                                   <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-xl">
                                      <p className="font-bold text-sm text-blue-100">{ev.data.customer_name} <span className="opacity-50 font-normal">({ev.data.guest_count} guests)</span></p>
                                      <p className="text-[10px] uppercase text-blue-400 mt-1 font-black">{ev.data.screen} · Slots: {formatSlotsDisplay(ev.data.slots)}</p>
                                   </div>
                                ) : (
                                   <div className={`flex items-center justify-between p-3 rounded-xl border ${ev.data.completed ? 'bg-green-500/5 text-white/40 border-green-500/10' : 'bg-orange-500/5 border-orange-500/20'}`}>
                                      <div className={`font-bold text-sm leading-tight ${ev.data.completed ? 'line-through' : 'text-orange-100'}`}>{ev.data.title}</div>
                                      <div className="flex items-center gap-2">
                                        <button onClick={()=>toggleTask(ev.data.id, ev.data.completed)} className={`border px-2 py-1 rounded text-[9px] uppercase font-black ${ev.data.completed ? 'text-green-500 border-green-500/30 hover:bg-green-500/10' : 'text-orange-400 border-orange-500/30 hover:bg-orange-500/20'}`}>
                                           {ev.data.completed ? 'Done' : 'Mark Done'}
                                        </button>
                                        <button onClick={()=>deleteTask(ev.data.id)} className="text-red-400/50 hover:text-red-400 transition-colors bg-red-500/10 p-1.5 rounded-md"><X size={12}/></button>
                                      </div>
                                   </div>
                                )}
                              </div>
                           </div>
                        ));
                    })()}
                  </div>

                  {/* Add New Task Form */}
                  <div className="glass-card p-5 !border-accent/30 space-y-3 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 blur-3xl -z-10 rounded-full"/>
                    <h4 className="text-[10px] uppercase tracking-widest font-black text-accent mb-2 flex items-center gap-1.5"><CheckSquare size={12}/>{selectedTaskDate} Schedule</h4>
                    <form onSubmit={addTask} className="flex flex-col sm:flex-row gap-2">
                      <input type="text" required placeholder="To-do element..." className="flex-1 bg-white/5 border border-white/10 px-3 py-2 text-sm rounded-xl outline-none focus:border-accent" value={taskForm.title} onChange={e=>setTaskForm({...taskForm,title:e.target.value})} />
                      <input type="time" required className="w-28 bg-white/5 border border-white/10 px-3 py-2 text-sm rounded-xl outline-none focus:border-accent text-white" value={taskForm.time} onChange={e=>setTaskForm({...taskForm,time:e.target.value})} />
                      <button className="gold-button !px-4 !py-2 !text-[10px] uppercase font-black"><Plus size={14}/></button>
                    </form>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ─── BOOKINGS ─── */}
          {view==='bookings' && (() => {
            const filtered = bookings.filter(b => {
              if (filterStatus !== 'all' && b.status !== filterStatus) return false;
              if (filterDate && b.booking_date !== filterDate) return false;
              return true;
            });
            return (
            <motion.div key="bk" initial={{opacity:0}} animate={{opacity:1}} className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-3xl font-heading">Reservations <span className="gold-text-gradient italic">Manifest</span></h2>
                <button onClick={()=>setShowBookingModal(true)} className="gold-button !px-5 !py-2.5 !text-xs flex items-center gap-2"><Plus size={14}/>Manual Book</button>
              </div>
              {/* Filters */}
              <div className="flex flex-wrap gap-2 items-center glass-card p-4">
                {['pending','confirmed','completed','cancelled','all'].map(s => {
                  const clsMap = {pending:'border-yellow-500/40 text-yellow-400 bg-yellow-500/10',confirmed:'border-blue-500/40 text-blue-400 bg-blue-500/10',completed:'border-green-500/40 text-green-400 bg-green-500/10',cancelled:'border-red-500/40 text-red-400 bg-red-500/10',all:'border-white/20 text-white/60 bg-white/5'};
                  const cnt = s==='all' ? bookings.length : bookings.filter(b=>b.status===s).length;
                  return (
                    <button key={s} onClick={()=>setFilterStatus(s)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border flex items-center gap-1.5 ${filterStatus===s ? (clsMap[s]||'bg-accent text-primary border-accent') : 'bg-white/5 border-white/10 text-white/30 hover:text-white'}`}
                    >{s} <span className="opacity-60">({cnt})</span></button>
                  );
                })}
                <div className="ml-auto flex items-center gap-2">
                  <input type="date" value={filterDate} onChange={e=>setFilterDate(e.target.value)} className="bg-white/5 border border-white/10 text-white text-xs rounded-lg px-3 py-2 outline-none" />
                  {filterDate && <button onClick={()=>setFilterDate('')} className="text-[9px] text-red-400 border border-red-500/20 px-2 py-1 rounded-lg">✕ Date</button>}
                </div>
              </div>
              <div className="space-y-3">
                {filtered.map(b=>{
                  const wa = editWaMobile[b.id] ?? b.customer_mobile;
                  return (
                  <div key={b.id} className="glass-card p-5">
                    <div className="flex flex-col md:flex-row justify-between gap-4">
                      <div className="flex-1">
                        <p className="text-accent text-[10px] font-black tracking-widest uppercase mb-1">#{b.id.slice(0,8)}</p>
                        <p className="font-bold">{b.customer_name} <span className="text-white/30 font-normal text-sm">· {b.customer_mobile}</span></p>
                        <p className="text-sm text-white/50 mt-1">{b.booking_date} · {b.screen||'Screen 1'} · {formatSlotsDisplay(b.slots)} · {b.guest_count} guests</p>
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          <p className="text-[10px] text-white/30">Total: ₹{b.final_price||b.price}</p>
                          {b.advance_paid!=null && <p className="text-[10px] text-green-400">Adv: ₹{b.advance_paid}</p>}
                          {b.remaining_amount!=null && <p className="text-[10px] text-yellow-400">Due: ₹{b.remaining_amount}</p>}
                          {b.cancel_reason && <p className="text-[10px] text-red-400">Reason: {b.cancel_reason}</p>}
                        </div>
                        {/* Editable WhatsApp number */}
                        <div className="flex items-center gap-2 mt-2">
                          <input type="tel" value={wa} onChange={e=>setEditWaMobile(p=>({...p,[b.id]:e.target.value}))}
                            className="bg-white/5 border border-white/10 text-white text-[10px] rounded-lg px-2 py-1 w-32 outline-none focus:border-accent" placeholder="WhatsApp No." maxLength={10}/>
                          <button onClick={()=>openAdminWhatsApp({ customerMobile:wa, customerName:b.customer_name, slots:b.slots||[], date:b.booking_date, guests:b.guest_count, totalAmount:b.final_price||b.price||0 })}
                            className="flex items-center gap-1 text-[9px] bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-1 rounded-lg font-black uppercase">
                            <Phone size={10}/> WhatsApp
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 items-end justify-center">
                        <StatusBadge s={b.status||'pending'}/>
                        {b.status==='pending' && (
                          <button onClick={()=>openAdvanceModal(b)} className="text-[9px] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-3 py-1.5 rounded-lg font-black uppercase">
                            Confirm + Advance
                          </button>
                        )}
                        {b.status==='confirmed' && (
                          <button onClick={()=>openDueModal(b)} className="text-[9px] bg-green-500/20 text-green-400 border border-green-500/30 px-3 py-1.5 rounded-lg font-black uppercase">
                            Mark Completed
                          </button>
                        )}
                        {b.status!=='cancelled' && b.status!=='completed' && (
                          <button onClick={()=>openCancelModal(b.id,'booking')} className="text-[9px] bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg font-black uppercase">Cancel</button>
                        )}
                        <div className="flex items-center gap-2">
                          {editPrice[b.id]!==undefined
                            ? <><input type="number" className="bg-white/5 border border-accent/40 text-white text-xs rounded-lg px-2 py-1 w-24 outline-none" value={editPrice[b.id]} onChange={e=>setEditPrice(p=>({...p,[b.id]:e.target.value}))}/>
                                <button onClick={()=>updateBookingPrice(b.id,editPrice[b.id])} className="text-[9px] bg-accent text-primary px-2 py-1 rounded-lg font-black uppercase">Save</button>
                                <button onClick={()=>setEditPrice(p=>({...p,[b.id]:undefined}))} className="text-[9px] text-white/30 px-1">✕</button></>
                            : <button onClick={()=>setEditPrice(p=>({...p,[b.id]:b.final_price||b.price||0}))} className="text-[9px] uppercase tracking-widest text-accent/70 hover:text-accent font-black border border-accent/20 px-2 py-1 rounded-lg">Edit Price</button>
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                )})}
              </div>
            </motion.div>
            );
          })()}

          {/* ─── SLOT CONTROL ─── */}
          {view==='slots' && (
            <motion.div key="sl" initial={{opacity:0}} animate={{opacity:1}} className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-3xl font-heading">Slot <span className="gold-text-gradient italic">Control</span></h2>
                <select className="bg-white/5 border border-white/10 p-2.5 rounded-lg outline-none text-white text-[10px] py-3 uppercase tracking-widest font-bold" value={slotScreen} onChange={e=>setSlotScreen(e.target.value)}>
                  {['Screen 1', 'Screen 2', 'TV Screen'].map(s=><option key={s} value={s} className="bg-primary">{s}</option>)}
                </select>
              </div>
              <div className="glass-card p-6">
                <div className="flex gap-3 overflow-x-auto pb-3">
                  {availableDates.map(date=>{const d=new Date(date+'T00:00:00');const sel=date===slotDate;return(
                    <button key={date} onClick={()=>setSlotDate(date)} className={`flex-shrink-0 flex flex-col items-center p-3 rounded-xl border min-w-[60px] transition-all ${sel?'bg-accent border-accent text-primary':'bg-white/5 border-white/10 hover:border-accent/30'}`}>
                      <span className="text-[9px] uppercase font-black">{d.toLocaleDateString('en',{weekday:'short'})}</span>
                      <span className="text-lg font-heading font-bold">{d.getDate()}</span>
                    </button>
                  );})}
                </div>
                <div className="mt-6 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                  {SLOT_HOURS.map(h=>{const s=slotStatus[h];return(
                    <div key={h} className={`p-4 rounded-2xl border text-center transition-all ${s==='booked'?'bg-red-500/10 border-red-500/30 text-red-400 cursor-not-allowed':s==='closed'?'bg-gray-800 border-gray-600 text-gray-500':'bg-white/5 border-white/10 text-white'}`}>
                      <div className="font-heading font-bold">{getSlotLabel(h).split(' - ')[0]}</div>
                      <div className="text-[9px] uppercase tracking-widest mt-1 opacity-60 mb-3">{s||'available'}</div>
                      {s!=='booked' && <button onClick={()=>toggleCloseSlot(h)} className={`text-[8px] uppercase tracking-widest font-black px-3 py-1 rounded-full w-full border ${s==='closed'?'bg-green-500/20 text-green-500 border-green-500/20':'bg-red-500/20 text-red-500 border-red-500/20'}`}>{s==='closed'?'Open':'Close'}</button>}
                    </div>
                  );})}
                </div>
              </div>
            </motion.div>
          )}

          {/* ─── FOOD ORDERS ─── */}
          {view==='orders' && (
            <motion.div key="or" initial={{opacity:0}} animate={{opacity:1}} className="space-y-6">
              <h2 className="text-3xl font-heading">Food <span className="gold-text-gradient italic">Orders</span></h2>
              <div className="space-y-4">
                {foodOrders.map(o=>(
                  <div key={o.id} className="glass-card p-5">
                    <div className="flex flex-col md:flex-row justify-between gap-4">
                      <div className="flex-1">
                        <p className="text-accent text-[10px] font-black tracking-widest uppercase mb-1">#{o.id.slice(0,8)}</p>
                        <p className="font-bold">{o.customer_name} <span className="text-white/30 font-normal text-sm">· {o.customer_mobile}</span></p>
                        <div className="space-y-1 mt-2">
                          {(o.items||[]).map((item,i)=><p key={i} className="text-sm text-white/60">{item.qty}× {item.name} — ₹{item.price*item.qty}</p>)}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                          <p className="text-[10px] text-white/30">Original: ₹{o.original_price||o.total}</p>
                          <p className="text-sm font-bold text-accent">Final: ₹{o.final_price||o.total}</p>
                          {o.cancel_reason && <p className="text-[10px] text-red-400">Reason: {o.cancel_reason}</p>}
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 items-end justify-center">
                        <StatusBadge s={o.status||'pending'}/>
                        <select value={o.status||'pending'} onChange={e=>updateOrderStatusWithNotif(o.id,e.target.value)}
                          className="bg-white/5 border border-white/10 text-white text-xs rounded-lg px-3 py-1.5 outline-none">
                          {ORDER_STATUSES.map(s=><option key={s} value={s} className="bg-[#05071A]">{s}</option>)}
                        </select>
                        {o.status!=='cancelled' && o.status!=='served' && (
                          <button onClick={()=>openCancelModal(o.id,'order')} className="text-[9px] bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg font-black uppercase">Cancel</button>
                        )}
                        <div className="flex items-center gap-2">
                          {editPrice['o_'+o.id]!==undefined
                            ? <><input type="number" className="bg-white/5 border border-accent/40 text-white text-xs rounded-lg px-2 py-1 w-24 outline-none" value={editPrice['o_'+o.id]} onChange={e=>setEditPrice(p=>({...p,['o_'+o.id]:e.target.value}))}/>
                                <button onClick={()=>updateOrderPrice(o.id,editPrice['o_'+o.id])} className="text-[9px] bg-accent text-primary px-2 py-1 rounded-lg font-black uppercase">Save</button>
                                <button onClick={()=>setEditPrice(p=>({...p,['o_'+o.id]:undefined}))} className="text-[9px] text-white/30 px-1">✕</button></>
                            : <button onClick={()=>setEditPrice(p=>({...p,['o_'+o.id]:o.final_price||o.total||0}))} className="text-[9px] uppercase tracking-widest text-accent/70 hover:text-accent font-black border border-accent/20 px-2 py-1 rounded-lg">Edit Price</button>
                          }
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ─── MENU ─── */}
          {view==='menu' && (
            <motion.div key="mn" initial={{opacity:0}} animate={{opacity:1}} className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-3xl font-heading">Menu <span className="gold-text-gradient italic">Catalog</span></h2>
                <div className="flex gap-2 flex-wrap">
                  <button onClick={()=>setShowAddCategory(!showAddCategory)} className="glass-card border-white/10 !px-4 !py-2 text-xs flex items-center gap-2 hover:bg-white/5 transition-colors">
                    <Plus size={13} className="text-accent"/> New Category
                  </button>
                  <button onClick={()=>{
                    setMenuForm({id:'',name:'',category:menuCategories[0]||'Drinks',member_price:'',non_member_price:'',image_url:''});
                    setImageFile(null); setImagePreview(''); setIsEditingMenu(false); setShowMenuModal(true);
                  }} className="gold-button !px-5 !py-2.5 !text-xs flex items-center gap-2"><Plus size={14}/>Add Item</button>
                </div>
              </div>

              {/* Add Category Inline Panel */}
              <AnimatePresence>
                {showAddCategory && (
                  <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:'auto'}} exit={{opacity:0,height:0}}
                    className="glass-card p-5 border-accent/20 overflow-hidden"
                  >
                    <p className="text-[10px] uppercase tracking-widest text-accent font-black mb-4">Manage Categories</p>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {menuCategories.map(cat => (
                        <div key={cat} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-xs">
                          <span>{cat}</span>
                          <button onClick={()=>deleteCategory(cat)} className="text-red-400 hover:text-red-300 ml-1">
                            <X size={11}/>
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-3">
                      <input
                        type="text" placeholder="New category name..."
                        value={newCategory} onChange={e=>setNewCategory(e.target.value)}
                        onKeyDown={e=>e.key==='Enter'&&saveCategory()}
                        className="flex-1 bg-white/5 border border-white/10 px-4 py-2.5 rounded-xl outline-none focus:border-accent text-sm"
                      />
                      <button onClick={saveCategory} className="gold-button !px-5 !py-2 !text-[10px] font-black">Add</button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Category Filter Tabs */}
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                {['All', ...menuCategories].map(c => (
                  <button key={c} onClick={()=>setMenuCatFilter(c)}
                    className={`px-4 py-2 rounded-xl border whitespace-nowrap text-xs font-bold transition-all flex-shrink-0 ${menuCatFilter===c ? 'bg-accent border-accent text-primary' : 'bg-white/5 border-white/10 text-white/50 hover:text-white'}`}
                  >{c} ({c==='All' ? menuItems.length : menuItems.filter(m=>m.category===c).length})</button>
                ))}
              </div>

              {/* Menu Items Table */}
              <div className="glass-card overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-white/5 border-b border-white/5">
                    <tr>{['Image & Item','Category','Member Price','Non-Member Price','Actions'].map(h=><th key={h} className="p-4 text-[9px] uppercase tracking-[0.2em] text-white/40 whitespace-nowrap">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {menuItems
                      .filter(m => menuCatFilter==='All' || m.category===menuCatFilter)
                      .map(m => (
                      <tr key={m.id} className="border-t border-white/5 hover:bg-white/[0.02] transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            {m.image_url
                              ? <img src={m.image_url} alt={m.name} className="w-12 h-12 rounded-xl object-cover border border-white/10" />
                              : <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center border border-white/10"><ImageIcon size={16} className="text-white/20"/></div>
                            }
                            <span className="font-medium text-sm">{m.name}</span>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className="px-2 py-1 bg-accent/10 border border-accent/20 rounded-full text-[9px] font-black uppercase tracking-widest text-accent">{m.category}</span>
                        </td>
                        <td className="p-4 text-accent font-bold">₹{m.member_price}</td>
                        <td className="p-4 text-white/60">₹{m.non_member_price}</td>
                        <td className="p-4">
                           <div className="flex gap-2">
                             <button onClick={()=>{
                               setMenuForm(m); setImagePreview(m.image_url||''); setImageFile(null);
                               setIsEditingMenu(true); setShowMenuModal(true);
                             }} className="bg-blue-500/20 text-blue-400 border border-blue-500/20 px-3 py-1 text-[9px] rounded-lg uppercase tracking-widest font-bold hover:bg-blue-500/30 transition-colors">Edit</button>
                             <button onClick={()=>deleteMenu(m.id)} className="bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1 text-[9px] rounded-lg uppercase tracking-widest font-bold hover:bg-red-500/20 transition-colors">Delete</button>
                           </div>
                        </td>
                      </tr>
                    ))}
                    {menuItems.filter(m=>menuCatFilter==='All'||m.category===menuCatFilter).length===0 && (
                      <tr><td colSpan={5} className="p-12 text-center text-white/20 text-sm">No items in this category</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* ─── MEMBERS ─── */}
          {view==='members' && (
            <motion.div key="mem" initial={{opacity:0}} animate={{opacity:1}} className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h2 className="text-3xl font-heading">Members <span className="gold-text-gradient italic">Registry</span></h2>
                <div className="flex gap-2 flex-wrap">
                  {['all','gold','silver','non_member'].map(f => (
                    <button key={f} onClick={()=>setMemberFilter(f)}
                      className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg border transition-all ${memberFilter===f ? 'bg-accent text-primary border-accent' : 'bg-white/5 border-white/10 text-white/40 hover:text-white'}`}
                    >{f.replace('_',' ')}</button>
                  ))}
                </div>
              </div>
              <div className="glass-card overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-white/5 border-b border-white/5">
                    <tr>{['Name','Mobile','Membership','Bookings','Total Spend'].map(h => <th key={h} className="p-4 text-[9px] uppercase tracking-[0.2em] text-white/40 whitespace-nowrap">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {customers
                      .filter(c => memberFilter==='all' || c.membership_type===memberFilter)
                      .sort((a,b) => (memberSpend[b.id]||0) - (memberSpend[a.id]||0))
                      .map(c => (
                      <tr key={c.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                        <td className="p-4 font-medium">{c.name}</td>
                        <td className="p-4 text-white/50 text-sm">{c.mobile_number}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${c.membership_type==='gold' ? 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' : c.membership_type==='silver' ? 'text-gray-300 border-white/20 bg-white/5' : 'text-white/30 border-white/10 bg-white/5'}`}>
                            {c.membership_type?.replace('_',' ') || 'Non-Member'}
                          </span>
                        </td>
                        <td className="p-4 text-accent font-bold">{memberBookings[c.id]||0}</td>
                        <td className="p-4 font-bold gold-text-gradient">₹{memberSpend[c.id]||0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {customers.filter(c => memberFilter==='all' || c.membership_type===memberFilter).length === 0 && (
                  <p className="text-center text-white/30 text-sm py-12">No customers found</p>
                )}
              </div>
            </motion.div>
          )}

          {/* ─── EXPENSES ─── */}
          {view==='expenses' && (
            <motion.div key="ex" initial={{opacity:0}} animate={{opacity:1}} className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-3xl font-heading">Expenses <span className="gold-text-gradient italic">Ledger</span></h2>
                <button onClick={()=>setShowExpenseModal(true)} className="gold-button !px-5 !py-2.5 !text-xs flex items-center gap-2"><Plus size={14}/>Log Expense</button>
              </div>
              <div className="glass-card overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-white/5 border-b border-white/5"><tr>{['Title','Amount','Date'].map(h=><th key={h} className="p-4 text-[9px] uppercase tracking-[0.2em] text-white/40">{h}</th>)}</tr></thead>
                  <tbody>{expenses.map((e,i)=><tr key={i} className="border-t border-white/5 hover:bg-white/[0.02]"><td className="p-4 font-medium text-sm">{e.title}</td><td className="p-4 text-red-400 font-bold">₹{e.amount}</td><td className="p-4 text-white/40 text-sm">{e.date}</td></tr>)}</tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* ─── ANALYTICS ─── */}
          {view==='analytics' && (
            <motion.div key="an" initial={{opacity:0}} animate={{opacity:1}} className="space-y-6">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-3xl font-heading">Analytics <span className="gold-text-gradient italic">Report</span></h2>
                <div className="flex gap-3 items-center flex-wrap">
                  <select value={analyticsMonth} onChange={e=>setAnalyticsMonth(Number(e.target.value))} className="bg-white/5 border border-white/10 text-white text-xs rounded-xl px-4 py-2 outline-none">
                    {MONTHS.map((m,i)=><option key={i} value={i} className="bg-[#05071A]">{m}</option>)}
                  </select>
                  <select value={analyticsYear} onChange={e=>setAnalyticsYear(Number(e.target.value))} className="bg-white/5 border border-white/10 text-white text-xs rounded-xl px-4 py-2 outline-none">
                    {[2024,2025,2026,2027].map(y=><option key={y} value={y} className="bg-[#05071A]">{y}</option>)}
                  </select>
                  <button onClick={()=>exportAnalyticsExcel(analyticsData.rows,analyticsData.bookingDetails,analyticsData.foodDetails,`${MONTHS[analyticsMonth]} ${analyticsYear}`,analyticsData.totalExpenses)}
                    className="gold-button !px-5 !py-2 !text-[10px] flex items-center gap-2">
                    ⬇ Download Excel
                  </button>
                </div>
              </div>

              {/* Summary */}
              {analyticsData.rows.length>0 && (() => {
                const totB=analyticsData.rows.reduce((s,r)=>s+r.bookingTotal,0);
                const totF=analyticsData.rows.reduce((s,r)=>s+r.foodTotal,0);
                const grand=totB+totF;
                return(
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="navy-card p-5"><p className="text-[9px] uppercase text-white/30 font-black mb-1">Booking Revenue</p><h3 className="text-xl font-heading text-blue-400 font-black">₹{totB}</h3></div>
                    <div className="navy-card p-5"><p className="text-[9px] uppercase text-white/30 font-black mb-1">Food Revenue</p><h3 className="text-xl font-heading text-orange-400 font-black">₹{totF}</h3></div>
                    <div className="navy-card p-5"><p className="text-[9px] uppercase text-white/30 font-black mb-1">Total Expenses</p><h3 className="text-xl font-heading text-red-400 font-black">₹{analyticsData.totalExpenses}</h3></div>
                    <div className="navy-card p-5 border-accent/30 bg-accent/5"><p className="text-[9px] uppercase text-white/30 font-black mb-1">Net Profit</p><h3 className="text-xl font-heading gold-text-gradient font-black">₹{grand-analyticsData.totalExpenses}</h3></div>
                  </div>
                );
              })()}

              {/* Daily Table */}
              <div className="glass-card overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-white/5 border-b border-white/5">
                    <tr>{['Date','Booking Revenue','Food Revenue','Grand Total'].map(h=><th key={h} className="p-4 text-[9px] uppercase tracking-[0.2em] text-white/40">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {analyticsData.rows.length===0
                      ? <tr><td colSpan={4} className="p-8 text-center text-white/30 text-sm">No data for this month</td></tr>
                      : analyticsData.rows.map(r=>(
                          <tr key={r.date} className="border-t border-white/5 hover:bg-white/[0.02]">
                            <td className="p-4 font-medium text-sm">{new Date(r.date+'T00:00:00').toLocaleDateString('en',{day:'numeric',month:'short',weekday:'short'})}</td>
                            <td className="p-4 text-blue-400 font-bold">₹{r.bookingTotal}</td>
                            <td className="p-4 text-orange-400 font-bold">₹{r.foodTotal}</td>
                            <td className="p-4 font-black gold-text-gradient">₹{r.total}</td>
                          </tr>
                        ))
                    }
                    {analyticsData.rows.length>0 && (() => {
                      const totB=analyticsData.rows.reduce((s,r)=>s+r.bookingTotal,0);
                      const totF=analyticsData.rows.reduce((s,r)=>s+r.foodTotal,0);
                      return(
                        <tr className="border-t-2 border-accent/30 bg-accent/5">
                          <td className="p-4 font-black text-sm uppercase tracking-widest">TOTAL</td>
                          <td className="p-4 font-black text-blue-400">₹{totB}</td>
                          <td className="p-4 font-black text-orange-400">₹{totF}</td>
                          <td className="p-4 font-black gold-text-gradient text-lg">₹{totB+totF}</td>
                        </tr>
                      );
                    })()}
                  </tbody>
                </table>
              </div>

              {/* Top Performers */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <div className="glass-card p-6">
                  <h3 className="text-sm font-black uppercase tracking-widest text-accent mb-4">Top Slots</h3>
                  {analyticsData.topSlots && analyticsData.topSlots.length > 0 ? (
                    <div className="space-y-3">
                      {analyticsData.topSlots.map((ts, i) => (
                        <div key={i} className="flex justify-between items-center text-sm p-3 bg-white/5 rounded-lg border border-white/10">
                          <span className="font-bold">{ts.name}</span>
                          <span className="text-white/50 text-[10px] uppercase font-black">{ts.count} Bookings</span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-white/30 text-xs">No slot data available.</p>}
                </div>
                <div className="glass-card p-6">
                  <h3 className="text-sm font-black uppercase tracking-widest text-accent mb-4">Top Food Items</h3>
                  {analyticsData.topFood && analyticsData.topFood.length > 0 ? (
                    <div className="space-y-3">
                      {analyticsData.topFood.map((tf, i) => (
                        <div key={i} className="flex justify-between items-center text-sm p-3 bg-white/5 rounded-lg border border-white/10">
                          <span className="font-bold">{tf.name}</span>
                          <span className="text-white/50 text-[10px] uppercase font-black">{tf.count} Orders</span>
                        </div>
                      ))}
                    </div>
                  ) : <p className="text-white/30 text-xs">No food data available.</p>}
                </div>
              </div>

            </motion.div>
          )}

          {/* ─── SETTINGS ─── */}
          {view==='settings' && (
            <motion.div key="st" initial={{opacity:0}} animate={{opacity:1}} className="space-y-8 max-w-2xl">
              <h2 className="text-3xl font-heading">System <span className="gold-text-gradient italic">Settings</span></h2>
              <div className="glass-card p-8 space-y-6">
                <div>
                  <h3 className="text-sm uppercase tracking-widest font-black text-accent mb-1 flex items-center gap-2"><MessageCircle size={14}/>WhatsApp Number</h3>
                  <p className="text-[10px] text-white/30 mb-4">All WhatsApp messages will go to this number.</p>
                  <div className="flex gap-3">
                    <input type="tel" value={waInput} onChange={e=>setWaInput(e.target.value.replace(/\D/g,''))} maxLength={10}
                      className="flex-1 bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-accent text-xl tracking-widest text-center font-heading"
                      placeholder="10-digit number"/>
                    <button onClick={saveSettings} className="gold-button !px-6 !py-4 !text-[10px] font-black uppercase tracking-widest">Save</button>
                  </div>
                  <p className="text-[10px] text-white/20 mt-3">Current: +91 {waNumber}</p>
                </div>

                {/* Screen Management */}
                <div className="pt-6 border-t border-white/10">
                  <h3 className="text-sm uppercase tracking-widest font-black text-accent mb-4 flex items-center gap-2"><Monitor size={14}/>Screen Management</h3>
                  <div className="space-y-3">
                    {screens.map(screen => (
                      <div key={screen} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                        <span className="font-medium text-sm">{screen}</span>
                        {!['Screen 1','Screen 2','TV Screen'].includes(screen) && (
                          <button onClick={async () => {
                            const updated = screens.filter(s => s!==screen);
                            const updMap = {}; updated.forEach(s => { updMap[s] = pricingMap[s] || {gold:299,silver:399,non_member:499}; });
                            setScreens(updated); setPricingMap(updMap);
                            await setDoc(doc(db,'pricing','rates'),{screens:updMap});
                          }} className="text-red-400 hover:text-red-300 p-1">
                            <Trash2 size={14}/>
                          </button>
                        )}
                      </div>
                    ))}
                    <div className="flex gap-3 mt-2">
                      <input type="text" placeholder="New screen name..." value={newScreenName} onChange={e=>setNewScreenName(e.target.value)}
                        className="flex-1 bg-white/5 border border-white/10 p-3 rounded-xl outline-none focus:border-accent text-sm"/>
                      <button onClick={async () => {
                        if (!newScreenName.trim()) return;
                        const s = newScreenName.trim();
                        const updated = [...screens, s];
                        const updMap = {...pricingMap, [s]: {gold:299,silver:399,non_member:499}};
                        setScreens(updated); setPricingMap(updMap); setNewScreenName('');
                        await setDoc(doc(db,'pricing','rates'),{screens:updMap});
                      }} className="gold-button !px-4 !py-3 !text-[10px] font-black">
                        <Plus size={14}/>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-white/10">
                  <h3 className="text-sm uppercase tracking-widest font-black text-accent mb-4">Slot Pricing per Screen</h3>
                  <div className="space-y-4">
                    {screens.map(screen => (
                      <div key={screen} className="border border-white/10 rounded-xl p-4 bg-white/[0.02]">
                        <p className="font-heading font-black mb-3">{screen}</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div><p className="text-[9px] uppercase tracking-widest text-white/40 mb-1">Non-Member</p>
                            <input type="number" className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm rounded-lg outline-none focus:border-accent" value={(pricingMap[screen]||{}).non_member||499} onChange={e=>setPricingMap(p=>({...p,[screen]:{...(p[screen]||{}),non_member:Number(e.target.value)}}))} /></div>
                          <div><p className="text-[9px] uppercase tracking-widest text-white/40 mb-1">Silver</p>
                            <input type="number" className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm text-gray-300 rounded-lg outline-none focus:border-accent" value={(pricingMap[screen]||{}).silver||399} onChange={e=>setPricingMap(p=>({...p,[screen]:{...(p[screen]||{}),silver:Number(e.target.value)}}))} /></div>
                          <div><p className="text-[9px] uppercase tracking-widest text-white/40 mb-1">Gold</p>
                            <input type="number" className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm gold-text-gradient rounded-lg outline-none focus:border-accent" value={(pricingMap[screen]||{}).gold||299} onChange={e=>setPricingMap(p=>({...p,[screen]:{...(p[screen]||{}),gold:Number(e.target.value)}}))} /></div>
                          <div><p className="text-[9px] uppercase tracking-widest text-accent mb-1 font-black">Max Guests</p>
                            <input type="number" className="w-full bg-accent/10 border border-accent/20 px-3 py-2 text-sm text-accent rounded-lg outline-none focus:border-accent" value={(pricingMap[screen]||{}).max_guests||6} onChange={e=>setPricingMap(p=>({...p,[screen]:{...(p[screen]||{}),max_guests:Number(e.target.value)}}))} /></div>
                        </div>
                      </div>
                    ))}
                    <button onClick={savePricing} className="gold-button w-full mt-2 !px-4 !py-3 !text-[10px] font-black uppercase tracking-widest">Save Pricing</button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ─── ADMINS ─── */}
          {view==='admins' && (
            <motion.div key="ad" initial={{opacity:0}} animate={{opacity:1}} className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-3xl font-heading">Administrators <span className="gold-text-gradient italic">Council</span></h2>
                <button onClick={()=>setShowAdminModal(true)} className="gold-button !px-5 !py-2.5 !text-xs flex items-center gap-2"><Plus size={14}/>Add Admin</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="navy-card !p-6 border-green-500/20 bg-green-500/5">
                  <div className="flex justify-between items-start mb-4"><div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-accent"><Lock size={18}/></div><div className="bg-green-500/20 text-green-500 px-2 py-1 rounded-full text-[8px] font-black uppercase border border-green-500/30">Root</div></div>
                  <h4 className="text-lg font-heading mb-1">Super Admin</h4><p className="text-xs text-white/20">9479810400</p><p className="text-[9px] text-green-500/40 mt-2">Cannot be removed</p>
                </div>
                {admins.map(a=>(
                  <div key={a.id} className="navy-card !p-6 relative group">
                    <button onClick={()=>deleteAdmin(a.id)} className="absolute top-4 right-4 text-white/10 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"><X size={18}/></button>
                    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-accent mb-4"><Shield size={18}/></div>
                    <h4 className="text-lg font-heading mb-1">{a.name}</h4><p className="text-xs text-white/20">{a.mobile}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* ─── MODALS ─── */}

      {/* Expense Modal */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={()=>setShowExpenseModal(false)}/>
          <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} className="glass-card !bg-[#05071A] p-8 max-w-md w-full relative z-10 border-accent/20 space-y-5">
            <h3 className="text-2xl font-heading text-red-400">Log Expense</h3>
            <form onSubmit={logExpense} className="space-y-4">
              <input type="text" required placeholder="Expense Title" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-red-400 text-sm" value={expenseForm.title} onChange={e=>setExpenseForm({...expenseForm,title:e.target.value})}/>
              <input type="number" required placeholder="Amount (₹)" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-red-400 text-sm" value={expenseForm.amount} onChange={e=>setExpenseForm({...expenseForm,amount:e.target.value})}/>
              <input type="date" required className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-red-400 text-sm" value={expenseForm.date} onChange={e=>setExpenseForm({...expenseForm,date:e.target.value})}/>
              <button className="w-full bg-red-500/10 text-red-400 border border-red-500/20 py-4 rounded-xl font-bold uppercase tracking-widest text-[10px]">Submit Expense</button>
            </form>
          </motion.div>
        </div>
      )}

      {/* Menu Modal */}
      {showMenuModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={()=>setShowMenuModal(false)}/>
          <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}}
            className="glass-card !bg-[#05071A] p-8 max-w-lg w-full relative z-10 border-accent/20 max-h-[95vh] overflow-y-auto"
          >
            <h3 className="text-2xl font-heading gold-text-gradient mb-6">
              {isEditingMenu ? '✏️ Edit Menu Item' : '➕ Add Menu Item'}
            </h3>
            <form onSubmit={saveMenu} className="space-y-5">
              {/* Item name */}
              <div className="space-y-1.5">
                <label className="text-[9px] uppercase tracking-widest text-white/40 font-black">Item Name *</label>
                <input type="text" required placeholder="e.g. Cold Coffee, Peri Peri Fries"
                  className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-accent text-sm"
                  value={menuForm.name} onChange={e=>setMenuForm({...menuForm,name:e.target.value})}
                />
              </div>

              {/* Image upload */}
              <div className="space-y-2">
                <label className="text-[9px] uppercase tracking-widest text-white/40 font-black">Item Photo</label>
                <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleImageSelect} />
                {imagePreview || menuForm.image_url ? (
                  <div className="relative group">
                    <img
                      src={imagePreview || menuForm.image_url}
                      alt="preview"
                      className="w-full h-40 object-cover rounded-2xl border border-white/10"
                    />
                    <button
                      type="button"
                      onClick={()=>{ setImageFile(null); setImagePreview(''); setMenuForm(f=>({...f,image_url:''})); if(fileInputRef.current) fileInputRef.current.value=''; }}
                      className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1.5 hover:bg-red-500 transition-colors"
                    ><X size={14}/></button>
                    <button type="button" onClick={()=>fileInputRef.current?.click()}
                      className="absolute bottom-2 right-2 bg-black/70 text-white text-[9px] uppercase tracking-widest font-black px-3 py-1.5 rounded-xl border border-white/20 hover:bg-accent hover:text-primary transition-all"
                    >Change Photo</button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={()=>fileInputRef.current?.click()}
                    className="w-full h-32 border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center gap-3 hover:border-accent/40 hover:bg-white/5 transition-all group"
                  >
                    <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                      <Upload size={18} className="text-accent"/>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-bold text-white/60">Click to upload image</p>
                      <p className="text-[9px] text-white/20 mt-0.5">PNG, JPG, WEBP • Max 5MB</p>
                    </div>
                  </button>
                )}
                {imageUploading && (
                  <div className="space-y-1.5">
                    <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full bg-accent rounded-full transition-all duration-200" style={{width:`${uploadProgress}%`}}/>
                    </div>
                    <p className="text-[9px] text-accent text-center">Uploading... {uploadProgress}%</p>
                  </div>
                )}
              </div>

              {/* Category */}
              <div className="space-y-1.5">
                <label className="text-[9px] uppercase tracking-widest text-white/40 font-black">Category *</label>
                <select required
                  className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none text-white text-sm"
                  value={menuForm.category}
                  onChange={e=>setMenuForm({...menuForm,category:e.target.value})}
                >
                  {menuCategories.map(c=><option key={c} value={c} className="bg-[#05071A]">{c}</option>)}
                </select>
                <p className="text-[9px] text-white/20">Add new categories from the Menu tab ("New Category" button).</p>
              </div>

              {/* Pricing */}
              <div className="space-y-1.5">
                <label className="text-[9px] uppercase tracking-widest text-white/40 font-black">Pricing (₹) *</label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[9px] text-accent/60 mb-1.5">Member Price</p>
                    <input type="number" required placeholder="e.g. 150"
                      className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-accent text-sm"
                      value={menuForm.member_price} onChange={e=>setMenuForm({...menuForm,member_price:e.target.value})}
                    />
                  </div>
                  <div>
                    <p className="text-[9px] text-white/40 mb-1.5">Non-Member Price</p>
                    <input type="number" required placeholder="e.g. 200"
                      className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-accent text-sm"
                      value={menuForm.non_member_price} onChange={e=>setMenuForm({...menuForm,non_member_price:e.target.value})}
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={()=>setShowMenuModal(false)}
                  className="flex-1 py-4 rounded-xl border border-white/10 text-white/40 text-[10px] uppercase font-black hover:bg-white/5 transition-colors"
                >Cancel</button>
                <button type="submit" disabled={imageUploading}
                  className="flex-1 gold-button !py-4 !text-[10px] uppercase font-black"
                >
                  {imageUploading ? `Uploading ${uploadProgress}%...` : isEditingMenu ? 'Update Item' : 'Save to Menu'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Manual Booking Modal */}
      {showBookingModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={()=>setShowBookingModal(false)}/>
          <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} className="glass-card !bg-[#05071A] p-8 max-w-2xl w-full relative z-10 border-accent/20 max-h-[90vh] overflow-y-auto space-y-5">
            <h3 className="text-2xl font-heading gold-text-gradient">Manual Booking</h3>
            <form onSubmit={manualBooking} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <input type="text" required placeholder="Guest Name" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-accent text-sm" value={bookingForm.name} onChange={e=>setBookingForm({...bookingForm,name:e.target.value})}/>
                <input type="tel" required placeholder="Mobile" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-accent text-sm" value={bookingForm.mobile} onChange={e=>setBookingForm({...bookingForm,mobile:e.target.value})}/>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="date" required className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-accent text-sm custom-date-input text-white" value={bookingForm.date} onChange={e=>setBookingForm({...bookingForm,date:e.target.value,slots:[]})}/>
                <select className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-accent text-sm text-white" value={bookingForm.screen} onChange={e=>setBookingForm({...bookingForm,screen:e.target.value,slots:[]})}>
                  {['Screen 1', 'Screen 2', 'TV Screen'].map(s=><option key={s} value={s} className="bg-primary">{s}</option>)}
                </select>
              </div>
              <input type="number" required placeholder="Guest Count" min="1" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-accent text-sm" value={bookingForm.guest_count} onChange={e=>setBookingForm({...bookingForm,guest_count:e.target.value})}/>
              <div className="border-t border-white/10 pt-4">
                <p className="text-[10px] uppercase tracking-widest text-white/40 mb-3">Select Slots</p>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {SLOT_HOURS.map(h=>{const st=bookingSlotStatus[h];const isSel=bookingForm.slots.includes(h);const isAv=st==='available'||!st;return(
                    <button type="button" key={h} disabled={!isAv} onClick={()=>{if(!isAv)return;setBookingForm(p=>({...p,slots:p.slots.includes(h)?p.slots.filter(s=>s!==h):[...p.slots,h]}));}}
                      className={`p-3 rounded-xl border text-center text-[11px] font-bold transition-all ${isSel?'bg-accent border-accent text-primary':isAv?'bg-white/5 border-white/10':'opacity-30 bg-black/20 border-transparent cursor-not-allowed'}`}>
                      {getSlotLabel(h).split(' - ')[0]}
                    </button>
                  );})}
                </div>
              </div>
              <button className="gold-button w-full py-4 !text-[10px] uppercase tracking-[0.2em] font-black">Confirm Booking</button>
            </form>
          </motion.div>
        </div>
      )}

      {/* Admin Modal */}
      {showAdminModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={()=>setShowAdminModal(false)}/>
          <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} className="glass-card !bg-[#05071A] p-8 max-w-md w-full relative z-10 border-accent/20 space-y-5">
            <h3 className="text-2xl font-heading gold-text-gradient">Add Administrator</h3>
            <form onSubmit={saveAdmin} className="space-y-4">
              <input type="text" required placeholder="Name" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-accent text-sm" value={adminForm.name} onChange={e=>setAdminForm({...adminForm,name:e.target.value})}/>
              <input type="tel" required placeholder="Mobile Number" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-accent text-sm" value={adminForm.mobile} onChange={e=>setAdminForm({...adminForm,mobile:e.target.value})}/>
              <input type="text" required placeholder="Password" minLength="6" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-accent text-sm" value={adminForm.password} onChange={e=>setAdminForm({...adminForm,password:e.target.value})}/>
              <button className="gold-button w-full py-4 !text-[10px] uppercase font-black">Grant Access</button>
            </form>
          </motion.div>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={()=>setShowCancelModal(false)}/>
          <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} className="glass-card !bg-[#05071A] p-8 max-w-md w-full relative z-10 border-red-500/20 space-y-5">
            <h3 className="text-2xl font-heading text-red-400">Cancel {cancelTarget?.type==='booking' ? 'Booking' : 'Order'}</h3>
            <p className="text-sm text-white/40">Please provide a reason for cancellation. This will be sent to the customer.</p>
            <div className="space-y-4">
              <textarea rows={3} value={cancelReason} onChange={e=>setCancelReason(e.target.value)}
                placeholder="Enter cancellation reason..."
                className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-red-400 text-sm resize-none"/>
              <div className="flex gap-3">
                <button onClick={()=>setShowCancelModal(false)} className="flex-1 py-3 rounded-xl border border-white/10 text-white/40 text-[10px] uppercase font-black">Back</button>
                <button onClick={confirmCancel} className="flex-1 bg-red-500/20 text-red-400 border border-red-500/30 py-3 rounded-xl font-black uppercase tracking-widest text-[10px]">Confirm Cancel</button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Due Amount Modal */}
      {showDueModal && dueTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={()=>setShowDueModal(false)}/>
          <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} className="glass-card !bg-[#05071A] p-8 max-w-md w-full relative z-10 border-green-500/20 space-y-5">
            <h3 className="text-2xl font-heading text-green-400">Mark as Completed</h3>
            <div className="bg-white/5 rounded-xl p-4 border border-white/10 space-y-2">
              <p className="font-bold">{dueTarget.customer_name}</p>
              <p className="text-sm text-white/40">{dueTarget.booking_date} · {dueTarget.screen}</p>
              <p className="text-accent font-bold">Total: ₹{dueTarget.final_price||dueTarget.price} · Advance: ₹{dueTarget.advance_paid||0}</p>
              <p className="text-yellow-400 text-sm font-bold">Remaining to collect: ₹{(dueTarget.remaining_amount)||(dueTarget.final_price||dueTarget.price||0)-(dueTarget.advance_paid||0)}</p>
            </div>
            <div className="space-y-2">
              <label className="text-[9px] uppercase tracking-widest text-white/40 font-black">Final Amount Collected on Arrival (₹)</label>
              <input type="number" value={dueAmount} onChange={e=>setDueAmount(e.target.value)}
                className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-green-400 text-xl font-heading text-center"
                placeholder="Enter amount paid"/>
            </div>
            <div className="flex gap-3">
              <button onClick={()=>setShowDueModal(false)} className="flex-1 py-3 rounded-xl border border-white/10 text-white/40 text-[10px] uppercase font-black">Back</button>
              <button onClick={saveDueAmount} className="flex-1 bg-green-500/20 text-green-400 border border-green-500/30 py-3 rounded-xl font-black uppercase tracking-widest text-[10px]">Confirm Completion</button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Advance Payment Modal */}
      {showAdvanceModal && advanceTarget && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={()=>setShowAdvanceModal(false)}/>
          <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} className="glass-card !bg-[#05071A] p-8 max-w-md w-full relative z-10 border-accent/20 space-y-5">
            <h3 className="text-2xl font-heading gold-text-gradient">Confirm Booking</h3>
            <div className="bg-white/5 rounded-xl p-4 space-y-2 border border-white/10">
              <p className="font-bold">{advanceTarget.customer_name}</p>
              <p className="text-sm text-white/50">{advanceTarget.booking_date} · {formatSlotsDisplay(advanceTarget.slots)} · {advanceTarget.guest_count} guests</p>
              <p className="text-accent font-bold">Total: ₹{advanceTarget.final_price||advanceTarget.price}</p>
            </div>
            <div className="space-y-2">
              <label className="text-[9px] uppercase tracking-widest text-white/40 font-black">Advance Amount Paid (₹)</label>
              <input type="number" value={advanceAmount} onChange={e=>setAdvanceAmount(e.target.value)}
                placeholder={`Min 50% = ₹${Math.ceil((advanceTarget.final_price||advanceTarget.price||0)*0.5)}`}
                className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-accent text-xl font-heading text-center"/>
              {advanceAmount && !isNaN(advanceAmount) && (
                <p className="text-[10px] text-white/40 text-center">
                  Remaining on arrival: ₹{(advanceTarget.final_price||advanceTarget.price||0) - Number(advanceAmount)}
                </p>
              )}
            </div>
            <p className="text-[9px] text-white/30 text-center">Customer will receive a WhatsApp message with payment details.</p>
            <div className="flex gap-3">
              <button onClick={()=>setShowAdvanceModal(false)} className="flex-1 py-3 rounded-xl border border-white/10 text-white/40 text-[10px] uppercase font-black">Back</button>
              <button onClick={confirmAdvancePayment} className="flex-1 gold-button !py-3 !text-[10px] font-black uppercase tracking-widest text-wrap leading-tight">Confirm & Send WhatsApp</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
