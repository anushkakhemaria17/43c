import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { QRCodeSVG } from 'qrcode.react';
import { Download, ChevronLeft, Printer, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';

const ReceiptPage = () => {
    const { id } = useParams();
    const [booking, setBooking] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => { fetchBooking(); }, [id]);

    const fetchBooking = async () => {
        try {
            const bookingSnap = await getDoc(doc(db, 'bookings', id));
            if (!bookingSnap.exists()) throw new Error('Not found');
            const b = { id: bookingSnap.id, ...bookingSnap.data() };

            const slotSnap = await getDoc(doc(db, 'slots', b.slot_id));
            const slot = slotSnap.exists() ? slotSnap.data() : {};

            const custSnap = await getDoc(doc(db, 'customers', b.customer_id));
            const cust = custSnap.exists() ? custSnap.data() : {};

            const payQ = query(collection(db, 'payments'), where('booking_id', '==', id));
            const paySnap = await getDocs(payQ);
            const payStatus = paySnap.empty ? 'pending' : paySnap.docs[0].data().status;

            setBooking({
                booking_id: b.id,
                date: b.booking_date,
                guest_count: b.guest_count,
                price: b.price,
                payment_status: payStatus,
                checkin_status: b.status || 'upcoming',
                customer_name: cust.name || 'Guest',
                slot_info: `${slot.screen_type || 'Screen'} | | ${slot.slot_time?.slice(0, 5) || 'TBD'}`,
            });
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

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

    const qrData = JSON.stringify({ id: booking.booking_id, v: "1.0", url: `${window.location.origin}/receipt/${booking.booking_id}` });

    return (
        <div className="pt-32 pb-20 px-4 max-w-xl mx-auto min-h-screen">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <button onClick={() => navigate('/')} className="flex items-center gap-2 text-white/40 mb-10 hover:text-accent transition-colors uppercase tracking-widest text-[10px] font-bold">
                    <ChevronLeft className="w-4 h-4"/> Return to Lounge
                </button>

                <div id="digital-pass" className="relative group">
                    <div className="absolute -top-4 -left-4 w-20 h-20 border-t-2 border-l-2 border-accent/30 rounded-tl-3xl"></div>
                    <div className="absolute -bottom-4 -right-4 w-20 h-20 border-b-2 border-r-2 border-accent/30 rounded-br-3xl"></div>

                    <div className="glass-card overflow-hidden !rounded-[2.5rem] shadow-2xl relative">
                        <div className="bg-gradient-to-br from-[#0B0F3A] to-[#05071A] p-10 text-center border-b border-white/5 relative overflow-hidden">
                            <div className="absolute inset-0 mesh-pattern opacity-10"></div>
                            <div className="relative z-10">
                                <span className="text-[10px] uppercase tracking-[0.6em] text-accent font-black mb-4 block">Official Entry Pass</span>
                                <h1 className="text-5xl font-heading gold-text-gradient font-bold tracking-tight mb-2">43C</h1>
                                <p className="text-[9px] uppercase tracking-[0.4em] text-white/40">{booking.booking_id}</p>
                            </div>
                        </div>

                        <div className="p-10 space-y-12 bg-[#05071A]/50 relative">
                            <div className="flex justify-center flex-col items-center gap-6">
                                <div className="p-4 bg-white rounded-[2rem] shadow-[0_0_30px_rgba(255,255,255,0.1)] hover:scale-105 transition-transform duration-500">
                                    <QRCodeSVG value={qrData} size={220} level="H" />
                                </div>
                                <span className="text-[9px] uppercase tracking-[0.2em] text-white/20">Scan at Entry Point</span>
                            </div>

                            <div className="grid grid-cols-2 gap-y-10 border-t border-b border-white/5 py-10">
                                <div className="space-y-1">
                                    <p className="text-white/20 uppercase text-[9px] tracking-widest font-black">Guest</p>
                                    <p className="text-lg font-heading tracking-tight">{booking.customer_name}</p>
                                </div>
                                <div className="space-y-1 text-right">
                                    <p className="text-white/20 uppercase text-[9px] tracking-widest font-black">Party Size</p>
                                    <p className="text-lg font-heading tracking-tight">{booking.guest_count} Select Guests</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-white/20 uppercase text-[9px] tracking-widest font-black">Lounge</p>
                                    <p className="text-lg font-heading tracking-tight">{booking.slot_info.split('|')[0]}</p>
                                </div>
                                <div className="space-y-1 text-right">
                                    <p className="text-white/20 uppercase text-[9px] tracking-widest font-black">Time Slot</p>
                                    <p className="text-xl font-heading tracking-tight text-accent">{booking.slot_info.split('|')[2]}</p>
                                </div>
                            </div>

                            <div className="flex justify-between items-center px-2">
                                <div className="flex items-center gap-2 text-[10px] uppercase font-black tracking-widest text-green-500/80 bg-green-500/5 px-4 py-2 rounded-full border border-green-500/20">
                                    <ShieldCheck size={14}/> Validated
                                </div>
                                <div className="text-right">
                                    <p className="text-[9px] uppercase tracking-widest text-white/20 mb-1">Total Contribution</p>
                                    <p className="text-2xl font-bold font-heading text-white">₹{booking.price}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-12 flex flex-col sm:flex-row gap-4 no-print">
                    <button onClick={() => window.print()} className="gold-button flex-1 flex items-center justify-center gap-4 group">
                        <Printer className="w-5 h-5 group-hover:scale-110 transition-transform"/> Print Hard Copy
                    </button>
                    <button className="flex-1 glass-card py-4 flex items-center justify-center gap-4 hover:bg-white/10 transition-colors uppercase tracking-widest text-[10px] font-bold border-white/5">
                        <Download className="w-5 h-5"/> Download PDF
                    </button>
                </div>
            </motion.div>
            <style dangerouslySetInnerHTML={{ __html: `@media print { nav, .no-print, button { display: none !important; } body { background: white !important; } #digital-pass { color: black !important; } }` }} />
        </div>
    );
};

export default ReceiptPage;
