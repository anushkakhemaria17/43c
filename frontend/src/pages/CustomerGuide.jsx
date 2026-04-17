import React from 'react';
import { motion } from 'framer-motion';
import { 
  LogIn, 
  Calendar, 
  Clapperboard, 
  Users, 
  Clock, 
  MessageCircle, 
  Handshake, 
  CreditCard, 
  CheckCircle2, 
  Smartphone, 
  MapPin, 
  Key, 
  Banknote,
  Utensils,
  ShoppingCart,
  Receipt,
  ArrowBigRightDash,
  Crown,
  Zap
} from 'lucide-react';
import FlowStepCard from '../components/FlowStepCard';
import Navbar from '../components/Navbar';

const CustomerGuide = () => {
  const bookingSteps = [
    { icon: LogIn, title: "Identity Access", desc: "Start your journey by logging in or registering with your mobile number. We use secure OTP for your privacy." },
    { icon: Calendar, title: "Choose Your Moment", desc: "Select the date you wish to celebrate. We recommend booking in advance for special occasions." },
    { icon: Clapperboard, title: "Lounge Selection", desc: "Pick your preferred Screen or a curated Party Combo that fits your vibe." },
    { icon: Users, title: "Guest Registry", desc: "Set the number of guests joining you in the Elite Circle." },
    { icon: Clock, title: "Claim Your Slot", desc: "Browse available time slots and select the ones that suit your schedule." },
    { icon: MessageCircle, title: "WhatsApp Request", desc: "Send your curated booking details to our team via WhatsApp for priority review." },
    { icon: Handshake, title: "Elite Concierge", desc: "Our 43C team will connect with you to finalize details and answer questions." },
    { icon: CreditCard, title: "Secure Advance", desc: "Pay the required advance amount to lock in your reservation." },
    { icon: CheckCircle2, title: "Booking Confirmation", desc: "Once verified, your booking is officially confirmed in our system." },
    { icon: Smartphone, title: "Access OTP", desc: "Receive your unique entry OTP 30 minutes before your slot begins." },
    { icon: MapPin, title: "Arrival at 43C", desc: "Visit our lounge. Our staff will be ready to welcome you." },
    { icon: Key, title: "Seamless Entry", desc: "Enter your secure OTP at the entrance for private access." },
    { icon: Banknote, title: "Final Settlement", desc: "Complete the remaining payment at the counter before you start." },
    { icon: Clapperboard, title: "Cinema Magic", desc: "Relax, interaction-free, and enjoy your premium lounge experience." },
  ];

  const foodSteps = [
    { icon: Utensils, title: "Browse Menu", desc: "Explore our premium selection of snacks, drinks, and combos." },
    { icon: ShoppingCart, title: "Build Your Feast", desc: "Add your favorite items to the digital cart." },
    { icon: MessageCircle, title: "Place Order", desc: "Send your food order via WhatsApp for instant preparation." },
    { icon: CheckCircle2, title: "Admin Review", desc: "Our kitchen verifies and confirms your delicious request." },
    { icon: Crown, title: "Elite Service", desc: "Fresh food is served directly to your lounge room." },
    { icon: Banknote, title: "Easy Billing", desc: "Pay for your orders at the conclusion of your visit." },
  ];

  return (
    <div className="min-h-screen bg-[#0a1128] text-white">
      <Navbar />

      <main className="pt-32 pb-20 px-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-20 space-y-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }} 
            animate={{ opacity: 1, scale: 1 }} 
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 mb-4"
          >
            <Zap className="w-4 h-4 text-accent fill-accent" />
            <span className="text-xs uppercase tracking-[0.3em] font-bold text-accent">The Guide to Elite Access</span>
          </motion.div>
          <h1 className="text-5xl md:text-7xl font-heading font-black">Master the <span className="gold-text-gradient italic">Circle</span></h1>
          <p className="text-gray-400 max-w-2xl mx-auto font-light leading-relaxed">Everything you need to know about reserving your luxury lounge experience at 43C.</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-16 items-start">
          {/* Booking Flow */}
          <section className="space-y-12">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center shadow-[0_0_20px_rgba(212,169,95,0.2)]">
                <Calendar className="text-primary" size={24} />
              </div>
              <h2 className="text-3xl font-heading">Lounge <span className="gold-text-gradient">Booking</span></h2>
            </div>
            
            <div className="glass-card p-10 border-accent/20 relative overflow-hidden">
               {bookingSteps.map((step, idx) => (
                 <FlowStepCard 
                    key={idx}
                    stepNumber={idx + 1}
                    icon={step.icon}
                    title={step.title}
                    description={step.desc}
                    isLast={idx === bookingSteps.length - 1}
                 />
               ))}
            </div>
          </section>

          {/* Food Flow */}
          <section className="space-y-12 lg:sticky lg:top-32">
             <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-accent flex items-center justify-center shadow-[0_0_20px_rgba(212,169,95,0.2)]">
                  <Utensils className="text-primary" size={24} />
                </div>
                <h2 className="text-3xl font-heading">Food & <span className="gold-text-gradient">Beverage</span></h2>
             </div>

             <div className="glass-card p-10 border-accent/20 relative overflow-hidden">
                {foodSteps.map((step, idx) => (
                  <FlowStepCard 
                    key={idx}
                    stepNumber={idx + 1}
                    icon={step.icon}
                    title={step.title}
                    description={step.desc}
                    isLast={idx === foodSteps.length - 1}
                  />
                ))}
                
                <div className="mt-8 p-6 rounded-2xl bg-accent/5 border border-accent/20">
                   <p className="text-xs text-accent/60 font-medium italic flex items-center gap-2">
                     <MessageCircle size={14} /> Quick Tip: Select your food in advance to have it served exactly when you arrive!
                   </p>
                </div>
             </div>

             {/* Call to action */}
             <motion.div 
               whileHover={{ scale: 1.02 }}
               className="navy-card !bg-gradient-to-br from-accent/20 to-transparent p-10 mt-12 border-accent/30 text-center space-y-6"
             >
                <h3 className="text-2xl font-heading gold-text-gradient font-black">Ready for the Experience?</h3>
                <p className="text-sm text-white/50 mb-6 font-medium uppercase tracking-widest text-[9px]">Your private elite lounge and gourmet treats are just 60 seconds away.</p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <a href="/book" className="gold-button flex-1 flex items-center justify-center gap-2 !py-5 text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-accent/20">
                    <Zap size={14} className="fill-primary" /> Reserve Experience
                  </a>
                  <a href="/menu" className="glass-card flex-1 flex items-center justify-center gap-2 !py-5 text-[10px] font-black uppercase tracking-[0.2em] border-accent/10 hover:border-accent/40 bg-white/5 hover:bg-accent/10 transition-all text-center">
                    <Utensils size={14} className="text-accent" /> Order Gourmet Food
                  </a>
                </div>
             </motion.div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default CustomerGuide;

