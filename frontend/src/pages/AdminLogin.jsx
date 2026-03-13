import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { Shield, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';

const AdminLogin = () => {
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPw, setShowPw] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            // Use Django's token-based login for admin (username + password)
            const res = await api.post('admin-login/', { username, password });
            localStorage.setItem('access_token', res.data.access);
            localStorage.setItem('refresh_token', res.data.refresh);
            localStorage.setItem('customer', JSON.stringify(res.data.customer));
            navigate('/admin');
            window.location.reload();
        } catch (err) {
            const msg = err.response?.data?.detail || err.response?.data?.error || 'Invalid credentials. Use your Django admin account.';
            setError(msg);
        } finally { setLoading(false); }
    };

    return (
        <div className="min-h-screen luxury-bg flex items-center justify-center px-4">
            <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-md"
            >
                <div className="glass-card p-12 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-accent to-transparent opacity-60"></div>

                    <div className="text-center mb-10">
                        <div className="w-16 h-16 bg-accent/10 border border-accent/30 rounded-2xl flex items-center justify-center mx-auto mb-6">
                            <Shield className="w-8 h-8 text-accent" />
                        </div>
                        <h1 className="text-4xl font-heading gold-text-gradient font-black mb-2">Control Panel</h1>
                        <p className="text-[10px] uppercase tracking-[0.3em] text-white/30">43C Executive Access</p>
                    </div>

                    {error && (
                        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-4 rounded-xl mb-6 text-center">
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[9px] uppercase tracking-[0.2em] text-accent/60 font-black">Username</label>
                            <input
                                type="text"
                                required
                                placeholder="admin"
                                className="w-full bg-white/5 border border-white/10 p-4 rounded-xl focus:border-accent outline-none transition-all text-white"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[9px] uppercase tracking-[0.2em] text-accent/60 font-black">Password</label>
                            <div className="relative">
                                <input
                                    type={showPw ? 'text' : 'password'}
                                    required
                                    placeholder="••••••••"
                                    className="w-full bg-white/5 border border-white/10 p-4 rounded-xl focus:border-accent outline-none transition-all text-white pr-12"
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                />
                                <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-accent transition-colors">
                                    {showPw ? <EyeOff size={18}/> : <Eye size={18}/>}
                                </button>
                            </div>
                        </div>
                        <button
                            type="submit"
                            className="gold-button w-full py-5 uppercase tracking-[0.3em] font-black text-xs mt-4"
                        >
                            {loading ? 'Authenticating...' : 'Access Dashboard'}
                        </button>
                    </form>

                    <p className="text-center text-white/10 text-[9px] mt-8 uppercase tracking-widest">Restricted Access · 43C Lounge Systems</p>
                </div>
            </motion.div>
        </div>
    );
};

export default AdminLogin;
