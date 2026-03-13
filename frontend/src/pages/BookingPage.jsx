import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import api from '../utils/api';
import { Calendar, Clock, Users, ChevronRight, CheckCircle2, UserCheck, ShieldCheck, Crown, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const BookingPage = () => {
    const { customer, register, login } = useAuth();
    const [step, setStep] = useState(1);
    const [authMode, setAuthMode] = useState('check'); // 'check', 'login', 'register'
    const [mobile, setMobile] = useState('');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [slots, setSlots] = useState([]);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [guestCount, setGuestCount] = useState(2);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (customer) setStep(2);
    }, [customer]);

    useEffect(() => {
        if (step === 2) fetchSlots();
    }, [step]);

    const handleInitialCheck = async (e) => {
        e.preventDefault();
        if (mobile.length < 10) return;
        setLoading(true);
        try {
            const res = await api.post('customers/check/', { mobile });
            if (res.data.exists) {
                setName(res.data.customer.name);
                setAuthMode('login');
            } else {
                setAuthMode('register');
            }
        } catch (err) { alert("Validation failed."); }
        finally { setLoading(false); }
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await login(mobile);
            setStep(2);
        } catch (err) {
            const msg = err.response?.data?.detail || err.response?.data?.error || "Login failed. Verify your details.";
            alert(msg);
        } finally { setLoading(false); }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await register({ name, mobile, email, username: mobile });
            setStep(2);
        } catch (err) {
            const msg = err.response?.data?.detail || err.response?.data?.error || "Registration failed. Check your data.";
            alert(msg);
        } finally { setLoading(false); }
    };

    const fetchSlots = async () => {
        setLoading(true);
        try {
            const date = new Date().toISOString().split('T')[0];
            const res = await api.get(`slots/available/?date=${date}`);
            setSlots(res.data);
        } catch (err) { console.error(err); }
        finally { setLoading(false); }
    };

    const handleBooking = async () => {
        if (!selectedSlot) return;
        setLoading(true);
        try {
            const res = await api.post('bookings/book/', {
                slot_id: selectedSlot.id,
                guest_count: guestCount
            });
            
            // Mock payment verification
            setTimeout(async () => {
                await api.post('bookings/verify-payment/', {
                    booking_id: res.data.booking.booking_id,
                    razorpay_payment_id: 'pay_mock_123',
                    razorpay_signature: 'sig_mock_123'
                });
                setStep(3);
            }, 1000);
        } catch (err) { alert("Booking failed"); }
        finally { setLoading(false); }
    };

    return (
        <div className="pt-32 pb-20 px-4 max-w-4xl mx-auto min-h-screen">
            {/* Progress Bar */}
            <div className="flex justify-between mb-16 relative">
                <div className="absolute top-1/2 left-0 w-full h-[1px] bg-white/10 -z-10"></div>
                {[1, 2, 3].map((s) => (
                    <div key={s} className={`flex flex-col items-center gap-2 bg-[#05071A] px-4`}>
                        <div className={`w-12 h-12 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${step >= s ? 'border-accent bg-accent text-primary' : 'border-white/20 text-white/40'}`}>
                            {step > s ? <CheckCircle2 size={24} /> : <span className="font-heading text-xl">{s}</span>}
                        </div>
                    </div>
                ))}
            </div>

            <AnimatePresence mode="wait">
                {step === 1 && (
                    <motion.div key="step1" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="max-w-md mx-auto">
                        <div className="glass-card p-10 relative">
                            {authMode === 'check' && (
                                <form onSubmit={handleInitialCheck} className="space-y-8">
                                    <div className="text-center space-y-2 mb-8">
                                        <h2 className="text-3xl font-heading">Welcome</h2>
                                        <p className="text-[10px] uppercase tracking-widest text-white/40">Enter mobile to continue</p>
                                    </div>
                                    <input 
                                        type="tel" placeholder="Mobile Number" 
                                        className="w-full bg-white/5 border border-white/10 p-5 rounded-2xl focus:border-accent outline-none text-center text-xl tracking-widest"
                                        required value={mobile} onChange={(e) => setMobile(e.target.value)}
                                    />
                                    <button className="gold-button w-full py-5 uppercase tracking-widest text-xs font-black">
                                        {loading ? 'Validating...' : 'Continue'}
                                    </button>
                                </form>
                            )}

                            {authMode === 'login' && (
                                <form onSubmit={handleLogin} className="space-y-8 animate-in fade-in duration-500">
                                    <div className="text-center space-y-2 mb-8">
                                        <h2 className="text-2xl font-heading">Welcome back, <span className="gold-text-gradient">{name}</span></h2>
                                        <p className="text-[10px] uppercase tracking-widest text-white/40">Secure access to your profile</p>
                                    </div>
                                    <button className="gold-button w-full py-5 uppercase tracking-widest text-xs font-black">
                                        {loading ? 'Authenticating...' : 'Log In Now'}
                                    </button>
                                    <button type="button" onClick={() => setAuthMode('check')} className="w-full text-[10px] uppercase tracking-widest text-white/20 font-bold hover:text-white transition-colors">Not you? Use another number</button>
                                </form>
                            )}

                            {authMode === 'register' && (
                                <form onSubmit={handleRegister} className="space-y-6 animate-in slide-in-from-right-4 duration-500">
                                    <div className="text-center mb-6">
                                        <h2 className="text-2xl font-heading">New Account</h2>
                                        <p className="text-[10px] uppercase tracking-widest text-white/40">Join the Elite Circle</p>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] uppercase tracking-widest text-accent font-black">Full Name</label>
                                        <input type="text" required className="w-full bg-white/5 border border-white/10 p-4 rounded-xl focus:border-accent outline-none" value={name} onChange={e => setName(e.target.value)} />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-[9px] uppercase tracking-widest text-accent font-black">Email Address</label>
                                        <input type="email" required className="w-full bg-white/5 border border-white/10 p-4 rounded-xl focus:border-accent outline-none" value={email} onChange={e => setEmail(e.target.value)} />
                                    </div>
                                    <button className="gold-button w-full py-5 uppercase tracking-widest text-xs font-black mt-4">
                                        {loading ? 'Creating Account...' : 'Sign Up & Reserve'}
                                    </button>
                                    <button type="button" onClick={() => setAuthMode('check')} className="w-full text-[10px] uppercase tracking-widest text-white/20 font-bold">Back</button>
                                </form>
                            )}
                        </div>
                    </motion.div>
                )}

                {step === 2 && (
                    <motion.div key="step2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-12">
                        <div className="flex justify-between items-end mb-8">
                            <div>
                                <h1 className="text-4xl font-heading mb-2">Select <span className="gold-text-gradient">Experience</span></h1>
                                <p className="text-white/30 text-xs uppercase tracking-widest">Available private slots for today</p>
                            </div>
                            {customer?.is_member && (
                                <div className="px-4 py-2 bg-accent/10 border border-accent/20 rounded-full text-[10px] text-accent font-black uppercase tracking-widest flex items-center gap-2">
                                    <Crown size={14}/> Exclusive Member Rates Applied
                                </div>
                            )}
                        </div>

                        <div className="grid md:grid-cols-3 gap-8">
                            <div className="md:col-span-2 grid grid-cols-2 gap-4">
                                {slots.length === 0 ? (
                                    <div className="col-span-2 glass-card py-20 text-center opacity-30 italic">No slots available for selection.</div>
                                ) : (
                                    slots.map((slot) => (
                                        <button 
                                            key={slot.id} 
                                            onClick={() => setSelectedSlot(slot)}
                                            className={`p-8 rounded-[2rem] border transition-all duration-500 text-left relative overflow-hidden group ${selectedSlot?.id === slot.id ? 'bg-accent border-accent' : 'bg-white/5 border-white/10 hover:border-accent/30'}`}
                                        >
                                            <div className={`font-heading text-3xl mb-1 ${selectedSlot?.id === slot.id ? 'text-primary' : 'text-white'}`}>{slot.start_time.slice(0, 5)}</div>
                                            <div className={`text-[10px] uppercase tracking-widest font-black mb-6 ${selectedSlot?.id === slot.id ? 'text-primary' : 'text-accent'}`}>{slot.screen_name}</div>
                                            <div className={`text-2xl font-bold font-heading ${selectedSlot?.id === slot.id ? 'text-primary' : 'gold-text-gradient'}`}>₹{customer?.is_member ? slot.member_price : slot.price}</div>
                                        </button>
                                    ))
                                )}
                            </div>

                            <div className="space-y-6">
                                <div className="glass-card p-8 space-y-8">
                                    <h4 className="text-sm uppercase tracking-widest font-black text-white/40">Guest Count</h4>
                                    <div className="flex p-2 bg-white/5 rounded-2xl border border-white/5">
                                        {[2, 4, 6, 8].map(count => (
                                            <button key={count} onClick={() => setGuestCount(count)} className={`flex-1 py-3 rounded-xl transition-all font-black text-sm ${guestCount === count ? 'bg-accent text-primary' : 'text-white/40'}`}>{count}</button>
                                        ))}
                                    </div>
                                    <div className="space-y-4 pt-4 border-t border-white/5">
                                        <div className="flex justify-between text-[10px] uppercase tracking-widest font-bold">
                                            <span className="text-white/20">Base Contribution</span>
                                            <span>₹{selectedSlot ? (customer?.is_member ? selectedSlot.member_price : selectedSlot.price) : '0'}</span>
                                        </div>
                                    </div>
                                </div>
                                <button 
                                    onClick={handleBooking} 
                                    disabled={!selectedSlot || loading} 
                                    className="gold-button w-full py-6 uppercase tracking-widest font-black text-xs shadow-2xl shadow-accent/20"
                                >
                                    {loading ? 'Processing...' : 'Confirm Reservation'}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}

                {step === 3 && (
                    <motion.div key="step3" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-w-xl mx-auto text-center space-y-10 py-20">
                        <div className="w-24 h-24 bg-accent rounded-full flex items-center justify-center mx-auto shadow-[0_0_50px_rgba(212,169,95,0.4)]">
                            <CheckCircle2 size={48} className="text-primary" />
                        </div>
                        <div>
                            <h2 className="text-6xl font-heading mb-4 italic gold-text-gradient font-black">Reservation Secured</h2>
                            <p className="text-gray-400 font-light tracking-wide text-lg">Your private experience is officially booked. Access your digital pass below.</p>
                        </div>
                        <button onClick={() => window.location.href='/profile'} className="gold-button px-16 py-5 uppercase tracking-widest font-black text-xs">View My Passes</button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default BookingPage;
