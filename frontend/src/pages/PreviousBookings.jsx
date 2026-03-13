import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import api from '../utils/api';
import { Calendar, Clock, Monitor, Download, ChevronRight, History, Hash } from 'lucide-react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

const PreviousBookings = () => {
    const { customer } = useAuth();
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (customer) fetchBookings();
    }, [customer]);

    const fetchBookings = async () => {
        try {
            const res = await api.get('bookings/my-bookings/');
            setBookings(res.data.reverse()); // Show latest first
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center pt-24">
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
        </div>
    );

    return (
        <div className="pt-32 pb-20 px-4 max-w-4xl mx-auto min-h-screen">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-4">
                <div>
                    <h1 className="text-4xl font-heading mb-2">Legacy <span className="gold-text-gradient">Records</span></h1>
                    <p className="text-gray-400 text-sm uppercase tracking-[0.2em] font-light">Your History at 43C Lounge</p>
                </div>
                <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-white/5 border border-white/10">
                    <History className="w-4 h-4 text-accent" />
                    <span className="text-xs font-bold uppercase tracking-widest">{bookings.length} Chapters</span>
                </div>
            </div>

            {bookings.length === 0 ? (
                <div className="glass-card p-20 text-center space-y-6">
                    <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/10">
                        <Calendar className="w-8 h-8 text-white/10" />
                    </div>
                    <h2 className="text-2xl font-heading text-white/40 italic">A Clean Slate awaits...</h2>
                    <p className="text-gray-500 max-w-xs mx-auto text-sm font-light">You haven't reserved any private experiences yet. Ready to start your journey?</p>
                    <Link to="/book" className="gold-button inline-block">Begin Reservation</Link>
                </div>
            ) : (
                <div className="space-y-6">
                    {bookings.map((booking, i) => (
                        <motion.div 
                            key={booking.booking_id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.1 }}
                            className="glass-card group overflow-hidden hover:border-accent/30 transition-all duration-500"
                        >
                            <div className="flex flex-col md:flex-row">
                                <div className="p-8 flex-1 space-y-6">
                                    <div className="flex justify-between items-start">
                                        <div className="space-y-1">
                                            <span className="text-[10px] uppercase tracking-[0.3em] text-accent font-black">Ref: {booking.booking_id}</span>
                                            <h3 className="text-2xl font-heading">{booking.slot_info.split('|')[0]}</h3>
                                        </div>
                                        <div className={`px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-widest ${booking.payment_status === 'confirmed' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20'}`}>
                                            {booking.payment_status}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 pt-4 border-t border-white/5">
                                        <div className="space-y-1">
                                            <p className="text-[9px] uppercase tracking-widest text-white/20 font-black">Date</p>
                                            <p className="text-sm font-medium flex items-center gap-2 italic"><Calendar size={12} className="text-accent"/> {booking.date}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[9px] uppercase tracking-widest text-white/20 font-black">Lounge Slot</p>
                                            <p className="text-sm font-medium flex items-center gap-2 italic"><Clock size={12} className="text-accent"/> {booking.slot_info.split('|')[2]}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[9px] uppercase tracking-widest text-white/20 font-black">Contribution</p>
                                            <p className="text-sm font-medium italic">₹{booking.price}</p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-[9px] uppercase tracking-widest text-white/20 font-black">Check-in</p>
                                            <p className="text-[10px] uppercase font-bold text-white/40">{booking.checkin_status}</p>
                                        </div>
                                    </div>
                                </div>

                                <Link 
                                    to={`/receipt/${booking.booking_id}`}
                                    className="bg-white/5 md:w-24 flex items-center justify-center border-l border-white/5 group-hover:bg-accent group-hover:text-primary transition-all duration-500"
                                >
                                    <Download className="w-6 h-6 transform group-hover:-translate-y-1 transition-transform" />
                                </Link>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default PreviousBookings;
