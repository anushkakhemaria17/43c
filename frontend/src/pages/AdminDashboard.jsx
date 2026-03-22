import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, addDoc, query, where, serverTimestamp, doc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { LayoutDashboard, Calendar, Users, Wallet, Plus, Clock, UtensilsCrossed, Coffee, CheckCircle2, Lock, X, Settings, Shield, BarChart2, MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SLOT_HOURS, getSlotLabel, getAvailableDates, getSlotStatusMap, formatSlotsDisplay, getTodayStr } from '../utils/slots';
import { exportAnalyticsExcel } from '../utils/exportExcel';

const BOOKING_STATUSES = ['pending','confirmed','completed'];
const ORDER_STATUSES   = ['pending','confirmed','served'];

const StatusBadge = ({ s }) => {
  const colors = { pending:'text-yellow-400 bg-yellow-500/10 border-yellow-500/30', confirmed:'text-blue-400 bg-blue-500/10 border-blue-500/30', completed:'text-green-400 bg-green-500/10 border-green-500/30', served:'text-green-400 bg-green-500/10 border-green-500/30' };
  return <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${colors[s]||colors.pending}`}>{s}</span>;
};

const AdminDashboard = () => {
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
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminForm, setAdminForm] = useState({ name:'', mobile:'', password:'' });

  useEffect(() => {
    if (view==='overview') fetchAnalytics();
    if (view==='bookings') fetchAllBookings();
    if (view==='slots') fetchSlotData();
    if (view==='members') fetchCustomers();
    if (view==='expenses') fetchExpenses();
    if (view==='menu') fetchMenu();
    if (view==='orders') fetchFoodOrders();
    if (view==='admins') fetchAdmins();
    if (view==='analytics') fetchAnalyticsView();
    if (view==='settings') fetchSettings();
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
         setPricingMap(pSnap.docs[0].data().screens);
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
      monthB.forEach(b=>{ if(!dayMap[b.booking_date]) dayMap[b.booking_date]={bookingTotal:0,foodTotal:0}; dayMap[b.booking_date].bookingTotal+=(b.final_price||b.price||0); });
      monthFO.forEach(o=>{ const d=o.created_at?.seconds?new Date(o.created_at.seconds*1000).toISOString().split('T')[0]:null; if(!d)return; if(!dayMap[d]) dayMap[d]={bookingTotal:0,foodTotal:0}; dayMap[d].foodTotal+=(o.final_price||o.total||0); });
      const rows = Object.keys(dayMap).sort().map(date=>({ date, bookingTotal:dayMap[date].bookingTotal, foodTotal:dayMap[date].foodTotal, total:dayMap[date].bookingTotal+dayMap[date].foodTotal }));
      const totalExpenses = monthE.reduce((s,e)=>s+Number(e.amount||0),0);
      setAnalyticsData({ rows, bookingDetails:monthB, foodDetails:monthFO, totalExpenses });
    } catch(e){ console.error(e); }
    finally { setLoading(false); }
  };

  const fetchAllBookings = async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db,'bookings'));
      const raw = snap.docs.map(d=>({id:d.id,...d.data()}));
      raw.sort((a,b)=>b.booking_date<a.booking_date?-1:1);
      setBookings(raw);
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
      const memIds = memSnap.docs.map(d=>d.data().customer_id);
      setCustomers(cSnap.docs.map(d=>({id:d.id,...d.data(),is_member:memIds.includes(d.id)})));
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
    try { const snap=await getDocs(collection(db,'menu_items')); setMenuItems(snap.docs.map(d=>({id:d.id,...d.data()}))); } catch(e){ console.error(e); }
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

  const saveMenu = async (e) => {
    e.preventDefault();
    try {
      if(isEditingMenu) {
        await updateDoc(doc(db,'menu_items',menuForm.id), {
          name: menuForm.name,
          category: menuForm.category,
          member_price: Number(menuForm.member_price),
          non_member_price: Number(menuForm.non_member_price),
          image_url: menuForm.image_url
        });
      } else {
        await addDoc(collection(db,'menu_items'),{...menuForm,member_price:Number(menuForm.member_price),non_member_price:Number(menuForm.non_member_price),available:true,created_at:serverTimestamp()});
      }
      setShowMenuModal(false);
      setMenuForm({id:'', name:'',category:'Drinks',member_price:'',non_member_price:'',image_url:''});
      setIsEditingMenu(false);
      fetchMenu();
    } catch(e){ alert('Failed: '+e.message); }
  };

  const deleteMenu = async (id) => {
    if(!window.confirm('Delete this item?')) return;
    try { await deleteDoc(doc(db,'menu_items',id)); fetchMenu(); } catch(e){ alert('Failed'); }
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

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const navItems = [
    {id:'overview',icon:<LayoutDashboard size={18}/>,label:'Overview'},
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

  return (
    <div className="flex min-h-screen luxury-bg mesh-pattern relative">
      {/* Sidebar */}
      <div className="w-64 bg-[#05071A]/90 backdrop-blur-2xl border-r border-[#D4A95F]/10 p-6 space-y-8 shrink-0 flex flex-col h-screen sticky top-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center text-primary font-bold text-lg">43</div>
          <div><h1 className="text-lg font-heading gold-text-gradient font-black">Control</h1><p className="text-[8px] uppercase tracking-[0.3em] text-white/30">Admin Panel</p></div>
        </div>
        <nav className="space-y-1 flex-1">
          {navItems.map(item=>(
            <button key={item.id} onClick={()=>setView(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-sm ${view===item.id?'bg-accent text-primary font-bold':'text-white/40 hover:text-white hover:bg-white/5'}`}
            >{item.icon}<span className="uppercase tracking-wider text-[11px]">{item.label}</span></button>
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

          {/* ─── BOOKINGS ─── */}
          {view==='bookings' && (
            <motion.div key="bk" initial={{opacity:0}} animate={{opacity:1}} className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-3xl font-heading">Reservations <span className="gold-text-gradient italic">Manifest</span></h2>
                <button onClick={()=>setShowBookingModal(true)} className="gold-button !px-5 !py-2.5 !text-xs flex items-center gap-2"><Plus size={14}/>Manual Book</button>
              </div>
              <div className="space-y-3">
                {bookings.map(b=>(
                  <div key={b.id} className="glass-card p-5">
                    <div className="flex flex-col md:flex-row justify-between gap-4">
                      <div className="flex-1">
                        <p className="text-accent text-[10px] font-black tracking-widest uppercase mb-1">#{b.id.slice(0,8)}</p>
                        <p className="font-bold">{b.customer_name} <span className="text-white/30 font-normal text-sm">· {b.customer_mobile}</span></p>
                        <p className="text-sm text-white/50 mt-1">{b.booking_date} · {b.screen||'Screen 1'} · {formatSlotsDisplay(b.slots)}</p>
                        <div className="flex items-center gap-2 mt-2">
                          <p className="text-[10px] text-white/30">Original: ₹{b.original_price||b.price}</p>
                          <p className="text-sm font-bold text-accent">Final: ₹{b.final_price||b.price}</p>
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 items-end justify-center">
                        <StatusBadge s={b.status||'pending'}/>
                        <select value={b.status||'pending'} onChange={e=>updateBookingStatus(b.id,e.target.value)}
                          className="bg-white/5 border border-white/10 text-white text-xs rounded-lg px-3 py-1.5 outline-none">
                          {BOOKING_STATUSES.map(s=><option key={s} value={s} className="bg-[#05071A]">{s}</option>)}
                        </select>
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
                ))}
              </div>
            </motion.div>
          )}

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
                        </div>
                      </div>
                      <div className="flex flex-col gap-2 items-end justify-center">
                        <StatusBadge s={o.status||'pending'}/>
                        <select value={o.status||'pending'} onChange={e=>updateOrderStatus(o.id,e.target.value)}
                          className="bg-white/5 border border-white/10 text-white text-xs rounded-lg px-3 py-1.5 outline-none">
                          {ORDER_STATUSES.map(s=><option key={s} value={s} className="bg-[#05071A]">{s}</option>)}
                        </select>
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
              <div className="flex justify-between items-center">
                <h2 className="text-3xl font-heading">Menu <span className="gold-text-gradient italic">Catalog</span></h2>
                <button onClick={()=>{setMenuForm({id:'',name:'',category:'Drinks',member_price:'',non_member_price:'',image_url:''});setIsEditingMenu(false);setShowMenuModal(true);}} className="gold-button !px-5 !py-2.5 !text-xs flex items-center gap-2"><Plus size={14}/>Add Item</button>
              </div>
              <div className="glass-card overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-white/5 border-b border-white/5"><tr>{['Item','Category','Member Price','Non-Member Price','Actions'].map(h=><th key={h} className="p-4 text-[9px] uppercase tracking-[0.2em] text-white/40">{h}</th>)}</tr></thead>
                  <tbody>{menuItems.map(m=><tr key={m.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                    <td className="p-4 font-medium text-sm flex items-center gap-3">
                      {m.image_url ? <img src={m.image_url} alt="img" className="w-8 h-8 rounded-lg object-cover" /> : <div className="w-8 h-8 bg-white/5 rounded-lg flex items-center justify-center"><UtensilsCrossed size={12}/></div>}
                      {m.name}
                    </td>
                    <td className="p-4 text-accent/80 text-xs">{m.category}</td><td className="p-4 text-accent font-bold">₹{m.member_price}</td><td className="p-4 text-white/60">₹{m.non_member_price}</td>
                    <td className="p-4 flex gap-2">
                       <button onClick={()=>{setMenuForm(m);setIsEditingMenu(true);setShowMenuModal(true);}} className="bg-blue-500/20 text-blue-400 px-3 py-1 text-[10px] rounded-full uppercase tracking-widest font-bold">Edit</button>
                       <button onClick={()=>deleteMenu(m.id)} className="bg-red-500/20 text-red-500 px-3 py-1 text-[10px] rounded-full uppercase tracking-widest font-bold">Del</button>
                    </td>
                  </tr>)}</tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* ─── MEMBERS ─── */}
          {view==='members' && (
            <motion.div key="mem" initial={{opacity:0}} animate={{opacity:1}} className="space-y-6">
              <h2 className="text-3xl font-heading">Members <span className="gold-text-gradient italic">Registry</span></h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {customers.map(c=>(
                  <div key={c.id} className="navy-card !p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-accent"><Users size={18}/></div>
                      {c.is_member&&<div className="bg-accent text-primary px-3 py-1 rounded-full text-[8px] font-black uppercase">Member</div>}
                    </div>
                    <h4 className="text-lg font-heading mb-1">{c.name}</h4>
                    <p className="text-xs text-white/20 tracking-widest uppercase">{c.mobile_number}</p>
                  </div>
                ))}
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
            </motion.div>
          )}

          {/* ─── SETTINGS ─── */}
          {view==='settings' && (
            <motion.div key="st" initial={{opacity:0}} animate={{opacity:1}} className="space-y-8 max-w-lg">
              <h2 className="text-3xl font-heading">System <span className="gold-text-gradient italic">Settings</span></h2>
              <div className="glass-card p-8 space-y-6">
                <div>
                  <h3 className="text-sm uppercase tracking-widest font-black text-accent mb-1 flex items-center gap-2"><MessageCircle size={14}/>WhatsApp Notification Number</h3>
                  <p className="text-[10px] text-white/30 mb-4">All booking & food order WhatsApp messages will go to this number.</p>
                  <div className="flex gap-3">
                    <input type="tel" value={waInput} onChange={e=>setWaInput(e.target.value.replace(/\D/g,''))} maxLength={10}
                      className="flex-1 bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-accent text-xl tracking-widest text-center font-heading"
                      placeholder="10-digit number"/>
                    <button onClick={saveSettings} className="gold-button !px-6 !py-4 !text-[10px] font-black uppercase tracking-widest">Save</button>
                  </div>
                  <p className="text-[10px] text-white/20 mt-3">Current: +91 {waNumber}</p>
                </div>

                <div className="pt-8 border-t border-white/10">
                  <h3 className="text-sm uppercase tracking-widest font-black text-accent mb-4 flex items-center gap-2">Slot Pricing Configurations</h3>
                  <div className="space-y-6">
                    {Object.keys(pricingMap).map(screen => (
                      <div key={screen} className="border border-white/10 rounded-xl p-4 bg-white/[0.02]">
                        <p className="font-heading font-black mb-3">{screen}</p>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <p className="text-[9px] uppercase tracking-widest text-white/40 mb-1">Non-Member</p>
                            <input type="number" className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm rounded-lg outline-none focus:border-accent" value={pricingMap[screen].non_member} onChange={e=>setPricingMap(p=>({...p, [screen]: {...p[screen], non_member: Number(e.target.value)}}))} />
                          </div>
                          <div>
                            <p className="text-[9px] uppercase tracking-widest text-white/40 mb-1">Silver</p>
                            <input type="number" className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm text-gray-300 rounded-lg outline-none focus:border-accent" value={pricingMap[screen].silver} onChange={e=>setPricingMap(p=>({...p, [screen]: {...p[screen], silver: Number(e.target.value)}}))} />
                          </div>
                          <div>
                            <p className="text-[9px] uppercase tracking-widest text-white/40 mb-1 flex items-center gap-1">Gold</p>
                            <input type="number" className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm gold-text-gradient rounded-lg outline-none focus:border-accent" value={pricingMap[screen].gold} onChange={e=>setPricingMap(p=>({...p, [screen]: {...p[screen], gold: Number(e.target.value)}}))} />
                          </div>
                        </div>
                      </div>
                    ))}
                    <button onClick={savePricing} className="gold-button w-full mt-4 !px-4 !py-3 !text-[10px] font-black uppercase tracking-widest">Save Pricing</button>
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
          <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}} className="glass-card !bg-[#05071A] p-8 max-w-md w-full relative z-10 border-accent/20 space-y-5">
            <h3 className="text-2xl font-heading gold-text-gradient">{isEditingMenu ? 'Edit Menu Item' : 'Add Menu Item'}</h3>
            <form onSubmit={saveMenu} className="space-y-4">
              <input type="text" required placeholder="Item Name" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-accent text-sm" value={menuForm.name} onChange={e=>setMenuForm({...menuForm,name:e.target.value})}/>
              <input type="url" placeholder="Image URL (optional)" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-accent text-sm" value={menuForm.image_url} onChange={e=>setMenuForm({...menuForm,image_url:e.target.value})}/>
              <select required className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none text-white text-sm" value={menuForm.category} onChange={e=>setMenuForm({...menuForm,category:e.target.value})}>
                {['Drinks','Snacks','Main Course','Desserts','Shisha'].map(c=><option key={c} value={c} className="bg-primary">{c}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-3">
                <input type="number" required placeholder="Member Price" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-accent text-sm" value={menuForm.member_price} onChange={e=>setMenuForm({...menuForm,member_price:e.target.value})}/>
                <input type="number" required placeholder="Non-Member Price" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-accent text-sm" value={menuForm.non_member_price} onChange={e=>setMenuForm({...menuForm,non_member_price:e.target.value})}/>
              </div>
              <button className="gold-button w-full py-4 !text-[10px] uppercase font-black">{isEditingMenu ? 'Update Item' : 'Save to Menu'}</button>
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
    </div>
  );
};

export default AdminDashboard;
