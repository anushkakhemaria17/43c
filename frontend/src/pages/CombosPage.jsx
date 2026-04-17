import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { Ticket, Users, Monitor, ArrowRight, Star, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const CombosPage = () => {
    const [combos, setCombos] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchCombos = async () => {
            try {
                const q = query(collection(db, 'combos'), where('is_active', '==', true));
                const snap = await getDocs(q);
                setCombos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (err) {
                console.error('Error fetching combos:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchCombos();
    }, []);

    const getLocalAsset = (path, section) => {
        if (!path) return '';
        if (path.startsWith('http') || path.startsWith('blob:') || path.startsWith('data:')) return path;
        return `/assets/${section}/${path}`;
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center pt-20">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1 }}
                    className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full shadow-[0_0_20px_rgba(212,169,95,0.2)]"
                />
            </div>
        );
    }

    return (
        <div className="pt-32 pb-32 px-4 max-w-7xl mx-auto min-h-screen">
            {/* Header Section */}
            <div className="text-center mb-24 relative">
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                >
                    <div className="inline-flex items-center gap-2 px-6 py-2 rounded-full border border-accent/20 bg-accent/5 backdrop-blur-sm">
                        <Star size={14} className="text-accent fill-accent" />
                        <span className="text-[10px] uppercase tracking-[0.4em] font-black text-accent">Exclusive Experiences</span>
                        <Star size={14} className="text-accent fill-accent" />
                    </div>
                    <h1 className="text-4xl sm:text-5xl md:text-8xl font-heading gold-text-gradient font-black tracking-tighter leading-none">
                        Our <br /><span className="italic opacity-80">Elite</span> Combos
                    </h1>
                    <div className="w-24 h-1 bg-gradient-to-r from-transparent via-accent to-transparent mx-auto mt-8 opacity-50"></div>
                </motion.div>
            </div>

            {/* Combos Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-10">
                {combos.map((combo, idx) => (
                    <motion.div
                        key={combo.id}
                        initial={{ opacity: 0, scale: 0.95, y: 30 }}
                        whileInView={{ opacity: 1, scale: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: idx * 0.1 }}
                        className="group flex flex-col h-full perspective-1000"
                    >
                        <div className="glass-card flex-1 flex flex-col overflow-hidden border-white/5 hover:border-accent/30 transition-all duration-700 bg-gradient-to-br from-white/[0.03] to-transparent relative group">
                            
                            {/* Image Header */}
                            <div className="relative h-60 sm:h-72 overflow-hidden">
                                {combo.image_url ? (
                                    <img
                                        src={getLocalAsset(combo.image_url, 'combos')}
                                        alt={combo.name}
                                        className="w-full h-full object-cover transition-transform duration-1000 group-hover:scale-110"
                                    />
                                ) : (
                                    <div className="w-full h-full bg-accent/5 flex items-center justify-center">
                                        <Ticket size={80} className="text-white/5" />
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-gradient-to-t from-[#0a1128] via-transparent to-transparent opacity-90" />
                                
                                {/* Floating Badge */}
                                <div className="absolute top-6 right-6">
                                    <div className="bg-[#0a1128]/80 backdrop-blur-md border border-accent/30 px-4 py-2 rounded-2xl flex flex-col items-center">
                                        <span className="text-[10px] text-accent font-black uppercase tracking-widest leading-none mb-1">Price</span>
                                        <span className="text-xl font-heading text-white font-black leading-none">₹{combo.price}</span>
                                    </div>
                                </div>

                                <div className="absolute bottom-6 left-8">
                                    <h3 className="text-3xl font-heading text-white font-black mb-1 group-hover:gold-text-gradient transition-all">{combo.name}</h3>
                                    <div className="flex items-center gap-3">
                                        <div className="h-[2px] w-8 bg-accent"></div>
                                        <span className="text-[9px] uppercase tracking-widest text-accent font-black">{combo.screen_type || 'Private Lounge'}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Info Body */}
                            <div className="p-6 sm:p-8 flex-1 flex flex-col">
                                <p className="text-white/40 text-xs sm:text-[13px] leading-relaxed mb-6 sm:mb-8 italic line-clamp-3">
                                    "{combo.description}"
                                </p>

                                <div className="grid grid-cols-2 gap-4 mb-8">
                                    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col gap-1">
                                        <span className="text-[8px] uppercase tracking-widest text-white/20 font-black">Capacity</span>
                                        <div className="flex items-center gap-2">
                                            <Users size={12} className="text-accent/60" />
                                            <span className="text-xs font-bold text-white/70 tracking-wide">Up to {combo.max_guests} Guests</span>
                                        </div>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5 flex flex-col gap-1">
                                        <span className="text-[8px] uppercase tracking-widest text-white/20 font-black">Duration</span>
                                        <div className="flex items-center gap-2">
                                            <Clock size={12} className="text-accent/60" />
                                            <span className="text-xs font-bold text-white/70 tracking-wide">{combo.number_of_slots || 1} Time Slots</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="mb-10">
                                    <p className="text-[9px] uppercase tracking-widest text-accent font-black mb-3 flex items-center gap-2">
                                        <Star size={10} className="fill-accent" /> Inclusions
                                    </p>
                                    <p className="text-xs text-white/60 leading-relaxed font-medium">
                                        {combo.includes}
                                    </p>
                                </div>

                                <button
                                    onClick={() => navigate(`/book?comboId=${combo.id}`)}
                                    className="mt-auto w-full group/btn relative overflow-hidden rounded-2xl py-5 transition-all duration-500 hover:shadow-[0_0_30px_rgba(212,169,95,0.2)]"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-[#D4A95F] to-[#b58d4a] transition-transform duration-500 group-hover/btn:scale-105" />
                                    <div className="relative flex items-center justify-center gap-3">
                                        <span className="uppercase tracking-[0.3em] font-black text-[11px] text-[#0a1128]">Book Combo</span>
                                        <ArrowRight size={16} className="text-[#0a1128] group-hover/btn:translate-x-2 transition-transform duration-500" />
                                    </div>
                                </button>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Empty State */}
            {combos.length === 0 && (
                <div className="text-center py-40 border-2 border-dashed border-white/5 rounded-[3rem] bg-white/[0.01]">
                    <Ticket size={48} className="text-white/10 mx-auto mb-6" />
                    <h2 className="text-2xl font-heading text-white/20 tracking-tighter uppercase font-black">Elite packages loading...</h2>
                    <p className="text-[10px] text-white/10 uppercase tracking-[0.2em] mt-2">Checking our cellar for the best brews and views</p>
                </div>
            )}

            {/* Footer Tag */}
            <div className="mt-32 text-center opacity-20">
                <span className="text-[9px] uppercase tracking-[1em] font-black italic">43C Luxury Cinematic Experience</span>
            </div>
        </div>
    );
};

export default CombosPage;

