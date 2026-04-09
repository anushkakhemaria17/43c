import React from 'react';
import { motion } from 'framer-motion';
import { 
  MessageCircle, 
  Monitor, 
  CalendarClock, 
  PhoneCall, 
  CreditCard, 
  CheckCircle, 
  History, 
  ShieldCheck, 
  PartyPopper,
  Zap,
  LayoutDashboard,
  Utensils,
  ChefHat,
  Bell,
  Settings,
  Shield,
  BarChart3,
  Ticket,
  Users,
  Backpack,
  ArrowLeft
} from 'lucide-react';
import FlowStepCard from '../components/FlowStepCard';

const AdminGuide = () => {
  const adminBookingFlow = [
    { icon: MessageCircle, title: "Request Reception", desc: "Monitor WhatsApp for incoming customer booking enquiries. Check details like guests and dates." },
    { icon: LayoutDashboard, title: "Log Entry", desc: "View the booking in your Admin Dashboard under 'Incoming' or 'Pending' requests." },
    { icon: CalendarClock, title: "Availability Audit", desc: "Cross-verify requested slots against existing bookings and maintenance schedules." },
    { icon: PhoneCall, title: "Direct Contact", desc: "Reach out to the customer via WhatsApp/Call to confirm their identity and intent." },
    { icon: CreditCard, title: "Advance Verification", desc: "Share payment details and confirm the successful receipt of the advance amount." },
    { icon: CheckCircle, title: "Formal Confirmation", desc: "Mark the booking as 'CONFIRMED' in the dashboard to formally reserve the slot." },
    { icon: History, title: "Slot Reservation", desc: "The system automatically locks the room for other users. Monitor for overlaps." },
    { icon: Backpack, title: "Welcome Protocol", desc: "Prepare the lounge. Welcome the customer upon arrival at the 43C premises." },
    { icon: ShieldCheck, title: "OTP Verification", desc: "Input or verify the customer's unique entry OTP to grant private access." },
    { icon: PartyPopper, title: "Start & Completion", desc: "Ensure final payment is made. Mark the booking as 'COMPLETED' once they leave." },
  ];

  const adminFoodFlow = [
    { icon: Bell, title: "Order Alert", desc: "Receive real-time notifications for food orders via WhatsApp or Admin Panel." },
    { icon: CheckCircle, title: "Order Confirmation", desc: "Verify item availability and confirm the order to let the customer know." },
    { icon: ChefHat, title: "Kitchen Prep", desc: "Initiate food preparation according to the order specifications." },
    { icon: Utensils, title: "Serve & Track", desc: "Deliver the items to the specific lounge and mark the order as 'SERVED'." },
    { icon: BarChart3, title: "Ledger Update", desc: "Ensure the order cost is reflected in the final settlement during checkout." },
  ];

  const adminManagementFlow = [
    { icon: Monitor, title: "Lounge Hardware", desc: "Manage screen availability, status, and dynamic naming from Settings." },
    { icon: CreditCard, title: "Pricing Engine", desc: "Update per-person or flat pricing for members and non-members." },
    { icon: Shield, title: "Membership Control", desc: "Approve or decline Elite Circle requests and manage existing member credits." },
    { icon: Ticket, title: "Marketing & Coupons", desc: "Create, track, and manage promotional codes and limit their usage." },
    { icon: Users, title: "Customer Analytics", desc: "Monitor visit frequency, total spends, and customer registries." },
    { icon: Settings, title: "System Oversight", desc: "Control global settings like WhatsApp numbers and Terms of Service." },
  ];

  return (
    <div className="min-h-screen bg-[#05071A] text-white">
      {/* Mini Header / Back Action */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-black/40 backdrop-blur-xl border-b border-white/5 p-4 flex items-center justify-between">
         <a href="/admin-dashboard" className="flex items-center gap-2 text-white/40 hover:text-accent transition-colors">
            <ArrowLeft size={16} />
            <span className="text-[10px] uppercase font-black tracking-widest leading-none">Back to Dashboard</span>
         </a>
         <div className="flex items-center gap-2">
            <Shield size={14} className="text-accent" />
            <span className="text-[10px] uppercase font-black tracking-widest text-accent leading-none">Admin Operational Manual</span>
         </div>
      </div>

      <main className="pt-24 pb-20 px-6 max-w-6xl mx-auto">
        <div className="mb-20">
          <motion.div 
            initial={{ opacity: 0, x: -20 }} 
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
             <h1 className="text-4xl md:text-6xl font-heading font-black">Operator's <span className="gold-text-gradient italic">Manual</span></h1>
             <p className="text-sm text-white/40 max-w-md">Comprehensive operational guide for 43C internal team members and administrators.</p>
          </motion.div>
        </div>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Main Booking Flow */}
          <div className="space-y-8">
             <div className="flex items-center gap-3">
               <div className="w-10 h-10 rounded-xl bg-accent/20 border border-accent/40 flex items-center justify-center text-accent">
                 <LayoutDashboard size={20} />
               </div>
               <h3 className="text-xl font-heading">Core Booking <span className="text-accent italic">Operations</span></h3>
             </div>
             
             <div className="glass-card p-8 border-white/5">
                {adminBookingFlow.map((step, idx) => (
                  <FlowStepCard 
                    key={idx}
                    stepNumber={idx + 1}
                    icon={step.icon}
                    title={step.title}
                    description={step.desc}
                    isLast={idx === adminBookingFlow.length - 1}
                  />
                ))}
             </div>
          </div>

          <div className="space-y-12">
            {/* Food Section */}
            <div className="space-y-8">
               <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-xl bg-accent/20 border border-accent/40 flex items-center justify-center text-accent">
                   <Utensils size={20} />
                 </div>
                 <h3 className="text-xl font-heading">Kitchen & <span className="text-accent italic">Service</span></h3>
               </div>
               <div className="glass-card p-8 border-white/5">
                  {adminFoodFlow.map((step, idx) => (
                    <FlowStepCard 
                      key={idx}
                      stepNumber={idx + 1}
                      icon={step.icon}
                      title={step.title}
                      description={step.desc}
                      isLast={idx === adminFoodFlow.length - 1}
                    />
                  ))}
               </div>
            </div>

            {/* Management Section */}
            <div className="space-y-8">
               <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-xl bg-accent/20 border border-accent/40 flex items-center justify-center text-accent">
                   <Settings size={20} />
                 </div>
                 <h3 className="text-xl font-heading">System <span className="text-accent italic">Oversight</span></h3>
               </div>
               <div className="glass-card p-8 border-white/5">
                  {adminManagementFlow.map((step, idx) => (
                    <FlowStepCard 
                      key={idx}
                      stepNumber={idx + 1}
                      icon={step.icon}
                      title={step.title}
                      description={step.desc}
                      isLast={idx === adminManagementFlow.length - 1}
                    />
                  ))}
               </div>
            </div>

            {/* Quick Reference */}
            <div className="navy-card p-8 border-accent/20 bg-accent/5">
               <div className="flex items-center gap-2 mb-4">
                  <Zap size={14} className="text-accent" />
                  <span className="text-[10px] font-black uppercase text-accent tracking-widest">Team Reminder</span>
               </div>
               <p className="text-xs text-white/60 leading-relaxed font-light italic">
                 "Our priority is an interaction-free cinema experience. Always ensure the client is comfortable and has entered their OTP before approaching the lounge room."
               </p>
            </div>
          </div>
        </div>

        {/* View Customer Flow Link */}
        <div className="mt-20 pt-12 border-t border-white/5 text-center">
           <p className="text-white/40 text-[10px] uppercase font-black tracking-widest mb-6">Want to see what the customer sees?</p>
           <a href="/guide" target="_blank" className="inline-flex items-center gap-2 px-8 py-4 rounded-full border border-white/10 hover:border-accent hover:text-accent transition-all duration-500 text-xs font-black uppercase tracking-widest">
             <Users size={14} /> View Customer Journey
           </a>
        </div>
      </main>
    </div>
  );
};

export default AdminGuide;
