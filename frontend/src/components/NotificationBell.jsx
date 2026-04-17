import React, { useState, useEffect, useRef } from 'react';
import { Bell, Calendar, UtensilsCrossed, X, CheckCircle2 } from 'lucide-react';
import { db } from '../lib/firebase';
import {
  collection, query, where, onSnapshot, updateDoc, doc, orderBy
} from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const NotificationBell = ({ userId }) => {
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const ref = useRef(null);

  useEffect(() => {
    if (!userId) return;
    const q = query(
      collection(db, 'notifications'),
      where('user_id', '==', userId),
      orderBy('created_at', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setNotifications(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [userId]);

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
    if (n.booking_id) navigate(`/receipt/${n.booking_id}`);
    else if (n.order_id) navigate('/my-bookings?tab=orders');
    else navigate('/my-bookings');
  };

  const markAllRead = async () => {
    const unreadItems = notifications.filter(n => !n.read);
    await Promise.all(unreadItems.map(n => updateDoc(doc(db, 'notifications', n.id), { read: true })));
  };

  const getIcon = (type) => {
    if (type?.includes('food') || type?.includes('order')) return <UtensilsCrossed size={14} className="text-orange-400" />;
    return <Calendar size={14} className="text-blue-400" />;
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
        className="relative p-2 hover:bg-white/5 rounded-xl transition-colors group"
        aria-label="Notifications"
      >
        <Bell size={20} className={unread > 0 ? 'text-[#D4A95F] animate-pulse' : 'text-white/40 group-hover:text-white'} />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-black w-4 h-4 rounded-full flex items-center justify-center shadow-lg">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(false)} className="sm:hidden fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, x: 10, y: 0 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, x: 10, y: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed top-0 right-0 h-[100dvh] w-[300px] sm:w-80 sm:absolute sm:top-14 sm:right-0 sm:bottom-auto sm:h-auto sm:max-h-[80px] sm:max-h-[400px] bg-[#0a1128] border-l sm:border border-white/10 sm:rounded-2xl shadow-2xl z-[70] flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-white/5">
                <span className="text-[10px] uppercase tracking-widest font-black text-white/60">Notifications</span>
                <div className="flex items-center gap-3">
                  {unread > 0 && (
                    <button onClick={markAllRead} className="text-[9px] text-[#D4A95F] hover:underline font-bold uppercase tracking-widest p-1">
                      Mark all read
                    </button>
                  )}
                  <button onClick={() => setOpen(false)} className="text-white/40 hover:text-white transition-colors p-1 rounded-lg">
                    <X size={18} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto w-full scrollbar-hide sm:max-h-[350px]">
                {notifications.length === 0 ? (
                  <div className="p-10 text-center text-white/20 text-xs">
                    <Bell size={28} className="mx-auto mb-4 opacity-30" />
                    No notifications yet
                  </div>
                ) : (
                  notifications.slice(0, 15).map(n => (
                    <button
                      key={n.id}
                      onClick={() => markRead(n)}
                      className={`w-full text-left px-5 py-4 min-h-[56px] flex items-start gap-4 hover:bg-white/5 transition-colors border-b border-white/5 ${!n.read ? 'bg-[#D4A95F]/5' : ''}`}
                    >
                      <div className="mt-0.5 flex-shrink-0">
                        {getIcon(n.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm sm:text-xs text-white/80 leading-snug line-clamp-3">{n.message}</p>
                        <p className="text-[10px] sm:text-[9px] text-white/30 mt-1.5">{timeAgo(n.created_at)}</p>
                      </div>
                      {!n.read && (
                        <div className="w-2 h-2 rounded-full bg-[#D4A95F] mt-2 flex-shrink-0 shadow-[0_0_6px_rgba(212,169,95,0.8)]" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationBell;

