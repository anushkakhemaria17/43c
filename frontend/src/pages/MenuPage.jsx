import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { db } from '../lib/firebase';
import { collection, getDocs, addDoc, serverTimestamp, query, where, onSnapshot } from 'firebase/firestore';
import { Coffee, UtensilsCrossed, Plus, Minus, ShoppingBag, CheckCircle2, Star, Clock, MessageCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getWhatsAppNumber } from '../utils/settings';

const MenuPage = () => {
  const { customer } = useAuth();
  const [menuItems, setMenuItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCat, setSelectedCat] = useState('All');
  const [cart, setCart] = useState({});
  const [isMember, setIsMember] = useState(false);
  const [loading, setLoading] = useState(true);

  const [showCart, setShowCart] = useState(false);
  const [orders, setOrders] = useState([]);

  // Order placed confirmation modal
  const [placedOrder, setPlacedOrder] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    fetchMenu();
    if (customer) {
      checkMembership();
      const q = query(collection(db, 'food_orders'), where('customer_id', '==', customer.id));
      const unsub = onSnapshot(q, (snap) => {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => {
          return (b.created_at?.seconds || 0) - (a.created_at?.seconds || 0);
        });
        setOrders(list);
      });
      return () => unsub();
    } else {
      setLoading(false);
    }
  }, [customer]);

  const checkMembership = async () => {
    try {
      const q = query(collection(db, 'memberships'), where('customer_id', '==', customer.id), where('status', '==', 'active'));
      const snap = await getDocs(q);
      setIsMember(!snap.empty);
    } catch (err) { console.error(err); }
  };

  const fetchMenu = async () => {
    try {
      const snap = await getDocs(collection(db, 'menu_items'));
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMenuItems(items);
      setCategories(['All', ...new Set(items.map(i => i.category))]);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const addToCart = (item) => {
    setCart(prev => ({ ...prev, [item.id]: { ...item, qty: (prev[item.id]?.qty || 0) + 1 } }));
  };

  const removeFromCart = (itemId) => {
    setCart(prev => {
      const n = { ...prev };
      if (!n[itemId]) return n;
      n[itemId] = { ...n[itemId], qty: n[itemId].qty - 1 };
      if (n[itemId].qty <= 0) delete n[itemId];
      return n;
    });
  };

  const getCartTotal = () =>
    Object.values(cart).reduce((sum, item) => {
      const price = isMember ? item.member_price : item.non_member_price;
      return sum + price * item.qty;
    }, 0);

  const getCartItemCount = () =>
    Object.values(cart).reduce((sum, item) => sum + item.qty, 0);

  const placeOrder = async () => {
    if (!customer) return alert('Log in to place orders');
    setLoading(true);
    try {
      const itemsToOrder = Object.values(cart).map(i => ({
        id: i.id,
        name: i.name,
        qty: i.qty,
        price: isMember ? i.member_price : i.non_member_price,
      }));
      const total = getCartTotal();
      const totalQty = itemsToOrder.reduce((s, i) => s + i.qty, 0);

      const docRef = await addDoc(collection(db, 'food_orders'), {
        customer_id: customer.id,
        customer_name: customer.name,
        customer_mobile: customer.mobile_number || '',
        items: itemsToOrder,
        original_price: total,
        final_price: total,
        total,
        status: 'pending',
        created_at: serverTimestamp(),
      });

      const placed = { id: docRef.id, items: itemsToOrder, total, totalQty };
      setPlacedOrder(placed);
      setCart({});
      setShowCart(false);
      setShowConfirm(true);

      // WhatsApp to admin with food items list
      const waNumber = await getWhatsAppNumber();
      const itemsList = itemsToOrder.map(i => `- ${i.name} (x${i.qty})`).join('\n');
      const msg = `I want to place a food order with the following items:\n${itemsList}`;
      window.open(`https://wa.me/${waNumber}?text=${encodeURIComponent(msg)}`, '_blank');
    } catch (err) {
      alert('Failed: ' + err.message);
    } finally { setLoading(false); }
  };

  if (!customer) return (
    <div className="min-h-screen flex flex-col items-center justify-center pt-24 space-y-6">
      <Coffee className="w-16 h-16 text-white/20" />
      <h2 className="text-3xl font-heading text-white/50">Exclusive Member Menu</h2>
      <p className="text-white/30 text-[10px] uppercase tracking-widest text-center max-w-sm">Please log in to access the menu.</p>
      <button onClick={() => window.location.href='/book'} className="gold-button mt-4">Login / Reserve</button>
    </div>
  );

  const filteredMenu = selectedCat === 'All' ? menuItems : menuItems.filter(i => i.category === selectedCat);

  return (
    <div className="pt-32 pb-32 px-4 max-w-5xl mx-auto min-h-screen relative">

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
        <div>
          <h1 className="text-5xl font-heading mb-2">Culinary <span className="gold-text-gradient italic">Collection</span></h1>
          <p className="text-white/30 text-xs uppercase tracking-widest flex items-center gap-2"><UtensilsCrossed size={14}/> Handcrafted for you</p>
        </div>
        {isMember && (
          <span className="px-5 py-2 glass-card !border-accent/40 text-[10px] uppercase font-black text-accent tracking-widest flex items-center gap-2">
            <Star size={12}/> Member Rates Active
          </span>
        )}
      </div>

      {/* Active Orders */}
      {orders.filter(o => o.status === 'pending' || o.status === 'confirmed').length > 0 && (
        <div className="mb-10 space-y-3">
          <h3 className="text-[10px] uppercase tracking-widest font-black text-white/40">Active Orders</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {orders.filter(o => o.status === 'pending' || o.status === 'confirmed').map(o => (
              <div key={o.id} className={`glass-card p-5 flex justify-between items-center border ${o.status === 'confirmed' ? 'border-green-500/30 bg-green-500/5' : 'border-accent/20 bg-accent/5'}`}>
                <div>
                  <p className="font-heading text-base">Order #{o.id.slice(0,6)}</p>
                  <p className={`text-[10px] mt-1 uppercase tracking-widest flex items-center gap-1.5 ${o.status === 'confirmed' ? 'text-green-400' : 'text-accent'}`}>
                    <Clock size={12}/>
                    {o.status === 'confirmed' ? 'Confirmed — Preparing' : 'Pending Confirmation'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-white/40 mb-1">{(o.items || []).reduce((a, i) => a + i.qty, 0)} items</p>
                  <p className="font-bold text-sm">₹{o.final_price || o.total}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Served Orders */}
      {orders.filter(o => o.status === 'served').length > 0 && (
        <div className="mb-10 space-y-3">
          <h3 className="text-[10px] uppercase tracking-widest font-black text-white/40">Completed Orders</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {orders.filter(o => o.status === 'served').map(o => (
              <div key={o.id} className="glass-card p-5 flex justify-between items-center border border-white/5">
                <div>
                  <p className="font-heading text-base">Order #{o.id.slice(0,6)}</p>
                  <p className="text-[10px] text-green-400 mt-1 uppercase tracking-widest flex items-center gap-1.5"><CheckCircle2 size={12}/> Served</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-white/40 mb-1">{(o.items || []).reduce((a, i) => a + i.qty, 0)} items</p>
                  <p className="font-bold text-sm">₹{o.final_price || o.total}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category Tabs */}
      <div className="flex gap-3 overflow-x-auto pb-6 mb-8">
        {categories.map(c => (
          <button key={c} onClick={() => setSelectedCat(c)}
            className={`px-6 py-3 rounded-xl border whitespace-nowrap text-xs font-bold transition-all ${selectedCat === c ? 'bg-accent border-accent text-primary' : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:border-white/30'}`}
          >{c}</button>
        ))}
      </div>

      {/* Menu Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredMenu.map(item => {
            const price = isMember ? item.member_price : item.non_member_price;
            const inCart = cart[item.id]?.qty || 0;
            return (
              <motion.div key={item.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card overflow-hidden group hover:border-accent/40 transition-colors">
                <div className="aspect-video bg-white/5 relative overflow-hidden flex items-center justify-center">
                  {item.image_url
                    ? <img src={item.image_url} alt={item.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                    : <UtensilsCrossed size={40} className="text-white/10" />
                  }
                  <div className="absolute top-4 right-4 px-3 py-1 bg-black/60 backdrop-blur-md rounded-full text-[9px] uppercase tracking-widest font-black text-white/80 border border-white/10">
                    {item.category}
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-heading mb-4 leading-tight min-h-[50px]">{item.name}</h3>
                  <div className="flex justify-between items-end border-t border-white/10 pt-4">
                    <div>
                      <p className="text-[9px] uppercase tracking-widest text-white/30 font-black mb-1">Price</p>
                      <p className={`text-xl font-bold font-heading ${isMember ? 'gold-text-gradient' : 'text-white'}`}>₹{price}</p>
                    </div>
                    {inCart > 0 ? (
                      <div className="flex items-center gap-3 bg-white/10 rounded-xl p-1 border border-white/20">
                        <button onClick={() => removeFromCart(item.id)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-black/20 text-white hover:bg-black/40"><Minus size={14}/></button>
                        <span className="w-6 text-center font-bold text-sm">{inCart}</span>
                        <button onClick={() => addToCart(item)} className="w-8 h-8 flex items-center justify-center rounded-lg bg-accent text-primary hover:bg-accent/80"><Plus size={14}/></button>
                      </div>
                    ) : (
                      <button onClick={() => addToCart(item)} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 border border-white/10 hover:bg-accent hover:border-accent text-white hover:text-primary transition-all">
                        <Plus size={18}/>
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Floating Cart Button */}
      <AnimatePresence>
        {getCartItemCount() > 0 && !showCart && (
          <motion.div initial={{ y: 100 }} animate={{ y: 0 }} exit={{ y: 100 }} className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 w-full max-w-sm px-4">
            <button onClick={() => setShowCart(true)} className="w-full bg-accent text-primary p-4 rounded-2xl flex justify-between items-center shadow-[0_0_40px_rgba(212,169,95,0.3)] font-black uppercase tracking-widest text-[10px]">
              <div className="flex items-center gap-3">
                <div className="bg-primary text-accent w-8 h-8 rounded-full flex items-center justify-center text-sm">{getCartItemCount()}</div>
                View Cart
              </div>
              <span className="text-sm font-heading">₹{getCartTotal()}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cart Drawer */}
      <AnimatePresence>
        {showCart && (
          <div className="fixed inset-0 z-50 flex justify-end">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCart(false)} className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 25 }} className="w-full max-w-md bg-[#05071A] border-l border-white/10 relative z-10 flex flex-col h-full shadow-2xl">
              <div className="p-8 border-b border-white/10 flex justify-between items-center bg-[#0B0F3A]">
                <h2 className="text-2xl font-heading flex items-center gap-3"><ShoppingBag size={20} className="text-accent"/> Your Tray</h2>
                <button onClick={() => setShowCart(false)} className="text-white/40 hover:text-white transition-colors"><X size={24}/></button>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-6">
                {Object.values(cart).length === 0
                  ? <div className="text-center text-white/30 italic py-20 flex flex-col items-center gap-4"><UtensilsCrossed size={48} className="opacity-20"/>Tray is empty</div>
                  : Object.values(cart).map(item => (
                    <div key={item.id} className="flex justify-between items-center border-b border-white/5 pb-6">
                      <div className="flex-1">
                        <h4 className="font-bold text-sm mb-1">{item.name}</h4>
                        <p className="text-[10px] text-accent">₹{isMember ? item.member_price : item.non_member_price} each</p>
                      </div>
                      <div className="flex items-center gap-3 bg-white/5 rounded-lg p-1 border border-white/10">
                        <button onClick={() => removeFromCart(item.id)} className="w-8 h-8 flex items-center justify-center text-white/60 hover:text-white"><Minus size={14}/></button>
                        <span className="w-4 text-center font-bold text-sm">{item.qty}</span>
                        <button onClick={() => addToCart(item)} className="w-8 h-8 flex items-center justify-center text-white/60 hover:text-accent"><Plus size={14}/></button>
                      </div>
                    </div>
                  ))
                }
              </div>

              {Object.values(cart).length > 0 && (
                <div className="p-8 border-t border-white/10 bg-[#0B0F3A] space-y-5">
                  <div className="flex justify-between items-center text-lg">
                    <span className="font-light">Subtotal</span>
                    <span className="font-heading font-bold gold-text-gradient">₹{getCartTotal()}</span>
                  </div>
                  <button onClick={placeOrder} disabled={loading} className="gold-button w-full !rounded-2xl flex justify-center items-center gap-2 !py-5">
                    {loading
                      ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-5 h-5 border-2 border-[#0B0F3A] border-t-transparent rounded-full"/>
                      : <><MessageCircle size={16}/> Place Order & Send on WhatsApp</>
                    }
                  </button>
                  <p className="text-center text-[9px] uppercase tracking-widest text-white/20">WhatsApp will open to send order to admin</p>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Order Placed Confirmation Modal */}
      <AnimatePresence>
        {showConfirm && placedOrder && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowConfirm(false)} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="glass-card !bg-[#05071A] p-10 max-w-md w-full relative z-10 border-accent/30 space-y-6">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(212,169,95,0.4)]">
                  <CheckCircle2 size={32} className="text-primary" />
                </div>
                <h2 className="text-2xl font-heading gold-text-gradient font-black">Order Placed!</h2>
                <p className="text-white/40 text-[10px] uppercase tracking-widest">Pending admin confirmation</p>
              </div>

              <div className="bg-white/5 rounded-2xl p-5 space-y-3 border border-white/10">
                <p className="text-[9px] uppercase tracking-widest text-accent/70 font-black">Order Items</p>
                {placedOrder.items.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-white/70">{item.qty}× {item.name}</span>
                    <span className="text-white/40">₹{item.price * item.qty}</span>
                  </div>
                ))}
                <div className="border-t border-white/10 pt-3 flex justify-between items-center">
                  <span className="text-[10px] uppercase tracking-widest text-white/40 font-black">Total</span>
                  <span className="text-lg font-heading gold-text-gradient font-black">₹{placedOrder.total}</span>
                </div>
              </div>

              <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4">
                <p className="text-[9px] uppercase tracking-widest text-green-400/80 font-black mb-1">WhatsApp Opened</p>
                <p className="text-xs text-white/50">Send the prefilled message to admin. They will confirm your order and prepare it.</p>
              </div>

              <div className="flex gap-3">
                <button onClick={() => setShowConfirm(false)} className="flex-1 gold-button !py-3 !text-[10px]">Continue</button>
                <button onClick={() => window.location.href = '/my-bookings'} className="flex-1 glass-card border-white/10 !py-3 text-[10px] uppercase tracking-widest font-black hover:bg-white/5 transition-colors text-center">My Orders</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MenuPage;
