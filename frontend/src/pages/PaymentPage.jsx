import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { motion } from 'framer-motion';
import { Copy, Check, MessageCircle, CreditCard, Smartphone, ShieldCheck, ArrowLeft, Info } from 'lucide-react';

const PaymentPage = () => {
  const [searchParams] = useSearchParams();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copiedField, setCopiedField] = useState(null);

  // Simple decryption for amount
  const decryptAmount = (str) => {
    try {
      if (!str) return null;
      // Simple base64 decode for "encryption" as requested
      const decoded = atob(str);
      return isNaN(decoded) ? null : decoded;
    } catch (e) {
      return null;
    }
  };

  const name = searchParams.get('name') || 'Guest';
  const rawAmount = searchParams.get('amount');
  const type = searchParams.get('type') || 'booking';
  const amount = decryptAmount(rawAmount);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'settings', 'payment');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setSettings(docSnap.data());
        } else {
          // Fallback if settings don't exist yet
          setSettings({
            upi_id: 'anushka17.khemaria@okicici',
            mobile_number: '9479810400',
            qr_image_url: '/assets/payment/qr.jpeg'
          });
        }
      } catch (err) {
        console.error('Error fetching payment settings:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleCopy = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const openWhatsApp = () => {
    const waNumber = '919479810400';
    const message = encodeURIComponent(`Hello, I have completed the payment of ₹${amount || '___'} for my ${type}. Here is the screenshot.`);
    window.open(`https://wa.me/${waNumber}?text=${message}`, '_blank');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center luxury-bg">
        <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen luxury-bg mesh-pattern text-white pb-20 pt-10 px-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }} 
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="inline-block p-3 rounded-2xl bg-accent/10 border border-accent/20 mb-4 text-accent">
            <CreditCard size={32} />
          </div>
          <h1 className="text-3xl font-heading mb-2">Complete Your <span className="gold-text-gradient italic">Payment</span></h1>
          <p className="text-white/40 text-sm">Secure your experience at 43C Lounge</p>
        </motion.div>

        {/* Amount Display */}
        {amount && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }} 
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card !border-accent/30 p-6 mb-8 text-center relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-2">
              <ShieldCheck size={16} className="text-accent/30" />
            </div>
            <p className="text-[10px] uppercase tracking-widest text-accent font-black mb-1">Amount to Pay</p>
            <p className="text-4xl font-heading gold-text-gradient">₹{amount}</p>
            <p className="text-[9px] text-white/30 mt-2 uppercase tracking-[0.2em]">{type === 'food' ? 'Food Order' : 'Lounge Booking'}</p>
          </motion.div>
        )}

        {/* QR Code Section */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card mb-8 p-6 flex flex-col items-center"
        >
          <div className="w-full aspect-square max-w-[280px] bg-white rounded-3xl p-4 mb-6 shadow-[0_0_30px_rgba(212,169,95,0.15)] overflow-hidden">
            {settings?.qr_image_url ? (
              <img 
                src={settings.qr_image_url} 
                alt="Payment QR" 
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-primary/30">
                <Smartphone size={64} strokeWidth={1} />
                <p className="text-[10px] uppercase font-black tracking-widest mt-2">QR Code Missing</p>
              </div>
            )}
          </div>
          <p className="text-xs text-white/50 text-center mb-2 italic">Scan to pay with any UPI App</p>
          <div className="flex gap-2">
            <div className="w-2 h-2 rounded-full bg-[#EA4335] animate-pulse"></div>
            <div className="w-2 h-2 rounded-full bg-[#FBBC05] animate-pulse delay-75"></div>
            <div className="w-2 h-2 rounded-full bg-[#34A853] animate-pulse delay-150"></div>
            <div className="w-2 h-2 rounded-full bg-[#4285F4] animate-pulse delay-200"></div>
          </div>
        </motion.div>

        {/* Manual Details */}
        <div className="space-y-4 mb-8">
          <motion.div 
            initial={{ opacity: 0, x: -20 }} 
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-card p-4 flex items-center justify-between"
          >
            <div>
              <p className="text-[9px] uppercase tracking-wider text-white/40 mb-1">UPI ID</p>
              <p className="font-mono text-sm font-bold text-accent">{settings?.upi_id}</p>
            </div>
            <button 
              onClick={() => handleCopy(settings?.upi_id, 'upi')}
              className={`p-3 rounded-xl transition-all ${copiedField === 'upi' ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-white/60 hover:text-white'}`}
            >
              {copiedField === 'upi' ? <Check size={18} /> : <Copy size={18} />}
            </button>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }} 
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-card p-4 flex items-center justify-between"
          >
            <div>
              <p className="text-[9px] uppercase tracking-wider text-white/40 mb-1">Mobile Number</p>
              <p className="font-mono text-sm font-bold text-white">{settings?.mobile_number}</p>
            </div>
            <button 
              onClick={() => handleCopy(settings?.mobile_number, 'mobile')}
              className={`p-3 rounded-xl transition-all ${copiedField === 'mobile' ? 'bg-green-500/20 text-green-400' : 'bg-white/5 text-white/60 hover:text-white'}`}
            >
              {copiedField === 'mobile' ? <Check size={18} /> : <Copy size={18} />}
            </button>
          </motion.div>
        </div>

        {/* Instructions */}
        <motion.div 
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="bg-white/5 border border-white/10 rounded-3xl p-6 mb-8"
        >
          <div className="flex items-center gap-2 mb-4 text-accent">
            <Info size={16} />
            <h3 className="text-xs uppercase font-black tracking-widest">Instructions</h3>
          </div>
          <ul className="space-y-3">
            {[
              "Scan the QR or copy the UPI ID above.",
              "Complete the payment in your UPI app.",
              "Take a screenshot of the success page.",
              "Share the screenshot on WhatsApp."
            ].map((step, i) => (
              <li key={i} className="flex gap-3 text-sm text-white/60 font-medium">
                <span className="text-accent flex-shrink-0">{i + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Action Button */}
        <motion.button 
          initial={{ opacity: 0, y: 20 }} 
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          onClick={openWhatsApp}
          className="w-full gold-button !py-4 flex items-center justify-center gap-3 text-sm font-black uppercase tracking-widest"
        >
          <MessageCircle size={20} />
          Send Screenshot
        </motion.button>

        {/* Back link */}
        <div className="mt-8 text-center">
          <button 
            onClick={() => window.history.back()}
            className="text-[10px] uppercase tracking-widest text-white/20 hover:text-accent flex items-center gap-2 mx-auto transition-colors"
          >
            <ArrowLeft size={12} /> Return to Lounge
          </button>
        </div>
      </div>
    </div>
  );
};

export default PaymentPage;
