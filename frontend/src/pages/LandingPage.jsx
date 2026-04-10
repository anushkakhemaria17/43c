import React from 'react';
import logoImage from '../assets/43C.png';
import { motion } from 'framer-motion';
import { ChevronRight, Play, Star, ShieldCheck, Clock, MapPin, Crown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { getDocs, collection } from 'firebase/firestore';
import { getWhatsAppNumber } from '../utils/settings';
import { openWhatsApp } from '../utils/whatsapp';

const LandingPage = () => {
    const [combos, setCombos] = useState([]);
    const [waNumber, setWaNumber] = useState('911234567890');

    useEffect(() => {
        getDocs(collection(db, 'combos')).then(snap => {
            setCombos(snap.docs.map(d => ({id: d.id, ...d.data()})));
        });
        getWhatsAppNumber().then(num => setWaNumber(num));
    }, []);

    const bookCombo = (c) => {
        const text = c.custom_message || `Hi! I want to book the ${c.name} combo (₹${c.price}).`;
        openWhatsApp(waNumber, text);
    };
    return (
        <div className="relative pt-20 overflow-hidden">
            {/* Hero Section */}
            <section className="relative min-h-[90vh] flex items-center px-4 overflow-hidden">
                <div className="absolute inset-0 z-0">
                    <img
                        src="https://images.unsplash.com/photo-1574096079513-d8259312b785?q=80&w=2670&auto=format&fit=crop"
                        alt="Lounge"
                        className="w-full h-full object-cover opacity-20 scale-110"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#05071A] via-transparent to-transparent"></div>
                </div>

                <div className="max-w-7xl mx-auto w-full z-10 grid md:grid-cols-2 gap-12 items-center">
                    <motion.div
                        initial={{ opacity: 0, x: -50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.8 }}
                    >
                        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 mb-6">
                            <Star className="w-4 h-4 text-accent fill-accent" />
                            <span className="text-xs uppercase tracking-[0.3em] font-bold text-accent">Lounge | Gaming | Cafe </span>
                        </div>
                        <h1 className="text-6xl md:text-8xl font-heading font-black leading-none mb-6">
                            Beyond <br />
                            <span className="gold-text-gradient">Ordinary.</span>
                        </h1>
                        <p className="text-xl text-gray-400 max-w-lg mb-10 leading-relaxed font-light italic">
                            Experience the pinnacle of privacy and luxury at 43C. Private screens, artisanal brews, and an atmosphere crafted for the discerning few.
                        </p>
                        <div className="flex flex-col sm:flex-row gap-6">
                            <Link to="/book" className="gold-button group">
                                <span className="flex items-center gap-2">
                                    Reserve Your Experience <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                                </span>
                            </Link>
                            <Link to="/membership" className="flex items-center gap-4 group">
                                <span className="w-14 h-14 rounded-full border border-white/20 flex items-center justify-center group-hover:border-accent transition-all">
                                    <Crown className="w-4 h-4 text-white group-hover:text-accent" />
                                </span>
                                <span className="uppercase tracking-widest text-xs font-bold">Explore Memberships</span>
                            </Link>
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 1 }}
                        className="hidden md:block relative"
                    >
                        <div className="relative z-10 glass-card p-4 rotate-3 transform hover:rotate-0 transition-all duration-700">
                            <img src={logoImage} className="rounded-2xl w-full object-cover" alt="43C Lounge" />
                        </div>
                        <div className="absolute top-1/2 -right-10 w-64 h-64 bg-accent/20 blur-[100px] -z-10"></div>
                    </motion.div>
                </div>
            </section>

            {/* Features Row */}
            <section className="py-24 px-4 bg-white/[0.02]">
                <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12">
                    {[
                        { icon: ShieldCheck, title: "Utmost Privacy", desc: "Soundproof private lounges designed for business meetings, gatherings and parties." },
                        { icon: Clock, title: "Hourly Booking", desc: "Flexible hourly slots starting at your convenience, managed digitally." },
                        { icon: Star, title: "Premium Service", desc: "Dedicated stewards and entry-to-exit luxury catering just for you." }
                    ].map((feature, i) => (
                        <motion.div
                            key={i}
                            whileHover={{ y: -10 }}
                            className="text-center p-8 transition-all"
                        >
                            <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mx-auto mb-6 text-accent">
                                <feature.icon size={32} />
                            </div>
                            <h3 className="text-2xl mb-4">{feature.title}</h3>
                            <p className="text-gray-400 font-light leading-relaxed">{feature.desc}</p>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* Combos Section */}
            {combos.length > 0 && (
                <section className="py-24 px-4 bg-[#05071A]">
                    <div className="max-w-7xl mx-auto">
                        <div className="text-center mb-16">
                            <h2 className="text-4xl md:text-5xl font-heading mb-4">Exclusive <span className="gold-text-gradient italic">Combos</span></h2>
                            <p className="text-gray-400 font-light">Curated experiences with the best value.</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {combos.map(c => (
                                <motion.div key={c.id} whileHover={{ y: -10 }} className="glass-card group overflow-hidden border border-white/10 hover:border-accent/40 transition-all flex flex-col h-full relative">
                                    <div className="p-8 flex flex-col flex-grow z-10 bg-gradient-to-b from-white/5 to-transparent">
                                        <div className="mb-6 flex-grow">
                                            <h3 className="text-2xl font-heading mb-2 text-white">{c.name}</h3>
                                            <p className="text-accent text-3xl font-black mb-4">₹{c.price}</p>
                                            <p className="text-sm text-gray-400 font-light leading-relaxed mb-6">{c.description}</p>
                                            <div className="bg-white/5 border border-white/10 p-4 rounded-xl">
                                                <p className="text-[10px] uppercase tracking-widest text-accent mb-2 font-black">Includes</p>
                                                <p className="text-sm text-white/80">{c.includes}</p>
                                            </div>
                                        </div>
                                        <button onClick={() => bookCombo(c)} className="w-full py-4 rounded-xl border border-accent/30 text-accent font-black uppercase tracking-widest text-[10px] group-hover:bg-accent group-hover:text-primary transition-all">
                                            Book via WhatsApp
                                        </button>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            {/* Call to Action */}
            <section className="py-32 px-4 text-center relative">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[1px] bg-gradient-to-r from-transparent via-accent/30 to-transparent"></div>
                <div className="max-w-3xl mx-auto glass-card p-8 md:p-16 relative overflow-hidden">
                    <div className="absolute inset-0 mesh-pattern opacity-10"></div>
                    <h2 className="text-4xl md:text-5xl lg:text-6xl mb-6 md:mb-8 leading-tight">Elevate Your <br /> Lounge <span className="gold-text-gradient italic">Lifestyle</span></h2>
                    <p className="text-lg md:text-xl text-gray-400 mb-10 md:mb-12 font-light">Join our exclusive membership for priority access and preferred pricing across all our luxury lounges.</p>
                    <Link to="/membership" className="gold-button w-full sm:w-auto inline-block text-center !py-4 md:!py-3">Explore Memberships</Link>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 border-t border-white/5 opacity-50 px-4">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8 text-center md:text-left">
                    <span className="text-xl font-heading gold-text-gradient uppercase tracking-[0.5em]">43C Lounge</span>
                    <p className="text-xs uppercase tracking-widest">&copy; 2026 43C Luxury Inc. All Rights Reserved.</p>
                    <div className="flex gap-6 uppercase text-[10px] tracking-widest font-bold">
                        <a href="#" className="hover:text-accent">Instagram</a>
                        <a href="#" className="hover:text-accent">Twitter</a>
                        <a href="#" className="hover:text-accent">Legal</a>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
