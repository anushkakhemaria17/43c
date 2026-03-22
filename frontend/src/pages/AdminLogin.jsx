import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

const AdminLogin = () => {
  const navigate = useNavigate();
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      // Hardware-coded main admin account fallback
      if (mobile === '9479810400' && password === '43cadmin') {
        localStorage.setItem('admin_access', 'true');
        const redirectUrl = localStorage.getItem('redirect_after_login');
        if (redirectUrl) {
          localStorage.removeItem('redirect_after_login');
          navigate(redirectUrl);
          window.location.reload();
        } else {
          navigate('/admin');
          window.location.reload();
        }
        return;
      }

      // Check database for dynamically added admins
      const q = query(
        collection(db, 'admins'),
        where('mobile', '==', mobile),
        where('password', '==', password)
      );
      const snap = await getDocs(q);

      if (!snap.empty) {
        localStorage.setItem('admin_access', 'true');
        const redirectUrl = localStorage.getItem('redirect_after_login');
        if (redirectUrl) {
          localStorage.removeItem('redirect_after_login');
          navigate(redirectUrl);
          window.location.reload();
        } else {
          navigate('/admin');
          window.location.reload();
        }
      } else {
        throw new Error('Invalid credentials.');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen luxury-bg flex items-center justify-center px-4">
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="glass-card p-12 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-accent to-transparent opacity-60"></div>
          
          <div className="text-center mb-10">
            <div className="w-16 h-16 bg-accent/10 border border-accent/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Shield className="w-8 h-8 text-accent" />
            </div>
            <h1 className="text-4xl font-heading gold-text-gradient font-black mb-2">Control Panel</h1>
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/30">Executive Access</p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-4 rounded-xl mb-6 text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[9px] uppercase tracking-[0.2em] text-accent/60 font-black">Mobile Number</label>
              <input
                type="tel" required placeholder="Mobile"
                className="w-full bg-white/5 border border-white/10 p-4 rounded-xl focus:border-accent outline-none transition-all text-white"
                value={mobile} onChange={e => setMobile(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] uppercase tracking-[0.2em] text-accent/60 font-black">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'} required placeholder="••••••••"
                  className="w-full bg-white/5 border border-white/10 p-4 rounded-xl focus:border-accent outline-none transition-all text-white pr-12"
                  value={password} onChange={e => setPassword(e.target.value)}
                />
                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-accent transition-colors">
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button type="submit" className="gold-button w-full py-5 uppercase tracking-[0.3em] font-black text-xs mt-4">
              {loading ? 'Authenticating...' : 'Access Dashboard'}
            </button>
          </form>

          <p className="text-center text-white/10 text-[9px] mt-8 uppercase tracking-widest flex justify-center gap-4">
            <button onClick={() => navigate('/')} className="hover:text-accent font-bold">Return to Main Site</button>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default AdminLogin;
