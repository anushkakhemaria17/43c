import React, { useState, useEffect, useRef } from 'react';
import { Bell, Calendar, UtensilsCrossed, X } from 'lucide-react';
import { db } from '../lib/firebase';
import {
  collection, query, onSnapshot, updateDoc, doc, orderBy, where
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';

// Admin notification bell: shows ALL unread notifications (booking/food)
const AdminNotificationBell = ({ onNavigate }) => {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    // Listen for all unread/recent notifications
    const q = query(
      collection(db, 'notifications'),
      where('target', '==', 'admin'),
      orderBy('created_at', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const unread = notifications.filter(n => !n.read).length;

  const markRead = async (n) => {
    if (!n.read) {
      await updateDoc(doc(db, 'notifications', n.id), { read: true });
    }
    setOpen(false);
    if (onNavigate) {
      if (n.booking_id) onNavigate('bookings');
      else onNavigate('orders');
    }
  };

  const markAllRead = async () => {
    const unreadItems = notifications.filter(n => !n.read);
    await Promise.all(unreadItems.map(n => updateDoc(doc(db, 'notifications', n.id), { read: true })));
  };

  const getIcon = (type) => {
    if (type?.includes('food') || type?.includes('order')) return <UtensilsCrossed size={13} className="text-orange-400" />;
    return <Calendar size={13} className="text-blue-400" />;
  };

  const timeAgo = (ts) => {
    if (!ts?.seconds) return '';
    const diff = Date.now() / 1000 - ts.seconds;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 hover:bg-white/5 rounded-lg transition-colors"
      >
        <Bell size={18} className={unread > 0 ? 'text-[#D4A95F]' : 'text-white/20'} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-12 w-80 bg-[#05071A] border border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden"
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/5">
              <span className="text-[10px] uppercase tracking-widest font-black text-white/60">Admin Notifications</span>
              <div className="flex items-center gap-2">
                {unread > 0 && (
                  <button onClick={markAllRead} className="text-[9px] text-[#D4A95F] hover:underline font-bold">Clear</button>
                )}
                <button onClick={() => setOpen(false)} className="text-white/20 hover:text-white">
                  <X size={13} />
                </button>
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-white/20 text-xs">
                  <Bell size={22} className="mx-auto mb-3 opacity-30" />
                  No notifications
                </div>
              ) : (
                notifications.slice(0, 20).map(n => (
                  <button
                    key={n.id}
                    onClick={() => markRead(n)}
                    className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-white/5 transition-colors border-b border-white/5 ${!n.read ? 'bg-[#D4A95F]/5' : ''}`}
                  >
                    <div className="mt-0.5 flex-shrink-0">{getIcon(n.type)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white/80 leading-snug line-clamp-2">{n.message}</p>
                      <p className="text-[9px] text-white/30 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                    {!n.read && (
                      <div className="w-2 h-2 rounded-full bg-[#D4A95F] mt-1.5 flex-shrink-0" />
                    )}
                  </button>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminNotificationBell;
