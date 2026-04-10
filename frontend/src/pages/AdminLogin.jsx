import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import logo43c from '../assets/43C.png';

const AdminLogin = () => {
  const navigate = useNavigate();
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (localStorage.getItem('admin_access') === 'true') {
      navigate('/admin');
    }
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const cleanedMobile = mobile.replace(/\D/g, '');
      const formattedMobile = cleanedMobile.length === 10 ? '91' + cleanedMobile : cleanedMobile;

      if (formattedMobile === '919479810400' && password === '43cadmin') {
        localStorage.setItem('admin_access', 'true');
        localStorage.setItem('admin_name', 'Super Admin');
        navigate('/admin');
        return;
      }
      const q = query(collection(db, 'admins'), 
        where('mobile', 'in', [cleanedMobile, formattedMobile]), 
        where('password', '==', password)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        localStorage.setItem('admin_access', 'true');
        localStorage.setItem('admin_name', snap.docs[0].data().name || 'Admin');
        navigate('/admin');
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
        <div className="glass-card p-10 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-accent to-transparent opacity-60"></div>
          <div className="text-center mb-10">
            <img
              src={logo43c}
              alt="43C"
              className="h-16 mx-auto mb-4 object-contain"
              onError={e => { e.target.style.display = 'none'; }}
            />
            <h1 className="text-3xl font-heading gold-text-gradient font-black mb-1">Control Panel</h1>
            <p className="text-[10px] uppercase tracking-[0.3em] text-white/30">Executive Access</p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-4 rounded-xl mb-6 text-center">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <label className="text-[9px] uppercase tracking-[0.2em] text-accent/60 font-black">Mobile Number</label>
              <input
                type="tel" required placeholder="10-digit mobile"
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

          <p className="text-center text-white/10 text-[9px] mt-8 uppercase tracking-widest">
            <button onClick={() => navigate('/')} className="hover:text-accent font-bold">Return to Main Site</button>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default AdminLogin;
