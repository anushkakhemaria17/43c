// Firebase Storage removed for cost optimization. Images are now handled via local static assets.
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../lib/firebase';
import { doc, updateDoc, deleteDoc, addDoc, collection, getDocs, query, where, serverTimestamp, setDoc, onSnapshot, getDoc, limit } from 'firebase/firestore';
import { LayoutDashboard, Calendar, Users, Wallet, Plus, Clock, UtensilsCrossed, Coffee, CheckCircle2, Lock, X, Settings, Shield, BarChart2, MessageCircle, Bell, Phone, Trash2, Monitor, ImageIcon, ClipboardList, CheckSquare, Menu, Ticket, CreditCard, Crown, Map, BookOpen, Zap, ShieldCheck, Database } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SLOT_HOURS, getSlotLabel, getAvailableDates, getSlotStatusMap, formatSlotsDisplay, getTodayStr } from '../utils/slots';
import { exportAnalyticsExcel } from '../utils/exportExcel';
import { createNotification, autoCompleteBookings, autoCancelPendingBookings, openAdminWhatsApp, sendBookingConfirmedWhatsApp, sendFoodOrderWhatsApp } from '../utils/firebaseHelpers';
import { openWhatsApp } from '../utils/whatsapp';
import { sendToGoogleSheet, runAutoCleanup } from '../utils/backup';
import AdminNotificationBell from '../components/AdminNotificationBell';
import logo43c from '../assets/43C.png';

const BOOKING_STATUSES = ['pending', 'confirmed', 'completed', 'cancelled'];
const ORDER_STATUSES = ['pending', 'confirmed', 'served', 'cancelled'];
const SCREEN_MAP = {
  'Screen 1': 'Mini Lounge',
  'Screen 2': 'Studio Lounge',
  'TV Screen': 'Grand Lounge'
};
const REVERSE_SCREEN_MAP = {
  'Mini Lounge': 'Screen 1',
  'Studio Lounge': 'Screen 2',
  'Grand Lounge': 'TV Screen'
};

const StatusBadge = ({ s }) => {
  const colors = { pending: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30', confirmed: 'text-blue-400 bg-blue-500/10 border-blue-500/30', completed: 'text-green-400 bg-green-500/10 border-green-500/30', served: 'text-green-400 bg-green-500/10 border-green-500/30', cancelled: 'text-red-400 bg-red-500/10 border-red-500/30' };
  return <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${colors[s] || colors.pending}`}>{s}</span>;
};

const ComboCard = ({ combo, onEdit, onDelete, onToggle, getLocalAsset }) => {
  return (
    <div className="glass-card flex flex-col border-accent/20 relative transition-all duration-300 hover:border-accent">
      <div className={`p-5 flex-1 ${!combo.is_active ? 'opacity-40 grayscale' : ''}`}>
        <div className="h-32 mb-4 bg-white/5 rounded-xl overflow-hidden border border-white/10">
          {combo.image_url ? (
            <img 
              src={getLocalAsset(combo.image_url, 'combos')} 
              alt={combo.name} 
              className="w-full h-full object-cover" 
              onError={e => { e.target.style.display = 'none'; }} 
            />
          ) : (
            <div className="flex items-center justify-center h-full text-white/10"><ImageIcon size={32} /></div>
          )}
        </div>
        <div className="flex justify-between items-start">
          <h3 className="text-xl font-heading text-white">{combo.name}</h3>
          <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${combo.is_active ? 'text-green-400 border-green-500/20 bg-green-500/5' : 'text-red-400 border-red-500/20 bg-red-500/5'}`}>
            {combo.is_active ? 'Active' : 'Disabled'}
          </span>
        </div>
        <p className="text-accent font-bold mt-1 text-lg">₹{combo.price}</p>
        <p className="text-[10px] text-white/30 uppercase tracking-widest mt-1">{combo.screen_type || 'Screen 1'} · Max {combo.max_guests || 2} Guests · {combo.number_of_slots || 1} Slots</p>
        <p className="text-xs text-white/50 mt-2 mb-4 line-clamp-2">{combo.description}</p>
        <div className="space-y-1">
          <p className="text-[9px] uppercase tracking-widest text-white/30">Includes:</p>
          <p className="text-sm font-bold text-white/80">{combo.includes}</p>
        </div>
      </div>
      <div className="border-t border-white/5 p-3 flex gap-2 bg-black/40 rounded-b-2xl">
        <button 
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggle(combo); }} 
          className={`flex-1 py-4 rounded-xl border transition-all text-center text-[10px] uppercase font-black tracking-widest ${combo.is_active ? 'border-red-500/20 text-red-400' : 'border-green-500/20 text-green-400'}`}>
          {combo.is_active ? 'Disable' : 'Activate'}
        </button>
        <button 
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onEdit(combo); }} 
          className="flex-1 py-4 bg-blue-500/20 text-blue-400 border border-blue-500/20 text-[10px] uppercase font-black tracking-widest rounded-xl text-center">
          Edit
        </button>
        <button 
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(combo.id); }} 
          className="px-5 py-4 bg-red-500/10 text-red-500/50 border border-red-500/10 rounded-xl flex items-center justify-center">
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
};

const AdminDashboard = () => {
  // Auth guard
  if (localStorage.getItem('admin_access') !== 'true') {
    window.location.href = '/admin-login';
    return null;
  }

  const [view, setView] = useState('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
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
  const [waNumber, setWaNumber] = useState('919479810400');
  const [waInput, setWaInput] = useState('919479810400');
  const [termsText, setTermsText] = useState("");
  const [editPrice, setEditPrice] = useState({});
  const [foodCombos, setFoodCombos] = useState([]);
  const [showFoodComboModal, setShowFoodComboModal] = useState(false);
  const [foodComboForm, setFoodComboForm] = useState({ id: '', name: '', price: '', items: [], image_url: '' });
  const [pricingMap, setPricingMap] = useState({});

  const [slotDate, setSlotDate] = useState(getTodayStr());
  const [slotScreen, setSlotScreen] = useState('Screen 1');
  const [slotStatus, setSlotStatus] = useState({});
  const availableDates = getAvailableDates();

  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseForm, setExpenseForm] = useState({ title: '', amount: '', date: getTodayStr() });
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [bookingForm, setBookingForm] = useState({ name: '', mobile: '', screen: 'Screen 1', slots: [], guest_count: 2, date: getTodayStr() });
  const [bookingSlotStatus, setBookingSlotStatus] = useState({});
  const [showComboModal, setShowComboModal] = useState(false);
  const [comboForm, setComboForm] = useState({ id: '', name: '', price: '', description: '', includes: '', custom_message: '', is_active: true, max_guests: 2, screen_type: 'Screen 1', image_url: '', number_of_slots: 1 });
  const [editingComboId, setEditingComboId] = useState(null);
  const [combos, setCombos] = useState([]);
  const [showCouponModal, setShowCouponModal] = useState(false);
  const [couponForm, setCouponForm] = useState({ id: '', code: '', type: 'percentage', value: '', applies_to: 'both', max_usage: '', used_count: 0, expiry_date: '', active: true, usage_per_user: 1, validity_days: '', screen_applicable: 'All', whatsapp_template: 'Hey! Use coupon code {{code}} to get a special discount at 43C! ✨' });
  const [coupons, setCoupons] = useState([]);
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [menuForm, setMenuForm] = useState({ id: '', name: '', category: 'Drinks', silver_price: '', gold_price: '', non_member_price: '', image_url: '', discount: '' });
  const [isEditingMenu, setIsEditingMenu] = useState(false);
  const fileInputRef = useRef(null);
  const [menuCategories, setMenuCategories] = useState(['Drinks', 'Snacks', 'Main Course', 'Desserts', 'Shisha']);
  const [newCategory, setNewCategory] = useState('');
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [menuCatFilter, setMenuCatFilter] = useState('All');
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminForm, setAdminForm] = useState({ name: '', mobile: '', password: '' });

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [advanceTarget, setAdvanceTarget] = useState(null);
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [filterStatus, setFilterStatus] = useState('pending');
  const [filterDate, setFilterDate] = useState('');
  const [editWaMobile, setEditWaMobile] = useState({});
  const [notifCount, setNotifCount] = useState({ bookings: 0, orders: 0, memberships: 0 });
  const [paymentSettings, setPaymentSettings] = useState({ upi_id: 'anushka17.khemaria@okicici', mobile_number: '9479810400', qr_image_url: '/assets/payment/qr.jpeg' });
 
  const [membershipPlans, setMembershipPlans] = useState([]);
  const [activeMemberships, setActiveMemberships] = useState([]);
  const [membershipRequests, setMembershipRequests] = useState([]);
  const [showMembershipModal, setShowMembershipModal] = useState(false);
  const [membershipForm, setMembershipForm] = useState({ 
    id: '', name: '', price: '', validity_days: 30, description: '', is_active: true, credit_type: 'any', credits: 0,
    per_screen_credits: {} 
  });
  const [isEditingMembership, setIsEditingMembership] = useState(false);
  const [membershipSubView, setMembershipSubView] = useState('plans'); // 'plans', 'active', 'requests'
  const [showMemApproveModal, setShowMemApproveModal] = useState(false);
  const [memApproveTarget, setMemApproveTarget] = useState(null);
  const [memApproveAmount, setMemApproveAmount] = useState('');

  const [memberFilter, setMemberFilter] = useState('all');
  const [memberBookings, setMemberBookings] = useState({});
  const [memberSpend, setMemberSpend] = useState({});
  const [showDueModal, setShowDueModal] = useState(false);
  const [dueTarget, setDueTarget] = useState(null);
  const [dueAmount, setDueAmount] = useState('');
  const [newScreenName, setNewScreenName] = useState('');
  const [screensList, setScreensList] = useState([]); // Array of objects
  const [screens, setScreens] = useState(['Screen 1', 'Screen 2', 'TV Screen']); // Array of names for legacy
  const [showScreenModal, setShowScreenModal] = useState(false);
  const [screenForm, setScreenForm] = useState({ id: '', name: '', type: 'private', capacity: 6, is_active: true, legacy_link: 'None', pricing: { gold: 299, silver: 399, non_member: 499, pricing_type: 'group' } });

  const [tasks, setTasks] = useState([]);
  const [taskForm, setTaskForm] = useState({ title: '', time: '10:00' });
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [selectedTaskDate, setSelectedTaskDate] = useState(getTodayStr());

  const getLocalAsset = (path, section) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    return `/assets/${section}/${path}`;
  };

  const fetchTasks = async () => {
    try {
      const snap = await getDocs(collection(db, 'tasks'));
      setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) { console.error(e); }
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
    } catch (err) { alert('Failed: ' + err.message); }
  };

  const toggleTask = async (id, currentStatus) => {
    try {
      await updateDoc(doc(db, 'tasks', id), { completed: !currentStatus });
      setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !currentStatus } : t));
    } catch (err) { alert('Failed'); }
  };

  const deleteTask = async (id) => {
    if (!window.confirm('Delete this task?')) return;
    try {
      await deleteDoc(doc(db, 'tasks', id));
      setTasks(prev => prev.filter(t => t.id !== id));
    } catch (err) { alert('Failed'); }
  };

    useEffect(() => {
      const unsubB = onSnapshot(query(collection(db, 'bookings'), where('status', '==', 'pending')), (snap) => {
        setNotifCount(prev => ({ ...prev, bookings: snap.docs.length }));
      });
      const unsubO = onSnapshot(query(collection(db, 'food_orders'), where('status', '==', 'pending')), (snap) => {
        setNotifCount(prev => ({ ...prev, orders: snap.docs.length }));
      });
      const unsubM = onSnapshot(query(collection(db, 'customer_memberships'), where('status', '==', 'pending')), (snap) => {
        setNotifCount(prev => ({ ...prev, memberships: snap.docs.length }));
      });
      return () => { unsubB(); unsubO(); unsubM(); };
    }, []);

    useEffect(() => {
      if (screens.length > 0) {
        if (!screens.includes(slotScreen)) setSlotScreen(screens[0]);
        setBookingForm(prev => ({ ...prev, screen: screens.includes(prev.screen) ? prev.screen : screens[0] }));
        setComboForm(prev => ({ ...prev, screen_type: screens.includes(prev.screen_type) ? prev.screen_type : screens[0] }));
      }
    }, [screens]);

    useEffect(() => {
      let unsubBookings = null;
      let unsubOrders = null;

      if (view === 'overview') { fetchAnalytics(); fetchScreens(); }
      if (view === 'bookings') { unsubBookings = fetchAllBookings(); fetchScreens(); }
      if (view === 'slots') { fetchSlotData(); fetchScreens(); }
      if (view === 'members') { fetchCustomers(); fetchScreens(); }
      if (view === 'expenses') fetchExpenses();
      if (view === 'menu') fetchMenu();
      if (view === 'combos') fetchCombos();
      if (view === 'food_combos') { fetchMenu(); fetchFoodCombos(); }
      if (view === 'coupons') fetchCoupons();
      if (view === 'memberships') { fetchScreens(); fetchMembershipPlans(); fetchActiveMemberships(); fetchMembershipRequests(); }
      if (view === 'orders') { unsubOrders = fetchFoodOrders(); fetchScreens(); }
      if (view === 'tasks_live') { unsubOrders = fetchFoodOrders(); unsubBookings = fetchAllBookings(); fetchScreens(); }
      if (view === 'analytics') fetchAnalyticsView();
      if (view === 'settings') { fetchSettings(); fetchScreens(); }
      if (view === 'tasks') { fetchTasks(); unsubBookings = fetchAllBookings(); }

      return () => {
        if (unsubBookings) unsubBookings();
        if (unsubOrders) unsubOrders();
      };
    }, [view, slotDate, slotScreen]);

    useEffect(() => { if (view === 'analytics') fetchAnalyticsView(); }, [analyticsMonth, analyticsYear]);
    useEffect(() => { if (showBookingModal) fetchSlotDataForBooking(); }, [showBookingModal, bookingForm.date, bookingForm.screen]);

    const fetchSettings = async () => {
      try {
        const snap = await getDocs(collection(db, 'settings'));
        const globals = snap.docs.find(d => d.id === 'global');
        if (globals) { 
          const num = globals.data().whatsapp_number || '919479810400';
          const formatted = num.length === 10 ? '91' + num : num;
          setWaNumber(formatted); 
          setWaInput(formatted); 
        }
        const pSnap = await getDocs(collection(db, 'pricing'));
        if (!pSnap.empty && pSnap.docs[0].data().screens) {
          const loadedMap = pSnap.docs[0].data().screens;
          setPricingMap(loadedMap);
          setScreens(Object.keys(loadedMap));
        }
        const tSnap = await getDocs(collection(db, 'terms_conditions'));
        const tDoc = tSnap.docs.find(d => d.id === 'default');
        if (tDoc && tDoc.data().content) {
          setTermsText(tDoc.data().content);
        } else {
          setTermsText("43C Lounge – Terms & Conditions\n\nBy proceeding with a booking, you agree to the following:\n\nNo Smoking & No Alcohol\nSmoking and alcohol consumption are strictly prohibited inside the premises.\nA fine of ₹500 will be charged if found smoking.\n\nNo Outside Food\nOutside food and beverages are not allowed.\n\nBehavior Policy\nAny inappropriate, rude, or unacceptable behavior will not be tolerated.\n\nDamage Policy\nAny damage to property must be paid for by the customer.\n\nLegal Action\n43C reserves the right to take strict or legal action in case of misconduct.\n\nResponsibility Clause\nThe person making the booking is fully responsible for all accompanying guests.\n\nNo Refund Policy\nNo refunds will be provided in case of cancellation or no-show.\n\nRight to Refuse Service\nManagement reserves the right to deny or cancel bookings if rules are violated.");
        }
        const pSettings = await getDoc(doc(db, 'settings', 'payment'));
        if (pSettings.exists()) {
          setPaymentSettings(pSettings.data());
        }
      } catch (e) { console.error(e); }
    };

    const fetchScreens = async () => {
      try {
        const snap = await getDocs(collection(db, 'screens'));
        let list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (list.length === 0) {
            // Self-migrate from pricingMap if empty
            const pSnap = await getDocs(collection(db, 'pricing'));
            if (!pSnap.empty && pSnap.docs[0].data().screens) {
                const map = pSnap.docs[0].data().screens;
                for(const [name, data] of Object.entries(map)) {
                   await addDoc(collection(db, 'screens'), {
                      name, 
                      type: data.type || 'private', 
                      capacity: data.max_guests || 6, 
                      is_active: true,
                      pricing: { gold: data.gold || 299, silver: data.silver || 399, non_member: data.non_member || 499, pricing_type: data.pricing_type || 'group' }
                   });
                }
                list = (await getDocs(collection(db, 'screens'))).docs.map(d => ({ id: d.id, ...d.data() }));
            }
        }
        setScreensList(list);
        setScreens(list.map(s => s.name));
        const newMap = {};
        list.forEach(s => {
          newMap[s.name] = { 
            ...(s.pricing || {}), 
            type: s.type, 
            max_guests: s.capacity 
          };
        });
        setPricingMap(newMap);
      } catch (e) { console.error(e); }
    };

    const saveScreen = async (e) => {
      e.preventDefault();
      try {
        setLoading(true);
        const data = {
          name: screenForm.name,
          type: screenForm.type,
          capacity: Number(screenForm.capacity),
          is_active: screenForm.is_active,
          legacy_link: screenForm.legacy_link || 'None',
          pricing: screenForm.pricing,
          updated_at: serverTimestamp()
        };
        if (screenForm.id) {
          await updateDoc(doc(db, 'screens', screenForm.id), data);
        } else {
          await addDoc(collection(db, 'screens'), { ...data, created_at: serverTimestamp() });
        }
        setShowScreenModal(false);
        fetchScreens();
        alert('Screen saved successfully.');
      } catch (err) { alert('Failed: ' + err.message); }
      finally { setLoading(false); }
    };

    const deleteScreen = async (id, name) => {
      if (!window.confirm(`Delete screen "${name}"?`)) return;
      try {
        const q = query(collection(db, 'bookings'), where('screen', '==', name), where('status', 'in', ['pending', 'confirmed']));
        const snap = await getDocs(q);
        if (!snap.empty) {
           return alert('Cannot delete screen. There are active (pending/confirmed) bookings associated with it.');
        }
        await deleteDoc(doc(db, 'screens', id));
        fetchScreens();
      } catch (e) { alert('Delete failed'); }
    };

    const saveSettings = async () => {
      try { 
        const formatted = waInput.length === 10 ? '91' + waInput : waInput;
        await setDoc(doc(db, 'settings', 'global'), { whatsapp_number: formatted }, { merge: true }); 
        setWaNumber(formatted); 
        alert('Settings saved!'); 
      } catch (e) { alert('Failed'); }
    };

    const savePaymentSettings = async () => {
      try {
        await setDoc(doc(db, 'settings', 'payment'), paymentSettings, { merge: true });
        alert('Payment settings updated!');
      } catch (e) { alert('Failed to save payment settings'); }
    };

    const saveTerms = async () => {
      try {
        await setDoc(doc(db, 'terms_conditions', 'default'), {
          content: termsText,
          updated_at: serverTimestamp()
        }, { merge: true });
        alert('Terms updated successfully!');
      } catch (e) { alert('Failed to update terms'); }
    };

    const savePricing = async () => {
      try { await setDoc(doc(db, 'pricing', 'rates'), { screens: pricingMap }); alert('Pricing updated.'); } catch (e) { alert('Failed to save pricing.'); }
    };

    useEffect(() => {
      // Auto-cleanup: Delete cancelled bookings older than 10 days
      if (bookings.length > 0) {
        runAutoCleanup(bookings, async (id) => {
          const b = bookings.find(x => x.id === id);
          if (b) {
            await sendToGoogleSheet({
              type: "deleted",
              reason: "Auto-cleanup (old cancelled)",
              data: JSON.stringify(b)
            });
          }
          await deleteDoc(doc(db, 'bookings', id));
          setBookings(prev => prev.filter(b => b.id !== id));
        });
      }
    }, [bookings.length]);

    const handleManualBackup = async () => {
      setBackupLoading(true);
      try {
        // Sync recent confirmed bookings
        const recentB = bookings.filter(b => b.status === 'confirmed' || b.status === 'completed');
        for (const b of recentB) {
          await sendToGoogleSheet({
            type: "booking",
            name: b.customer_name,
            mobile: b.customer_mobile,
            details: `Slot booking sync (${b.screen})`,
            amount: b.final_price || b.price || 0,
            status: b.status
          });
        }
        // Sync confirmed food orders
        const recentFO = foodOrders.filter(o => o.status === 'confirmed' || o.status === 'served');
        for (const o of recentFO) {
          await sendToGoogleSheet({
            type: "food",
            name: o.customer_name,
            mobile: o.customer_mobile,
            details: "Food order sync",
            amount: o.final_price || o.total || 0,
            status: o.status
          });
        }
        alert('Selective sync completed! Confirmed records sent to Google Sheets.');
      } catch (err) {
        alert('Sync failed: ' + err.message);
      } finally {
        setBackupLoading(false);
      }
    };

    const fetchAnalytics = async () => {
      try {
        const today = getTodayStr();
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
        const allB = (await getDocs(collection(db, 'bookings'))).docs.map(d => d.data());
        const allE = (await getDocs(collection(db, 'expenses'))).docs.map(d => d.data());
        const allFO = (await getDocs(collection(db, 'food_orders'))).docs.map(d => d.data());
        const allM = (await getDocs(collection(db, 'customer_memberships'))).docs.map(d => d.data());
        const todayB = allB.filter(b => b.booking_date === today);
        const monthB = allB.filter(b => b.booking_date >= startOfMonth && (b.status === 'confirmed' || b.status === 'completed'));
        const monthE = allE.filter(e => e.date >= startOfMonth);
        const mStartTs = new Date(startOfMonth + 'T00:00:00').getTime() / 1000;
        const tStartTs = new Date(today + 'T00:00:00').getTime() / 1000;
        const monthFO = allFO.filter(o => (o.created_at?.seconds || 0) >= mStartTs && (o.status === 'confirmed' || o.status === 'served'));
        const todayFO = allFO.filter(o => (o.created_at?.seconds || 0) >= tStartTs && (o.created_at?.seconds || 0) < tStartTs + 86400);
        const monthM = allM.filter(m => m.status === 'active' && m.approved_at && (m.approved_at?.seconds || 0) >= mStartTs);
        
        const monthBRev = monthB.reduce((s, b) => s + (b.final_price || b.price || 0), 0);
        const monthFRev = monthFO.reduce((s, o) => s + (o.final_price || o.total || 0), 0);
        const monthMRev = monthM.reduce((s, m) => s + Number(m.paid_amount || 0), 0);
        const monthExp = monthE.reduce((s, e) => s + Number(e.amount || 0), 0);
        
        setAnalytics({
          today_bookings: todayB.length,
          today_revenue: todayB.reduce((s, b) => s + (b.final_price || b.price || 0), 0) + todayFO.reduce((s, o) => s + (o.final_price || o.total || 0), 0),
          monthly_expenses: monthExp,
          monthly_booking_rev: monthBRev,
          monthly_food_rev: monthFRev,
          monthly_membership_rev: monthMRev,
          net_profit: monthBRev + monthFRev + monthMRev - monthExp,
          total_food_orders: allFO.length,
        });
      } catch (e) { console.error(e); }
    };

    const fetchAnalyticsView = async () => {
      setLoading(true);
      try {
        const allB = (await getDocs(collection(db, 'bookings'))).docs.map(d => ({ id: d.id, ...d.data() }));
        const allFO = (await getDocs(collection(db, 'food_orders'))).docs.map(d => ({ id: d.id, ...d.data() }));
        const allE = (await getDocs(collection(db, 'expenses'))).docs.map(d => d.data());
        const mStart = new Date(analyticsYear, analyticsMonth, 1);
        const mEnd = new Date(analyticsYear, analyticsMonth + 1, 1);
        const mStartStr = mStart.toISOString().split('T')[0];
        const mEndStr = mEnd.toISOString().split('T')[0];
        const mStartTs = mStart.getTime() / 1000;
        const mEndTs = mEnd.getTime() / 1000;
        const monthB = allB.filter(b => b.booking_date >= mStartStr && b.booking_date < mEndStr && (b.status === 'confirmed' || b.status === 'completed'));
        const monthFO = allFO.filter(o => (o.created_at?.seconds || 0) >= mStartTs && (o.created_at?.seconds || 0) < mEndTs && (o.status === 'confirmed' || o.status === 'served'));
        const monthE = allE.filter(e => e.date >= mStartStr && e.date < mEndStr);
        const dayMap = {};
        const slotMap = {};
        const foodMap = {};
        monthB.forEach(b => {
          if (!dayMap[b.booking_date]) dayMap[b.booking_date] = { bookingTotal: 0, foodTotal: 0 };
          dayMap[b.booking_date].bookingTotal += (b.final_price || b.price || 0);
          if (b.slots && b.slots.length) {
            b.slots.forEach(slot => {
              const label = getSlotLabel(slot).split(' - ')[0];
              slotMap[label] = (slotMap[label] || 0) + 1;
            });
          }
        });
        monthFO.forEach(o => {
          const d = o.created_at?.seconds ? new Date(o.created_at.seconds * 1000).toISOString().split('T')[0] : null;
          if (d) {
            if (!dayMap[d]) dayMap[d] = { bookingTotal: 0, foodTotal: 0 };
            dayMap[d].foodTotal += (o.final_price || o.total || 0);
          }
          if (o.items && o.items.length) {
            o.items.forEach(item => {
              foodMap[item.name] = (foodMap[item.name] || 0) + item.qty;
            });
          }
        });
        const rows = Object.keys(dayMap).sort().map(date => ({ date, bookingTotal: dayMap[date].bookingTotal, foodTotal: dayMap[date].foodTotal, total: dayMap[date].bookingTotal + dayMap[date].foodTotal }));
        const totalExpenses = monthE.reduce((s, e) => s + Number(e.amount || 0), 0);
        const topSlots = Object.entries(slotMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(x => ({ name: x[0], count: x[1] }));
        const topFood = Object.entries(foodMap).sort((a, b) => b[1] - a[1]).slice(0, 5).map(x => ({ name: x[0], count: x[1] }));
        setAnalyticsData({ rows, bookingDetails: monthB, foodDetails: monthFO, totalExpenses, topSlots, topFood });
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };

    const fetchAllBookings = () => {
      setLoading(true);
      const q = collection(db, 'bookings');
      return onSnapshot(q, async (snap) => {
        const raw = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        raw.sort((a, b) => {
          if (a.status === 'pending' && b.status !== 'pending') return -1;
          if (b.status === 'pending' && a.status !== 'pending') return 1;
          if (a.status === 'pending' && b.status === 'pending') {
            return (a.created_at?.seconds || 0) - (b.created_at?.seconds || 0);
          }
          return b.booking_date < a.booking_date ? -1 : 1;
        });
        setBookings(raw);
        setLoading(false);
        await autoCompleteBookings(raw, (id, status) =>
          setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b))
        );
        await autoCancelPendingBookings(raw, (id, status) =>
          setBookings(prev => prev.map(b => b.id === id ? { ...b, status } : b))
        );
      }, (err) => {
        console.error(err);
        setLoading(false);
      });
    };


    const fetchSlotData = async () => {
      try {
        const bSnap = await getDocs(query(collection(db, 'bookings'), where('booking_date', '==', slotDate)));
        const cSnap = await getDocs(query(collection(db, 'closed_slots'), where('date', '==', slotDate)));
        setSlotStatus(getSlotStatusMap(slotDate, bSnap.docs.map(d => d.data()), cSnap.docs.map(d => d.data()), slotScreen, pricingMap[slotScreen] || {}));
      } catch (e) { console.error(e); }
    };

    const fetchSlotDataForBooking = async () => {
      try {
        const bSnap = await getDocs(query(collection(db, 'bookings'), where('booking_date', '==', bookingForm.date)));
        const cSnap = await getDocs(query(collection(db, 'closed_slots'), where('date', '==', bookingForm.date)));
        setBookingSlotStatus(getSlotStatusMap(bookingForm.date, bSnap.docs.map(d => d.data()), cSnap.docs.map(d => d.data()), bookingForm.screen, pricingMap[bookingForm.screen] || {}));
      } catch (e) { console.error(e); }
    };

    const fetchCustomers = async () => {
      try {
        const cSnap = await getDocs(collection(db, 'customers'));
        const memSnap = await getDocs(query(collection(db, 'customer_memberships'), where('status', '==', 'active')));
        const memMap = {};
        memSnap.docs.forEach(d => { memMap[d.data().customer_id] = d.data().membership_type || 'silver'; });
        const bSnap = await getDocs(collection(db, 'bookings'));
        const bkMap = {}; const spMap = {};
        bSnap.docs.forEach(d => {
          const bd = d.data();
          if (!bkMap[bd.customer_id]) { bkMap[bd.customer_id] = 0; spMap[bd.customer_id] = 0; }
          bkMap[bd.customer_id]++;
          spMap[bd.customer_id] += (bd.final_price || bd.price || 0);
        });
        setMemberBookings(bkMap);
        setMemberSpend(spMap);
        setCustomers(cSnap.docs.map(d => ({ id: d.id, ...d.data(), membership_type: memMap[d.id] || 'non_member', is_member: !!memMap[d.id] })));
      } catch (e) { console.error(e); }
    };

    const fetchExpenses = async () => {
      try {
        const snap = await getDocs(collection(db, 'expenses'));
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => b.date < a.date ? -1 : 1);
        setExpenses(data);
      } catch (e) { console.error(e); }
    };

    const fetchMenu = async () => {
      try {
        const snap = await getDocs(collection(db, 'menu_items'));
        setMenuItems(snap.docs.map(d => {
          const data = d.data();
          return { id: d.id, ...data };
        }));

        const catSnap = await getDocs(collection(db, 'settings'));
        const catDoc = catSnap.docs.find(d => d.id === 'menu_categories');
        if (catDoc && catDoc.data().categories) {
          setMenuCategories(catDoc.data().categories);
        }
      } catch (e) { console.error(e); }
    };

    const fetchFoodOrders = () => {
      const q = collection(db, 'food_orders');
      return onSnapshot(q, (snap) => {
        const data = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0));
        setFoodOrders(data);
      }, (err) => {
        console.error(err);
      });
    };

    const fetchCombos = async () => {
      try {
        const snap = await getDocs(collection(db, 'combos'));
        setCombos(snap.docs.map(d => {
          const data = d.data();
          return { id: d.id, ...data };
        }));
      } catch (e) { console.error(e); }
    };

    const saveCombo = async (e) => {
      e.preventDefault();
      try {
        setLoading(true);
        const comboData = {
          name: comboForm.name || '',
          price: Number(comboForm.price || 0),
          description: comboForm.description || '',
          includes: comboForm.includes || '',
          custom_message: comboForm.custom_message || '',
          is_active: comboForm.is_active ?? true,
          max_guests: Number(comboForm.max_guests || 2),
          number_of_slots: Number(comboForm.number_of_slots || 1),
          screen_type: comboForm.screen_type || 'Screen 1',
          image_url: comboForm.image_url || '',
          updated_at: serverTimestamp()
        };

        if (editingComboId) {
          await updateDoc(doc(db, 'combos', editingComboId), comboData);
        } else {
          await addDoc(collection(db, 'combos'), {
            ...comboData,
            created_at: serverTimestamp()
          });
        }
        setShowComboModal(false);
        setEditingComboId(null);
        fetchCombos();
      } catch (err) { 
        console.error('Save Combo Error:', err);
        alert('Failed: ' + err.message); 
      } finally { setLoading(false); }
    };

    const deleteCombo = async (id) => {
      if (!window.confirm('Delete combo?')) return;
      try { await deleteDoc(doc(db, 'combos', id)); fetchCombos(); } catch (e) { }
    };

    const toggleComboActive = async (combo) => {
      try {
        await updateDoc(doc(db, 'combos', combo.id), { is_active: !combo.is_active });
        fetchCombos();
      } catch (e) { alert('Failed to toggle status'); }
    };

    const fetchFoodCombos = async () => {
      try {
        const snap = await getDocs(collection(db, 'food_combos'));
        setFoodCombos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) { console.error(e); }
    };

    const saveFoodCombo = async (e) => {
      e.preventDefault();
      try {
        setLoading(true);
        const data = {
          name: foodComboForm.name,
          price: Number(foodComboForm.price),
          items: foodComboForm.items, // Array of { id, name, price }
          image_url: foodComboForm.image_url || '',
          updated_at: serverTimestamp()
        };
        if (foodComboForm.id) {
          await updateDoc(doc(db, 'food_combos', foodComboForm.id), data);
        } else {
          await addDoc(collection(db, 'food_combos'), { ...data, created_at: serverTimestamp() });
        }
        setShowFoodComboModal(false);
        fetchFoodCombos();
      } catch (err) { alert('Failed: ' + err.message); }
      finally { setLoading(false); }
    };

    const deleteFoodCombo = async (id) => {
      if (!window.confirm('Delete this food combo?')) return;
      try {
        await deleteDoc(doc(db, 'food_combos', id));
        fetchFoodCombos();
      } catch (err) { alert('Delete failed'); }
    };

    const fetchCoupons = async () => {
      try {
        const snap = await getDocs(collection(db, 'coupons'));
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setCoupons(list);
      } catch (e) { 
        console.error('Fetch Coupons Error:', e);
      }
    };

    const saveCoupon = async (e) => {
      e.preventDefault();
      setLoading(true);
      try {
        const cleanCode = (couponForm.code || '').trim().toUpperCase();
        if (!cleanCode) {
          setLoading(false);
          return alert('Coupon code is required.');
        }

        // Rule: Same active code cannot exist twice
        if (couponForm.active) {
          const conflict = coupons.find(c => 
            c.code.toUpperCase() === cleanCode && 
            c.active && 
            c.id !== couponForm.id
          );
          if (conflict) {
            setLoading(false);
            return alert(`A coupon with code "${cleanCode}" is already active. Deactivate or edit the existing one instead.`);
          }
        }

        const { id, ...formData } = couponForm;
        const dataToSave = {
          ...formData,
          code: cleanCode,
          value: Number(formData.value || 0),
          max_usage: Number(formData.max_usage || 0),
          used_count: Number(formData.used_count || 0),
          usage_per_user: Number(formData.usage_per_user || 1),
          validity_days: formData.validity_days ? Number(formData.validity_days) : null,
          updated_at: serverTimestamp()
        };
        
        if (id && id !== '') {
          await updateDoc(doc(db, 'coupons', id), dataToSave);
          alert('Coupon updated successfully!');
        } else {
          await addDoc(collection(db, 'coupons'), { 
            ...dataToSave, 
            created_at: serverTimestamp(), 
            used_count: 0 
          });
          alert('New coupon created!');
        }
        
        setShowCouponModal(false);
        fetchCoupons();
      } catch (e) { 
        console.error('Save Coupon Error:', e);
        alert('Failed to save coupon: ' + e.message); 
      } finally {
        setLoading(false);
      }
    };

    const deleteCoupon = async (id) => {
      if (!id) return;
      if (!window.confirm('Are you sure you want to delete this coupon? This action cannot be undone.')) return;
      try {
        await deleteDoc(doc(db, 'coupons', id));
        alert('Coupon deleted successfully.');
        fetchCoupons();
      } catch (e) { 
        console.error('Delete Coupon Error:', e);
        alert('Failed to delete: ' + e.message);
      }
    };

    const toggleCouponActive = async (coupon) => {
      try {
        const newStatus = !coupon.active;
        if (newStatus) {
          // Check for conflicts before enabling
          const conflict = coupons.find(c => 
            c.code.toUpperCase() === coupon.code.toUpperCase() && 
            c.active && 
            c.id !== coupon.id
          );
          if (conflict) {
            return alert(`Cannot enable. Code "${coupon.code}" is already active in another coupon.`);
          }
        }

        await updateDoc(doc(db, 'coupons', coupon.id), { active: newStatus });
        fetchCoupons();
      } catch (e) {
        console.error('Toggle Coupon Error:', e);
        alert('Failed to update status: ' + e.message);
      }
    };

    const resetCoupon = async (coupon) => {
      try {
        // Resetting used count and ensuring it is active
        const conflict = coupons.find(c => 
          c.code.toUpperCase() === coupon.code.toUpperCase() && 
          c.active && 
          c.id !== coupon.id
        );
        if (conflict) return alert(`Cannot enable/reset. Another active coupon with code "${coupon.code}" exists.`);
        await updateDoc(doc(db, 'coupons', coupon.id), { used_count: 0, active: true });
        alert('Coupon usage reset to 0.');
        fetchCoupons();
      } catch (e) { 
        console.error('Reset Coupon Error:', e);
        alert('Failed to reset'); 
      }
    };
 
    const fetchMembershipPlans = async () => {
      try {
        const snap = await getDocs(collection(db, 'membership_plans'));
        setMembershipPlans(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) { console.error('Fetch Memberships Error:', e); }
    };
 
    const fetchActiveMemberships = async () => {
      try {
        const q = query(collection(db, 'customer_memberships'), where('status', '==', 'active'));
        const snap = await getDocs(q);
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        const enriched = list.map(m => {
          const cust = customers.find(c => c.id === m.customer_id);
          return { ...m, customer_name: cust?.name || 'Unknown', customer_mobile: cust?.mobile_number || 'Unknown' };
        });
        setActiveMemberships(enriched);
      } catch (e) { console.error('Fetch Active Memberships Error:', e); }
    };
 
    const fetchMembershipRequests = async () => {
      try {
        const q = query(collection(db, 'customer_memberships'), where('status', '==', 'pending'));
        const snap = await getDocs(q);
        // Sort by created_at desc (latest first)
        const allPending = snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0));
        
        const latestByCustomer = {};
        const toDeleteIds = [];
        
        allPending.forEach(m => {
          if (!m.customer_id) return;
          if (!latestByCustomer[m.customer_id]) {
            latestByCustomer[m.customer_id] = m;
          } else {
            toDeleteIds.push(m.id);
          }
        });

        // Cleanup duplicate pending requests in background
        if (toDeleteIds.length > 0) {
          Promise.all(toDeleteIds.map(id => deleteDoc(doc(db, 'customer_memberships', id))))
            .catch(err => console.warn('Membership cleanup error:', err));
        }

        const filteredList = Object.values(latestByCustomer);
        const enriched = filteredList.map(m => {
          const cust = customers.find(c => c.id === m.customer_id);
          return { ...m, customer_name: cust?.name || 'Unknown', customer_mobile: cust?.mobile_number || 'Unknown' };
        });
        setMembershipRequests(enriched);
      } catch (e) { console.error('Fetch Membership Requests Error:', e); }
    };

    const deleteMembershipReq = async (id) => {
      if (!window.confirm('Permanently delete this membership request? This action cannot be undone.')) return;
      try {
        await deleteDoc(doc(db, 'customer_memberships', id));
        fetchMembershipRequests();
        alert('Request deleted.');
      } catch (err) { alert('Delete failed: ' + err.message); }
    };
 
    const saveMembership = async (e) => {
      e.preventDefault();
      setLoading(true);
      try {
        const dynamicCredits = {};
        screens.forEach(s => {
          dynamicCredits[s] = Number(membershipForm.per_screen_credits[s] || 0);
        });
        
        const data = {
          name: membershipForm.name,
          price: Number(membershipForm.price),
          validity_days: Number(membershipForm.validity_days),
          credit_type: membershipForm.credit_type || 'any',
          credits: Number(membershipForm.credits || 0),
          per_screen_credits: dynamicCredits,
          description: membershipForm.description,
          is_active: !!membershipForm.is_active,
          updated_at: serverTimestamp()
        };
        if (membershipForm.id) {
          await updateDoc(doc(db, 'membership_plans', membershipForm.id), data);
          alert('Membership updated!');
        } else {
          await addDoc(collection(db, 'membership_plans'), { ...data, created_at: serverTimestamp() });
          alert('Membership created!');
        }
        setShowMembershipModal(false);
        fetchMembershipPlans();
      } catch (err) { alert('Failed: ' + err.message); }
      finally { setLoading(false); }
    };
 
    const openMemApproveModal = (membership) => {
      const plan = membershipPlans.find(p => p.id === (membership.membership_id || membership.plan_id));
      setMemApproveTarget(membership);
      setMemApproveAmount(plan?.price || 0);
      setShowMemApproveModal(true);
    };

    const confirmMemApprove = async () => {
      if (!memApproveAmount || isNaN(memApproveAmount)) return alert('Enter valid amount.');
      setLoading(true);
      try {
        const membership = memApproveTarget;
        const plan = membershipPlans.find(p => p.id === (membership.membership_id || membership.plan_id));
        const days = plan?.validity_days || 30;
        
        const dataToSave = {
          status: 'active',
          paid_amount: Number(memApproveAmount),
          start_date: new Date().toISOString(),
          expiry_date: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString(),
          approved_at: serverTimestamp(),
          credit_type: plan?.credit_type || 'any',
          credits_remaining: {}
        };

        if (dataToSave.credit_type === 'any') {
          dataToSave.credits_remaining.total_hours = plan?.credits || 0;
        } else {
          dataToSave.credits_remaining.per_screen = { ...plan?.per_screen_credits };
        }
        
        await updateDoc(doc(db, 'customer_memberships', membership.id), dataToSave);
        
        if (membership.customer_id) {
          const type = membership.plan_name.toLowerCase().includes('gold') ? 'gold' : 
                       membership.plan_name.toLowerCase().includes('silver') ? 'silver' : 'other';
          await updateDoc(doc(db, 'customers', membership.customer_id), {
            is_member: true,
            membership_type: type,
            membership_id: membership.id,
            membership_plan_name: membership.plan_name
          });
          await createNotification({ userId: membership.customer_id, type: 'membership_active', message: `Welcome! Your ${membership.plan_name} membership is now ACTIVE. ✨` });
        }

        // Send WhatsApp Confirmation
        const expiryDateStr = new Date(dataToSave.expiry_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
        const waMsg = `Hello ${membership.customer_name}! Your ${membership.plan_name} membership at 43C has been CONFIRMED. ✨\n\nIt is valid until: ${expiryDateStr}\n\nYou can now enjoy member-exclusive pricing and perks. Welcome to the Circle! 🏛️`;
        
        let cleanPhone = (membership.customer_mobile || '').replace(/\D/g, '');
        if (cleanPhone) {
          if (!cleanPhone.startsWith('91')) cleanPhone = '91' + cleanPhone;
          openWhatsApp(cleanPhone, waMsg);
        }

        // Google Sheets Backup
        sendToGoogleSheet({
          type: "membership",
          name: membership.customer_name,
          mobile: membership.customer_mobile,
          details: `Membership Approved: ${membership.plan_name}`,
          amount: Number(memApproveAmount),
          status: "active"
        });

        alert('Membership approved and earnings logged. WhatsApp message opened.');
        setShowMemApproveModal(false);
        fetchActiveMemberships();
        fetchMembershipRequests();
        fetchAnalytics();
      } catch (err) { alert('Failed: ' + err.message); }
      finally { setLoading(false); }
    };

 
    const deleteMembership = async (id) => {
      if (!window.confirm('Delete this membership plan? All active/pending memberships using this plan will also be removed. Continue?')) return;
      try {
        await deleteDoc(doc(db, 'membership_plans', id));
        
        // Cascade delete: remove all memberships with this plan_id
        const q = query(collection(db, 'customer_memberships'), where('membership_id', '==', id));
        const snap = await getDocs(q);
        const batch = snap.docs.map(d => deleteDoc(doc(db, 'customer_memberships', d.id)));
        await Promise.all(batch);
        
        fetchMembershipPlans();
        fetchActiveMemberships();
        fetchMembershipRequests();
        alert('Plan and associated memberships deleted.');
      } catch (err) { alert('Delete failed: ' + err.message); }
    };
 
    const toggleMembershipActive = async (plan) => {
      try {
        await updateDoc(doc(db, 'membership_plans', plan.id), { is_active: !plan.is_active });
        fetchMembershipPlans();
      } catch (e) { alert('Failed'); }
    };
 
    const fetchAdmins = async () => {
      try { const snap = await getDocs(collection(db, 'admins')); setAdmins(snap.docs.map(d => ({ id: d.id, ...d.data() }))); } catch (e) { console.error(e); }
    };
 
    const deleteBooking = async (id) => {
      if (!window.confirm('PERMANENTLY DELETE this booking? This cannot be undone.')) return;
      try {
        const b = bookings.find(x => x.id === id);
        if (b) {
          await sendToGoogleSheet({
            type: "deleted",
            reason: "Manual admin delete",
            data: JSON.stringify(b)
          });
        }
        await deleteDoc(doc(db, 'bookings', id));
        setBookings(prev => prev.filter(b => b.id !== id));
        alert('Booking deleted permanently.');
      } catch (e) {
        alert('Delete failed: ' + e.message);
      }
    };

    const updateBookingStatus = async (id, status) => {
      try {
        const b = bookings.find(x => x.id === id);
        if (!b) return alert('Booking not found in state.');

        await updateDoc(doc(db, 'bookings', id), { status });
        
        if (status === 'confirmed') {
          // 🆕 Deduct Membership Credit if active and NOT already deducted by customer
          if (b.customer_id && !b.is_credit_booking) {
            const mQ = query(collection(db, 'customer_memberships'), 
              where('customer_id', '==', b.customer_id), 
              where('status', '==', 'active'),
              limit(1)
            );
            const mSnap = await getDocs(mQ);
            if (!mSnap.empty) {
              const mDoc = mSnap.docs[0];
              const mData = mDoc.data();
              const expiry = new Date(mData.expiry_date);
              
              if (expiry > new Date()) {
                if (mData.credit_type === 'any') {
                  const current = mData.credits_remaining?.total_hours || 0;
                  if (current > 0) {
                    await updateDoc(doc(db, 'customer_memberships', mDoc.id), {
                      'credits_remaining.total_hours': current - 1
                    });
                    console.log('Any-screen credit deducted.');
                  }
                } else if (mData.credit_type === 'per_screen') {
                  const bucket = SCREEN_MAP[b.screen];
                  const current = mData.credits_remaining?.per_screen?.[bucket] || 0;
                  if (bucket && current > 0) {
                    await updateDoc(doc(db, 'customer_memberships', mDoc.id), {
                      [`credits_remaining.per_screen.${bucket}`]: current - 1
                    });
                    console.log(`Per-screen credit deducted for ${bucket}.`);
                  }
                }
              }
            }
          }

          // 1. In-app notification for Customer
          await createNotification({
            userId: b.customer_id,
            type: 'booking_confirmed',
            message: `Your booking for ${b.booking_date} (${b.screen}) has been CONFIRMED! See you soon. ✨`,
            bookingId: id
          });

          // 2. Open WhatsApp for Admin
          sendBookingConfirmedWhatsApp({
            customerMobile: b.customer_mobile,
            customerName: b.customer_name,
            slots: b.slots,
            date: b.booking_date,
            guests: b.guest_count,
            totalAmount: b.final_price || b.price,
            advancePaid: b.advance_paid || 0,
            comboName: b.combo_applied?.name
          });

          // 3. Google Sheets Backup
          sendToGoogleSheet({
            type: "booking",
            name: b.customer_name,
            mobile: b.customer_mobile,
            details: `Slot booking confirmed (${b.screen})`,
            amount: b.final_price || b.price || 0,
            status: "confirmed"
          });
        }
      } catch (err) {
        console.error('Status update error:', err);
        alert('Failed to update status: ' + err.message);
      }
    };

    const updateBookingPrice = async (id, finalPrice) => {
      await updateDoc(doc(db, 'bookings', id), { final_price: Number(finalPrice) });
      setBookings(prev => prev.map(b => b.id === id ? { ...b, final_price: Number(finalPrice) } : b));
      setEditPrice(prev => ({ ...prev, [id]: undefined }));
    };

    const updateOrderStatus = async (id, status) => {
      try {
        const o = foodOrders.find(x => x.id === id);
        if (!o) return;

        await updateDoc(doc(db, 'food_orders', id), { status });
        setFoodOrders(prev => prev.map(o => o.id === id ? { ...o, status } : o));

        // Notify customer
        let msg = '';
        if (status === 'confirmed') msg = `✅ Your food order is confirmed and being prepared! Order #${id.slice(0, 6)}.`;
        if (status === 'served') msg = `🎉 Your order has been served. Enjoy! Order #${id.slice(0, 6)}.`;
        if (status === 'cancelled') msg = `❌ Your food order has been cancelled. Order #${id.slice(0, 6)}.`;

        if (msg && o.customer_id) {
          await createNotification({ 
            userId: o.customer_id, 
            type: `food_${status}`, 
            message: msg, 
            orderId: id 
          });

          // Google Sheets Backup on Confirmation
          if (status === 'confirmed') {
            sendToGoogleSheet({
              type: "food",
              name: o.customer_name,
              mobile: o.customer_mobile,
              details: "Food order confirmed",
              amount: o.final_price || o.total || 0,
              status: "confirmed"
            });
          }
        }
      } catch (err) {
        console.error('Order status update error:', err);
        alert('Failed to update order status');
      }
    };

    const updateOrderPrice = async (id, finalPrice) => {
      await updateDoc(doc(db, 'food_orders', id), { final_price: Number(finalPrice) });
      setFoodOrders(prev => prev.map(o => o.id === id ? { ...o, final_price: Number(finalPrice) } : o));
      setEditPrice(prev => ({ ...prev, [id]: undefined }));
    };

    const toggleCloseSlot = async (hour) => {
      const status = slotStatus[hour]; if (status === 'booked') return alert('Cannot close a booked slot.');
      try {
        if (status === 'closed') { const q = query(collection(db, 'closed_slots'), where('date', '==', slotDate), where('hour', '==', hour), where('screen', '==', slotScreen)); (await getDocs(q)).forEach(async d => await deleteDoc(doc(db, 'closed_slots', d.id))); }
        else { await addDoc(collection(db, 'closed_slots'), { date: slotDate, hour, screen: slotScreen, reason: 'Admin Closed', created_at: serverTimestamp() }); }
        fetchSlotData();
      } catch (e) { alert('Failed'); }
    };

    const manualBooking = async (e) => {
      e.preventDefault();
      if (bookingForm.slots.length === 0) return alert('Select at least one slot.');
      try {
        const q = query(collection(db, 'customers'), where('mobile_number', '==', bookingForm.mobile));
        const snap = await getDocs(q); let custId = '';
        if (!snap.empty) custId = snap.docs[0].id;
        else { const ref = await addDoc(collection(db, 'customers'), { name: bookingForm.name, mobile_number: bookingForm.mobile, created_at: serverTimestamp() }); custId = ref.id; }
        const totalPrice = 499 * bookingForm.slots.length;
        const bRef = await addDoc(collection(db, 'bookings'), { customer_id: custId, customer_name: bookingForm.name, customer_mobile: bookingForm.mobile, booking_date: bookingForm.date, screen: bookingForm.screen, slots: bookingForm.slots, guest_count: bookingForm.guest_count, original_price: totalPrice, final_price: totalPrice, price: totalPrice, status: 'confirmed', created_at: serverTimestamp() });
        await addDoc(collection(db, 'payments'), { booking_id: bRef.id, amount: totalPrice, status: 'confirmed', created_at: serverTimestamp() });
        
        // 🆕 Notify Customer
        await createNotification({
          userId: custId,
          type: 'booking_confirmed',
          message: `Your manual booking at 43C is confirmed! Date: ${bookingForm.date}, Slots: ${formatSlotsDisplay(bookingForm.slots)}. Enjoy your cinematic experience! ✨`,
          bookingId: bRef.id
        });

        // 🆕 Trigger WhatsApp Confirmation
        sendBookingConfirmedWhatsApp({
          customerMobile: bookingForm.mobile,
          customerName: bookingForm.name,
          slots: bookingForm.slots,
          date: bookingForm.date,
          guests: bookingForm.guest_count,
          totalAmount: totalPrice
        });

        // Google Sheets Backup
        sendToGoogleSheet({
          type: "booking",
          name: bookingForm.name,
          mobile: bookingForm.mobile,
          details: `Manual booking (${bookingForm.screen})`,
          amount: totalPrice,
          status: "confirmed"
        });

        alert('Booking created and confirmed.'); setShowBookingModal(false); setBookingForm({ name: '', mobile: '', screen: 'Screen 1', slots: [], guest_count: 2, date: getTodayStr() });
        if (view === 'bookings') fetchAllBookings();
      } catch (e) { alert('Failed: ' + e.message); }
    };

    const saveMenu = async (e) => {
      e.preventDefault();
      try {
        setLoading(true);
        const data = {
          name: menuForm.name || '',
          category: menuForm.category || 'Drinks',
          silver_price: Number(menuForm.silver_price || 0),
          gold_price: Number(menuForm.gold_price || 0),
          non_member_price: Number(menuForm.non_member_price || 0),
          discount: Number(menuForm.discount) || 0,
          image_url: menuForm.image_url || '',
          updated_at: serverTimestamp()
        };

        if (isEditingMenu && menuForm.id) {
          await updateDoc(doc(db, 'menu_items', menuForm.id), data);
        } else {
          await addDoc(collection(db, 'menu_items'), {
            ...data,
            available: true,
            created_at: serverTimestamp(),
          });
        }
        setShowMenuModal(false);
        setMenuForm({ id: '', name: '', category: menuCategories[0] || 'Drinks', silver_price: '', gold_price: '', non_member_price: '', discount: '', image_url: '' });
        setIsEditingMenu(false);
        fetchMenu();
      } catch (err) {
        console.error('Save Menu Error:', err);
        alert('Failed to save menu item: ' + err.message);
      } finally {
        setLoading(false);
      }
    };

    const deleteMenu = async (id) => {
      if (!window.confirm('Delete this item?')) return;
      try { await deleteDoc(doc(db, 'menu_items', id)); fetchMenu(); } catch (e) { alert('Failed'); }
    };

    const saveCategory = async () => {
      const cat = newCategory.trim();
      if (!cat) return;
      if (menuCategories.includes(cat)) return alert('Category already exists.');
      const updated = [...menuCategories, cat];
      setMenuCategories(updated);
      setNewCategory('');
      setShowAddCategory(false);
      try { await setDoc(doc(db, 'settings', 'menu_categories'), { categories: updated }); } catch (e) { /* ignore */ }
    };

    const deleteCategory = async (cat) => {
      const inUse = menuItems.some(m => m.category === cat);
      if (inUse) return alert(`Cannot delete "${cat}" — it has menu items. Reassign them first.`);
      const updated = menuCategories.filter(c => c !== cat);
      setMenuCategories(updated);
      try { await setDoc(doc(db, 'settings', 'menu_categories'), { categories: updated }); } catch (e) { /* ignore */ }
    };

    const logExpense = async (e) => {
      e.preventDefault();
      try { 
        const docRef = await addDoc(collection(db, 'expenses'), { ...expenseForm, amount: Number(expenseForm.amount), created_at: serverTimestamp() }); 
        
        // Google Sheets Backup
        sendToGoogleSheet({
          type: "expense",
          name: "admin",
          details: `Expense: ${expenseForm.title}`,
          amount: Number(expenseForm.amount),
          status: "added"
        });

        setShowExpenseModal(false); 
        setExpenseForm({ title: '', amount: '', date: getTodayStr() }); 
        fetchExpenses(); 
      } catch (e) { alert('Failed'); }
    };

    const saveAdmin = async (e) => {
      e.preventDefault();
      if (adminForm.mobile.length < 10) return alert('Enter valid mobile.');
      try { await addDoc(collection(db, 'admins'), { ...adminForm, created_at: serverTimestamp() }); setShowAdminModal(false); setAdminForm({ name: '', mobile: '', password: '' }); fetchAdmins(); alert('Admin added.'); } catch (e) { alert('Failed'); }
    };

    const deleteAdmin = async (id) => {
      if (!window.confirm('Remove admin?')) return;
      try { await deleteDoc(doc(db, 'admins', id)); fetchAdmins(); } catch (e) { alert('Failed'); }
    };

    const openCancelModal = (id, type) => { setCancelTarget({ id, type }); setCancelReason(''); setShowCancelModal(true); };
    const confirmCancel = async () => {
      if (!cancelReason.trim()) return alert('Please enter a cancellation reason.');
      const { id, type } = cancelTarget;
      try {
        if (type === 'booking') {
          const b = bookings.find(x => x.id === id);
          if (b?.status === 'completed') return alert('Cannot cancel a completed booking.');
          await updateDoc(doc(db, 'bookings', id), { status: 'cancelled', cancel_reason: cancelReason });
          setBookings(prev => prev.map(x => x.id === id ? { ...x, status: 'cancelled', cancel_reason: cancelReason } : x));
          
          // Google Sheets Archive
          sendToGoogleSheet({
            type: "deleted",
            reason: `Cancelled: ${cancelReason}`,
            data: JSON.stringify(b)
          });

          await createNotification({ userId: b.customer_id, type: 'booking_cancelled', message: `Your booking on ${b.booking_date} has been cancelled. Reason: ${cancelReason}`, bookingId: id });
        } else if (type === 'order') {
          const o = foodOrders.find(x => x.id === id);
          await updateDoc(doc(db, 'food_orders', id), { status: 'cancelled', cancel_reason: cancelReason });
          setFoodOrders(prev => prev.map(x => x.id === id ? { ...x, status: 'cancelled', cancel_reason: cancelReason } : x));
          
          // Google Sheets Archive
          if (o) {
            sendToGoogleSheet({
              type: "deleted",
              reason: `Order Cancelled: ${cancelReason}`,
              data: JSON.stringify(o)
            });
          }
          if (o) await createNotification({ userId: o.customer_id, type: 'order_cancelled', message: `Your food order #${id.slice(0, 6)} has been cancelled. Reason: ${cancelReason}`, orderId: id });
        } else if (type === 'membership') {
          const m = membershipRequests.find(x => x.id === id);
          await updateDoc(doc(db, 'customer_memberships', id), { status: 'cancelled', cancel_reason: cancelReason });
          if (m) {
            await createNotification({ userId: m.customer_id, type: 'membership_cancelled', message: `Your ${m.plan_name} membership request has been declined. Reason: ${cancelReason}` });
          }
          fetchMembershipRequests();
        }
      } catch (e) { alert('Failed: ' + e.message); }
      setShowCancelModal(false);
    };

    const openAdvanceModal = (booking) => { setAdvanceTarget(booking); setAdvanceAmount(''); setShowAdvanceModal(true); };
    const confirmAdvancePayment = async () => {
      if (!advanceAmount || isNaN(advanceAmount)) return alert('Enter valid amount.');
      const adv = Number(advanceAmount);
      const total = advanceTarget.final_price || advanceTarget.price || 0;
      const remaining = total - adv;
      try {
        await updateDoc(doc(db, 'bookings', advanceTarget.id), {
          status: 'confirmed',
          advance_paid: adv,
          remaining_amount: remaining,
          total_amount: total,
        });
        
        // Notify Customer
        if (advanceTarget.customer_id) {
          await createNotification({
            userId: advanceTarget.customer_id,
            type: 'booking_confirmed',
            message: `Your booking at 43C is confirmed! Date: ${advanceTarget.booking_date}, Slots: ${formatSlotsDisplay(advanceTarget.slots)}, Guests: ${advanceTarget.guest_count}. Remaining to pay on arrival: ₹${remaining}. Enjoy your cinematic experience!`,
            bookingId: advanceTarget.id,
          });
        }

        sendBookingConfirmedWhatsApp({
          customerMobile: advanceTarget.customer_mobile,
          customerName: advanceTarget.customer_name,
          slots: advanceTarget.slots,
          date: advanceTarget.booking_date,
          guests: advanceTarget.guest_count,
          totalAmount: total,
          advancePaid: adv,
          comboName: advanceTarget.combo_applied?.name
        });

        // Google Sheets Backup
        sendToGoogleSheet({
          type: "booking",
          name: advanceTarget.customer_name,
          mobile: advanceTarget.customer_mobile,
          details: `Slot booking confirmed (${advanceTarget.screen})`,
          amount: total,
          status: "confirmed"
        });
      } catch (e) { alert('Failed: ' + e.message); }
      setShowAdvanceModal(false);
    };

    const refreshNotifCounts = (bkList, foList) => {
      setNotifCount({
        bookings: (bkList || bookings).filter(b => b.status === 'pending').length,
        orders: (foList || foodOrders).filter(o => o.status === 'pending').length,
      });
    };

    const updateOrderStatusWithNotif = updateOrderStatus;

    const openDueModal = (booking) => { setDueTarget(booking); setDueAmount(''); setShowDueModal(true); };
    const saveDueAmount = async () => {
      if (!dueAmount || isNaN(dueAmount)) return alert('Enter valid amount.');
      const finalPaid = Number(dueAmount);
      try {
        await updateDoc(doc(db, 'bookings', dueTarget.id), {
          status: 'completed',
          final_paid: finalPaid,
          remaining_amount: Math.max(0, (dueTarget.final_price || dueTarget.price || 0) - (dueTarget.advance_paid || 0) - finalPaid),
        });
        setBookings(prev => prev.map(b => b.id === dueTarget.id ? { ...b, status: 'completed', final_paid: finalPaid } : b));
        await createNotification({ userId: dueTarget.customer_id, type: 'booking_completed', message: `Your visit is complete! Thank you for visiting 43C. Total paid: ₹${(dueTarget.advance_paid || 0) + finalPaid}`, bookingId: dueTarget.id });
      } catch (e) { alert('Failed'); }
      setShowDueModal(false);
    };

    const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const navItems = [
      { id: 'overview', icon: <LayoutDashboard size={18} />, label: 'Overview' },
      { id: 'tasks', icon: <ClipboardList size={18} />, label: 'Tasks / Calendar' },
      { id: 'bookings', icon: <Calendar size={18} />, label: 'Bookings' },
      { id: 'slots', icon: <Clock size={18} />, label: 'Slot Control' },
      { id: 'orders', icon: <UtensilsCrossed size={18} />, label: 'Food Orders' },
      { id: 'menu', icon: <Coffee size={18} />, label: 'Menu' },
      { id: 'food_combos', icon: <UtensilsCrossed size={18} />, label: 'Food Combos' },
      { id: 'combos', icon: <Ticket size={18} />, label: 'Lounge Combos' },
      { id: 'coupons', icon: <Shield size={18} />, label: 'Coupons' },
      { id: 'memberships', icon: <CreditCard size={18} />, label: 'Memberships' },
      { id: 'members', icon: <Users size={18} />, label: 'Members' },
      { id: 'expenses', icon: <Wallet size={18} />, label: 'Expenses' },
      { id: 'analytics', icon: <BarChart2 size={18} />, label: 'Analytics' },
      { id: 'tasks_live', icon: <CheckSquare size={18} />, label: 'Live Tasks' },
      { id: 'admin_flow', icon: <BookOpen size={18} />, label: 'Operational Guide' },
      { id: 'customer_flow', icon: <Map size={18} />, label: 'Customer Flow' },
      { id: 'settings', icon: <Settings size={18} />, label: 'Settings' },
      { id: 'admins', icon: <Lock size={18} />, label: 'Admins' },
    ];

    return (
      <div className="flex min-h-screen luxury-bg mesh-pattern relative">
        <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-[#0a1128]/95 backdrop-blur-2xl border-b border-accent/10 z-[60] flex items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <img src={logo43c} alt="43C" className="h-8 w-8 object-contain rounded-lg" onError={e => e.target.style.display = 'none'} />
            <h1 className="text-sm font-heading gold-text-gradient font-black">Control Panel</h1>
          </div>
          <div className="flex items-center gap-3">
            <AdminNotificationBell onNavigate={(v) => { setView(v); setIsSidebarOpen(false); }} />
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="text-accent p-2 bg-white/5 rounded-lg border border-white/10 flex-shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center relative">
              {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {isSidebarOpen && (
          <div className="lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[45]" onClick={() => setIsSidebarOpen(false)} />
        )}

        <div className={`w-64 bg-[#0a1128]/95 backdrop-blur-2xl border-r border-[#D4A95F]/20 p-4 lg:p-6 space-y-6 shrink-0 flex flex-col h-[100dvh] fixed lg:sticky top-0 left-0 z-50 transition-transform duration-300 ease-in-out lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="hidden lg:flex items-center gap-3">
            <img src={logo43c} alt="43C" className="h-8 w-8 object-contain rounded-lg" onError={e => e.target.style.display = 'none'} />
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-heading gold-text-gradient font-black truncate">Control</h1>
              <p className="text-[8px] uppercase tracking-[0.3em] text-white/30">Admin Panel</p>
            </div>
            <AdminNotificationBell onNavigate={setView} />
          </div>

          <div className="lg:hidden mt-14"></div>

          <nav className="space-y-1 flex-1 overflow-y-auto pr-1 pb-16 lg:pb-0 scrollbar-hide">
            {navItems.map(item => (
              <button key={item.id} onClick={() => { setView(item.id); setIsSidebarOpen(false); }}
                className={`w-full flex items-center justify-between px-4 py-3 min-h-[44px] rounded-xl transition-all text-sm ${view === item.id ? 'bg-accent text-primary font-bold shadow-[0_0_15px_rgba(212,169,95,0.2)]' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
              >
                <div className="flex items-center gap-3">{item.icon}<span className="uppercase tracking-wider text-[11px]">{item.label}</span></div>
                {item.id === 'bookings' && notifCount.bookings > 0 && <span className="bg-red-500 text-white text-[9px] w-5 h-5 flex items-center justify-center rounded-full font-black ml-auto">{notifCount.bookings}</span>}
                {item.id === 'orders' && notifCount.orders > 0 && <span className="bg-red-500 text-white text-[9px] w-5 h-5 flex items-center justify-center rounded-full font-black ml-auto">{notifCount.orders}</span>}
                {item.id === 'memberships' && notifCount.memberships > 0 && <span className="bg-red-500 text-white text-[9px] w-5 h-5 flex items-center justify-center rounded-full font-black ml-auto">{notifCount.memberships}</span>}
              </button>
            ))}
          </nav>
          <button onClick={() => { localStorage.removeItem('admin_access'); window.location.href = '/admin-login'; }}
            className="w-full py-3 min-h-[44px] rounded-xl border border-red-500/20 text-red-500 hover:bg-red-500/10 font-bold text-[10px] uppercase tracking-widest transition-all mb-4 lg:mb-0 bg-[#0a1128]">
            Log Out
          </button>
        </div>

        <div className="flex-1 p-4 lg:p-8 pt-20 lg:pt-8 w-full overflow-y-auto h-[100dvh]">
          <AnimatePresence mode="wait">

            {view === 'overview' && analytics && (
              <motion.div key="ov" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                <div className="flex justify-between items-end">
                  <div><h2 className="text-4xl font-heading mb-1">Dashboard <span className="gold-text-gradient italic">Overview</span></h2><p className="text-white/30 text-[10px] uppercase tracking-widest">Current Month Performance</p></div>
                  <div className="flex gap-3">
                    <button onClick={() => setShowExpenseModal(true)} className="glass-card !border-white/5 px-5 py-2.5 flex items-center gap-2 text-xs uppercase tracking-widest font-bold hover:bg-white/5"><Wallet className="w-4 h-4 text-accent" />Log Expense</button>
                    <button onClick={() => setShowBookingModal(true)} className="gold-button !px-5 !py-2.5 !text-xs flex items-center gap-2"><Plus className="w-4 h-4" />Manual Book</button>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
                  {[
                    { label: "Today's Guests", val: analytics.today_bookings, cls: 'text-accent' },
                    { label: "Today's Revenue", val: '₹' + analytics.today_revenue, cls: 'text-green-400' },
                    { label: 'Monthly Expenses', val: '₹' + analytics.monthly_expenses, cls: 'text-red-400' },
                    { label: 'Net Profit', val: '₹' + analytics.net_profit, cls: 'gold-text-gradient' },
                  ].map(c => (
                    <div key={c.label} className="navy-card p-6"><p className="text-white/30 text-[9px] uppercase tracking-widest font-black mb-2">{c.label}</p><h3 className={`text-2xl font-heading font-black ${c.cls}`}>{c.val}</h3></div>
                  ))}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="navy-card p-6 border-orange-500/20 bg-orange-500/5"><p className="text-white/30 text-[9px] uppercase tracking-widest font-black mb-2">Monthly Food Revenue</p><h3 className="text-2xl font-heading text-orange-400 font-black">₹{analytics.monthly_food_rev}</h3><p className="text-[9px] text-white/20 mt-1">{analytics.total_food_orders} total orders</p></div>
                  <div className="navy-card p-6 border-blue-500/20 bg-blue-500/5"><p className="text-white/30 text-[9px] uppercase tracking-widest font-black mb-2">Monthly Booking Revenue</p><h3 className="text-2xl font-heading text-blue-400 font-black">₹{analytics.monthly_booking_rev}</h3></div>
                </div>
              </motion.div>
            )}

            {view === 'tasks' && (
              <motion.div key="tk" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-3xl font-heading">Tasks & <span className="gold-text-gradient italic">Calendar</span></h2>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="glass-card p-6 border-white/10">
                    <div className="flex justify-between items-center mb-6">
                      <button onClick={() => setCalendarMonth(p => { if (p === 0) { setCalendarYear(y => y - 1); return 11; } return p - 1; })} className="text-white/40 hover:text-accent font-bold px-3 py-1 bg-white/5 rounded-lg">&lt;</button>
                      <h3 className="font-heading font-black text-lg text-accent uppercase tracking-widest">{MONTHS[calendarMonth]} {calendarYear}</h3>
                      <button onClick={() => setCalendarMonth(p => { if (p === 11) { setCalendarYear(y => y + 1); return 0; } return p + 1; })} className="text-white/40 hover:text-accent font-bold px-3 py-1 bg-white/5 rounded-lg">&gt;</button>
                    </div>
                    <div className="grid grid-cols-7 gap-2 text-center text-[10px] font-black uppercase text-white/30 mb-4">
                      {['Sn', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <div key={d}>{d}</div>)}
                    </div>
                    <div className="grid grid-cols-7 gap-2">
                      {(() => {
                        const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
                        const firstDay = new Date(calendarYear, calendarMonth, 1).getDay();
                        const cells = [];
                        for (let i = 0; i < firstDay; i++) cells.push(<div key={`e-${i}`} />);
                        for (let d = 1; d <= daysInMonth; d++) {
                          const dateStr = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                          const isSel = dateStr === selectedTaskDate;
                          const hasTask = tasks.some(t => t.date === dateStr && !t.completed);
                          const hasBooking = bookings.some(b => b.booking_date === dateStr && (b.status === 'confirmed' || b.status === 'completed'));

                          cells.push(
                            <button key={d} onClick={() => setSelectedTaskDate(dateStr)} className={`relative h-10 rounded-xl flex items-center justify-center font-bold text-sm transition-colors border ${isSel ? 'bg-accent/20 border-accent text-accent' : 'bg-white/5 border-white/10 hover:border-white/30 text-white/70'}`}>
                              {d}
                              <div className="absolute top-1 right-1 flex gap-0.5">
                                {hasBooking && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                                {hasTask && <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />}
                              </div>
                            </button>
                          );
                        }
                        return cells;
                      })()}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="p-4 bg-white/5 border border-white/10 border-b-0 rounded-t-2xl flex justify-between items-center -mb-6">
                      <h3 className="font-heading text-lg">{new Date(selectedTaskDate).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</h3>
                    </div>

                    <div className="glass-card p-6 !rounded-t-none border-t border-white/10 max-h-[400px] overflow-y-auto space-y-6">
                      {(() => {
                        const dayBookings = bookings.filter(b => b.booking_date === selectedTaskDate && (b.status === 'confirmed' || b.status === 'completed'))
                          .map(b => ({ type: 'booking', time: getSlotLabel(b.slots[0]).split(' - ')[0], rawTime: b.slots[0], data: b }));
                        const dayTasks = tasks.filter(t => t.date === selectedTaskDate)
                          .map(t => ({ type: 'task', time: t.time, rawTime: parseInt((t.time || '0').split(':')[0]) + parseInt((t.time || '0').split(':')[1] || 0) / 60, data: t }));

                        const allEvents = [...dayBookings, ...dayTasks].sort((a, b) => a.rawTime - b.rawTime);

                        if (allEvents.length === 0) return <p className="text-white/30 text-xs text-center py-10 font-bold uppercase tracking-widest">No scheduled events</p>;

                        return allEvents.map((ev, idx) => (
                          <div key={idx} className="flex gap-4">
                            <div className="w-14 flex-shrink-0 text-right pt-2 mt-0.5">
                              <span className={`text-[10px] font-black tracking-widest uppercase ${ev.type === 'booking' ? 'text-blue-400' : 'text-orange-400'}`}>{ev.time}</span>
                            </div>
                            <div className="flex-1 border-l-2 border-white/10 pl-4 py-1 relative">
                              <div className={`absolute -left-[5px] top-3 w-2 h-2 rounded-full ${ev.type === 'booking' ? 'bg-blue-400 shadow-[0_0_8px_#3b82f6]' : 'bg-orange-400 shadow-[0_0_8px_#f97316]'}`} />
                              {ev.type === 'booking' ? (
                                <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded-xl">
                                  <p className="font-bold text-sm text-blue-100">{ev.data.customer_name} <span className="opacity-50 font-normal">({ev.data.guest_count} guests)</span></p>
                                  <p className="text-[10px] uppercase text-blue-400 mt-1 font-black">{ev.data.screen} · Slots: {formatSlotsDisplay(ev.data.slots)}</p>
                                </div>
                              ) : (
                                <div className={`flex items-center justify-between p-3 rounded-xl border ${ev.data.completed ? 'bg-green-500/5 text-white/40 border-green-500/10' : 'bg-orange-500/5 border-orange-500/20'}`}>
                                  <div className={`font-bold text-sm leading-tight ${ev.data.completed ? 'line-through' : 'text-orange-100'}`}>{ev.data.title}</div>
                                  <div className="flex items-center gap-2">
                                    <button onClick={() => toggleTask(ev.data.id, ev.data.completed)} className={`border px-2 py-1 rounded text-[9px] uppercase font-black ${ev.data.completed ? 'text-green-500 border-green-500/30 hover:bg-green-500/10' : 'text-orange-400 border-orange-500/30 hover:bg-orange-500/20'}`}>
                                      {ev.data.completed ? 'Done' : 'Mark Done'}
                                    </button>
                                    <button onClick={() => deleteTask(ev.data.id)} className="text-red-400/50 hover:text-red-400 transition-colors bg-red-500/10 p-1.5 rounded-md"><X size={12} /></button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ));
                      })()}
                    </div>

                    <div className="glass-card p-5 !border-accent/30 space-y-3 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 blur-3xl -z-10 rounded-full" />
                      <h4 className="text-[10px] uppercase tracking-widest font-black text-accent mb-2 flex items-center gap-1.5"><CheckSquare size={12} />{selectedTaskDate} Schedule</h4>
                      <form onSubmit={addTask} className="flex flex-col sm:flex-row gap-2">
                        <input type="text" required placeholder="To-do element..." className="flex-1 bg-white/5 border border-white/10 px-3 py-2 text-sm rounded-xl outline-none focus:border-accent" value={taskForm.title} onChange={e => setTaskForm({ ...taskForm, title: e.target.value })} />
                        <input type="time" required className="w-28 bg-white/5 border border-white/10 px-3 py-2 text-sm rounded-xl outline-none focus:border-accent text-white" value={taskForm.time} onChange={e => setTaskForm({ ...taskForm, time: e.target.value })} />
                        <button className="gold-button !px-4 !py-2 !text-[10px] uppercase font-black"><Plus size={14} /></button>
                      </form>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {view === 'bookings' && (() => {
              const filtered = bookings.filter(b => {
                if (filterStatus !== 'all' && b.status !== filterStatus) return false;
                if (filterDate && b.booking_date !== filterDate) return false;
                return true;
              });
              return (
                <motion.div key="bk" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <h2 className="text-3xl font-heading">Reservations <span className="gold-text-gradient italic">Manifest</span></h2>
                    <button onClick={() => setShowBookingModal(true)} className="gold-button !px-5 !py-2.5 !text-xs flex items-center gap-2"><Plus size={14} />Manual Book</button>
                  </div>
                  <div className="flex flex-wrap gap-2 items-center glass-card p-4">
                    {['pending', 'confirmed', 'completed', 'cancelled', 'all'].map(s => {
                      const clsMap = { pending: 'border-yellow-500/40 text-yellow-400 bg-yellow-500/10', confirmed: 'border-blue-500/40 text-blue-400 bg-blue-500/10', completed: 'border-green-500/40 text-green-400 bg-green-500/10', cancelled: 'border-red-500/40 text-red-400 bg-red-500/10', all: 'border-white/20 text-white/60 bg-white/5' };
                      const cnt = s === 'all' ? bookings.length : bookings.filter(b => b.status === s).length;
                      return (
                        <button key={s} onClick={() => setFilterStatus(s)}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border flex items-center gap-1.5 ${filterStatus === s ? (clsMap[s] || 'bg-accent text-primary border-accent') : 'bg-white/5 border-white/10 text-white/30 hover:text-white'}`}
                        >{s} <span className="opacity-60">({cnt})</span></button>
                      );
                    })}
                    <div className="ml-auto flex items-center gap-2">
                      <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="bg-white/5 border border-white/10 text-white text-xs rounded-lg px-3 py-2 outline-none" />
                      {filterDate && <button onClick={() => setFilterDate('')} className="text-[9px] text-red-400 border border-red-500/20 px-2 py-1 rounded-lg">✕ Date</button>}
                    </div>
                  </div>
                  <div className="space-y-3">
                    {filtered.map(b => {
                      const wa = editWaMobile[b.id] ?? b.customer_mobile;
                      return (
                        <div key={b.id} className="glass-card p-5">
                          <div className="flex flex-col md:flex-row justify-between gap-4">
                            <div className="flex-1">
                              <p className="text-accent text-[10px] font-black tracking-widest uppercase mb-1">#{b.id.slice(0, 8)}</p>
                              <p className="font-bold">{b.customer_name} <span className="text-white/30 font-normal text-sm">· {b.customer_mobile}</span></p>
                              <p className="text-sm text-white/50 mt-1">{b.booking_date} · {b.screen || 'Screen 1'} · {formatSlotsDisplay(b.slots)} · {b.guest_count} guests</p>
                              {b.combo_applied && (
                                <div className="mt-2 p-2 bg-accent/10 border border-accent/20 rounded-xl max-w-fit">
                                  <p className="text-[10px] uppercase font-black tracking-widest text-accent flex items-center gap-1.5">
                                    <Ticket size={10}/> Combo: {b.combo_applied.name} (₹{b.combo_applied.price})
                                  </p>
                                </div>
                              )}
                              <div className="flex items-center gap-3 mt-2 flex-wrap">
                                <p className="text-[10px] text-white/30">Total: ₹{b.final_price || b.price}</p>
                                {b.advance_paid != null && <p className="text-[10px] text-green-400">Adv: ₹{b.advance_paid}</p>}
                                {b.remaining_amount != null && <p className="text-[10px] text-yellow-400">Due: ₹{b.remaining_amount}</p>}
                                {b.coupon_applied && <p className="text-[10px] text-blue-400">Coupon: {b.coupon_applied}</p>}
                                {b.cancel_reason && <p className="text-[10px] text-red-400">Reason: {b.cancel_reason}</p>}
                              </div>
                              <div className="flex items-center gap-2 mt-2">
                                <input type="tel" value={wa} onChange={e => setEditWaMobile(p => ({ ...p, [b.id]: e.target.value }))}
                                  className="bg-white/5 border border-white/10 text-white text-[10px] rounded-lg px-2 py-1 w-32 outline-none focus:border-accent" placeholder="WhatsApp No." maxLength={10} />
                                <button onClick={() => openAdminWhatsApp({ 
                                  customerMobile: wa, 
                                  customerName: b.customer_name, 
                                  slots: b.slots || [], 
                                  date: b.booking_date, 
                                  guests: b.guest_count, 
                                  totalAmount: b.final_price || b.price || 0,
                                  comboName: b.combo_applied?.name 
                                })}
                                  className="flex items-center gap-1 text-[9px] bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-1 rounded-lg font-black uppercase">
                                  <Phone size={10} /> WhatsApp
                                </button>
                              </div>
                            </div>
                            <div className="flex flex-col gap-2 items-end justify-center">
                              <StatusBadge s={b.status || 'pending'} />
                              {b.status === 'pending' && (
                                <button onClick={() => openAdvanceModal(b)} className="text-[9px] bg-blue-500/20 text-blue-400 border border-blue-500/30 px-3 py-1.5 rounded-lg font-black uppercase">
                                  Confirm + Advance
                                </button>
                              )}
                              {b.status === 'confirmed' && (
                                <button onClick={() => openDueModal(b)} className="text-[9px] bg-green-500/20 text-green-400 border border-green-500/30 px-3 py-1.5 rounded-lg font-black uppercase">
                                  Mark Completed
                                </button>
                              )}
                              {b.status !== 'cancelled' && b.status !== 'completed' && (
                                <button onClick={() => openCancelModal(b.id, 'booking')} className="text-[9px] bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg font-black uppercase">Cancel</button>
                              )}
                              <button onClick={() => deleteBooking(b.id)} className="text-[9px] bg-red-500 text-white px-3 py-1.5 rounded-lg font-black uppercase hover:bg-red-600 transition-colors">Perm Delete</button>
                              <div className="flex items-center gap-2">
                                {editPrice[b.id] !== undefined
                                  ? <React.Fragment><input type="number" className="bg-white/5 border border-accent/40 text-white text-xs rounded-lg px-2 py-1 w-24 outline-none" value={editPrice[b.id]} onChange={e => setEditPrice(p => ({ ...p, [b.id]: e.target.value }))} />
                                    <button onClick={() => updateBookingPrice(b.id, editPrice[b.id])} className="text-[9px] bg-accent text-primary px-2 py-1 rounded-lg font-black uppercase">Save</button>
                                    <button onClick={() => setEditPrice(p => ({ ...p, [b.id]: undefined }))} className="text-[9px] text-white/30 px-1">✕</button></React.Fragment>
                                  : <button onClick={() => setEditPrice(p => ({ ...p, [b.id]: b.final_price || b.price || 0 }))} className="text-[9px] uppercase tracking-widest text-accent/70 hover:text-accent font-black border border-accent/20 px-2 py-1 rounded-lg">Edit Price</button>
                                }
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </motion.div>
              );
            })()}

            {view === 'slots' && (
              <motion.div key="sl" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <h2 className="text-3xl font-heading">Slot <span className="gold-text-gradient italic">Control</span></h2>
                  <select className="bg-white/5 border border-white/10 p-2.5 rounded-lg outline-none text-white text-[10px] py-3 uppercase tracking-widest font-bold" value={slotScreen} onChange={e => setSlotScreen(e.target.value)}>
                    {['Screen 1', 'Screen 2', 'TV Screen'].map(s => <option key={s} value={s} className="bg-primary">{s}</option>)}
                  </select>
                </div>
                <div className="glass-card p-6">
                  <div className="flex gap-3 overflow-x-auto pb-3">
                    {availableDates.map(date => {
                      const d = new Date(date + 'T00:00:00'); const sel = date === slotDate; return (
                        <button key={date} onClick={() => setSlotDate(date)} className={`flex-shrink-0 flex flex-col items-center p-3 rounded-xl border min-w-[60px] transition-all ${sel ? 'bg-accent border-accent text-primary' : 'bg-white/5 border-white/10 hover:border-accent/30'}`}>
                          <span className="text-[9px] uppercase font-black">{d.toLocaleDateString('en', { weekday: 'short' })}</span>
                          <span className="text-lg font-heading font-bold">{d.getDate()}</span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-6 grid grid-cols-1 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {SLOT_HOURS.map(h => {
                      const s = slotStatus[h]; return (
                        <div key={h} className={`p-4 rounded-2xl border text-center transition-all ${s === 'booked' ? 'bg-red-500/10 border-red-500/30 text-red-400 cursor-not-allowed' : s === 'closed' ? 'bg-gray-800 border-gray-600 text-gray-500' : 'bg-white/5 border-white/10 text-white'}`}>
                          <div className="font-heading font-bold">{getSlotLabel(h).split(' - ')[0]}</div>
                          <div className="text-[9px] uppercase tracking-widest mt-1 opacity-60 mb-3">{s || 'available'}</div>
                          {s !== 'booked' && <button onClick={() => toggleCloseSlot(h)} className={`text-[8px] uppercase tracking-widest font-black px-3 py-1 rounded-full w-full border ${s === 'closed' ? 'bg-green-500/20 text-green-500 border-green-500/20' : 'bg-red-500/20 text-red-500 border-red-500/20'}`}>{s === 'closed' ? 'Open' : 'Close'}</button>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {view === 'orders' && (
              <motion.div key="or" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <h2 className="text-3xl font-heading">Food <span className="gold-text-gradient italic">Orders</span></h2>
                <div className="space-y-4">
                  {foodOrders.map(o => (
                    <div key={o.id} className="glass-card p-5">
                      <div className="flex flex-col md:flex-row justify-between gap-4">
                        <div className="flex-1">
                          <p className="text-accent text-[10px] font-black tracking-widest uppercase mb-1">#{o.id.slice(0, 8)}</p>
                          <p className="font-bold">{o.customer_name} <span className="text-white/30 font-normal text-sm">· {o.customer_mobile}</span></p>
                          <div className="mt-3 space-y-1.5">
                            {(o.items || []).map((item, i) => {
                              const isCombo = item.type === 'combo' && item.items && item.items.length > 0;
                              return isCombo ? (
                                <div key={i} className="bg-accent/5 border border-accent/20 rounded-xl p-3">
                                  {/* Combo header: name + total price only */}
                                  <div className="flex justify-between items-center mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[7px] bg-accent text-primary px-1.5 py-0.5 rounded font-black uppercase tracking-widest">Combo</span>
                                      <p className="text-sm font-black text-white">{item.qty}× {item.name}</p>
                                    </div>
                                    <p className="text-accent font-bold text-sm">₹{(item.price || 0) * item.qty}</p>
                                  </div>
                                  {/* Prep breakdown — items only, no prices */}
                                  <div className="space-y-0.5 border-t border-accent/10 pt-2">
                                    <p className="text-[8px] uppercase tracking-widest text-white/25 font-black mb-1">Prep:</p>
                                    {item.items.map((sub, si) => (
                                      <div key={si} className="flex justify-between items-center px-1">
                                        <p className="text-xs text-white/60">· {sub.name}</p>
                                        <p className="text-xs font-black text-white">{(sub.qty || 1) * item.qty}×</p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : (
                                /* Regular item: just qty × name, no price */
                                <div key={i} className="flex items-center py-1.5 px-2 rounded-lg bg-white/3 border border-white/5">
                                    <p className="text-sm text-white/70">{item.qty}× {item.name}</p>
                                </div>
                              );
                            })}
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            <p className="text-[10px] text-white/30">Original: ₹{o.original_price || o.total}</p>
                            <p className="text-sm font-bold text-accent">Final: ₹{o.final_price || o.total}</p>
                            {o.cancel_reason && <p className="text-[10px] text-red-400">Reason: {o.cancel_reason}</p>}
                          </div>
                          <div className="mt-3">
                            <button onClick={() => sendFoodOrderWhatsApp({
                              customerMobile: o.customer_mobile,
                              customerName: o.customer_name,
                              items: o.items || [],
                              totalAmount: o.final_price || o.total
                            })}
                              className="flex items-center gap-2 text-[10px] bg-green-500/20 text-green-400 border border-green-500/30 px-3 py-1.5 rounded-lg font-black uppercase tracking-widest hover:bg-green-500/30 transition-all">
                              <MessageCircle size={14} /> Send Bill via WhatsApp
                            </button>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 items-end justify-center">
                          <StatusBadge s={o.status || 'pending'} />
                          <select value={o.status || 'pending'} onChange={e => updateOrderStatusWithNotif(o.id, e.target.value)}
                            className="bg-white/5 border border-white/10 text-white text-xs rounded-lg px-3 py-1.5 outline-none">
                            {ORDER_STATUSES.map(s => <option key={s} value={s} className="bg-[#0a1128]">{s}</option>)}
                          </select>
                          {o.status !== 'cancelled' && o.status !== 'served' && (
                            <button onClick={() => openCancelModal(o.id, 'order')} className="text-[9px] bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1.5 rounded-lg font-black uppercase">Cancel</button>
                          )}
                          <div className="flex items-center gap-2">
                            {editPrice['o_' + o.id] !== undefined
                              ? <React.Fragment><input type="number" className="bg-white/5 border border-accent/40 text-white text-xs rounded-lg px-2 py-1 w-24 outline-none" value={editPrice['o_' + o.id]} onChange={e => setEditPrice(p => ({ ...p, ['o_' + o.id]: e.target.value }))} />
                                <button onClick={() => updateOrderPrice(o.id, editPrice['o_' + o.id])} className="text-[9px] bg-accent text-primary px-2 py-1 rounded-lg font-black uppercase">Save</button>
                                <button onClick={() => setEditPrice(p => ({ ...p, ['o_' + o.id]: undefined }))} className="text-[9px] text-white/30 px-1">✕</button></React.Fragment>
                              : <button onClick={() => setEditPrice(p => ({ ...p, ['o_' + o.id]: o.final_price || o.total || 0 }))} className="text-[9px] uppercase tracking-widest text-accent/70 hover:text-accent font-black border border-accent/20 px-2 py-1 rounded-lg">Edit Price</button>
                            }
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {view === 'tasks_live' && (() => {
              const pendingBookings = bookings.filter(b => b.status === 'pending');
              const activeOrders = foodOrders.filter(o => o.status === 'pending' || o.status === 'preparing' || o.status === 'confirmed');
              const upcomingBookings = bookings.filter(b => b.status === 'confirmed' || b.status === 'in_progress');

              return (
                <motion.div key="live" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                  <div className="flex justify-between items-center">
                    <h2 className="text-3xl font-heading">Mission <span className="gold-text-gradient italic">Control</span></h2>
                    <div className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-500 rounded-full text-[10px] font-black uppercase tracking-widest border border-red-500/20 animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.3)]">
                      <div className="w-2 h-2 rounded-full bg-red-500"></div> Live Ops
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="space-y-4">
                      <h3 className="font-heading text-lg flex items-center justify-between border-b border-white/10 pb-2">
                        <span className="text-white/60">Pending Req</span>
                        <span className="bg-yellow-500 text-black px-2 rounded-full text-xs font-black">{pendingBookings.length}</span>
                      </h3>
                      {pendingBookings.map(b => (
                        <div key={b.id} className="glass-card p-4 border-l-4 border-l-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.1)]">
                          <p className="text-xs uppercase tracking-widest mb-1 text-white/50">{b.booking_date}</p>
                          <p className="font-black text-sm">{b.customer_name}</p>
                          <p className="text-accent text-[10px] font-bold mt-1">{b.screen} · {b.slotDisplay}</p>
                          {b.combo_applied && <p className="text-[9px] text-accent/70 mt-1 uppercase">🍹 Combo: {b.combo_applied.name}</p>}
                          <button onClick={() => setView('bookings')} className="mt-3 w-full gold-button !py-1.5 !text-[9px]">Review</button>
                        </div>
                      ))}
                      {pendingBookings.length === 0 && <p className="text-center text-xs text-white/20 p-4">All caught up!</p>}
                    </div>

                    <div className="space-y-4">
                      <h3 className="font-heading text-lg flex items-center justify-between border-b border-white/10 pb-2">
                        <span className="text-white/60">Kitchen</span>
                        <span className="bg-blue-500 text-white px-2 rounded-full text-xs font-black">{activeOrders.length}</span>
                      </h3>
                      {activeOrders.map(o => (
                        <div key={o.id} className="glass-card p-4 border-l-4 border-l-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                          <div className="flex justify-between items-start mb-1">
                            <p className="font-black text-sm">{o.customer_name}</p>
                            <span className="text-[9px] uppercase tracking-widest text-blue-400 font-bold">{o.status}</span>
                          </div>
                          <div className="mt-1 mb-2 space-y-1">
                            {(o.items||[]).map((item, ii) => {
                              const isCombo = item.type === 'combo' && item.items && item.items.length > 0;
                              return (
                                <div key={ii}>
                                  <p className="text-[10px] text-white/50 font-bold">{item.qty}× {item.name}{isCombo ? ' 🔖' : ''}</p>
                                  {isCombo && item.items.map((sub, si) => (
                                    <p key={si} className="text-[9px] text-white/30 pl-3">→ {(sub.qty||1)*item.qty}× {sub.name}</p>
                                  ))}
                                </div>
                              );
                            })}
                          </div>
                          <button onClick={() => setView('orders')} className="mt-2 w-full bg-white/5 hover:bg-white/10 text-[9px] uppercase font-black py-1.5 rounded-lg border border-white/10">Manage</button>
                        </div>
                      ))}
                      {activeOrders.length === 0 && <p className="text-center text-xs text-white/20 p-4">No active orders</p>}
                    </div>

                    <div className="space-y-4">
                      <h3 className="font-heading text-lg flex items-center justify-between border-b border-white/10 pb-2">
                        <span className="text-white/60">Active Guests</span>
                        <span className="bg-green-500 text-white px-2 rounded-full text-xs font-black">{upcomingBookings.length}</span>
                      </h3>
                      {upcomingBookings.slice(0,7).map(b => (
                        <div key={b.id} className="glass-card p-4 border-l-4 border-l-green-500 shadow-[0_0_15px_rgba(34,197,94,0.1)]">
                          <p className="font-black text-sm">{b.customer_name}</p>
                          <p className="text-green-400 text-[10px] font-bold mt-1">{b.screen} · {b.slotDisplay}</p>
                          <p className="text-[10px] text-white/40 mt-1">{b.booking_date}</p>
                          <button onClick={() => setView('bookings')} className="mt-3 w-full bg-white/5 hover:bg-white/10 text-[9px] uppercase font-black py-1.5 rounded-lg border border-white/10">Manage Booking</button>
                        </div>
                      ))}
                      {upcomingBookings.length === 0 && <p className="text-center text-xs text-white/20 p-4">Lounge is quiet</p>}
                    </div>

                  </div>
                </motion.div>
              );
            })()}

            {view === 'menu' && (
              <motion.div key="mn" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <h2 className="text-3xl font-heading">Menu <span className="gold-text-gradient italic">Catalog</span></h2>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => setShowAddCategory(!showAddCategory)} className="glass-card border-white/10 !px-4 !py-2 text-xs flex items-center gap-2 hover:bg-white/5 transition-colors">
                      <Plus size={13} className="text-accent" /> New Category
                    </button>
                    <button onClick={() => {
                      setMenuForm({ id: '', name: '', category: menuCategories[0] || 'Drinks', member_price: '', non_member_price: '', discount: '', image_url: '' });
                      setIsEditingMenu(false); setShowMenuModal(true);
                    }} className="gold-button !px-5 !py-2.5 !text-xs flex items-center gap-2"><Plus size={14} />Add Item</button>
                  </div>
                </div>

                <AnimatePresence>
                  {showAddCategory && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      className="glass-card p-5 border-accent/20 overflow-hidden"
                    >
                      <p className="text-[10px] uppercase tracking-widest text-accent font-black mb-4">Manage Categories</p>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {menuCategories.map(cat => (
                          <div key={cat} className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-xs">
                            <span>{cat}</span>
                            <button onClick={() => deleteCategory(cat)} className="text-red-400 hover:text-red-300 ml-1">
                              <X size={11} />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="flex gap-3">
                        <input
                          type="text" placeholder="New category name..."
                          value={newCategory} onChange={e => setNewCategory(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && saveCategory()}
                          className="flex-1 bg-white/5 border border-white/10 px-4 py-2.5 rounded-xl outline-none focus:border-accent text-sm"
                        />
                        <button onClick={saveCategory} className="gold-button !px-5 !py-2 !text-[10px] font-black">Add</button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                  {['All', ...menuCategories].map(c => (
                    <button key={c} onClick={() => setMenuCatFilter(c)}
                      className={`px-4 py-2 rounded-xl border whitespace-nowrap text-xs font-bold transition-all flex-shrink-0 ${menuCatFilter === c ? 'bg-accent border-accent text-primary' : 'bg-white/5 border-white/10 text-white/50 hover:text-white'}`}
                    >{c} ({c === 'All' ? menuItems.length : menuItems.filter(m => m.category === c).length})</button>
                  ))}
                </div>

                <div className="glass-card overflow-x-auto w-full">
                  <table className="w-full text-left">
                    <thead className="bg-white/5 border-b border-white/5">
                      <tr>{['Image & Item', 'Category', 'Gold (₹)', 'Silver (₹)', 'Non-MBR (₹)', 'Actions'].map(h => <th key={h} className="p-4 text-[9px] uppercase tracking-[0.2em] text-white/40 whitespace-nowrap">{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {menuItems
                        .filter(m => menuCatFilter === 'All' || m.category === menuCatFilter)
                        .map(m => (
                          <tr key={m.id} className="border-t border-white/5 hover:bg-white/[0.02] transition-colors">
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                {m.image_url
                                  ? <img src={getLocalAsset(m.image_url, 'menu')} alt={m.name} className="w-12 h-12 rounded-xl object-cover border border-white/10" onError={e => e.target.style.display = 'none'} />
                                  : <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center border border-white/10"><ImageIcon size={16} className="text-white/20" /></div>
                                }
                                <span className="font-medium text-sm">{m.name}</span>
                              </div>
                            </td>
                            <td className="p-4">
                              <span className="px-2 py-1 bg-accent/10 border border-accent/20 rounded-full text-[9px] font-black uppercase tracking-widest text-accent">{m.category}</span>
                            </td>
                            <td className="p-4"><span className="text-sm font-black text-accent">₹{m.gold_price || '-'}</span></td>
                            <td className="p-4"><span className="text-sm font-black text-white">₹{m.silver_price || m.member_price || '-'}</span></td>
                            <td className="p-4 text-white/40 text-sm">₹{m.non_member_price || '-'}</td>
                            <td className="p-4">
                              <div className="flex gap-2">
                                <button onClick={() => {
                                  setMenuForm({
                                    id: m.id,
                                    name: m.name,
                                    category: m.category,
                                    gold_price: m.gold_price || '',
                                    silver_price: m.silver_price || m.member_price || '',
                                    non_member_price: m.non_member_price || '',
                                    discount: m.discount || '',
                                    image_url: m.image_url || ''
                                  });
                                  setIsEditingMenu(true); setShowMenuModal(true);
                                }} className="bg-blue-500/20 text-blue-400 border border-blue-500/20 px-3 py-1 text-[9px] rounded-lg uppercase tracking-widest font-bold hover:bg-blue-500/30 transition-colors">Edit</button>
                                <button onClick={() => deleteMenu(m.id)} className="bg-red-500/10 text-red-400 border border-red-500/20 px-3 py-1 text-[9px] rounded-lg uppercase tracking-widest font-bold hover:bg-red-500/20 transition-colors">Delete</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      {menuItems.filter(m => menuCatFilter === 'All' || m.category === menuCatFilter).length === 0 && (
                        <tr><td colSpan={5} className="p-12 text-center text-white/20 text-sm">No items in this category</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {view === 'combos' && (
              <motion.div key="com" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <h2 className="text-3xl font-heading">Lounge <span className="gold-text-gradient italic">Combos</span></h2>
                  <button onClick={() => { 
                    setComboForm({ id: '', name: '', price: '', description: '', includes: '', custom_message: '', is_active: true, max_guests: 2, screen_type: 'Screen 1', image_url: '' }); 
                    setEditingComboId(null);
                    setShowComboModal(true); 
                  }} className="gold-button !px-5 !py-2.5 !text-[10px] flex items-center gap-2 font-black uppercase tracking-widest"><Plus size={14} />Add Combo</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {combos.map(c => (
                    <ComboCard 
                      key={c.id} 
                      combo={c} 
                      getLocalAsset={getLocalAsset}
                      onEdit={(item) => {
                        setEditingComboId(item.id);
                        setComboForm({ ...item, id: item.id });
                        setShowComboModal(true);
                      }}
                      onDelete={deleteCombo}
                      onToggle={toggleComboActive}
                    />
                  ))}
                  {combos.length === 0 && <div className="col-span-full text-center py-12 text-white/30 text-sm">No combos available.</div>}
                </div>
              </motion.div>
            )}

            {view === 'food_combos' && (
              <motion.div key="fcom" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <h2 className="text-3xl font-heading">Food <span className="gold-text-gradient italic">Combos</span></h2>
                  <button onClick={() => { setFoodComboForm({ id: '', name: '', price: '', items: [], image_url: '' }); setShowFoodComboModal(true); }}
                    className="gold-button !px-5 !py-2.5 !text-[10px] flex items-center gap-2 font-black uppercase tracking-widest"><Plus size={14} />Create Combo</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {foodCombos.map(c => (
                    <div key={c.id} className="glass-card flex flex-col p-5 group transition-all hover:border-accent/40">
                      <div className="h-40 bg-white/5 rounded-2xl mb-4 overflow-hidden border border-white/10">
                        {c.image_url ? <img src={getLocalAsset(c.image_url, 'menu')} className="w-full h-full object-cover" /> : <div className="flex items-center justify-center h-full"><ImageIcon size={40} className="text-white/10" /></div>}
                      </div>
                      <h3 className="text-xl font-heading mb-1">{c.name}</h3>
                      <p className="text-accent font-bold text-lg mb-2">₹{c.price}</p>
                      <div className="flex-1 space-y-1 mb-4">
                        <p className="text-[10px] uppercase tracking-widest text-white/30 font-black">Includes:</p>
                        {c.items.map((i, idx) => <p key={idx} className="text-xs text-white/60">· {i.qty || 1}x {i.name}</p>)}
                      </div>
                      <div className="flex gap-2 border-t border-white/5 pt-4">
                        <button onClick={() => { setFoodComboForm(c); setShowFoodComboModal(true); }} className="flex-1 py-3 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] uppercase font-black">Edit</button>
                        <button onClick={() => deleteFoodCombo(c.id)} className="p-3 rounded-xl bg-red-500/10 text-red-500 border border-red-500/20"><Trash2 size={16} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {view === 'coupons' && (
              <motion.div key="coup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <h2 className="text-3xl font-heading">Coupons <span className="gold-text-gradient italic">Manager</span></h2>
                  <div className="flex gap-2">
                    <p className="text-[10px] text-white/30 italic">Send personalized codes to customers instantly.</p>
                    <button 
                      onClick={() => { 
                        setCouponForm({ 
                          id: '', 
                          code: '', 
                          type: 'percentage', 
                          value: '', 
                          applies_to: 'both', 
                          max_usage: '', 
                          used_count: 0, 
                          expiry_date: '', 
                          active: true, 
                          usage_per_user: 1, 
                          validity_days: '', 
                          screen_applicable: 'All', 
                          whatsapp_template: 'Hey! Your coupon code is {{code}}. Use this code to get 5% off! ✨' 
                        }); 
                        setShowCouponModal(true); 
                      }} 
                      className="gold-button !px-5 !py-2.5 !text-[10px] flex items-center gap-2 font-black uppercase tracking-widest"
                    >
                      <Plus size={14} />Add Coupon
                    </button>
                  </div>
                </div>
                <div className="glass-card overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-white/5 border-b border-white/5">
                      <tr>{['Code', 'Type', 'Value', 'Applies To', 'Used/Max', 'Per User', 'Validity (D/Exp)', 'Status', 'Actions'].map(h => <th key={h} className="p-4 text-[9px] uppercase tracking-[0.2em] text-white/40 whitespace-nowrap">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {coupons.map(c => (
                        <tr key={c.id} className="hover:bg-white/[0.02]">
                          <td className="p-4 font-bold font-mono text-accent">{c.code}</td>
                          <td className="p-4 uppercase text-[10px] tracking-widest">{c.type.replace('_', ' ')}</td>
                          <td className="p-4 font-bold">{c.type === 'percentage' ? `${c.value}%` : c.type === 'amount' ? `₹${c.value}` : 'Free Hour'}</td>
                          <td className="p-4 uppercase text-[10px] tracking-widest">{c.applies_to}</td>
                          <td className="p-4 text-xs">{c.used_count || 0} / {c.max_usage || '∞'}</td>
                          <td className="p-4 text-xs">{c.usage_per_user || '∞'}</td>
                          <td className="p-4 text-xs">{c.validity_days ? `${c.validity_days}d` : ''} {c.expiry_date || ''}</td>
                          <td className="p-4"><span className={`px-2 py-1 rounded-full text-[9px] uppercase font-black tracking-widest border ${c.active ? 'text-green-500 border-green-500/30 bg-green-500/10' : 'text-red-500 border-red-500/30 bg-red-500/10'}`}>{c.active ? 'Active' : 'Inactive'}</span></td>
                          <td className="p-4">
                            <div className="flex gap-2">
                              <button 
                                onClick={() => {
                                  let phone = prompt("Enter Customer Mobile (e.g. 9876543210):");
                                  if (!phone) return;
                                  
                                  const template = c.whatsapp_template || `Hey! Your coupon code is {{code}}. Use this code to get 5% off! ✨`;
                                  const generatedMsg = template.replace(/{{code}}/gi, c.code);
                                  
                                  // SECON STEP: Allow admin to edit/confirm the message
                                  const finalMsg = prompt("Confirm/Edit the message being sent:", generatedMsg);
                                  if (!finalMsg) return;

                                  const cleanPhone = phone.replace(/\D/g, '');
                                  const fullPhone = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;
                                  openWhatsApp(fullPhone, finalMsg);
                                }} 
                                className="p-2 bg-green-500/10 text-green-500 rounded hover:bg-green-500/20"
                                title="Send via WhatsApp"
                              >
                                <MessageCircle size={14} />
                              </button>
                              <button 
                                onClick={() => { setCouponForm({ ...c }); setShowCouponModal(true); }} 
                                className="p-2 bg-blue-500/10 text-blue-500 rounded hover:bg-blue-500/20"
                                title="Edit Coupon"
                              >
                                <Plus size={14} className="rotate-45" />
                              </button>
                              <button 
                                onClick={() => toggleCouponActive(c)} 
                                className={`px-3 py-1.5 rounded transition-all text-[9px] font-black uppercase tracking-widest border
                                  ${c.active ? 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500' : 'bg-green-500/10 border-green-500/30 text-green-500'}
                                `}
                              >
                                {c.active ? 'Disable' : 'Enable'}
                              </button>
                              <button 
                                onClick={() => resetCoupon(c)} 
                                className="px-3 py-1.5 bg-green-500/10 border border-green-500/30 text-green-500 rounded text-[9px] uppercase font-black tracking-widest"
                              >
                                Reset
                              </button>
                              <button 
                                onClick={() => deleteCoupon(c.id)} 
                                className="p-2 bg-red-500/10 text-red-500 rounded hover:bg-red-500/20"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {coupons.length === 0 && <tr><td colSpan="8" className="p-8 text-center text-white/30 text-xs">No coupons created.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {view === 'memberships' && (
              <motion.div key="mbr" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <h2 className="text-3xl font-heading">Membership <span className="gold-text-gradient italic">Circle</span></h2>
                  <div className="flex gap-2 bg-white/5 p-1 rounded-xl border border-white/10">
                    {['plans', 'requests', 'active'].map(v => (
                      <button key={v} onClick={() => setMembershipSubView(v)}
                        className={`px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-2 ${membershipSubView === v ? 'bg-accent text-primary' : 'text-white/40 hover:text-white'}`}
                      >
                        {v}
                        {v === 'requests' && notifCount.memberships > 0 && (
                          <span className="bg-red-500 text-white text-[8px] min-w-[16px] h-4 flex items-center justify-center rounded-full px-1 font-black">{notifCount.memberships}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {membershipSubView === 'plans' && (
                  <div className="space-y-6">
                    <div className="flex justify-end">
                      <button onClick={() => {
                    setMembershipForm({ 
                      id: '', name: '', price: '', validity_days: 30, description: '', is_active: true, 
                      credit_type: 'any', credits: 0, 
                      per_screen_credits: screens.reduce((acc, name) => ({ ...acc, [name]: 0 }), {})
                    });
                    setIsEditingMembership(false); setShowMembershipModal(true);
                  }} className="gold-button !px-5 !py-2.5 !text-xs flex items-center gap-2 font-black uppercase tracking-widest"><Plus size={14} />Create Plan</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {membershipPlans.map(plan => (
                        <div key={plan.id} className={`glass-card p-6 flex flex-col border-accent/20 transition-all hover:border-accent ${!plan.is_active ? 'opacity-50 grayscale' : ''}`}>
                          <div className="flex justify-between items-start mb-4">
                            <h3 className="text-xl font-heading text-white">{plan.name}</h3>
                            <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${plan.is_active ? 'text-green-400 border-green-500/20 bg-green-500/5' : 'text-red-400 border-red-500/20 bg-red-500/5'}`}>
                              {plan.is_active ? 'Active' : 'Disabled'}
                            </span>
                          </div>
                          <p className="text-accent font-bold text-2xl mb-1">₹{plan.price}</p>
                          <div className="flex flex-col gap-1 mb-4">
                            <p className="text-[10px] text-white/40 uppercase tracking-widest italic">{plan.validity_days} Days Validity</p>
                            {plan.credit_type === 'any' ? (
                              <p className="text-[10px] text-accent/60 uppercase tracking-widest font-black">{plan.credits || 0} Total Credits</p>
                            ) : (
                              <div className="flex flex-wrap gap-2 mt-1">
                                {Object.entries(plan.per_screen_credits || {}).map(([key, v]) => {
                                  const linkedScreen = screensList.find(s => s.legacy_link === key || s.name === key);
                                  const displayName = linkedScreen ? linkedScreen.name : key;
                                  return (
                                    <span key={key} className="px-2 py-0.5 bg-accent/10 border border-accent/20 rounded text-[8px] font-black uppercase text-accent/60">
                                      {displayName}: {v}
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          <p className="text-xs text-white/60 mb-6 flex-1 italic leading-relaxed">"{plan.description}"</p>
                          
                          <div className="flex gap-2 border-t border-white/5 pt-4">
                            <button onClick={() => { setMembershipForm(plan); setIsEditingMembership(true); setShowMembershipModal(true); }} 
                              className="flex-1 py-3 bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] uppercase font-black rounded-xl">Edit</button>
                            <button onClick={() => toggleMembershipActive(plan)} 
                              className={`px-4 py-3 rounded-xl border text-[10px] uppercase font-black transition-all ${plan.is_active ? 'border-red-500/20 text-red-500' : 'border-green-500/20 text-green-400'}`}>
                              {plan.is_active ? 'Disable' : 'Activate'}
                            </button>
                            <button onClick={() => deleteMembership(plan.id)} className="p-3 bg-red-500/10 text-red-500 border border-red-500/10 rounded-xl hover:bg-red-500/20 transition-all">
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {membershipSubView === 'requests' && (
                  <div className="glass-card overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-white/5 border-b border-white/5">
                        <tr>{['Customer', 'Mobile', 'Requested Plan', 'Date', 'Actions'].map(h => <th key={h} className="p-4 text-[9px] uppercase tracking-[0.2em] text-white/40 whitespace-nowrap">{h}</th>)}</tr>
                      </thead>
                      <tbody>
                        {membershipRequests.map(m => (
                          <tr key={m.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                            <td className="p-4 font-bold">{m.customer_name}</td>
                            <td className="p-4 text-white/40 text-xs">{m.customer_mobile}</td>
                            <td className="p-4"><span className="px-2 py-1 bg-accent/10 border border-accent/20 rounded-full text-[9px] font-black uppercase text-accent">{m.plan_name}</span></td>
                            <td className="p-4 text-white/30 text-xs">{m.created_at?.toDate ? m.created_at.toDate().toLocaleDateString() : 'Pending'}</td>
                            <td className="p-4">
                              <div className="flex gap-2">
                                <button onClick={() => openMemApproveModal(m)} className="px-4 py-2 bg-green-500/10 text-green-500 border border-green-500/20 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-green-500/20 transition-all">Approve</button>
                                <button onClick={() => openCancelModal(m.id, 'membership')} className="px-4 py-2 bg-red-500/10 text-red-500 border border-red-500/20 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-red-500/10 transition-all">Cancel</button>
                                <button onClick={() => deleteMembershipReq(m.id)} className="p-2 text-white/20 hover:text-red-500 transition-colors" title="Delete Permanent"><Trash2 size={16} /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {membershipRequests.length === 0 && <tr><td colSpan="5" className="p-12 text-center text-white/20 text-xs italic">No pending membership requests.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                )}

                {membershipSubView === 'active' && (
                  <div className="glass-card overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-white/5 border-b border-white/5">
                        <tr>{['Member', 'Mobile', 'Plan', 'Credits Remaining', 'Validity Left', 'Status'].map(h => <th key={h} className="p-4 text-[9px] uppercase tracking-[0.2em] text-white/40 whitespace-nowrap">{h}</th>)}</tr>
                      </thead>
                      <tbody>
                        {activeMemberships.map(m => {
                          const daysLeft = m.expiry_date ? Math.ceil((new Date(m.expiry_date) - new Date()) / (1000 * 60 * 60 * 24)) : 0;
                          return (
                            <tr key={m.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                              <td className="p-4 font-bold">{m.customer_name}</td>
                              <td className="p-4 text-white/40 text-xs">{m.customer_mobile}</td>
                              <td className="p-4 uppercase text-[10px] font-bold tracking-widest">{m.plan_name}</td>
                              <td className="p-4">
                                {m.credit_type === 'any' ? (
                                  <span className={`font-black ${(m.credits_remaining?.total_hours || 0) > 0 ? 'text-accent' : 'text-white/20'}`}>
                                    {m.credits_remaining?.total_hours || 0} Hrs
                                  </span>
                                ) : (
                                  <div className="space-y-1">
                                    {Object.entries(m.credits_remaining?.per_screen || {}).map(([key, val]) => {
                                      const autoMap = { 'Mini Lounge': 'Screen 1', 'Studio Lounge': 'Screen 2', 'Grand Lounge': 'TV Screen' };
                                      const linkedScreen = screensList.find(s => s.legacy_link === key || s.name === key || s.name === autoMap[key]);
                                      const displayName = linkedScreen ? linkedScreen.name : key;
                                      return (
                                        <p key={key} className="text-[9px] font-bold">
                                          <span className="text-white/30">{displayName}:</span>{' '}
                                          <span className={val > 0 ? 'text-accent' : 'text-white/10'}>{val}</span>
                                        </p>
                                      );
                                    })}
                                  </div>
                                )}
                              </td>
                              <td className="p-4">
                                <div className="space-y-1">
                                  <span className={`text-xs font-bold ${daysLeft < 5 ? 'text-red-400' : 'text-white'}`}>{daysLeft} Days</span>
                                  <p className="text-[8px] text-white/20 uppercase tracking-widest">Expires: {new Date(m.expiry_date).toLocaleDateString()}</p>
                                </div>
                              </td>
                              <td className="p-4">
                                <span className={`px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${daysLeft > 0 ? 'text-green-400 border-green-500/20 bg-green-500/5' : 'text-red-400 border-red-500/20 bg-red-500/5'}`}>
                                  {daysLeft > 0 ? 'Active' : 'Expired'}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                        {activeMemberships.length === 0 && <tr><td colSpan="6" className="p-12 text-center text-white/20 text-xs italic">No active memberships found.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                )}
              </motion.div>
            )}

            {view === 'members' && (
              <motion.div key="mem" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <h2 className="text-3xl font-heading">Members <span className="gold-text-gradient italic">Registry</span></h2>
                  <div className="flex gap-2 flex-wrap">
                    {['all', 'gold', 'silver', 'non_member'].map(f => (
                      <button key={f} onClick={() => setMemberFilter(f)}
                        className={`px-3 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg border transition-all ${memberFilter === f ? 'bg-accent text-primary border-accent' : 'bg-white/5 border-white/10 text-white/40 hover:text-white'}`}
                      >{f.replace('_', ' ')}</button>
                    ))}
                  </div>
                </div>
                <div className="glass-card overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-white/5 border-b border-white/5">
                      <tr>{['Name', 'Mobile', 'Membership', 'Bookings', 'Total Spend'].map(h => <th key={h} className="p-4 text-[9px] uppercase tracking-[0.2em] text-white/40 whitespace-nowrap">{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {customers
                        .filter(c => memberFilter === 'all' || c.membership_type === memberFilter)
                        .sort((a, b) => (memberSpend[b.id] || 0) - (memberSpend[a.id] || 0))
                        .map(c => (
                          <tr key={c.id} className="border-t border-white/5 hover:bg-white/[0.02]">
                            <td className="p-4 font-medium">{c.name}</td>
                            <td className="p-4 text-white/50 text-sm">{c.mobile_number}</td>
                            <td className="p-4">
                              <span className={`px-2 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${c.membership_type === 'gold' ? 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' : c.membership_type === 'silver' ? 'text-gray-300 border-white/20 bg-white/5' : 'text-white/30 border-white/10 bg-white/5'}`}>
                                {c.membership_type?.replace('_', ' ') || 'Non-Member'}
                              </span>
                            </td>
                            <td className="p-4 text-accent font-bold">{memberBookings[c.id] || 0}</td>
                            <td className="p-4 font-bold gold-text-gradient">₹{memberSpend[c.id] || 0}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  {customers.filter(c => memberFilter === 'all' || c.membership_type === memberFilter).length === 0 && (
                    <p className="text-center text-white/30 text-sm py-12">No customers found</p>
                  )}
                </div>
              </motion.div>
            )}

            {view === 'expenses' && (
              <motion.div key="ex" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-3xl font-heading">Expenses <span className="gold-text-gradient italic">Ledger</span></h2>
                  <button onClick={() => setShowExpenseModal(true)} className="gold-button !px-5 !py-2.5 !text-xs flex items-center gap-2"><Plus size={14} />Log Expense</button>
                </div>
                <div className="glass-card overflow-x-auto w-full">
                  <table className="w-full text-left">
                    <thead className="bg-white/5 border-b border-white/5"><tr>{['Title', 'Amount', 'Date'].map(h => <th key={h} className="p-4 text-[9px] uppercase tracking-[0.2em] text-white/40">{h}</th>)}</tr></thead>
                    <tbody>{expenses.map((e, i) => <tr key={i} className="border-t border-white/5 hover:bg-white/[0.02]"><td className="p-4 font-medium text-sm">{e.title}</td><td className="p-4 text-red-400 font-bold">₹{e.amount}</td><td className="p-4 text-white/40 text-sm">{e.date}</td></tr>)}</tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {view === 'analytics' && (
              <motion.div key="an" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <h2 className="text-3xl font-heading">Analytics <span className="gold-text-gradient italic">Report</span></h2>
                  <div className="flex gap-3 items-center flex-wrap">
                    <select value={analyticsMonth} onChange={e => setAnalyticsMonth(Number(e.target.value))} className="bg-white/5 border border-white/10 text-white text-xs rounded-xl px-4 py-2 outline-none">
                      {MONTHS.map((m, i) => <option key={i} value={i} className="bg-[#0a1128]">{m}</option>)}
                    </select>
                    <select value={analyticsYear} onChange={e => setAnalyticsYear(Number(e.target.value))} className="bg-white/5 border border-white/10 text-white text-xs rounded-xl px-4 py-2 outline-none">
                      {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y} className="bg-[#0a1128]">{y}</option>)}
                    </select>
                    <button onClick={() => exportAnalyticsExcel(analyticsData.rows, analyticsData.bookingDetails, analyticsData.foodDetails, `${MONTHS[analyticsMonth]} ${analyticsYear}`, analyticsData.totalExpenses)}
                      className="gold-button !px-5 !py-2 !text-[10px] flex items-center gap-2">
                      ⬇ Download Excel
                    </button>
                  </div>
                </div>

                {analyticsData.rows.length > 0 && (() => {
                  const totB = analyticsData.rows.reduce((s, r) => s + r.bookingTotal, 0);
                  const totF = analyticsData.rows.reduce((s, r) => s + r.foodTotal, 0);
                  const grand = totB + totF;
                  return (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="navy-card p-5"><p className="text-[9px] uppercase text-white/30 font-black mb-1">Booking Revenue</p><h3 className="text-xl font-heading text-blue-400 font-black">₹{totB}</h3></div>
                      <div className="navy-card p-5"><p className="text-[9px] uppercase text-white/30 font-black mb-1">Food Revenue</p><h3 className="text-xl font-heading text-orange-400 font-black">₹{totF}</h3></div>
                      <div className="navy-card p-5"><p className="text-[9px] uppercase text-white/30 font-black mb-1">Total Expenses</p><h3 className="text-xl font-heading text-red-400 font-black">₹{analyticsData.totalExpenses}</h3></div>
                      <div className="navy-card p-5 border-accent/30 bg-accent/5"><p className="text-[9px] uppercase text-white/30 font-black mb-1">Net Profit</p><h3 className="text-xl font-heading gold-text-gradient font-black">₹{grand - analyticsData.totalExpenses}</h3></div>
                    </div>
                  );
                })()}

                <div className="glass-card overflow-x-auto w-full">
                  <table className="w-full text-left">
                    <thead className="bg-white/5 border-b border-white/5">
                      <tr>{['Date', 'Booking Revenue', 'Food Revenue', 'Grand Total'].map(h => <th key={h} className="p-4 text-[9px] uppercase tracking-[0.2em] text-white/40">{h}</th>)}</tr>
                    </thead>
                    <tbody>
                      {analyticsData.rows.length === 0
                        ? <tr><td colSpan={4} className="p-8 text-center text-white/30 text-sm">No data for this month</td></tr>
                        : analyticsData.rows.map(r => (
                          <tr key={r.date} className="border-t border-white/5 hover:bg-white/[0.02]">
                            <td className="p-4 font-medium text-sm">{new Date(r.date + 'T00:00:00').toLocaleDateString('en', { day: 'numeric', month: 'short', weekday: 'short' })}</td>
                            <td className="p-4 text-blue-400 font-bold">₹{r.bookingTotal}</td>
                            <td className="p-4 text-orange-400 font-bold">₹{r.foodTotal}</td>
                            <td className="p-4 font-black gold-text-gradient">₹{r.total}</td>
                          </tr>
                        ))
                      }
                      {analyticsData.rows.length > 0 && (() => {
                        const totB = analyticsData.rows.reduce((s, r) => s + r.bookingTotal, 0);
                        const totF = analyticsData.rows.reduce((s, r) => s + r.foodTotal, 0);
                        return (
                          <tr className="border-t-2 border-accent/30 bg-accent/5">
                            <td className="p-4 font-black text-sm uppercase tracking-widest">TOTAL</td>
                            <td className="p-4 font-black text-blue-400">₹{totB}</td>
                            <td className="p-4 font-black text-orange-400">₹{totF}</td>
                            <td className="p-4 font-black gold-text-gradient text-lg">₹{totB + totF}</td>
                          </tr>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>

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

            {view === 'settings' && (
              <motion.div key="st" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8 max-w-2xl">
                <h2 className="text-3xl font-heading">System <span className="gold-text-gradient italic">Settings</span></h2>
                <div className="glass-card p-8 space-y-6">
                  <div>
                    <h3 className="text-sm uppercase tracking-widest font-black text-accent mb-1 flex items-center gap-2"><MessageCircle size={14} />WhatsApp Number</h3>
                    <p className="text-[10px] text-white/30 mb-4">All WhatsApp messages will go to this number.</p>
                    <div className="flex gap-3">
                      <input type="tel" value={waInput} onChange={e => setWaInput(e.target.value.replace(/\D/g, ''))} maxLength={10}
                        className="flex-1 bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-accent text-xl tracking-widest text-center font-heading"
                        placeholder="10-digit number" />
                      <button onClick={saveSettings} className="gold-button !px-6 !py-4 !text-[10px] font-black uppercase tracking-widest">Save</button>
                    </div>
                    <p className="text-[10px] text-white/20 mt-3">Current: +{waNumber.startsWith('91') ? waNumber : `91${waNumber}`}</p>
                  </div>

                  <div className="pt-6 border-t border-white/10">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-sm uppercase tracking-widest font-black text-accent flex items-center gap-2"><Monitor size={14} />Screen Management</h3>
                      <button onClick={() => {
                        setScreenForm({ id: '', name: '', type: 'private', capacity: 6, is_active: true, pricing: { gold: 299, silver: 399, non_member: 499, pricing_type: 'group' } });
                        setShowScreenModal(true);
                       }} className="gold-button !px-4 !py-2 !text-[9px] flex items-center gap-2 animate-pulse"><Plus size={12} />Add Screen</button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {screensList.map(s => (
                        <div key={s.id} className="navy-card !p-5 border-accent/10 relative group bg-white/[0.03]">
                          <div className="flex justify-between items-start">
                            <div>
                               <h4 className="text-lg font-heading gold-text-gradient">{s.name}</h4>
                               <p className="text-[10px] text-white/40 uppercase tracking-widest mt-1 mb-3">{s.type} · {s.capacity} Guests</p>
                            </div>
                            <span className={`text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full border ${s.is_active ? 'text-green-400 border-green-500/20' : 'text-red-400 border-red-500/20'}`}>
                                {s.is_active ? 'Active' : 'Disabled'}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-3 gap-2 py-3 border-y border-white/5 my-3">
                             <div><p className="text-[8px] text-white/30 uppercase">Gold</p><p className="text-xs font-bold text-accent">₹{s.pricing?.gold}</p></div>
                             <div><p className="text-[8px] text-white/30 uppercase">Silver</p><p className="text-xs font-bold text-white">₹{s.pricing?.silver}</p></div>
                             <div><p className="text-[8px] text-white/30 uppercase">Non-MBR</p><p className="text-xs font-bold text-white/50">₹{s.pricing?.non_member}</p></div>
                          </div>

                          <div className="flex gap-2">
                             <button onClick={() => { setScreenForm(s); setShowScreenModal(true); }} className="flex-1 py-2 bg-blue-500/10 text-blue-400 text-[9px] font-black uppercase tracking-widest rounded-lg border border-blue-500/20 hover:bg-blue-500/20 transition-all">Edit</button>
                             <button onClick={() => deleteScreen(s.id, s.name)} className="px-3 py-2 bg-red-500/10 text-red-400 text-[9px] font-black uppercase rounded-lg border border-red-500/10 hover:bg-red-500/20 transition-all"><Trash2 size={12} /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>



                  <div className="pt-6 border-t border-white/10">
                    <h3 className="text-sm uppercase tracking-widest font-black text-accent mb-4 flex items-center gap-2"><ClipboardList size={14} />Terms & Conditions</h3>
                    <div className="space-y-4">
                      <p className="text-[10px] text-white/40">These terms will be displayed on the Terms page and must be accepted before booking.</p>
                      <textarea
                        value={termsText}
                        onChange={(e) => setTermsText(e.target.value)}
                        rows={12}
                        className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-accent text-sm resize-y"
                        placeholder="Enter terms and conditions..."
                      />
                      <button onClick={saveTerms} className="gold-button !px-6 !py-3 !text-[10px] font-black uppercase tracking-widest">Save Terms</button>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-white/10">
                    <h3 className="text-sm uppercase tracking-widest font-black text-accent mb-4 flex items-center gap-2"><CreditCard size={14} />Payment Settings</h3>
                    <p className="text-[10px] text-white/30 mb-6">Configure UPI and QR details for the payment page.</p>
                    <div className="space-y-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <label className="text-[9px] uppercase tracking-widest text-white/40">UPI ID</label>
                          <input type="text" value={paymentSettings.upi_id} onChange={e => setPaymentSettings({...paymentSettings, upi_id: e.target.value})} className="w-full bg-white/5 border border-white/10 p-3 rounded-xl outline-none focus:border-accent text-sm" placeholder="example@upi" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[9px] uppercase tracking-widest text-white/40">Mobile Number</label>
                          <input type="text" value={paymentSettings.mobile_number} onChange={e => setPaymentSettings({...paymentSettings, mobile_number: e.target.value})} className="w-full bg-white/5 border border-white/10 p-3 rounded-xl outline-none focus:border-accent text-sm" placeholder="10-digit mobile" />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[9px] uppercase tracking-widest text-white/40 font-black flex items-center justify-between">
                          QR Code Image URL
                          {paymentSettings.qr_image_url && <span className="text-green-400 font-normal lowercase tracking-normal">Active</span>}
                        </label>
                        <input type="text" value={paymentSettings.qr_image_url} onChange={e => setPaymentSettings({...paymentSettings, qr_image_url: e.target.value})} className="w-full bg-white/5 border border-white/10 p-3 rounded-xl outline-none focus:border-accent text-sm" placeholder="Paste image URL or hosted QR link" />
                        
                        {paymentSettings.qr_image_url && (
                          <div className="mt-3 p-4 bg-white/5 border border-white/10 rounded-2xl flex items-center gap-4">
                            <img src={paymentSettings.qr_image_url} alt="QR Preview" className="w-20 h-20 object-contain rounded-lg bg-white p-1" onError={e => e.target.src = logo43c} />
                            <div>
                              <p className="text-[9px] uppercase tracking-widest font-black text-white/40 mb-1">Preview</p>
                              <p className="text-[10px] text-white/20 break-all max-w-[200px]">{paymentSettings.qr_image_url}</p>
                            </div>
                          </div>
                        )}
                      </div>
                      <button onClick={savePaymentSettings} className="gold-button !px-6 !py-3 !text-[10px] font-black uppercase tracking-widest">Update Payment Config</button>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-red-500/20">
                    <h3 className="text-sm uppercase tracking-widest font-black text-red-400 mb-4 flex items-center gap-2"><Database size={14} />Sync & Maintenance</h3>
                    <div className="navy-card !bg-red-500/5 border-red-500/10 p-6 space-y-4">
                      <div>
                        <p className="text-white font-bold text-xs mb-1">Backup to Google Sheets</p>
                        <p className="text-[10px] text-white/40 leading-relaxed">Manually push confirmed bookings and food orders to your Google Sheets daily report. This is recommended at the end of every business day.</p>
                      </div>
                      <button 
                        onClick={handleManualBackup} 
                        disabled={backupLoading}
                        className={`w-full py-4 rounded-xl flex items-center justify-center gap-3 text-[10px] font-black uppercase tracking-[0.2em] transition-all
                          ${backupLoading ? 'bg-white/10 text-white/20' : 'bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:border-accent group'}`}
                      >
                        {backupLoading ? (
                          <RefreshCcw size={16} className="animate-spin" />
                        ) : (
                          <RefreshCcw size={16} className="group-hover:rotate-180 transition-transform duration-700" />
                        )}
                        {backupLoading ? 'Syncing...' : 'Sync Data to Sheets'}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {view === 'admin_flow' && (
              <motion.div key="af" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                <div className="flex justify-between items-center">
                  <h2 className="text-3xl font-heading">Operational <span className="gold-text-gradient italic">Manual</span></h2>
                  <div className="text-[10px] bg-accent/10 border border-accent/20 text-accent px-4 py-1.5 rounded-full font-black uppercase tracking-widest flex items-center gap-2">
                    <ShieldCheck size={12} /> Standard Operating Procedures
                  </div>
                </div>
                
                <div className="grid lg:grid-cols-2 gap-8">
                   <div className="glass-card p-6 border-white/5 space-y-6">
                      <h3 className="text-lg font-heading text-accent border-b border-white/5 pb-3">Booking Cycle</h3>
                      <div className="space-y-4">
                         {[
                           { t: 'WhatsApp Req', d: 'Receive request with guest count & date.' },
                           { t: 'Status Check', d: 'Verify slot availability in Dashboard.' },
                           { t: 'Lead Confirm', d: 'Contact customer for advance payment.' },
                           { t: 'Payment Log', d: 'Confirm payment & set status to CONFIRMED.' },
                           { t: 'Guest Check-in', d: 'Verify OTP at arrival for secure entry.' },
                           { t: 'Finalize', d: 'Mark COMPLETED after final payment.' }
                         ].map((s, i) => (
                           <div key={i} className="flex gap-4 p-3 rounded-xl bg-white/5 border border-white/10">
                             <span className="text-accent font-black text-xs">0{i+1}</span>
                             <div>
                               <p className="font-bold text-xs uppercase tracking-widest">{s.t}</p>
                               <p className="text-[10px] text-white/40">{s.d}</p>
                             </div>
                           </div>
                         ))}
                      </div>
                   </div>

                   <div className="space-y-8">
                      <div className="glass-card p-6 border-white/5 space-y-6">
                        <h3 className="text-lg font-heading text-accent border-b border-white/5 pb-3">Food & Service</h3>
                        <div className="space-y-4">
                           {[
                             { t: 'Alert', d: 'Receive notification for new food order.' },
                             { t: 'Confirm', d: 'Mark as CONFIRMED if kitchen is ready.' },
                             { t: 'Serve', d: 'Prepare and deliver. Mark as SERVED.' },
                             { t: 'Bill', d: 'Ensure price is added to final settlement.' }
                           ].map((s, i) => (
                             <div key={i} className="flex gap-4 p-3 rounded-xl bg-white/5 border border-white/10">
                               <span className="text-accent font-black text-xs">0{i+1}</span>
                               <div>
                                 <p className="font-bold text-xs uppercase tracking-widest">{s.t}</p>
                                 <p className="text-[10px] text-white/40">{s.d}</p>
                               </div>
                             </div>
                           ))}
                        </div>
                      </div>

                      <div className="navy-card p-6 border-accent/20 bg-accent/5">
                         <p className="text-[9px] uppercase font-black text-accent tracking-widest mb-2 flex items-center gap-2">
                           <Zap size={10} /> Shift Reminder
                         </p>
                         <p className="text-xs text-white/60 italic font-light">
                           "Double-check slot availability before confirming manual payments to avoid double bookings."
                         </p>
                      </div>
                   </div>
                </div>
              </motion.div>
            )}

            {view === 'customer_flow' && (
              <motion.div key="cf" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                <div className="flex justify-between items-center">
                  <h2 className="text-3xl font-heading">User <span className="gold-text-gradient italic">Experience</span></h2>
                  <div className="text-[10px] bg-blue-500/10 border border-blue-500/20 text-blue-400 px-4 py-1.5 rounded-full font-black uppercase tracking-widest flex items-center gap-2">
                    <Users size={12} /> The Customer Journey
                  </div>
                </div>

                <div className="glass-card p-8 border-white/5 relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 blur-3xl rounded-full -z-10" />
                   <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {[
                        { t: 'Login', d: 'Register via Mobile Number.' },
                        { t: 'Discovery', d: 'Choose Date, Screen & Slots.' },
                        { t: 'Request', d: 'Send WhatsApp booking data.' },
                        { t: 'Advance', d: 'Pay to confirm membership/slot.' },
                        { t: 'OTP Wait', d: 'Receive OTP 30m before visit.' },
                        { t: 'Arrival', d: 'Visit 43C & Enter OTP.' },
                        { t: 'Settlement', d: 'Pay due amount & Enter Lounge.' },
                        { t: 'Food', d: 'Browse Menu & Order via WhatsApp.' },
                        { t: 'Enjoy', d: 'Experience 43C Luxury.' }
                      ].map((s, i) => (
                        <div key={i} className="p-5 rounded-2xl bg-white/5 border border-white/10 hover:border-accent/40 transition-all">
                           <div className="w-8 h-8 rounded-lg bg-accent text-primary flex items-center justify-center font-black text-xs mb-3 shadow-lg">
                             {i+1}
                           </div>
                           <h4 className="text-sm font-black uppercase tracking-widest mb-1">{s.t}</h4>
                           <p className="text-[10px] text-white/40 leading-relaxed font-light">{s.d}</p>
                        </div>
                      ))}
                   </div>
                </div>
              </motion.div>
            )}

            {view === 'admins' && (
              <motion.div key="ad" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-3xl font-heading">Administrators <span className="gold-text-gradient italic">Council</span></h2>
                  <button onClick={() => setShowAdminModal(true)} className="gold-button !px-5 !py-2.5 !text-xs flex items-center gap-2"><Plus size={14} />Add Admin</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="navy-card !p-6 border-green-500/20 bg-green-500/5">
                    <div className="flex justify-between items-start mb-4"><div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-accent"><Lock size={18} /></div><div className="bg-green-500/20 text-green-500 px-2 py-1 rounded-full text-[8px] font-black uppercase border border-green-500/30">Root</div></div>
                    <h4 className="text-lg font-heading mb-1">Super Admin</h4><p className="text-xs text-white/20">9479810400</p><p className="text-[9px] text-green-500/40 mt-2">Cannot be removed</p>
                  </div>
                  {admins.map(a => (
                    <div key={a.id} className="navy-card !p-6 relative group">
                      <button onClick={() => deleteAdmin(a.id)} className="absolute top-4 right-4 text-white/10 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"><X size={18} /></button>
                      <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-accent mb-4"><Shield size={18} /></div>
                      <h4 className="text-lg font-heading mb-1">{a.name}</h4><p className="text-xs text-white/20">{a.mobile}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {showExpenseModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowExpenseModal(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-card !bg-[#0a1128] p-8 max-w-md w-full relative z-10 border-accent/20 space-y-5">
              <h3 className="text-2xl font-heading text-red-400">Log Expense</h3>
              <form onSubmit={logExpense} className="space-y-4">
                <input type="text" required placeholder="Expense Title" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-red-400 text-sm" value={expenseForm.title} onChange={e => setExpenseForm({ ...expenseForm, title: e.target.value })} />
                <input type="number" required placeholder="Amount (₹)" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-red-400 text-sm" value={expenseForm.amount} onChange={e => setExpenseForm({ ...expenseForm, amount: e.target.value })} />
                <input type="date" required className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-red-400 text-sm" value={expenseForm.date} onChange={e => setExpenseForm({ ...expenseForm, date: e.target.value })} />
                <button className="w-full bg-red-500/10 text-red-400 border border-red-500/20 py-4 rounded-xl font-bold uppercase tracking-widest text-[10px]">Submit Expense</button>
              </form>
            </motion.div>
          </div>
        )}

        {showMenuModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowMenuModal(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              className="glass-card !bg-[#0a1128] p-8 max-w-lg w-full relative z-10 border-accent/20 max-h-[95vh] overflow-y-auto"
            >
              <h3 className="text-2xl font-heading gold-text-gradient mb-6">
                {isEditingMenu ? '✏️ Edit Menu Item' : '➕ Add Menu Item'}
              </h3>
              <form onSubmit={saveMenu} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[9px] uppercase tracking-widest text-white/40 font-black">Item Name *</label>
                  <input type="text" required placeholder="e.g. Cold Coffee, Peri Peri Fries"
                    className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-accent text-sm"
                    value={menuForm.name} onChange={e => setMenuForm({ ...menuForm, name: e.target.value })}
                  />
                </div>

                <div className="space-y-1.5 p-4 bg-white/5 border border-white/10 rounded-2xl relative overflow-hidden">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-[9px] uppercase tracking-widest text-white/40 font-black">Local Asset Filename</label>
                    <ImageIcon size={14} className="text-accent/40" />
                  </div>
                  
                  <input type="text" placeholder="hero.png"
                    className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-accent text-sm mb-3"
                    value={menuForm.image_url || ''} 
                    onChange={e => setMenuForm({ ...menuForm, image_url: e.target.value })}
                  />

                  {menuForm.image_url ? (
                    <div className="relative group">
                      <img
                        src={getLocalAsset(menuForm.image_url, 'menu')}
                        alt="preview"
                        className="w-full h-40 object-cover rounded-2xl border border-white/10 bg-black/40"
                        onError={(e) => { e.target.src = logo43c; e.target.style.opacity = 0.3; }}
                      />
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl">
                         <p className="text-[8px] uppercase tracking-widest font-black text-white/60">Path: public/assets/menu/{menuForm.image_url}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-32 border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center gap-3 bg-white/2">
                       <ImageIcon size={24} className="text-white/10" />
                       <p className="text-[9px] text-white/20 font-bold uppercase">No asset specified</p>
                    </div>
                  )}
                  <p className="text-[8px] text-white/20 mt-3 leading-relaxed">
                    💡 <b>Tip:</b> Place your image in the <code className="text-accent/60">public/assets/menu/</code> folder and type its exact filename here.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] uppercase tracking-widest text-white/40 font-black">Category *</label>
                  <select required
                    className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none text-white text-sm"
                    value={menuForm.category}
                    onChange={e => setMenuForm({ ...menuForm, category: e.target.value })}
                  >
                    {menuCategories.map(c => <option key={c} value={c} className="bg-[#0a1128]">{c}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] uppercase tracking-widest text-white/40 font-black">Pricing (₹) *</label>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-[9px] text-accent/60 mb-1.5">Gold Price</p>
                      <input type="number" required placeholder="e.g. 150"
                        className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-accent text-sm"
                        value={menuForm.gold_price} onChange={e => setMenuForm({ ...menuForm, gold_price: e.target.value })}
                      />
                    </div>
                    <div>
                      <p className="text-[9px] text-white/40 mb-1.5 font-bold">Silver Price</p>
                      <input type="number" required placeholder="e.g. 180"
                        className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-accent text-sm"
                        value={menuForm.silver_price} onChange={e => setMenuForm({ ...menuForm, silver_price: e.target.value })}
                      />
                    </div>
                    <div>
                      <p className="text-[9px] text-white/40 mb-1.5">Non-Member</p>
                      <input type="number" required placeholder="e.g. 200"
                        className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-accent text-sm"
                        value={menuForm.non_member_price} onChange={e => setMenuForm({ ...menuForm, non_member_price: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] uppercase tracking-widest text-white/40 font-black">Discount % (Optional)</label>
                  <input type="number" placeholder="e.g. 10" min="0" max="100"
                    className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-accent text-sm"
                    value={menuForm.discount || ''} onChange={e => setMenuForm({ ...menuForm, discount: e.target.value })}
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowMenuModal(false)}
                    className="flex-1 py-4 rounded-xl border border-white/10 text-white/40 text-[10px] uppercase font-black hover:bg-white/5 transition-colors"
                  >Cancel</button>
                  <button type="submit" className="flex-[2] gold-button !py-4 font-black uppercase tracking-widest text-[10px]">
                    {menuForm.id ? 'Update Item' : 'Create Item'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showScreenModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowScreenModal(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-card !bg-[#0a1128] p-8 max-w-lg w-full relative z-10 border-accent/20">
               <h3 className="text-2xl font-heading gold-text-gradient mb-6">{screenForm.id ? 'Edit Screen' : 'Add New Screen'}</h3>
               <form onSubmit={saveScreen} className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] uppercase tracking-widest text-white/40">Screen Name</label>
                      <input type="text" required value={screenForm.name} onChange={e => setScreenForm({...screenForm, name: e.target.value})} className="w-full bg-white/5 border border-white/10 p-3 rounded-xl outline-none focus:border-accent text-sm" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] uppercase tracking-widest text-white/40">Type</label>
                      <select value={screenForm.type} onChange={e => setScreenForm({...screenForm, type: e.target.value})} className="w-full bg-white/5 border border-white/10 p-3 rounded-xl outline-none focus:border-accent text-sm">
                        <option value="private" className="bg-primary">Private (Lounge)</option>
                        <option value="shared" className="bg-primary">Shared (Cafe)</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[9px] uppercase tracking-widest text-white/40">Capacity (Guests)</label>
                      <input type="number" required value={screenForm.capacity} onChange={e => setScreenForm({...screenForm, capacity: e.target.value})} className="w-full bg-white/5 border border-white/10 p-3 rounded-xl outline-none focus:border-accent text-sm" />
                    </div>
                    <div className="flex items-center gap-3 pt-6">
                       <button type="button" onClick={() => setScreenForm({...screenForm, is_active: !screenForm.is_active})} className={`w-10 h-6 rounded-full relative transition-all ${screenForm.is_active ? 'bg-accent' : 'bg-white/10'}`}>
                          <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${screenForm.is_active ? 'left-5' : 'left-1'}`} />
                       </button>
                       <span className="text-[10px] uppercase font-black text-white">{screenForm.is_active ? 'Active' : 'Hidden'}</span>
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t border-white/5 space-y-4">
                    <p className="text-[10px] uppercase tracking-[0.2em] font-black text-accent">Pricing Config</p>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-1.5">
                        <label className="text-[9px] uppercase tracking-widest text-white/40">Pricing Type</label>
                        <select value={screenForm.pricing.pricing_type} onChange={e => setScreenForm({...screenForm, pricing: {...screenForm.pricing, pricing_type: e.target.value}})} className="w-full bg-white/5 border border-white/10 p-3 rounded-xl outline-none focus:border-accent text-sm">
                          <option value="group" className="bg-primary">Flat Rate</option>
                          <option value="per_person" className="bg-primary">Per Person</option>
                        </select>
                       </div>
                       <div className="space-y-1.5">
                        <label className="text-[9px] uppercase tracking-widest text-white/40">Non-Member Price</label>
                        <input type="number" value={screenForm.pricing.non_member} onChange={e => setScreenForm({...screenForm, pricing: {...screenForm.pricing, non_member: Number(e.target.value)}})} className="w-full bg-white/5 border border-white/10 p-3 rounded-xl outline-none focus:border-accent text-sm" />
                       </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-1.5">
                        <label className="text-[9px] uppercase tracking-widest text-white/40 font-bold">Silver Member Price</label>
                        <input type="number" value={screenForm.pricing.silver} onChange={e => setScreenForm({...screenForm, pricing: {...screenForm.pricing, silver: Number(e.target.value)}})} className="w-full bg-white/5 border border-white/10 p-3 rounded-xl outline-none focus:border-accent text-sm" />
                       </div>
                       <div className="space-y-1.5">
                        <label className="text-[9px] uppercase tracking-widest text-accent font-black">Gold Elite Price</label>
                        <input type="number" value={screenForm.pricing.gold} onChange={e => setScreenForm({...screenForm, pricing: {...screenForm.pricing, gold: Number(e.target.value)}})} className="w-full bg-white/5 border border-white/10 p-3 rounded-xl outline-none focus:border-accent text-sm gold-text-gradient" />
                       </div>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2">
                    <label className="text-[9px] uppercase tracking-widest text-white/40">Legacy Membership Link (For Credits)</label>
                    <select 
                      value={screenForm.legacy_link || 'None'} 
                      onChange={e => setScreenForm({...screenForm, legacy_link: e.target.value})} 
                      className="w-full bg-white/5 border border-white/10 p-3 rounded-xl outline-none focus:border-accent text-sm"
                    >
                      <option value="None" className="bg-primary">None (No Legacy Mapping)</option>
                      <option value="Mini Lounge" className="bg-primary">Mini Lounge</option>
                      <option value="Studio Lounge" className="bg-primary">Studio Lounge</option>
                      <option value="Grand Lounge" className="bg-primary">Grand Lounge</option>
                    </select>
                    <p className="text-[7px] text-white/20 uppercase tracking-widest">Maps this screen to old membership categories for credit usage.</p>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button type="button" onClick={() => setShowScreenModal(false)} className="flex-1 py-4 text-[10px] uppercase font-black text-white/40 hover:bg-white/5 rounded-xl border border-white/10">Discard</button>
                    <button type="submit" className="flex-[2] gold-button !py-4 !text-[10px] uppercase font-black">Commit Changes</button>
                  </div>
               </form>
            </motion.div>
          </div>
        )}

        {/* Combo Modal */}
        {showComboModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowComboModal(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-card !bg-[#0a1128] p-8 max-w-lg w-full relative z-10 border-accent/20 space-y-5 max-h-[95vh] overflow-y-auto">
              <h3 className="text-2xl font-heading gold-text-gradient mb-6">{comboForm.id ? 'Edit Combo' : 'Create Combo'}</h3>
              <form onSubmit={saveCombo} className="space-y-4">
                {/* Combo Image Asset mapping */}
                <div className="space-y-1.5 p-4 bg-white/5 border border-white/10 rounded-2xl">
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-[9px] uppercase tracking-widest text-white/40 font-black">Combo Banner (public/assets/combos/)</label>
                    <ImageIcon size={14} className="text-accent/40" />
                  </div>
                  
                  <input type="text" placeholder="bday_banner.jpg"
                    className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-accent text-sm mb-3"
                    value={comboForm.image_url || ''} 
                    onChange={e => setComboForm({ ...comboForm, image_url: e.target.value })}
                  />

                  {comboForm.image_url && (
                    <div className="relative h-32 rounded-xl overflow-hidden group border border-white/10 bg-black/40">
                      <img 
                        src={getLocalAsset(comboForm.image_url, 'combos')} 
                        className="w-full h-full object-cover" 
                        alt="Preview" 
                        onError={(e) => { e.target.src = logo43c; e.target.style.opacity = 0.2; }}
                      />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                         <p className="text-[8px] font-black uppercase text-accent">Filename active</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-[9px] uppercase tracking-widest text-white/40 font-black">Combo Name</label>
                    <input type="text" required placeholder="Birthday Dash Special" className="w-full bg-white/5 border border-white/10 p-3 rounded-xl outline-none focus:border-accent text-sm" value={comboForm.name || ''} onChange={e => setComboForm({ ...comboForm, name: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-[9px] uppercase tracking-widest text-white/40 font-black">Price (₹)</label>
                    <input type="number" required placeholder="999" className="w-full bg-white/5 border border-white/10 p-3 rounded-xl outline-none focus:border-accent text-sm" value={comboForm.price || ''} onChange={e => setComboForm({ ...comboForm, price: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-[9px] uppercase tracking-widest text-white/40 font-black">Max Guests</label>
                    <input type="number" required placeholder="6" className="w-full bg-white/5 border border-white/10 p-3 rounded-xl outline-none focus:border-accent text-sm" value={comboForm.max_guests || ''} onChange={e => setComboForm({ ...comboForm, max_guests: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-[9px] uppercase tracking-widest text-white/40 font-black">Default Screen</label>
                    <select required className="w-full bg-white/5 border border-white/10 p-3 rounded-xl outline-none focus:border-accent text-sm text-white" value={comboForm.screen_type || ''} onChange={e => setComboForm({ ...comboForm, screen_type: e.target.value })}>
                       <option value="" disabled className="bg-[#0a1128]">Select Screen</option>
                       {screens.map(s => <option key={s} value={s} className="bg-[#0a1128]">{s}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] uppercase tracking-widest text-white/40 font-black">Number of Slots</label>
                    <input type="number" required min="1" placeholder="1" className="w-full bg-white/5 border border-white/10 p-3 rounded-xl outline-none focus:border-accent text-sm" value={comboForm.number_of_slots || ''} onChange={e => setComboForm({ ...comboForm, number_of_slots: e.target.value })} />
                  </div>
                </div>

                <div>
                   <label className="text-[9px] uppercase tracking-widest text-white/40 font-black">Description</label>
                   <textarea placeholder="Tell customers about the vibe..." className="w-full bg-white/5 border border-white/10 p-3 rounded-xl outline-none focus:border-accent text-sm h-16" value={comboForm.description || ''} onChange={e => setComboForm({ ...comboForm, description: e.target.value })} />
                </div>
                <div>
                   <label className="text-[9px] uppercase tracking-widest text-white/40 font-black">What's Included</label>
                   <textarea placeholder="Drinks, Balloons, Decorations..." className="w-full bg-white/5 border border-white/10 p-3 rounded-xl outline-none focus:border-accent text-sm h-16" value={comboForm.includes || ''} onChange={e => setComboForm({ ...comboForm, includes: e.target.value })} />
                </div>
                <div>
                   <label className="text-[9px] uppercase tracking-widest text-white/40 font-black">Custom Reply Message (Optional)</label>
                   <textarea placeholder="Standard greeting for this package..." className="w-full bg-white/5 border border-white/10 p-3 rounded-xl outline-none focus:border-accent text-sm h-16" value={comboForm.custom_message || ''} onChange={e => setComboForm({ ...comboForm, custom_message: e.target.value })} />
                </div>

                <div className="flex items-center gap-3 bg-white/5 p-4 rounded-xl border border-white/10">
                  <input type="checkbox" id="combo_active_modal" checked={comboForm.is_active} onChange={(e) => setComboForm(p => ({...p, is_active: e.target.checked}))} className="w-5 h-5 accent-accent" />
                  <label htmlFor="combo_active_modal" className="text-sm text-white/70 font-bold uppercase tracking-widest text-[10px]">Combo is Active</label>
                </div>

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setShowComboModal(false)}
                    className="flex-1 py-4 rounded-xl border border-white/10 text-white/40 text-[10px] uppercase font-black hover:bg-white/5 transition-colors"
                  >Cancel</button>
                  <button type="submit" className="flex-[2] gold-button !py-4 font-black uppercase tracking-widest text-[10px]">
                    {editingComboId ? 'Update Combo' : 'Create Combo'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Coupon Modal */}
        {showCouponModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowCouponModal(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-card !bg-[#0a1128] p-8 max-w-lg w-full relative z-10 border-accent/20 space-y-5 max-h-[90vh] overflow-y-auto">
              <h3 className="text-2xl font-heading gold-text-gradient mb-6">{couponForm.id ? 'Edit Coupon' : 'Create Coupon'}</h3>
              <form onSubmit={saveCoupon} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="text-[10px] uppercase tracking-widest text-white/40 block mb-2">Coupon Code</label>
                    <input type="text" required className="w-full bg-white/5 border border-white/10 p-3 rounded-xl outline-none focus:border-accent text-sm font-mono uppercase text-white" value={couponForm.code} onChange={e => setCouponForm({ ...couponForm, code: e.target.value.toUpperCase() })} />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="text-[10px] uppercase tracking-widest text-white/40 block mb-2">Type</label>
                    <select className="w-full bg-white/5 border border-white/10 p-3 rounded-xl outline-none focus:border-accent text-sm text-white" value={couponForm.type} onChange={e => setCouponForm({ ...couponForm, type: e.target.value })}>
                      <option value="percentage" className="bg-[#0a1128]">Percentage (%)</option>
                      <option value="amount" className="bg-[#0a1128]">Fixed Amount (₹)</option>
                      <option value="free_hour" className="bg-[#0a1128]">Free Hour</option>
                    </select>
                  </div>
                  
                  {couponForm.type !== 'free_hour' && (
                    <div className="col-span-2 sm:col-span-1">
                      <label className="text-[10px] uppercase tracking-widest text-white/40 block mb-2">Value</label>
                      <input type="number" required placeholder={couponForm.type === 'percentage' ? '%' : '₹'} className="w-full bg-white/5 border border-white/10 p-3 rounded-xl outline-none focus:border-accent text-sm text-white" value={couponForm.value} onChange={e => setCouponForm({ ...couponForm, value: e.target.value })} />
                    </div>
                  )}

                  <div className="col-span-2 sm:col-span-1">
                    <label className="text-[10px] uppercase tracking-widest text-white/40 block mb-2">Applies To</label>
                    <select className="w-full bg-white/5 border border-white/10 p-3 rounded-xl outline-none focus:border-accent text-sm text-white" value={couponForm.applies_to} onChange={e => setCouponForm({ ...couponForm, applies_to: e.target.value })}>
                      <option value="both" className="bg-[#0a1128]">Food & Booking</option>
                      <option value="food" className="bg-[#0a1128]">Food Only</option>
                      <option value="booking" className="bg-[#0a1128]">Booking Only</option>
                    </select>
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <label className="text-[10px] uppercase tracking-widest text-white/40 block mb-2">Usage Per User (0 = Unlim)</label>
                    <input type="number" min="0" className="w-full bg-white/5 border border-white/10 p-3 rounded-xl outline-none focus:border-accent text-sm text-white" value={couponForm.usage_per_user} onChange={e => setCouponForm({ ...couponForm, usage_per_user: e.target.value })} />
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <label className="text-[10px] uppercase tracking-widest text-white/40 block mb-2">Validity Days (Opt)</label>
                    <input type="number" min="0" placeholder="e.g. 30" className="w-full bg-white/5 border border-white/10 p-3 rounded-xl outline-none focus:border-accent text-sm text-white" value={couponForm.validity_days} onChange={e => setCouponForm({ ...couponForm, validity_days: e.target.value })} />
                  </div>

                  <div className="col-span-2 sm:col-span-1">
                    <label className="text-[10px] uppercase tracking-widest text-white/40 block mb-2">Expiry Date (Opt)</label>
                    <input type="date" className="w-full bg-white/5 border border-white/10 p-3 rounded-xl outline-none focus:border-accent text-sm text-white custom-date-input" value={couponForm.expiry_date} onChange={e => setCouponForm({ ...couponForm, expiry_date: e.target.value })} />
                  </div>

                  <div className="col-span-2">
                    <label className="text-[10px] uppercase tracking-widest text-white/40 block mb-2 font-black">WhatsApp Template (Use {"{{code}}"} as placeholder)</label>
                    <textarea 
                      placeholder="e.g. Welcome to 43C! Use code {{code}} to get a 5% discount." 
                      className="w-full bg-white/5 border border-white/10 p-4 rounded-2xl outline-none focus:border-accent text-sm h-32 resize-none"
                      value={couponForm.whatsapp_template || ''} 
                      onChange={e => setCouponForm({ ...couponForm, whatsapp_template: e.target.value })}
                    />
                    <p className="text-[8px] text-white/20 mt-1 uppercase tracking-widest">Example: Hey you coupon code is {"{{code}}"} use this code to get 5% off.</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-white/5 p-4 rounded-xl border border-white/10 mt-4">
                  <input type="checkbox" id="coupon_active" checked={couponForm.active} onChange={(e) => setCouponForm(p => ({...p, active: e.target.checked}))} className="w-5 h-5 accent-accent" />
                  <label htmlFor="coupon_active" className="text-sm text-white/70">Coupon Active</label>
                </div>
                <button className="gold-button w-full !py-4 font-black uppercase tracking-widest text-[10px] mt-4">Save Coupon</button>
              </form>
            </motion.div>
          </div>
        )}

        {/* Manual Booking Modal */}
        {showBookingModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowBookingModal(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-card !bg-[#0a1128] p-8 max-w-2xl w-full relative z-10 border-accent/20 max-h-[90vh] overflow-y-auto space-y-5">
              <h3 className="text-2xl font-heading gold-text-gradient">Manual Booking</h3>
              <form onSubmit={manualBooking} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" required placeholder="Guest Name" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-accent text-sm" value={bookingForm.name} onChange={e => setBookingForm({ ...bookingForm, name: e.target.value })} />
                  <input type="tel" required placeholder="Mobile" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-accent text-sm" value={bookingForm.mobile} onChange={e => setBookingForm({ ...bookingForm, mobile: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <input type="date" required className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-accent text-sm custom-date-input text-white" value={bookingForm.date} onChange={e => setBookingForm({ ...bookingForm, date: e.target.value, slots: [] })} />
                  <select className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-accent text-sm text-white" value={bookingForm.screen} onChange={e => setBookingForm({ ...bookingForm, screen: e.target.value, slots: [] })}>
                    {['Screen 1', 'Screen 2', 'TV Screen'].map(s => <option key={s} value={s} className="bg-primary">{s}</option>)}
                  </select>
                </div>
                <input type="number" required placeholder="Guest Count" min="1" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-accent text-sm" value={bookingForm.guest_count} onChange={e => setBookingForm({ ...bookingForm, guest_count: e.target.value })} />
                <div className="border-t border-white/10 pt-4">
                  <p className="text-[10px] uppercase tracking-widest text-white/40 mb-3">Select Slots</p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {SLOT_HOURS.map(h => {
                      const st = bookingSlotStatus[h]; const isSel = bookingForm.slots.includes(h); const isAv = st === 'available' || !st; return (
                        <button type="button" key={h} disabled={!isAv} onClick={() => { if (!isAv) return; setBookingForm(p => ({ ...p, slots: p.slots.includes(h) ? p.slots.filter(s => s !== h) : [...p.slots, h] })); }}
                          className={`p-3 rounded-xl border text-center text-[11px] font-bold transition-all ${isSel ? 'bg-accent border-accent text-primary' : isAv ? 'bg-white/5 border-white/10' : 'opacity-30 bg-black/20 border-transparent cursor-not-allowed'}`}>
                          {getSlotLabel(h).split(' - ')[0]}
                        </button>
                      );
                    })}
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
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowAdminModal(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-card !bg-[#0a1128] p-8 max-w-md w-full relative z-10 border-accent/20 space-y-5">
              <h3 className="text-2xl font-heading gold-text-gradient">Add Administrator</h3>
              <form onSubmit={saveAdmin} className="space-y-4">
                <input type="text" required placeholder="Name" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-accent text-sm" value={adminForm.name} onChange={e => setAdminForm({ ...adminForm, name: e.target.value })} />
                <input type="tel" required placeholder="Mobile Number" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-accent text-sm" value={adminForm.mobile} onChange={e => setAdminForm({ ...adminForm, mobile: e.target.value })} />
                <input type="text" required placeholder="Password" minLength="6" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-accent text-sm" value={adminForm.password} onChange={e => setAdminForm({ ...adminForm, password: e.target.value })} />
                <button className="gold-button w-full py-4 !text-[10px] uppercase font-black">Grant Access</button>
              </form>
            </motion.div>
          </div>
        )}

        {/* Cancel Modal */}
        {showCancelModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowCancelModal(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-card !bg-[#0a1128] p-8 max-w-md w-full relative z-10 border-red-500/20 space-y-5">
              <h3 className="text-2xl font-heading text-red-400">Cancel {cancelTarget?.type === 'booking' ? 'Booking' : 'Order'}</h3>
              <p className="text-sm text-white/40">Please provide a reason for cancellation. This will be sent to the customer.</p>
              <div className="space-y-4">
                <textarea rows={3} value={cancelReason} onChange={e => setCancelReason(e.target.value)}
                  placeholder="Enter cancellation reason..."
                  className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-red-400 text-sm resize-none" />
                <div className="flex gap-3">
                  <button onClick={() => setShowCancelModal(false)} className="flex-1 py-3 rounded-xl border border-white/10 text-white/40 text-[10px] uppercase font-black">Back</button>
                  <button onClick={confirmCancel} className="flex-1 bg-red-500/20 text-red-400 border border-red-500/30 py-3 rounded-xl font-black uppercase tracking-widest text-[10px]">Confirm Cancel</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {/* Due Amount Modal */}
        {showDueModal && dueTarget && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowDueModal(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-card !bg-[#0a1128] p-8 max-w-md w-full relative z-10 border-green-500/20 space-y-5">
              <h3 className="text-2xl font-heading text-green-400">Mark as Completed</h3>
              <div className="bg-white/5 rounded-xl p-4 border border-white/10 space-y-2">
                <p className="font-bold">{dueTarget.customer_name}</p>
                <p className="text-sm text-white/40">{dueTarget.booking_date} · {dueTarget.screen}</p>
                <p className="text-accent font-bold">Total: ₹{dueTarget.final_price || dueTarget.price} · Advance: ₹{dueTarget.advance_paid || 0}</p>
                <p className="text-yellow-400 text-sm font-bold">Remaining to collect: ₹{(dueTarget.remaining_amount) || (dueTarget.final_price || dueTarget.price || 0) - (dueTarget.advance_paid || 0)}</p>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] uppercase tracking-widest text-white/40 font-black">Final Amount Collected on Arrival (₹)</label>
                <input type="number" value={dueAmount} onChange={e => setDueAmount(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-green-400 text-xl font-heading text-center"
                  placeholder="Enter amount paid" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowDueModal(false)} className="flex-1 py-3 rounded-xl border border-white/10 text-white/40 text-[10px] uppercase font-black">Back</button>
                <button onClick={saveDueAmount} className="flex-1 bg-green-500/20 text-green-400 border border-green-500/30 py-3 rounded-xl font-black uppercase tracking-widest text-[10px]">Confirm Completion</button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Advance Payment Modal */}
        {showAdvanceModal && advanceTarget && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowAdvanceModal(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-card !bg-[#0a1128] p-8 max-w-md w-full relative z-10 border-accent/20 space-y-5">
              <h3 className="text-2xl font-heading gold-text-gradient">Confirm Booking</h3>
              <div className="bg-white/5 rounded-xl p-4 space-y-2 border border-white/10">
                <p className="font-bold">{advanceTarget.customer_name}</p>
                <p className="text-sm text-white/50">{advanceTarget.booking_date} · {formatSlotsDisplay(advanceTarget.slots)} · {advanceTarget.guest_count} guests</p>
                <p className="text-accent font-bold">Total: ₹{advanceTarget.final_price || advanceTarget.price}</p>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] uppercase tracking-widest text-white/40 font-black">Advance Amount Paid (₹)</label>
                <input type="number" value={advanceAmount} onChange={e => setAdvanceAmount(e.target.value)}
                  placeholder={`Min 50% = ₹${Math.ceil((advanceTarget.final_price || advanceTarget.price || 0) * 0.5)}`}
                  className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-accent text-xl font-heading text-center" />
                {advanceAmount && !isNaN(advanceAmount) && (
                  <p className="text-[10px] text-white/40 text-center">
                    Remaining on arrival: ₹{(advanceTarget.final_price || advanceTarget.price || 0) - Number(advanceAmount)}
                  </p>
                )}
              </div>
              <p className="text-[9px] text-white/30 text-center">Customer will receive a WhatsApp message with payment details.</p>
              <div className="flex gap-3">
                <button onClick={() => setShowAdvanceModal(false)} className="flex-1 py-3 rounded-xl border border-white/10 text-white/40 text-[10px] uppercase font-black">Back</button>
                <button onClick={confirmAdvancePayment} className="flex-1 gold-button !py-3 !text-[10px] font-black uppercase tracking-widest text-wrap leading-tight">Confirm & Send WhatsApp</button>
              </div>
            </motion.div>
          </div>
        )}
        {/* Food Combo Modal */}
        {showFoodComboModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowFoodComboModal(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass-card w-full max-w-2xl max-h-[90dvh] overflow-y-auto relative z-10 p-8">
              <h2 className="text-2xl font-heading mb-6">{foodComboForm.id ? 'Edit' : 'New'} Food Combo</h2>
              <form onSubmit={saveFoodCombo} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-white/40 font-black">Combo Name</label>
                    <input type="text" required value={foodComboForm.name} onChange={e => setFoodComboForm({ ...foodComboForm, name: e.target.value })} className="w-full bg-white/5 border border-white/10 p-3 rounded-xl outline-none focus:border-accent" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] uppercase tracking-widest text-white/40 font-black">Combo Price (₹)</label>
                    <input type="number" required value={foodComboForm.price} onChange={e => setFoodComboForm({ ...foodComboForm, price: e.target.value })} className="w-full bg-white/5 border border-white/10 p-3 rounded-xl outline-none focus:border-accent" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] uppercase tracking-widest text-white/40 font-black">Image URL / Path</label>
                  <input type="text" value={foodComboForm.image_url} onChange={e => setFoodComboForm({ ...foodComboForm, image_url: e.target.value })} className="w-full bg-white/5 border border-white/10 p-3 rounded-xl outline-none focus:border-accent" placeholder="e.g. burger_combo.jpg" />
                </div>
                <div className="space-y-4">
                  <label className="text-[10px] uppercase tracking-widest text-white/40 font-black">Select Items & Quantities</label>
                  <div className="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto p-4 bg-white/5 rounded-2xl border border-white/10">
                    {menuItems.map(item => {
                      const selectedItem = foodComboForm.items.find(i => i.id === item.id);
                      const isSelected = !!selectedItem;
                      return (
                        <div key={item.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${isSelected ? 'bg-accent/10 border-accent' : 'bg-white/5 border-white/10'}`}>
                          <button type="button" onClick={() => {
                            if (isSelected) { setFoodComboForm({ ...foodComboForm, items: foodComboForm.items.filter(i => i.id !== item.id) }); }
                            else { setFoodComboForm({ ...foodComboForm, items: [...foodComboForm.items, { id: item.id, name: item.name, price: item.non_member_price, qty: 1 }] }); }
                          }} className="flex items-center gap-3 flex-1 text-left">
                            <div className={`w-4 h-4 rounded border flex items-center justify-center ${isSelected ? 'bg-accent border-accent' : 'border-white/20'}`}>
                              {isSelected && <CheckCircle2 size={10} className="text-primary" />}
                            </div>
                            <span className={`text-xs font-bold ${isSelected ? 'text-accent' : 'text-white/40'}`}>{item.name}</span>
                            <span className="text-[10px] ml-auto opacity-30">₹{item.non_member_price}</span>
                          </button>
                          
                          {isSelected && (
                            <div className="flex items-center gap-2 bg-black/20 rounded-lg p-1 border border-white/5">
                              <span className="text-[8px] uppercase font-black text-white/30 px-1">Qty</span>
                              <input 
                                type="number" 
                                min="1"
                                value={selectedItem.qty || 1}
                                onChange={(e) => {
                                  const val = Math.max(1, parseInt(e.target.value) || 1);
                                  setFoodComboForm({
                                    ...foodComboForm,
                                    items: foodComboForm.items.map(i => i.id === item.id ? { ...i, qty: val } : i)
                                  });
                                }}
                                className="w-12 bg-transparent text-xs text-center font-bold text-accent outline-none"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setShowFoodComboModal(false)} className="flex-1 py-4 border border-white/10 rounded-xl text-[10px] uppercase font-black text-white/40">Cancel</button>
                  <button type="submit" disabled={loading} className="flex-1 gold-button !py-4 !text-[10px] font-black uppercase tracking-widest">{loading ? 'Saving...' : 'Save Combo'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {showMembershipModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowMembershipModal(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-card !bg-[#0a1128] p-8 max-w-md w-full relative z-10 border-accent/20 space-y-6 max-h-[85vh] overflow-y-auto">
              <h3 className="text-2xl font-heading gold-text-gradient">{isEditingMembership ? 'Edit' : 'Create'} Membership</h3>
              <form onSubmit={saveMembership} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[9px] uppercase tracking-widest text-white/40 font-black">Plan Name</label>
                  <input type="text" required placeholder="e.g. Gold, Silver, Elite" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-accent text-sm" value={membershipForm.name} onChange={e => setMembershipForm({ ...membershipForm, name: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] uppercase tracking-widest text-white/40 font-black">Price (₹)</label>
                    <input type="number" required placeholder="999" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-accent text-sm font-bold text-accent" value={membershipForm.price} onChange={e => setMembershipForm({ ...membershipForm, price: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] uppercase tracking-widest text-white/40 font-black">Validity (Days)</label>
                    <input type="number" required placeholder="30" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-accent text-sm font-bold" value={membershipForm.validity_days} onChange={e => setMembershipForm({ ...membershipForm, validity_days: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-4 bg-white/5 p-4 rounded-2xl border border-white/10">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] uppercase tracking-widest text-white/40 font-black">Credit Type</label>
                    <div className="flex gap-2 bg-black/20 p-1 rounded-lg">
                      <button type="button" onClick={() => setMembershipForm({ ...membershipForm, credit_type: 'any' })}
                        className={`px-3 py-1.5 text-[8px] font-black uppercase rounded-md transition-all ${membershipForm.credit_type === 'any' ? 'bg-accent text-primary' : 'text-white/40'}`}>Any Screen</button>
                      <button type="button" onClick={() => setMembershipForm({ ...membershipForm, credit_type: 'per_screen' })}
                        className={`px-3 py-1.5 text-[8px] font-black uppercase rounded-md transition-all ${membershipForm.credit_type === 'per_screen' ? 'bg-accent text-primary' : 'text-white/40'}`}>Per Screen</button>
                    </div>
                  </div>

                  {membershipForm.credit_type === 'any' ? (
                    <div className="space-y-1.5">
                      <label className="text-[9px] uppercase tracking-widest text-white/40 font-black">Total Hours/Credits</label>
                      <input type="number" placeholder="Enter credits (e.g. 10)" className="w-full bg-white/5 border border-white/10 p-3 rounded-xl outline-none focus:border-accent text-sm" value={membershipForm.credits} onChange={e => setMembershipForm({ ...membershipForm, credits: e.target.value })} />
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      {screens.map(screen => (
                        <div key={screen} className="flex items-center gap-3 bg-black/20 p-3 rounded-xl border border-white/5">
                          <label className="text-[9px] uppercase font-bold text-white/60 flex-1">{screen}</label>
                          <input 
                            type="number" 
                            min="0"
                            placeholder="0" 
                            className="w-20 bg-white/5 border border-white/10 p-2 rounded-lg text-center text-xs outline-none focus:border-accent" 
                            value={membershipForm.per_screen_credits[screen] || ''} 
                            onChange={e => setMembershipForm({ 
                              ...membershipForm, 
                              per_screen_credits: { ...membershipForm.per_screen_credits, [screen]: e.target.value } 
                            })} 
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] uppercase tracking-widest text-white/40 font-black">Perks & Description</label>
                  <textarea required placeholder="Free snacks, 20% off bookings..." className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-accent text-sm h-32 resize-none" value={membershipForm.description} onChange={e => setMembershipForm({ ...membershipForm, description: e.target.value })} />
                </div>
                <div className="flex items-center gap-3 bg-white/5 p-4 rounded-xl border border-white/10">
                  <input type="checkbox" id="mem_active" checked={membershipForm.is_active} onChange={(e) => setMembershipForm(p => ({...p, is_active: e.target.checked}))} className="w-5 h-5 accent-accent" />
                  <label htmlFor="mem_active" className="text-xs text-white/70 font-bold uppercase tracking-widest">Plan is Active</label>
                </div>
                <button disabled={loading} className="w-full gold-button !py-4 font-black uppercase tracking-widest text-sm shadow-lg shadow-accent/10">{loading ? 'Saving...' : isEditingMembership ? 'Update Membership' : 'Create Membership'}</button>
              </form>
            </motion.div>
          </div>
        )}
        {showMemApproveModal && memApproveTarget && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setShowMemApproveModal(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="glass-card max-w-sm w-full relative z-10 p-8 border-accent/20 space-y-6">
              <div className="text-center space-y-2">
                <Crown size={32} className="mx-auto text-accent mb-2" />
                <h3 className="text-xl font-heading gold-text-gradient">Approve Membership</h3>
                <p className="text-[10px] text-white/40 uppercase tracking-widest font-bold">{memApproveTarget.customer_name} · {memApproveTarget.plan_name}</p>
              </div>
              <div className="space-y-2">
                <label className="text-[9px] uppercase tracking-widest text-white/40 font-black">Final Amount Received (₹)</label>
                <input type="number" value={memApproveAmount} onChange={e => setMemApproveAmount(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-accent text-xl font-heading text-center text-accent" />
                <p className="text-[9px] text-white/20 text-center">This will be logged in monthly earnings.</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowMemApproveModal(false)} className="flex-1 py-3 rounded-xl border border-white/10 text-white/40 text-[10px] uppercase font-black">Cancel</button>
                <button onClick={confirmMemApprove} disabled={loading} className="flex-1 gold-button !py-3 !text-[10px] font-black uppercase tracking-widest">{loading ? 'Processing...' : 'Confirm & Activate'}</button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    );
  };

  export default AdminDashboard;

