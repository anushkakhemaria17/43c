import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { Calendar, UtensilsCrossed, CheckCircle2, Clock, Download, History } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { formatSlotsDisplay } from '../utils/slots';

const STATUS_STYLES = {
  pending:   'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  confirmed: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
  completed: 'bg-green-500/10 text-green-400 border-green-500/30',
  served:    'bg-green-500/10 text-green-400 border-green-500/30',
};

const STATUS_LABELS = {
  pending:   '⏳ Pending',
  confirmed: '✓ Confirmed',
  completed: '✓ Completed',
  served:    '✓ Served',
};

const PreviousBookings = () => {
  const { customer, logout } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [foodOrders, setFoodOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('bookings');

  useEffect(() => {
    if (!customer) { setLoading(false); return; }
    fetchBookings();

    // Live food orders
    const q = query(collection(db, 'food_orders'), where('customer_id', '==', customer.id));
    const unsub = onSnapshot(q, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0));
      setFoodOrders(list);
    });
    return () => unsub();
  }, [customer]);

  const fetchBookings = async () => {
    try {
      const q = query(collection(db, 'bookings'), where('customer_id', '==', customer.id));
      const snap = await getDocs(q);
      const raw = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      raw.sort((a, b) => (b.booking_date < a.booking_date ? -1 : 1));
      setBookings(raw);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center pt-24">
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
    </div>
  );

  if (!customer) return (
    <div className="min-h-screen flex flex-col items-center justify-center pt-24 gap-6">
      <p className="text-white/40 text-sm">Please log in to view your activity.</p>
      <Link to="/book" className="gold-button">Login</Link>
    </div>
  );

  return (
    <div className="pt-32 pb-20 px-4 max-w-4xl mx-auto min-h-screen">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-4">
        <div>
          <h1 className="text-4xl font-heading mb-2">My <span className="gold-text-gradient">Account</span></h1>
          <p className="text-gray-400 text-sm uppercase tracking-[0.2em] font-light">
            {customer.name} · {customer.mobile_number}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-white/5 border border-white/10">
            <History className="w-4 h-4 text-accent" />
            <span className="text-xs font-bold uppercase tracking-widest">{bookings.length} Bookings · {foodOrders.length} Orders</span>
          </div>
          <button onClick={logout} className="text-[10px] text-red-500 uppercase font-black hover:underline tracking-widest">Logout</button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-3 mb-10 overflow-x-auto pb-2">
        <button onClick={() => setActiveTab('bookings')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl border text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-all ${activeTab === 'bookings' ? 'bg-accent border-accent text-primary' : 'bg-white/5 border-white/10 text-white/60 hover:border-white/30'}`}
        >
          <Calendar size={14} /> Slot Bookings ({bookings.length})
        </button>
        <button onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl border text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-all ${activeTab === 'orders' ? 'bg-accent border-accent text-primary' : 'bg-white/5 border-white/10 text-white/60 hover:border-white/30'}`}
        >
          <UtensilsCrossed size={14} /> Food Orders ({foodOrders.length})
        </button>
      </div>

      {/* ── BOOKINGS TAB ── */}
      {activeTab === 'bookings' && (
        bookings.length === 0 ? (
          <div className="glass-card p-20 text-center space-y-6">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto border border-white/10">
              <Calendar className="w-8 h-8 text-white/10" />
            </div>
            <h2 className="text-2xl font-heading text-white/40 italic">No bookings yet</h2>
            <p className="text-gray-500 max-w-xs mx-auto text-sm">Ready to reserve your private lounge experience?</p>
            <Link to="/book" className="gold-button inline-block">Book a Slot</Link>
          </div>
        ) : (
          <div className="space-y-5">
            {bookings.map((b, i) => (
              <motion.div key={b.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                className="glass-card group overflow-hidden hover:border-accent/20 transition-all"
              >
                <div className="flex flex-col md:flex-row">
                  <div className="p-6 flex-1 space-y-4">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <span className="text-[10px] uppercase tracking-[0.3em] text-accent font-black">Ref: {b.id.slice(0,10)}</span>
                        <h3 className="text-xl font-heading mt-1">
                          {new Date(b.booking_date + 'T00:00:00').toLocaleDateString('en', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}
                        </h3>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${STATUS_STYLES[b.status] || STATUS_STYLES.pending}`}>
                        {STATUS_LABELS[b.status] || b.status || 'Pending'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3 pt-3 border-t border-white/5">
                      <div>
                        <p className="text-[9px] uppercase tracking-widest text-white/20 font-black mb-1">Slots</p>
                        <p className="text-sm text-accent font-medium italic">{b.screen||'Screen 1'} · {formatSlotsDisplay(b.slots)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-widest text-white/20 font-black mb-1">Guests</p>
                        <p className="text-sm">{b.guest_count} People</p>
                      </div>
                      <div>
                        <p className="text-[9px] uppercase tracking-widest text-white/20 font-black mb-1">Total</p>
                        <p className="text-sm font-bold">₹{b.final_price || b.price}</p>
                      </div>
                      {b.advance_paid != null && (
                        <div>
                          <p className="text-[9px] uppercase tracking-widest text-green-500/40 font-black mb-1">Advance</p>
                          <p className="text-sm font-bold text-green-400">₹{b.advance_paid}</p>
                        </div>
                      )}
                      {b.remaining_amount != null && (
                        <div>
                          <p className="text-[9px] uppercase tracking-widest text-yellow-500/40 font-black mb-1">Due</p>
                          <p className="text-sm font-bold text-yellow-500">₹{b.remaining_amount}</p>
                        </div>
                      )}
                    </div>
                    {b.cancel_reason && (
                      <div className="px-3 py-2 bg-red-500/5 border border-red-500/10 rounded-lg text-xs text-red-400 mt-2">
                        <span className="font-bold uppercase tracking-widest text-[9px] opacity-70">Cancel Reason:</span> {b.cancel_reason}
                      </div>
                    )}
                  </div>

                  <Link to={`/receipt/${b.id}`}
                    className="bg-white/5 md:w-20 flex items-center justify-center border-l border-white/5 group-hover:bg-accent group-hover:text-primary transition-all p-5 md:p-0"
                  >
                    <Download className="w-5 h-5 group-hover:-translate-y-1 transition-transform" />
                    <span className="ml-2 md:hidden text-[10px] uppercase tracking-widest font-black">Pass</span>
                  </Link>
                </div>
              </motion.div>
            ))}
          </div>
        )
      )}

      {/* ── FOOD ORDERS TAB ── */}
      {activeTab === 'orders' && (
        foodOrders.length === 0 ? (
          <div className="glass-card p-20 text-center space-y-6">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto border border-white/10">
              <UtensilsCrossed className="w-8 h-8 text-white/10" />
            </div>
            <h2 className="text-2xl font-heading text-white/40 italic">No food orders yet</h2>
            <Link to="/menu" className="gold-button inline-block">Browse Menu</Link>
          </div>
        ) : (
          <div className="space-y-5">
            {foodOrders.map((o, i) => (
              <motion.div key={o.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                className="glass-card overflow-hidden"
              >
                <div className="p-6 space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] uppercase tracking-[0.3em] text-accent font-black">Order #{o.id.slice(0,10)}</span>
                      <p className="text-xs text-white/30 mt-0.5">
                        {o.created_at?.seconds ? new Date(o.created_at.seconds * 1000).toLocaleString('en-IN') : ''}
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${STATUS_STYLES[o.status] || STATUS_STYLES.pending}`}>
                      {STATUS_LABELS[o.status] || o.status || 'Pending'}
                    </span>
                  </div>

                  <div className="space-y-2 border-t border-white/5 pt-3">
                    {(o.items || []).map((item, j) => (
                      <div key={j} className="flex justify-between text-sm">
                        <span className="text-white/70">{item.qty}× {item.name}</span>
                        <span className="text-white/40">₹{item.price * item.qty}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between items-center border-t border-white/10 pt-3">
                    <span className="text-[9px] uppercase tracking-widest text-white/30 font-black">
                      {(o.items || []).reduce((s, i) => s + i.qty, 0)} items total
                    </span>
                    <span className="text-lg font-heading gold-text-gradient font-black">₹{o.final_price || o.total}</span>
                  </div>
                  {o.cancel_reason && (
                    <div className="px-3 py-2 bg-red-500/5 border border-red-500/10 rounded-lg text-xs text-red-400 mt-2">
                      <span className="font-bold uppercase tracking-widest text-[9px] opacity-70">Cancel Reason:</span> {o.cancel_reason}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )
      )}
    </div>
  );
};

export default PreviousBookings;
