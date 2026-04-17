import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MapPin, Phone, Mail, MessageCircle, Clock } from 'lucide-react';
import { getWhatsAppNumber } from '../utils/settings';
import { openWhatsApp } from '../utils/whatsapp';

const ContactPage = () => {
  const [waNumber, setWaNumber] = useState('9479810400');

  useEffect(() => {
    getWhatsAppNumber().then(num => {
      if(num) setWaNumber(num);
    });
  }, []);

  const handleWhatsApp = (e) => {
    e.preventDefault();
    const message = "Hello 43C, I have a query regarding...";
    const fullPhone = waNumber.startsWith('91') ? waNumber : `91${waNumber}`;
    openWhatsApp(fullPhone, message);
  };

  return (
    <div className="pt-32 pb-20 px-4 max-w-5xl mx-auto min-h-screen">
      <div className="text-center mb-16 space-y-4">
        <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 mb-4">
          <MessageCircle className="w-4 h-4 text-accent" />
          <span className="text-xs uppercase tracking-[0.3em] font-bold text-accent">Get in Touch</span>
        </motion.div>
        <h1 className="text-5xl md:text-7xl font-heading font-black">Contact <span className="gold-text-gradient">43C</span></h1>
        <p className="text-gray-400 max-w-2xl mx-auto font-light leading-relaxed">Reach out to our concierge for special requests, event hosting, or general inquiries.</p>
      </div>

      <div className="grid md:grid-cols-2 gap-10">
        <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} className="glass-card p-10 space-y-8">
          <h2 className="text-3xl font-heading mb-6">Concierge <span className="gold-text-gradient italic">Services</span></h2>
          
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
              <MapPin className="text-accent w-5 h-5"/>
            </div>
            <div>
              <p className="text-[10px] uppercase font-black tracking-widest text-white/40 mb-1">Location</p>
              <p className="font-medium text-white/80">43C Premium Lounge<br/>City Center, India</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
              <Clock className="text-accent w-5 h-5"/>
            </div>
            <div>
              <p className="text-[10px] uppercase font-black tracking-widest text-white/40 mb-1">Hours of Operation</p>
              <p className="font-medium text-white/80">Open 24/7</p>
            </div>
          </div>

          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
              <Phone className="text-accent w-5 h-5"/>
            </div>
            <div>
              <p className="text-[10px] uppercase font-black tracking-widest text-white/40 mb-1">Direct Line</p>
              <p className="font-medium text-white/80">+91 {waNumber}</p>
            </div>
          </div>

          <div className="pt-6 border-t border-white/10">
            <button onClick={handleWhatsApp} className="gold-button w-full flex items-center justify-center gap-3 !py-4">
              <MessageCircle className="w-5 h-5"/> Chat on WhatsApp
            </button>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} className="navy-card p-10">
           <h2 className="text-3xl font-heading mb-6">Send <span className="gold-text-gradient italic">Query</span></h2>
           <form onSubmit={handleWhatsApp} className="space-y-4">
             <input type="text" placeholder="Your Name" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-accent" required />
             <input type="tel" placeholder="Mobile Number" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-accent" required />
             <textarea placeholder="How can we help you?" rows="4" className="w-full bg-white/5 border border-white/10 p-4 rounded-xl outline-none focus:border-accent resize-none" required></textarea>
             <button type="submit" className="w-full border border-accent text-accent hover:bg-accent hover:text-primary transition-all rounded-xl py-4 font-bold uppercase tracking-widest text-[10px]">Send Message</button>
           </form>
           <p className="text-[10px] text-white/30 text-center mt-4 uppercase tracking-[0.2em]">Redirects to WhatsApp</p>
        </motion.div>
      </div>
    </div>
  );
};

export default ContactPage;

