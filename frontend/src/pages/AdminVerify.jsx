import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { ShieldCheck, Calendar, Clock, Users, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatSlotsDisplay } from '../utils/slots';

const AdminVerify = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('admin_access') !== 'true') {
      localStorage.setItem('redirect_after_login', window.location.pathname);
      navigate('/admin-login');
      return;
    }
    fetchBooking();
  }, [id, navigate]);

  const fetchBooking = async () => {
    try {
      const bookingSnap = await getDoc(doc(db, 'bookings', id));
      if (!bookingSnap.exists()) throw new Error('Not found');
      setBooking({ id: bookingSnap.id, ...bookingSnap.data() });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleComplete = async () => {
    if(!window.confirm('Mark this booking as Completed?')) return;
    setUpdating(true);
    try {
      await updateDoc(doc(db, 'bookings', id), { status: 'completed' });
      setBooking(prev => ({ ...prev, status: 'completed' }));
      alert('Booking successfully marked as completed.');
    } catch(e) {
      alert('Failed to update status.');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen luxury-bg flex items-center justify-center">
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
    </div>
  );

  if (!booking) return (
    <div className="min-h-screen luxury-bg flex flex-col items-center justify-center gap-4 px-4 text-center">
      <ShieldAlert className="w-16 h-16 text-red-500" />
      <h2 className="text-3xl font-heading text-red-500">Pass Invalid</h2>
      <p className="text-gray-500 uppercase tracking-widest text-[10px]">Could not find this booking or it has been purged.</p>
      <button onClick={() => navigate('/admin')} className="gold-button mt-4">Return to Dashboard</button>
    </div>
  );

  return (
    <div className="min-h-screen luxury-bg pt-24 pb-20 px-4 flex flex-col items-center">
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-lg">
        <div className="text-center mb-8 space-y-2">
          <div className="w-16 h-16 bg-accent/10 border border-accent/30 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-8 h-8 text-accent" />
          </div>
          <h1 className="text-3xl font-heading gold-text-gradient font-black tracking-tight">Access Verification</h1>
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/30">ID: {booking.id}</p>
        </div>

        <div className="glass-card p-8 space-y-6">
          <div className="flex justify-between items-center border-b border-white/5 pb-4">
            <p className="font-heading text-xl">{booking.customer_name}</p>
            <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border 
              ${booking.status === 'completed' ? 'bg-green-500/10 text-green-400 border-green-500/30' : 
                booking.status === 'confirmed' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30' : 
                'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'}`}>
              {booking.status}
            </span>
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <Calendar className="text-accent w-5 h-5 opacity-70" />
              <div>
                <p className="text-[9px] uppercase font-black text-white/30 tracking-widest">Date</p>
                <p className="font-medium text-white/80">{booking.booking_date}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Clock className="text-accent w-5 h-5 opacity-70" />
              <div>
                <p className="text-[9px] uppercase font-black text-white/30 tracking-widest">Slots</p>
                <p className="font-medium text-white/80">{booking.screen||'Screen 1'} • {formatSlotsDisplay(booking.slots)}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Users className="text-accent w-5 h-5 opacity-70" />
              <div>
                <p className="text-[9px] uppercase font-black text-white/30 tracking-widest">Guests</p>
                <p className="font-medium text-white/80">{booking.guest_count} People</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <span className="w-5 flex justify-center text-accent text-lg opacity-70">₹</span>
              <div>
                <p className="text-[9px] uppercase font-black text-white/30 tracking-widest">Final Price</p>
                <p className="font-bold text-lg gold-text-gradient">{booking.final_price || booking.price}</p>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-white/10 flex flex-col gap-4">
            {booking.status !== 'completed' ? (
              <button 
                onClick={handleComplete} 
                disabled={updating}
                className="w-full bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30 py-4 rounded-xl flex items-center justify-center gap-2 font-bold uppercase tracking-widest text-xs transition-colors"
              >
                <CheckCircle2 size={16} /> {updating ? 'Updating...' : 'Mark as Completed'}
              </button>
            ) : (
              <div className="w-full bg-white/5 py-4 rounded-xl flex items-center justify-center gap-2 text-white/40 uppercase tracking-widest text-xs font-bold border border-white/5">
                <CheckCircle2 size={16} /> Guest has checked out
              </div>
            )}
            
            <button onClick={() => navigate('/admin')} className="w-full py-4 rounded-xl text-[10px] uppercase font-bold tracking-widest text-white/30 hover:text-accent transition-colors">
              Return to Dashboard
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default AdminVerify;

