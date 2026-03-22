import React from 'react';
import logoImage from '../assets/43C.png';
import { motion } from 'framer-motion';
import { ChevronRight, Play, Star, ShieldCheck, Clock, MapPin, Crown } from 'lucide-react';
import { Link } from 'react-router-dom';

const LandingPage = () => {
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
                            <span className="text-xs uppercase tracking-[0.3em] font-bold text-accent">India's Premimum Lounge</span>
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
                        { icon: ShieldCheck, title: "Utmost Privacy", desc: "Soundproof private lounges designed for business meetings or intimate gatherings." },
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

            {/* Call to Action */}
            <section className="py-32 px-4 text-center relative">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[1px] bg-gradient-to-r from-transparent via-accent/30 to-transparent"></div>
                <div className="max-w-3xl mx-auto glass-card p-16 relative overflow-hidden">
                    <div className="absolute inset-0 mesh-pattern opacity-10"></div>
                    <h2 className="text-5xl md:text-6xl mb-8 leading-tight">Elevate Your <br /> Lounge <span className="gold-text-gradient italic">Lifestyle</span></h2>
                    <p className="text-xl text-gray-400 mb-12 font-light">Join our exclusive membership for priority access and preferred pricing across all our luxury lounges.</p>
                    <Link to="/membership" className="gold-button">Explore Memberships</Link>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 border-t border-white/5 opacity-50 px-4">
                <div className="max-w-7xl mx-auto flex flex-col md:row justify-between items-center gap-8">
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
