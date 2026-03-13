import React, { useState, useEffect } from 'react';
import api from '../utils/api';
import { 
    LayoutDashboard, Calendar, Users, Settings, Plus, BarChart3, Search, 
    Clock, QrCode, CheckCircle, XCircle, TrendingUp, TrendingDown, 
    Receipt, UserPlus, Star, Crown, Wallet
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const AdminDashboard = () => {
    const [view, setView] = useState('overview');
    const [analytics, setAnalytics] = useState(null);
    const [bookings, setBookings] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(false);
    
    // Forms
    const [showExpenseModal, setShowExpenseModal] = useState(false);
    const [expenseForm, setExpenseForm] = useState({ title: '', amount: '', date: new Date().toISOString().split('T')[0], description: '' });
    
    const [showBookingModal, setShowBookingModal] = useState(false);
    const [bookingForm, setBookingForm] = useState({ name: '', mobile: '', slot_id: '', guest_count: 2, date: new Date().toISOString().split('T')[0] });
    const [availableSlots, setAvailableSlots] = useState([]);

    useEffect(() => {
        if (showBookingModal) {
            const fetchAvailable = async () => {
                const date = new Date().toISOString().split('T')[0];
                const res = await api.get(`slots/available/?date=${date}`);
                setAvailableSlots(res.data);
            };
            fetchAvailable();
        }
    }, [showBookingModal]);

    useEffect(() => {
        if (view === 'overview') fetchAnalytics();
        if (view === 'bookings') fetchAllBookings();
        if (view === 'members') fetchCustomers();
        if (view === 'expenses') fetchExpenses();
    }, [view]);

    const fetchAnalytics = async () => {
        try {
            const res = await api.get('bookings/analytics/');
            setAnalytics(res.data);
        } catch (err) { console.error(err); }
    };

    const fetchAllBookings = async () => {
        setLoading(true);
        try {
            const res = await api.get('bookings/admin/bookings/');
            setBookings(res.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const fetchCustomers = async () => {
        try {
            const res = await api.get('customers/admin/customers/');
            setCustomers(res.data);
        } catch (err) { console.error(err); }
    };

    const fetchExpenses = async () => {
        try {
            const res = await api.get('bookings/expenses/');
            setExpenses(res.data);
        } catch (err) { console.error(err); }
    };

    const logExpense = async (e) => {
        e.preventDefault();
        try {
            await api.post('bookings/expenses/', expenseForm);
            setShowExpenseModal(false);
            fetchExpenses();
            if (view === 'overview') fetchAnalytics();
        } catch (err) { alert("Failed to log expense"); }
    };

    const manualBooking = async (e) => {
        e.preventDefault();
        try {
            await api.post('bookings/manual-block/', bookingForm);
            alert("Reservation recorded successfully.");
            setShowBookingModal(false);
            fetchAllBookings();
        } catch (err) { alert("Failed to block slot"); }
    };

    return (
        <div className="flex min-h-screen luxury-bg mesh-pattern">
            {/* Sidebar */}
            <div className="w-72 bg-[#05071A]/80 backdrop-blur-2xl border-r border-[#D4A95F]/10 p-8 space-y-12 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center text-primary font-bold text-xl">43</div>
                    <div>
                        <h1 className="text-xl font-heading gold-text-gradient font-black">Control</h1>
                        <p className="text-[8px] uppercase tracking-[0.3em] text-white/30">Executive Dashboard</p>
                    </div>
                </div>

                <nav className="space-y-3">
                    {[
                        { id: 'overview', icon: <LayoutDashboard size={20} />, label: 'Analytics' },
                        { id: 'bookings', icon: <Calendar size={20} />, label: 'Reservations' },
                        { id: 'members', icon: <Users size={20} />, label: 'Elite Circle' },
                        { id: 'expenses', icon: <Wallet size={20} />, label: 'Finance' },
                        { id: 'settings', icon: <Settings size={20} />, label: 'Lounge Config' },
                    ].map((item) => (
                        <button 
                            key={item.id}
                            onClick={() => setView(item.id)}
                            className={`w-full flex items-center gap-4 px-5 py-4 rounded-2xl transition-all duration-300 ${view === item.id ? 'bg-accent text-primary font-bold shadow-lg shadow-accent/20' : 'text-white/40 hover:text-white hover:bg-white/5'}`}
                        >
                            {item.icon} <span className="text-sm uppercase tracking-widest">{item.label}</span>
                        </button>
                    ))}
                </nav>
            </div>

            {/* Content Area */}
            <div className="flex-1 p-12 overflow-y-auto">
                <AnimatePresence mode="wait">
                    {view === 'overview' && analytics && (
                        <motion.div key="overview" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-12">
                            <header className="flex justify-between items-end">
                                <div>
                                    <h2 className="text-5xl font-heading mb-2">Performance <span className="gold-text-gradient italic">Snapshot</span></h2>
                                    <p className="text-white/30 truncate uppercase tracking-[0.2em] text-[10px]">Current Month Financial Tracking</p>
                                </div>
                                <div className="flex gap-4">
                                    <button onClick={() => setShowExpenseModal(true)} className="glass-card !border-white/5 px-6 py-3 flex items-center gap-2 text-xs uppercase tracking-widest font-bold hover:bg-white/5 transition-colors">
                                        <Wallet className="w-4 h-4 text-accent" /> Log Expense
                                    </button>
                                    <button onClick={() => setShowBookingModal(true)} className="gold-button !px-6 !py-3 !text-xs flex items-center gap-2">
                                        <Plus className="w-4 h-4" /> Manual Reserve
                                    </button>
                                </div>
                            </header>

                            {/* Stats Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                                <div className="navy-card p-8">
                                    <p className="text-white/30 text-[9px] uppercase tracking-widest font-black mb-2">Today's Guests</p>
                                    <h3 className="text-3xl font-heading text-accent font-black">{analytics.today_bookings}</h3>
                                </div>
                                <div className="navy-card p-8 border-green-500/20">
                                    <p className="text-white/30 text-[9px] uppercase tracking-widest font-black mb-2">Today's Revenue</p>
                                    <h3 className="text-3xl font-heading text-green-500 font-black">₹{analytics.today_revenue}</h3>
                                </div>
                                <div className="navy-card p-8 border-red-500/20">
                                    <p className="text-white/30 text-[9px] uppercase tracking-widest font-black mb-2">Monthly Expenses</p>
                                    <h3 className="text-3xl font-heading text-red-400 font-black">₹{analytics.monthly_expenses}</h3>
                                </div>
                                <div className="navy-card p-8 border-accent/40 bg-accent/5">
                                    <p className="text-white/30 text-[9px] uppercase tracking-widest font-black mb-2">Net Profit</p>
                                    <h3 className="text-3xl font-heading gold-text-gradient font-black">₹{analytics.net_profit}</h3>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                {/* Top Customers */}
                                <div className="glass-card p-10">
                                    <h4 className="flex items-center gap-3 text-xl font-heading mb-8"><Star className="w-5 h-5 text-accent"/> Elite Contributors</h4>
                                    <div className="space-y-6">
                                        {analytics.top_customers.map((c, i) => (
                                            <div key={i} className="flex justify-between items-center group">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center text-accent font-black text-xs">{i+1}</div>
                                                    <div>
                                                        <p className="font-bold">{c.customer__name}</p>
                                                        <p className="text-[10px] text-white/20 tracking-widest">{c.customer__mobile}</p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="font-heading text-accent">₹{c.total_spent}</p>
                                                    <p className="text-[9px] text-white/20 uppercase tracking-widest">{c.count} Visits</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Popular Slots */}
                                <div className="glass-card p-10">
                                    <h4 className="flex items-center gap-3 text-xl font-heading mb-8"><Clock className="w-5 h-5 text-accent"/> Prime Slots</h4>
                                    <div className="space-y-6">
                                        {analytics.popular_slots.map((s, i) => (
                                            <div key={i} className="flex justify-between items-center">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-10 w-[2px] bg-accent/30"></div>
                                                    <div>
                                                        <p className="font-bold">{s.slot__start_time.slice(0, 5)} - {s.slot__screen__screen_name}</p>
                                                        <p className="text-[9px] text-white/20 uppercase tracking-widest">Peak Demand Slot</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 px-4 py-1 rounded-full bg-accent/10 border border-accent/20">
                                                    <span className="text-accent text-xs font-black">{s.count}</span>
                                                    <span className="text-[8px] uppercase tracking-widest text-white/40">Bookings</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {view === 'bookings' && (
                        <motion.div key="bookings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                            <h2 className="text-3xl font-heading">Reservation <span className="gold-text-gradient italic">Manifest</span></h2>
                            <div className="glass-card overflow-hidden">
                                <table className="w-full text-left">
                                    <thead className="bg-white/5 border-b border-white/5">
                                        <tr>
                                            <th className="p-6 text-[10px] uppercase tracking-[0.3em] text-white/40">Reference</th>
                                            <th className="p-6 text-[10px] uppercase tracking-[0.3em] text-white/40">Dignitary</th>
                                            <th className="p-6 text-[10px] uppercase tracking-[0.3em] text-white/40">Placement</th>
                                            <th className="p-6 text-[10px] uppercase tracking-[0.3em] text-white/40">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {bookings.map((b, i) => (
                                            <tr key={i} className="border-t border-white/5 hover:bg-white/[0.02] transition-colors group">
                                                <td className="p-6">
                                                    <p className="text-accent font-black tracking-widest text-[10px]">{b.booking_id}</p>
                                                </td>
                                                <td className="p-6">
                                                    <p className="font-bold">{b.customer_name}</p>
                                                    <p className="text-[10px] text-white/20 italic">{b.customer.mobile}</p>
                                                </td>
                                                <td className="p-6">
                                                    <p className="text-sm">{b.slot_info.split('|')[0]}</p>
                                                    <p className="text-[10px] text-accent font-medium">{b.date} | {b.slot_info.split('|')[2]}</p>
                                                </td>
                                                <td className="p-6">
                                                    <span className={`px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${b.payment_status === 'confirmed' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                                                        {b.payment_status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </motion.div>
                    )}

                    {view === 'members' && (
                        <motion.div key="members" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
                            <h2 className="text-3xl font-heading">Elite <span className="gold-text-gradient italic">Registry</span></h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {customers.map((c, i) => (
                                    <div key={i} className="navy-card !p-8 flex flex-col justify-between group">
                                        <div className="flex justify-between items-start mb-6">
                                            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-accent shadow-xl">
                                                <Users size={20} />
                                            </div>
                                            {c.is_member && (
                                                <div className="bg-accent text-primary px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest shadow-lg shadow-accent/20">
                                                    Member
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <h4 className="text-xl font-heading mb-1">{c.name}</h4>
                                            <p className="text-xs text-white/20 tracking-widest uppercase mb-4">{c.mobile}</p>
                                            <p className="text-[10px] text-white/40 italic mb-6">{c.email || 'No email registered'}</p>
                                        </div>
                                        <button className="text-[10px] uppercase tracking-[0.2em] font-black text-accent border border-accent/20 py-3 rounded-xl hover:bg-accent hover:text-primary transition-all">View Dossier</button>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Modals */}
            {showExpenseModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowExpenseModal(false)}></div>
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-card !bg-[#05071A] p-10 max-w-lg w-full relative z-10 border-accent/20">
                        <h3 className="text-3xl font-heading mb-8">Log <span className="text-red-400">Expense</span></h3>
                        <form onSubmit={logExpense} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] uppercase tracking-widest text-white/30 font-black">Expense Title</label>
                                <input type="text" required placeholder="Utility Bills, Catering, etc" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-red-400 text-sm" value={expenseForm.title} onChange={e => setExpenseForm({...expenseForm, title: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] uppercase tracking-widest text-white/30 font-black">Amount (₹)</label>
                                    <input type="number" required placeholder="0.00" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-red-400 text-sm" value={expenseForm.amount} onChange={e => setExpenseForm({...expenseForm, amount: e.target.value})} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] uppercase tracking-widest text-white/30 font-black">Date</label>
                                    <input type="date" required className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-red-400 text-sm" value={expenseForm.date} onChange={e => setExpenseForm({...expenseForm, date: e.target.value})} />
                                </div>
                            </div>
                            <button className="w-full bg-red-500/10 text-red-400 border border-red-500/20 py-4 rounded-xl font-bold uppercase tracking-widest text-[10px] hover:bg-red-500 hover:text-white transition-all">Submit Expense Record</button>
                        </form>
                    </motion.div>
                </div>
            )}
            
            {showBookingModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowBookingModal(false)}></div>
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass-card !bg-[#05071A] p-10 max-w-lg w-full relative z-10 border-accent/20">
                        <h3 className="text-3xl font-heading mb-8 gold-text-gradient">Manual <span className="text-white">Reserve</span></h3>
                        <form onSubmit={manualBooking} className="space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] uppercase tracking-widest text-white/30 font-black">Dignitary Name</label>
                                    <input type="text" required placeholder="Guest Name" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-accent text-sm" value={bookingForm.name} onChange={e => setBookingForm({...bookingForm, name: e.target.value})} />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] uppercase tracking-widest text-white/30 font-black">Mobile</label>
                                    <input type="tel" required placeholder="Primary Contact" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-accent text-sm" value={bookingForm.mobile} onChange={e => setBookingForm({...bookingForm, mobile: e.target.value})} />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] uppercase tracking-widest text-white/30 font-black">Target Slot</label>
                                <select 
                                    className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none appearance-none focus:border-accent text-sm text-white/80"
                                    value={bookingForm.slot_id}
                                    onChange={e => setBookingForm({...bookingForm, slot_id: e.target.value})}
                                    required
                                >
                                    <option value="">Select an Available Slot...</option>
                                    {availableSlots.map(slot => (
                                        <option key={slot.id} value={slot.id} className="bg-primary text-white">
                                            {slot.start_time.slice(0,5)} - {slot.screen_name} (₹{slot.price})
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <button className="gold-button w-full py-5 !text-[10px] uppercase tracking-[0.3em] font-black shadow-xl">Confirm Concierge Booking</button>
                        </form>
                    </motion.div>
                </div>
            )}
        </div>
    );
};

export default AdminDashboard;
