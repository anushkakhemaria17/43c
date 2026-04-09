import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db } from '../lib/firebase';
import { Crown, CheckCircle2, Star, Zap, ShieldCheck, Loader2, MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  orderBy,
  limit,
  doc,
  updateDoc,
  onSnapshot
} from 'firebase/firestore';
import { createNotification } from '../utils/firebaseHelpers';

const Membership = () => {
    const { customer, updateProfile } = useAuth();
    const [loading, setLoading] = useState(false);
    const [plans, setPlans] = useState([]);
    const [screens, setScreens] = useState([]);
    const [fetching, setFetching] = useState(true);
    const [adminMobile, setAdminMobile] = useState('9989405071');
    const [activeMembership, setActiveMembership] = useState(null);
    const [pendingMembership, setPendingMembership] = useState(null);

    useEffect(() => {
        // 1. Fetch Plans, Settings & Screens
        const fetchInitial = async () => {
             const snap = await getDocs(collection(db, 'membership_plans'));
             setPlans(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.is_active).sort((a,b) => a.price - b.price));
             
             const scSnap = await getDocs(collection(db, 'screens'));
             setScreens(scSnap.docs.map(d => ({ id: d.id, ...d.data() })));
             
             const sSnap = await getDocs(collection(db, 'settings'));
             const global = sSnap.docs.find(d => d.id === 'global');
             if (global?.data().whatsapp_number) setAdminMobile(global.data().whatsapp_number);
             setFetching(false);
        };
        fetchInitial();

        if (customer) {
            const unsubM = onSnapshot(query(collection(db, 'customer_memberships'), where('customer_id', '==', customer.id)), (snap) => {
                if (snap.empty) { setActiveMembership(null); setPendingMembership(null); return; }

                const all = snap.docs.map(d => ({ id: d.id, ...d.data() }))
                    .sort((a, b) => (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0));
                
                const active = all.find(m => m.status === 'active');
                const pending = all.find(m => m.status === 'pending');

                if (active) {
                    const hasValidity = new Date(active.expiry_date) > new Date();
                    let hasCredits = false;
                    if (active.credit_type === 'any') hasCredits = (active.credits_remaining?.total_hours || 0) > 0;
                    else hasCredits = Object.values(active.credits_remaining?.per_screen || {}).some(v => v > 0);

                    if (!hasValidity || !hasCredits) {
                         updateDoc(doc(db, 'customer_memberships', active.id), { status: 'expired', expired_at: serverTimestamp() });
                         updateDoc(doc(db, 'customers', customer.id), { is_member: false, membership_type: 'non-member', membership_id: '', membership_plan_name: '' });
                         setActiveMembership(null);
                    } else { setActiveMembership(active); }
                } else { setActiveMembership(null); }
                setPendingMembership(pending || null);
            });
            return () => unsubM();
        }
    }, [customer]);

    const handlePurchase = async (plan) => {
        if (!customer) {
            window.location.href = '/book';
            return;
        }
        if (activeMembership || pendingMembership) {
            alert('You already have an active or pending membership enquiry. ✨');
            return;
        }
        setLoading(true);
        try {
            await addDoc(collection(db, 'customer_memberships'), {
                customer_id: customer.id,
                membership_id: plan.id,
                plan_name: plan.name,
                status: 'pending',
                created_at: serverTimestamp(),
            });

            await createNotification({
                target: 'admin',
                type: 'new_membership_request',
                message: `New Membership Request: ${customer.name} wants to join ${plan.name} ✨`,
                customer_name: customer.name
            });

            const msg = `Elite Enquiry: Hello 43C Admin, I am ${customer.name}. I would like to join the ${plan.name} Membership (₹${plan.price}). Please guide me with the payment process. ✨`;
            
            // Clean mobile number (remove non-digits, ensure 91 prefix)
            let cleanMobile = adminMobile.replace(/\D/g, '');
            if (!cleanMobile.startsWith('91')) cleanMobile = `91${cleanMobile}`;
            
            const waUrl = `https://wa.me/${cleanMobile}?text=${encodeURIComponent(msg)}`;
            
            setPendingMembership({ plan_name: plan.name, status: 'pending' });
            alert(`Your enquiry for ${plan.name} has been sent to 43C. Please complete the payment on WhatsApp.`);
            window.open(waUrl, '_blank');
        } catch (err) {
            console.error(err);
            alert('Enquiry failed. Please contact concierge.');
        } finally {
            setLoading(false);
        }
    };

    if (fetching) {
        return (
            <div className="min-h-screen flex items-center justify-center luxury-bg">
                <Loader2 className="w-10 h-10 text-accent animate-spin" />
            </div>
        );
    }

    const daysLeft = activeMembership?.expiry_date ? Math.ceil((new Date(activeMembership.expiry_date) - new Date()) / (1000 * 60 * 60 * 24)) : 0;

    return (
        <div className="pt-32 pb-20 px-4 max-w-7xl mx-auto min-h-screen luxury-bg">
            {/* Active Status Header */}
            {activeMembership && (
                <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="max-w-4xl mx-auto mb-16 glass-card p-8 border-accent/30 bg-accent/5">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                        <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center">
                                <Crown className="w-8 h-8 text-accent fill-accent" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-heading text-white">Elite <span className="gold-text-gradient">{activeMembership.plan_name}</span> Member</h2>
                                <p className="text-white/40 text-xs uppercase tracking-widest font-bold">Member ID: {activeMembership.id.slice(0, 8)}</p>
                            </div>
                        </div>
                        <div className="flex gap-8">
                            <div className="text-center">
                                <p className="text-[10px] uppercase tracking-widest text-white/30 font-black mb-1">Validity Left</p>
                                <h3 className={`text-2xl font-black ${daysLeft < 5 ? 'text-red-400' : 'text-accent'}`}>{daysLeft} Days</h3>
                                <p className="text-[8px] text-white/20">Expires: {new Date(activeMembership.expiry_date.toDate ? activeMembership.expiry_date.toDate() : activeMembership.expiry_date).toLocaleDateString()}</p>
                            </div>
                            <div className="text-center border-l border-white/10 pl-8">
                                {activeMembership.credit_type === 'any' ? (
                                    <div className="text-right">
                                        <p className="text-[10px] uppercase text-white/40 mb-1">Total Credits</p>
                                        <p className="text-2xl font-heading text-accent">{activeMembership.credits_remaining?.total_hours || 0} hrs</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                        {Object.entries(activeMembership.credits_remaining?.per_screen || {}).map(([key, val]) => {
                                            // Find a screen that is linked to this legacy key
                                            const linkedScreen = screens.find(s => s.legacy_link === key);
                                            const displayName = linkedScreen ? linkedScreen.name : key;
                                            
                                            return (
                                                <div key={key} className="p-3 rounded-xl bg-white/5 border border-white/10 text-center">
                                                    <p className="text-[7px] uppercase tracking-widest text-white/40 mb-1 font-black">{displayName}</p>
                                                    <p className={`text-xl font-heading ${val > 0 ? 'text-accent' : 'text-white/10'}`}>{val} <span className="text-[8px] font-bold">HRS</span></p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}

            {pendingMembership && !activeMembership && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-md mx-auto mb-16 p-4 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 text-center">
                    <p className="text-yellow-500 text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2">
                        <Loader2 className="w-3 h-3 animate-spin" /> {pendingMembership.plan_name} Purchase Pending Approval
                    </p>
                </motion.div>
            )}

            <div className="text-center mb-16 space-y-4">
                <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 mb-4">
                    <Crown className="w-4 h-4 text-accent fill-accent" />
                    <span className="text-xs uppercase tracking-[0.3em] font-bold text-accent">The 43C Elite Circle</span>
                </motion.div>
                <h1 className="text-5xl md:text-7xl font-heading font-black">Elevate Your <span className="gold-text-gradient">Experience</span></h1>
                <p className="text-gray-400 max-w-2xl mx-auto font-light leading-relaxed">Exclusive benefits, preferred pricing, and priority access. Designed for those who value privacy and luxury in every chapter.</p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
                {plans.map((plan, i) => {
                    // DISALLOW IF ANY ACTIVE OR PENDING
                    const isAnyActive = !!activeMembership;
                    const isAnyPending = !!pendingMembership;
                    
                    const isMatchesThis = activeMembership?.membership_id === plan.id;
                    const isPendingThis = pendingMembership?.membership_id === plan.id;
                    
                    return (
                        <motion.div
                            key={plan.id}
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.2 }}
                            className={`navy-card relative group overflow-hidden flex flex-col ${plan.name.toLowerCase().includes('gold') ? 'border-accent/40 shadow-[0_0_50px_rgba(212,169,95,0.1)]' : ''}`}
                        >
                            {plan.name.toLowerCase().includes('gold') && (
                                <div className="absolute top-8 -right-12 rotate-45 bg-accent text-primary px-12 py-1 text-[10px] font-black uppercase tracking-widest shadow-xl">
                                    Premium
                                </div>
                            )}

                            <div className="space-y-8 relative z-10 flex flex-col h-full">
                                <div>
                                    <h3 className="text-3xl font-heading mb-2">{plan.name}</h3>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-5xl font-heading gold-text-gradient">₹{plan.price}</span>
                                        <span className="text-white/20 uppercase tracking-widest text-xs font-bold">/ {plan.validity_days} days</span>
                                    </div>
                                    {plan.credit_type === 'any' ? (
                                        <p className="text-[10px] text-accent font-black uppercase tracking-widest mt-2">{plan.credits || 0} Circle Credits Included</p>
                                    ) : (
                                        <div className="flex flex-wrap gap-2 mt-2">
                                            {Object.entries(plan.per_screen_credits || {}).map(([key, v]) => {
                                                const linkedScreen = screens.find(s => s.legacy_link === key);
                                                const displayName = linkedScreen ? linkedScreen.name : key;
                                                return (
                                                    <span key={key} className="px-2 py-0.5 bg-accent/10 border border-accent/20 rounded text-[8px] font-black uppercase text-accent/60">
                                                        {displayName}: {v} Hrs
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-4 pt-4 border-t border-white/5 flex-1">
                                    {plan.description.split('\n').filter(l => l.trim()).map((feature, fIndex) => (
                                        <div key={fIndex} className="flex items-start gap-3">
                                            <div className="mt-1 flex-shrink-0 w-4 h-4 rounded-full bg-accent/20 flex items-center justify-center">
                                                <CheckCircle2 size={10} className="text-accent" />
                                            </div>
                                            <span className="text-gray-300 text-sm font-light leading-snug">{feature}</span>
                                        </div>
                                    ))}
                                </div>

                                <button
                                    onClick={() => handlePurchase(plan)}
                                    disabled={loading || isAnyActive || isAnyPending}
                                    className={`w-full py-5 rounded-full font-bold uppercase tracking-widest text-xs transition-all duration-500 overflow-hidden relative group/btn mt-8 
                                        ${isMatchesThis ? 'bg-accent text-primary' : (isAnyActive || isAnyPending) ? 'bg-white/5 text-white/20' : 'bg-white/5 hover:bg-white/10 text-white border border-white/10'}`}
                                >
                                    <span className="relative z-10 flex items-center justify-center gap-2">
                                        {isMatchesThis ? 'Your Elite Tier' : 
                                         isAnyActive ? 'Active Circle Member' : 
                                         isPendingThis ? 'Awaiting Payment' : 
                                         isAnyPending ? 'Request Pending' : 
                                         <span>Join {plan.name} <MessageCircle size={14} className="inline ml-1" /></span>}
                                    </span>
                                </button>
                            </div>

                            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-accent/5 blur-3xl -z-10 group-hover:bg-accent/10 transition-colors"></div>
                        </motion.div>
                    );
                })}
            </div>

            {plans.length === 0 && (
                <div className="text-center py-20 text-white/20 italic">
                    <Star className="w-12 h-12 mx-auto mb-4 opacity-10" />
                    <p>New membership tiers are being curated. Check back soon.</p>
                </div>
            )}

            <div className="mt-24 grid grid-cols-2 md:grid-cols-4 gap-8 px-4 opacity-40">
                {[
                    { icon: ShieldCheck, label: "Secure Payments" },
                    { icon: Zap, label: "Instant Activation" },
                    { icon: Star, label: "Elite Support" },
                    { icon: Crown, label: "Priority Slots" }
                ].map((item, i) => (
                    <div key={i} className="flex flex-col items-center gap-3 text-center">
                        <item.icon size={24} className="text-accent" />
                        <span className="text-[9px] uppercase tracking-[0.3em] font-black">{item.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Membership;
