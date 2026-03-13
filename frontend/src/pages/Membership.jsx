import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import api from '../utils/api';
import { Crown, CheckCircle2, Star, Zap, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';

const Membership = () => {
    const { customer, updateProfile } = useAuth();
    const [loading, setLoading] = useState(false);

    const plans = [
        {
            id: 1,
            name: "Elite Monthly",
            price: 1999,
            days: 30,
            features: ["Priority Slot Booking", "20% Discount on All Slots", "Complimentary Brews", "Valet Parking"]
        },
        {
            id: 2,
            name: "Prestige Yearly",
            price: 19999,
            days: 365,
            features: ["All Monthly Features", "35% Discount on All Slots", "Private Event Priority", "Dedicated Concierge", "Gift Vouchers worth ₹5000"]
        }
    ];

    const handlePurchase = async (planId) => {
        if (!customer) {
            window.location.href = '/book';
            return;
        }
        setLoading(true);
        try {
            const res = await api.post('customers/purchase-membership/', { plan_id: planId });
            updateProfile(res.data.customer);
            alert("Welcome to the 43C Elite! Your membership is now active.");
        } catch (err) {
            alert("Transaction failed. Please contact concierge.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="pt-32 pb-20 px-4 max-w-7xl mx-auto">
            <div className="text-center mb-16 space-y-4">
                <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 mb-4">
                    <Crown className="w-4 h-4 text-accent fill-accent" />
                    <span className="text-xs uppercase tracking-[0.3em] font-bold text-accent">The 43C Elite Circle</span>
                </motion.div>
                <h1 className="text-5xl md:text-7xl font-heading font-black">Elevate Your <span className="gold-text-gradient">Experience</span></h1>
                <p className="text-gray-400 max-w-2xl mx-auto font-light leading-relaxed">Exclusive benefits, preferred pricing, and priority access. Designed for those who value privacy and luxury in every chapter.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
                {plans.map((plan, i) => (
                    <motion.div 
                        key={plan.id}
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.2 }}
                        className={`navy-card relative group overflow-hidden ${plan.id === 2 ? 'border-accent/40 shadow-[0_0_50px_rgba(212,169,95,0.1)]' : ''}`}
                    >
                        {plan.id === 2 && (
                            <div className="absolute top-8 -right-12 rotate-45 bg-accent text-primary px-12 py-1 text-[10px] font-black uppercase tracking-widest shadow-xl">
                                Best Value
                            </div>
                        )}
                        
                        <div className="space-y-8 relative z-10">
                            <div>
                                <h3 className="text-3xl font-heading mb-2">{plan.name}</h3>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-5xl font-heading gold-text-gradient">₹{plan.price}</span>
                                    <span className="text-white/20 uppercase tracking-widest text-xs font-bold">/ {plan.days === 30 ? 'mo' : 'yr'}</span>
                                </div>
                            </div>

                            <div className="space-y-4 pt-4 border-t border-white/5">
                                {plan.features.map((feature, fIndex) => (
                                    <div key={fIndex} className="flex items-start gap-3">
                                        <div className="mt-1 flex-shrink-0 w-4 h-4 rounded-full bg-accent/20 flex items-center justify-center">
                                            <CheckCircle2 size={10} className="text-accent" />
                                        </div>
                                        <span className="text-gray-300 text-sm font-light leading-snug">{feature}</span>
                                    </div>
                                ))}
                            </div>

                            <button 
                                onClick={() => handlePurchase(plan.id)}
                                disabled={loading || customer?.is_member}
                                className={`w-full py-5 rounded-full font-bold uppercase tracking-widest text-xs transition-all duration-500 overflow-hidden relative group/btn ${customer?.is_member ? 'bg-white/5 text-white/20 cursor-not-allowed' : 'bg-white/5 hover:bg-white/10 text-white'}`}
                            >
                                <span className="relative z-10">
                                    {customer?.is_member ? 'Membership Active' : plan.id === 2 ? 'Inaugurate Prestige Plan' : 'Begin Elite Monthly'}
                                </span>
                                {plan.id === 2 && !customer?.is_member && (
                                    <div className="absolute inset-x-0 bottom-0 h-1 bg-accent transform scale-x-0 group-hover/btn:scale-x-100 transition-transform origin-center duration-700"></div>
                                )}
                            </button>
                        </div>

                        {/* Aesthetic Background Shapes */}
                        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-accent/5 blur-3xl -z-10 group-hover:bg-accent/10 transition-colors"></div>
                    </motion.div>
                ))}
            </div>

            {/* Satisfaction Row */}
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
