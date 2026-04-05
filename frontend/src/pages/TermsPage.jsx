import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { motion } from 'framer-motion';

const TermsPage = () => {
    const [termsText, setTermsText] = useState("Loading terms...");

    useEffect(() => {
        const fetchTerms = async () => {
            try {
                const docSnap = await getDoc(doc(db, 'terms_conditions', 'default'));
                if (docSnap.exists() && docSnap.data().content) {
                    setTermsText(docSnap.data().content);
                } else {
                    setTermsText("Terms and Conditions are currently unavailable.");
                }
            } catch (error) {
                console.error("Error fetching terms:", error);
                setTermsText("Failed to load Terms and Conditions. Please try again later.");
            }
        };
        fetchTerms();
    }, []);

    return (
        <div className="pt-28 pb-20 px-4 max-w-4xl mx-auto min-h-screen">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6 md:p-12 relative overflow-hidden">
                <div className="absolute inset-0 mesh-pattern opacity-10"></div>
                <div className="relative z-10">
                    <h1 className="text-3xl md:text-5xl font-heading mb-8 gold-text-gradient font-black text-center">Terms & Conditions</h1>
                    <div className="bg-[#05071A]/50 border border-white/10 rounded-2xl p-6 md:p-10 whitespace-pre-wrap leading-relaxed text-white/80 font-light text-sm md:text-base">
                        {termsText}
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default TermsPage;
