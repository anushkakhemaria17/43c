import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { doc, onSnapshot, collection, query, where, getDocs } from 'firebase/firestore';
import { QRCodeSVG } from 'qrcode.react';
import { Download, ChevronLeft, Printer, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatSlotsDisplay } from '../utils/slots';
import logo43c from '../assets/43C.png';

const ReceiptPage = () => {
  const { id } = useParams();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const ref = doc(db, 'bookings', id);
    const unsub = onSnapshot(ref, async (snap) => {
      if (!snap.exists()) { setLoading(false); return; }
      const b = { id: snap.id, ...snap.data() };
      const payQ = query(collection(db, 'payments'), where('booking_id', '==', id));
      const paySnap = await getDocs(payQ);
      const payStatus = paySnap.empty ? 'pending' : paySnap.docs[0].data().status;
      setBooking({
        booking_id: b.id,
        date: b.booking_date,
        slots: b.slots || [],
        screen: b.screen || 'Screen 1',
        guest_count: b.guest_count,
        price: b.final_price || b.price,
        advance_paid: b.advance_paid,
        remaining_amount: b.remaining_amount,
        total_amount: b.total_amount,
        payment_status: payStatus,
        checkin_status: b.status || 'upcoming',
        customer_name: b.customer_name || 'Guest',
        customer_mobile: b.customer_mobile || '',
      });
      setLoading(false);
    });
    return () => unsub();
  }, [id]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
    </div>
  );

  if (!booking) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <h2 className="text-2xl font-heading text-red-500">Access Denied</h2>
      <p className="text-gray-500 uppercase tracking-widest text-[10px]">Pass invalid or expired</p>
      <button onClick={() => navigate('/')} className="gold-button">Return to Main</button>
    </div>
  );

  const qrData = `${window.location.origin}/admin/verify/${booking.booking_id}`;
  const isConfirmed = booking.checkin_status === 'confirmed' || booking.checkin_status === 'completed';

  return (
    <div className="pt-28 pb-20 px-4 max-w-xl mx-auto min-h-screen">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <button onClick={() => navigate('/my-bookings')} className="flex items-center gap-2 text-white/40 mb-8 hover:text-accent transition-colors uppercase tracking-widest text-[10px] font-bold">
          <ChevronLeft className="w-4 h-4" /> Return to History
        </button>

        <div id="digital-pass" className="relative group">
          <div className="absolute -top-4 -left-4 w-20 h-20 border-t-2 border-l-2 border-accent/30 rounded-tl-3xl"></div>
          <div className="absolute -bottom-4 -right-4 w-20 h-20 border-b-2 border-r-2 border-accent/30 rounded-br-3xl"></div>

          <div className="glass-card overflow-hidden !rounded-[2.5rem] shadow-2xl relative">
            {/* Header */}
            <div className="bg-gradient-to-br from-[#0B0F3A] to-[#05071A] p-8 text-center border-b border-white/5 relative overflow-hidden">
              <div className="absolute inset-0 mesh-pattern opacity-10"></div>
              <div className="relative z-10">
                <span className="text-[10px] uppercase tracking-[0.6em] text-accent font-black mb-3 block">Official Entry Pass</span>
                <img
                  src={logo43c}
                  alt="43C"
                  className="h-12 mx-auto mb-2 object-contain"
                  onError={e => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
                />
                <h1 className="text-4xl font-heading gold-text-gradient font-bold tracking-tight mb-1 hidden">43C</h1>
                <p className="text-[9px] uppercase tracking-[0.4em] text-white/40">{booking.booking_id}</p>
              </div>
            </div>

            <div className="p-8 space-y-8 bg-[#05071A]/50 relative">
              {/* QR Code */}
              <div className="flex justify-center flex-col items-center gap-4">
                <div className="p-4 bg-white rounded-[2rem] shadow-[0_0_30px_rgba(255,255,255,0.1)] hover:scale-105 transition-transform duration-500">
                  <QRCodeSVG value={qrData} size={200} level="H" />
                </div>
                <span className="text-[9px] uppercase tracking-[0.2em] text-white/20">Scan at Entry Point</span>
              </div>

              {/* Booking Info */}
              <div className="flex flex-col sm:grid sm:grid-cols-2 gap-y-6 border-t border-b border-white/5 py-6">
                <div className="space-y-1">
                  <p className="text-white/20 uppercase text-[9px] tracking-widest font-black">Guest</p>
                  <p className="text-lg sm:text-base md:text-lg font-heading tracking-tight break-words">{booking.customer_name}</p>
                </div>
                <div className="space-y-1 sm:text-right">
                  <p className="text-white/20 uppercase text-[9px] tracking-widest font-black">Party Size</p>
                  <p className="text-lg sm:text-base md:text-lg font-heading tracking-tight">{booking.guest_count} Guests</p>
                </div>
                <div className="space-y-1">
                  <p className="text-white/20 uppercase text-[9px] tracking-widest font-black">Date</p>
                  <p className="text-base font-heading tracking-tight">
                    {new Date(booking.date + 'T00:00:00').toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
                <div className="space-y-1 sm:text-right">
                  <p className="text-white/20 uppercase text-[9px] tracking-widest font-black">Screen & Slots</p>
                  <p className="text-sm font-heading tracking-tight text-accent break-words">{booking.screen} • {formatSlotsDisplay(booking.slots)}</p>
                </div>
              </div>

              {/* Payment Breakdown */}
              <div className="space-y-3 bg-white/5 rounded-2xl p-5 border border-white/10">
                <p className="text-[9px] uppercase tracking-widest text-accent/70 font-black mb-3">Payment Details</p>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-white/50">Total Amount</span>
                  <span className="font-bold text-white">₹{booking.total_amount || booking.price}</span>
                </div>
                {booking.advance_paid != null && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-green-400/70">Advance Paid ✓</span>
                    <span className="font-bold text-green-400">₹{booking.advance_paid}</span>
                  </div>
                )}
                {booking.remaining_amount != null && booking.remaining_amount > 0 && (
                  <div className="flex justify-between items-center border-t border-white/10 pt-3 mt-2">
                    <span className="text-sm text-yellow-400/80 font-bold">Due on Arrival</span>
                    <span className="font-black text-yellow-400 text-xl">₹{booking.remaining_amount}</span>
                  </div>
                )}
                {booking.advance_paid == null && (
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-white/50">Total Payable</span>
                    <span className="font-bold text-white text-lg">₹{booking.price}</span>
                  </div>
                )}
              </div>

              {/* Status */}
              <div className="flex justify-between items-center px-2">
                <div className={`flex items-center gap-2 text-[10px] uppercase font-black tracking-widest px-4 py-2 rounded-full border ${isConfirmed ? 'text-green-500/80 bg-green-500/5 border-green-500/20' : 'text-yellow-500/80 bg-yellow-500/5 border-yellow-500/20'}`}>
                  <ShieldCheck size={14} /> {booking.checkin_status}
                </div>
                <div className="text-right">
                  <p className="text-[9px] uppercase tracking-widest text-white/20 mb-1">Payment</p>
                  <p className="text-sm font-bold font-heading text-white capitalize">{booking.payment_status}</p>
                </div>
              </div>

              {/* OTP Note */}
              {isConfirmed && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 text-center mt-4">
                  <p className="text-xs text-blue-400 font-bold">You will get the OTP for entry 30 min before your slot.</p>
                </div>
              )}

              {/* Terms Link */}
              <div className="border-t border-white/5 pt-5 mt-2 text-center no-print">
                <a href="/terms" target="_blank" rel="noreferrer" className="text-[10px] uppercase tracking-widest text-white/40 hover:text-accent transition-colors underline underline-offset-4 font-bold">
                  View Terms & Conditions
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col sm:flex-row gap-4 no-print flex-wrap">
          <button onClick={() => window.print()} className="gold-button flex-1 flex items-center justify-center gap-4 group">
            <Printer className="w-5 h-5 group-hover:scale-110 transition-transform" /> Print Hard Copy
          </button>
          <button className="flex-1 glass-card py-4 flex items-center justify-center gap-4 hover:bg-white/10 transition-colors uppercase tracking-widest text-[10px] font-bold border-white/5 cursor-not-allowed opacity-50">
            <Download className="w-5 h-5" /> Download PDF (Soon)
          </button>
        </div>
      </motion.div>
      <style dangerouslySetInnerHTML={{ __html: `@media print { nav, .no-print, button { display: none !important; } body { background: white !important; } #digital-pass { color: black !important; } }` }} />
    </div>
  );
};

export default ReceiptPage;
