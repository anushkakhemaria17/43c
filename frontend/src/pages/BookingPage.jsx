import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useLocation } from 'react-router-dom';
import { db } from '../lib/firebase';
import { collection, getDocs, addDoc, query, where, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { Calendar, Clock, Users, CheckCircle2, MessageCircle, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  SLOT_HOURS, getSlotLabel, getAvailableDates, getSlotStatusMap, formatSlotsDisplay, getTodayStr
} from '../utils/slots';
import { getWhatsAppNumber } from '../utils/settings';
import { createNotification } from '../utils/firebaseHelpers';
import { openWhatsApp } from '../utils/whatsapp';

const SCREEN_MAP = {
  'Screen 1': 'Mini Lounge',
  'Screen 2': 'Studio Lounge',
  'TV Screen': 'Grand Lounge'
};

const BookingPage = () => {
  const { customer, checkMobile, login, register } = useAuth();
  const location = useLocation();

  // Auth flow: 'mobile' | 'register' | 'done'
  const [authMode, setAuthMode] = useState('mobile');
  const [mobile, setMobile] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1=auth, 2=slots, 3=confirmed

  // Booking state
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [selectedScreen, setSelectedScreen] = useState('Screen 1');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [screens, setScreens] = useState(['Screen 1', 'Screen 2', 'TV Screen']);
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [slotStatus, setSlotStatus] = useState({});
  const [guestCount, setGuestCount] = useState(2);
  const [pricingMap, setPricingMap] = useState({});
  const [membershipType, setMembershipType] = useState('non_member');
  const isMember = membershipType !== 'non_member';
  const availableDates = getAvailableDates();

  // Confirmed booking info
  const [confirmedBooking, setConfirmedBooking] = useState(null);

  // Coupon state
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');

  // Combo state
  const [combos, setCombos] = useState([]);
  const [selectedCombo, setSelectedCombo] = useState(null);

  // Membership Credit State
  const [useCredits, setUseCredits] = useState(false);
  const [activeMembership, setActiveMembership] = useState(null);

  useEffect(() => {
    fetchCombos();
  }, []);

  useEffect(() => {
    if (customer) {
      setStep(2);
      checkMembership();
    }
  }, [customer]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const comboId = params.get('comboId');
    if (comboId && combos.length > 0) {
      const found = combos.find(c => c.id === comboId);
      if (found) {
        setSelectedCombo(found);
        if (found.screen_type !== 'All') {
          setSelectedScreen(found.screen_type);
        }
        setGuestCount(found.max_guests || 2);
      }
    }
  }, [combos, location.search]);

  useEffect(() => {
    if (step === 2) {
      fetchPricing().then(pm => fetchSlotAvailability(pm));
    }
  }, [step, selectedDate, selectedScreen]);

  const fetchCombos = async () => {
    try {
      const q = query(collection(db, 'combos'), where('is_active', '==', true));
      const snap = await getDocs(q);
      setCombos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) { console.error(err); }
  };

  const checkMembership = async () => {
    if (!customer) return;
    try {
      const q = query(
        collection(db, 'customer_memberships'),
        where('customer_id', '==', customer.id),
        where('status', '==', 'active')
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const mData = { id: snap.docs[0].id, ...snap.docs[0].data() };
        // Check expiry here as well to be safe
        if (new Date(mData.expiry_date) > new Date()) {
           setActiveMembership(mData);
           setMembershipType(mData.membership_type || 'silver');
        }
      }
    } catch (err) { console.error(err); }
  };

  const fetchPricing = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'screens'), where('is_active', '==', true)));
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (list.length > 0) {
          const names = list.map(s => s.name);
          setScreens(names);
          if (!names.includes(selectedScreen)) setSelectedScreen(names[0]);
          
          const pMap = {};
          list.forEach(s => {
            pMap[s.name] = { 
                ...(s.pricing || {}), 
                type: s.type, 
                max_guests: s.capacity,
                legacy_link: s.legacy_link || 'None'
            };
          });
          setPricingMap(pMap);
          return pMap;
      }
    } catch (err) { console.error(err); }
    return {};
  };

  const fetchSlotAvailability = async (currentPricingMap) => {
    setLoading(true);
    try {
      const bookingsQ = query(collection(db, 'bookings'), where('booking_date', '==', selectedDate));
      const bookingsSnap = await getDocs(bookingsQ);
      const bookings = bookingsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const closedQ = query(collection(db, 'closed_slots'), where('date', '==', selectedDate));
      const closedSnap = await getDocs(closedQ);
      const closedSlots = closedSnap.docs.map(d => d.data());

      setSlotStatus(getSlotStatusMap(selectedDate, bookings, closedSlots, selectedScreen, currentPricingMap[selectedScreen] || {}));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const toggleSlot = (hour) => {
    if (slotStatus[hour] !== 'available') return;
    
    if (selectedCombo) {
      const numSlots = Number(selectedCombo.number_of_slots || 1);
      
      if (selectedSlots.includes(hour)) {
        setSelectedSlots([]);
        return;
      }

      const requested = [];
      for (let i = 0; i < numSlots; i++) {
        const h = hour + i;
        if (h > 22 || slotStatus[h] !== 'available') {
          if (numSlots > 1) {
            alert(`This combo requires ${numSlots} consecutive slots. Some slots in this range are unavailable.`);
          }
          return;
        }
        requested.push(h);
      }
      
      if (useCredits && activeMembership) {
        const screenKey = { 'Screen 1': 'Mini Lounge', 'Screen 2': 'Studio Lounge', 'TV Screen': 'Grand Lounge' }[selectedScreen];
        const avail = activeMembership.credit_type === 'any' ? (activeMembership.credits_remaining?.total_hours || 0) : (activeMembership.credits_remaining?.per_screen?.[screenKey] || 0);
        if (requested.length > avail) {
            alert(`You only have ${avail} credits for this screen. Please select fewer slots or disable "Use Credits".`);
            return;
        }
      }
      setSelectedSlots(requested);
    } else {
      if (useCredits && activeMembership && !selectedSlots.includes(hour)) {
        const screenKey = { 'Screen 1': 'Mini Lounge', 'Screen 2': 'Studio Lounge', 'TV Screen': 'Grand Lounge' }[selectedScreen];
        const avail = activeMembership.credit_type === 'any' ? (activeMembership.credits_remaining?.total_hours || 0) : (activeMembership.credits_remaining?.per_screen?.[screenKey] || 0);
        if (selectedSlots.length + 1 > avail) {
            alert(`You only have ${avail} credits for this screen.`);
            return;
        }
      }
      setSelectedSlots(prev =>
        prev.includes(hour) ? prev.filter(h => h !== hour) : [...prev, hour]
      );
    }
  };

  const handleMobileSubmit = async (e) => {
    e.preventDefault();
    if (mobile.length < 10) return alert('Enter a valid 10-digit mobile number.');
    setLoading(true);
    try {
      const { exists, name: existingName } = await checkMobile(mobile);
      if (exists) {
        await login(mobile);
      } else {
        setName('');
        setAuthMode('register');
      }
    } catch (err) {
      alert('Error: ' + (err.message || err));
    } finally { setLoading(false); }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!name.trim()) return alert('Please enter your name.');
    setLoading(true);
    try {
      await register({ name: name.trim(), mobile });
    } catch (err) {
      alert('Registration failed: ' + (err.message || err));
    } finally { setLoading(false); }
  };

  const handleApplyCoupon = async () => {
    setCouponError('');
    if (!couponCode.trim()) return;
    try {
      const q = query(collection(db, 'coupons'), where('code', '==', couponCode.toUpperCase()));
      const snap = await getDocs(q);
      if (snap.empty) {
        setCouponError('Invalid coupon code');
        return;
      }
      const c = snap.docs[0].data();
      c.id = snap.docs[0].id;

      if (!c.active) return setCouponError('Coupon is inactive');
      if (c.applies_to !== 'both' && c.applies_to !== 'booking') return setCouponError('Coupon not valid for bookings');
      
      if (c.max_usage > 0 && (c.used_count || 0) >= c.max_usage) return setCouponError('Coupon total usage limit reached');
      
      if (c.expiry_date) {
        const expDate = new Date(c.expiry_date);
        const today = new Date();
        today.setHours(0,0,0,0);
        if (expDate < today) return setCouponError('Coupon has expired');
      }

      if (c.type === 'free_hour' && selectedSlots.length === 0) return setCouponError('Select slots first');

      if (c.usage_per_user > 0) {
        const bQ = query(collection(db, 'bookings'), where('customer_id', '==', customer.id), where('coupon_applied', '==', couponCode.toUpperCase()));
        const bSnap = await getDocs(bQ);
        if (bSnap.size >= c.usage_per_user) return setCouponError('You have already used this coupon maximum times');
      }
      
      setAppliedCoupon(c);
      setCouponError('');
    } catch (e) {
      setCouponError('Error applying coupon');
    }
  };

  const handleBooking = async () => {
    if (selectedSlots.length === 0) return alert('Please select at least one slot.');
    if (!termsAccepted) return alert('You must agree to the Terms & Conditions to proceed.');
    setLoading(true);
    try {
      const currentScreenPricing = pricingMap[selectedScreen] || Object.values(pricingMap)[0] || { gold: 299, silver: 399, non_member: 499, type: 'private', pricing_type: 'group' };
      const slotPrice = currentScreenPricing[membershipType] || currentScreenPricing.non_member || 499;
      const includedSlots = selectedCombo ? Number(selectedCombo.number_of_slots || 0) : 0;
      const extraSlots = Math.max(0, selectedSlots.length - includedSlots);
      let baseOriginal = slotPrice * extraSlots;
      
      if (currentScreenPricing.pricing_type === 'per_person') {
        baseOriginal = baseOriginal * guestCount;
      }
      const comboOriginal = selectedCombo ? Number(selectedCombo.price) : 0;
      const totalOriginal = baseOriginal + comboOriginal;

      let discountAmount = 0;
      if (appliedCoupon) {
        if (appliedCoupon.type === 'free_hour') {
          discountAmount = (currentScreenPricing.pricing_type === 'per_person') ? (slotPrice * guestCount) : slotPrice;
        } else if (appliedCoupon.type === 'percentage') {
          discountAmount = baseOriginal * Number(appliedCoupon.value) / 100;
        } else if (appliedCoupon.type === 'amount') {
          discountAmount = Number(appliedCoupon.value);
        }
      }
      let finalPrice = useCredits ? 0 : Math.round(Math.max(0, totalOriginal - discountAmount));

      const slotDisplay = formatSlotsDisplay(selectedSlots);
      const dateObj = new Date(selectedDate + 'T00:00:00');
      const dateFormatted = dateObj.toLocaleDateString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
      });

      const bookingRef = await addDoc(collection(db, 'bookings'), {
        customer_id: customer.id,
        customer_name: customer.name,
        customer_mobile: customer.mobile_number,
        booking_date: selectedDate,
        screen: selectedScreen,
        slots: selectedSlots,
        guest_count: guestCount,
        combo_applied: selectedCombo ? { id: selectedCombo.id, name: selectedCombo.name, price: selectedCombo.price } : null,
        original_price: totalOriginal,
        final_price: finalPrice,
        price: finalPrice,
        coupon_applied: appliedCoupon ? appliedCoupon.code : null,
        discount_amount: discountAmount,
        is_member: isMember,
        status: 'pending',
        is_credit_booking: useCredits,
        terms_accepted: termsAccepted,
        created_at: serverTimestamp(),
      });

      // 🆕 Deduct Credits if used
      if (useCredits && activeMembership) {
        const count = selectedSlots.length;
        const legacyName = SCREEN_MAP[selectedScreen];
        
        if (activeMembership.credit_type === 'any') {
           const current = activeMembership.credits_remaining?.total_hours || 0;
           await updateDoc(doc(db, 'customer_memberships', activeMembership.id), {
             'credits_remaining.total_hours': Math.max(0, current - count)
           });
        } else {
           // Try dynamic name first, then legacy
           let screenKey = selectedScreen;
           let current = activeMembership.credits_remaining?.per_screen?.[selectedScreen];
           
           if ((current === undefined || current === null) && legacyName) {
             screenKey = legacyName;
             current = activeMembership.credits_remaining?.per_screen?.[legacyName];
           }
           
           current = current || 0;
           await updateDoc(doc(db, 'customer_memberships', activeMembership.id), {
             [`credits_remaining.per_screen.${screenKey}`]: Math.max(0, current - count)
           });
        }
      }

      if (appliedCoupon) {
        import('firebase/firestore').then(({ updateDoc, doc, increment }) => {
          updateDoc(doc(db, 'coupons', appliedCoupon.id), { used_count: increment(1) });
        });
      }

      await addDoc(collection(db, 'payments'), {
        booking_id: bookingRef.id,
        amount: finalPrice,
        status: 'pending',
        created_at: serverTimestamp(),
      });

      // Notify customer
      await createNotification({
        userId: customer.id,
        type: 'booking_submitted',
        message: `Your booking request for ${selectedDate} (${selectedScreen}) has been submitted! Admin will confirm shortly. Total: ₹${finalPrice}`,
        bookingId: bookingRef.id,
      });

      // Notify admin
      await createNotification({
        userId: null,
        type: 'new_booking',
        message: `🆕 New booking from ${customer.name} (${customer.mobile_number}) on ${selectedDate} · ${selectedScreen} · ₹${finalPrice}`,
        bookingId: bookingRef.id,
        notifyAdmin: true,
        adminMessage: `🆕 New Booking: ${customer.name} · ${selectedDate} · ₹${finalPrice}`,
      });

      setConfirmedBooking({
        id: bookingRef.id,
        date: dateFormatted,
        rawDate: selectedDate,
        slots: selectedSlots,
        slotDisplay,
        guests: guestCount,
        price: finalPrice,
        comboName: selectedCombo ? selectedCombo.name : null,
        comboPrice: selectedCombo ? selectedCombo.price : 0,
        extraSlotsInfo: (selectedSlots.length > (selectedCombo?.number_of_slots || 0)) 
          ? [...selectedSlots].sort((a,b)=>a-b).slice((selectedCombo?.number_of_slots || 0)).map(h => ({
              label: getSlotLabel(h).split(' - ')[0],
              price: (currentScreenPricing.pricing_type === 'per_person' ? (slotPrice * guestCount) : slotPrice)
            }))
          : []
      });

      setStep(3);

      // Prefill WhatsApp message as if written by the Customer
      const waNumber = await getWhatsAppNumber();
      const slotsText = [...selectedSlots].sort((a, b) => a - b).map(h => getSlotLabel(h)).join(', ');
      const comboText = selectedCombo ? `\n* Combo Package: ${selectedCombo.name}` : '';
      const couponText = appliedCoupon ? `\n* Coupon Applied: ${appliedCoupon.code} (-₹${Math.round(discountAmount)})` : '';
      
      const msg = `Hi 43C! I'd like to request a reservation:
      
* Screen: ${selectedScreen}
* Date: ${selectedDate}
* Time Slots: ${slotsText}
* Number of Guests: ${guestCount}${comboText}${couponText}
* Total Payable: ₹${finalPrice}

Please let me know how I can confirm this booking. Thanks!`;

      openWhatsApp(waNumber, msg);
    } catch (err) {
      console.error(err);
      alert('Booking failed: ' + err.message);
    } finally { setLoading(false); }
  };

  const handleResendWhatsApp = async () => {
    if (!confirmedBooking) return;
    const waNumber = await getWhatsAppNumber();
    const comboText = selectedCombo ? `\n* Combo Package: ${selectedCombo.name}` : '';
    const couponText = appliedCoupon ? `\n* Coupon Applied: ${appliedCoupon.code}` : '';
    
    const msg = `Hi 43C! I'd like to request a reservation:

* Screen: ${selectedScreen}
* Date: ${confirmedBooking.rawDate}
* Time Slots: ${confirmedBooking.slotDisplay}
* Number of Guests: ${confirmedBooking.guests}${comboText}${couponText}
* Total Payable: ₹${confirmedBooking.price}

Please let me know how I can confirm this booking. Thanks!`;

    openWhatsApp(waNumber, msg);
  };

  const currentScreenPricing = pricingMap[selectedScreen] || Object.values(pricingMap)[0] || { gold: 299, silver: 399, non_member: 499, type: 'private', pricing_type: 'group' };
  const slotPrice = currentScreenPricing[membershipType] || currentScreenPricing.non_member || 499;
  
  const includedSlotsDisp = selectedCombo ? Number(selectedCombo.number_of_slots || 0) : 0;
  const extraSlotsDisp = Math.max(0, selectedSlots.length - includedSlotsDisp);
  let baseBookingPrice = slotPrice * extraSlotsDisp;
  
  if (currentScreenPricing.pricing_type === 'per_person') {
    baseBookingPrice = baseBookingPrice * guestCount;
  }
  
  const comboPrice = selectedCombo ? Number(selectedCombo.price) : 0;
  const totalOriginal = baseBookingPrice + comboPrice;

  let discountAmountDisp = 0;
  if (appliedCoupon) {
    if (appliedCoupon.type === 'free_hour') {
      discountAmountDisp = (currentScreenPricing.pricing_type === 'per_person') ? (slotPrice * guestCount) : slotPrice;
    } else if (appliedCoupon.type === 'percentage') {
      // RULE: Coupons apply to baseBookingPrice only, NOT combos
      discountAmountDisp = baseBookingPrice * Number(appliedCoupon.value) / 100;
    } else if (appliedCoupon.type === 'amount') {
      discountAmountDisp = Number(appliedCoupon.value);
    }
  }

  const finalPriceDisplay = Math.max(0, totalOriginal - discountAmountDisp);

  return (
    <div className="pt-28 pb-20 px-4 max-w-4xl mx-auto min-h-screen">

      {/* Progress Steps */}
      <div className="flex justify-between mb-12 relative">
        <div className="absolute top-1/2 left-0 w-full h-[1px] bg-white/10 -z-10" />
        {['Login', 'Select Slot', 'Done'].map((label, i) => {
          const s = i + 1;
          return (
            <div key={s} className="flex flex-col items-center gap-2 bg-[#0a1128] px-4">
              <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${step >= s ? 'border-accent bg-accent text-primary' : 'border-white/20 text-white/40'}`}>
                {step > s ? <CheckCircle2 size={20} /> : <span className="font-heading">{s}</span>}
              </div>
              <span className="text-[9px] uppercase tracking-widest text-white/30">{label}</span>
            </div>
          );
        })}
      </div>

      <AnimatePresence mode="wait">

        {/* ─── STEP 1: Auth ─── */}
        {step === 1 && (
          <motion.div key="step1" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} className="max-w-md mx-auto">
            <div className="glass-card p-10">

              {/* Mobile check */}
              {authMode === 'mobile' && (
                <form onSubmit={handleMobileSubmit} className="space-y-8">
                  <div className="text-center space-y-2">
                    <h2 className="text-3xl font-heading gold-text-gradient font-black">Welcome Back</h2>
                    <p className="text-[10px] uppercase tracking-widest text-white/40">Enter your number to continue</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] uppercase tracking-widest text-white/40 font-black">Mobile Number</label>
                    <div className="relative">
                      <span className="absolute left-6 top-1/2 -translate-y-1/2 text-white/20 font-black text-xl">+91</span>
                      <input
                        type="tel"
                        placeholder="98765-43210"
                        className="w-full bg-white/5 border border-white/10 p-5 pl-20 rounded-2xl focus:border-accent outline-none text-xl tracking-widest"
                        required
                        maxLength={10}
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                      />
                    </div>
                  </div>
                  <button type="submit" disabled={loading} className="gold-button w-full py-5 uppercase tracking-widest text-xs font-black">
                    {loading ? 'Checking...' : 'Continue'}
                  </button>
                </form>
              )}

              {/* New user — enter name */}
              {authMode === 'register' && (
                <form onSubmit={handleRegister} className="space-y-8">
                  <div className="text-center space-y-2">
                    <h2 className="text-2xl font-heading">Join the <span className="gold-text-gradient">43C Circle</span></h2>
                    <p className="text-[10px] uppercase tracking-widest text-white/40">New account for +91 {mobile}</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] uppercase tracking-widest text-white/40 font-black">Your Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="Enter your full name"
                      className="w-full bg-white/5 border border-white/10 p-4 rounded-xl focus:border-accent outline-none text-lg"
                      value={name}
                      onChange={e => setName(e.target.value)}
                    />
                  </div>
                  <button type="submit" disabled={loading} className="gold-button w-full py-5 uppercase tracking-widest text-xs font-black">
                    {loading ? 'Creating...' : 'Create Account & Continue'}
                  </button>
                  <button type="button" onClick={() => { setAuthMode('mobile'); setMobile(''); }} className="w-full text-[10px] uppercase tracking-widest text-white/20 font-bold hover:text-white transition-colors">
                    ← Use Another Number
                  </button>
                </form>
              )}
            </div>
          </motion.div>
        )}

        {/* ─── STEP 2: Slot Selection ─── */}
        {step === 2 && (
          <motion.div key="step2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
            <div className="flex justify-between items-end">
              <div>
                <h1 className="text-4xl font-heading mb-1">Book a <span className="gold-text-gradient">Slot</span></h1>
                <p className="text-white/30 text-xs uppercase tracking-widest">
                  {isMember ? '✦ Member pricing applied' : 'Standard pricing'}
                </p>
              </div>
              {isMember && (
                <span className="px-4 py-2 bg-accent/10 border border-accent/30 rounded-full text-accent text-[10px] uppercase tracking-widest font-black">Member</span>
              )}
            </div>

            {/* Date Selector */}
            <div className="glass-card p-6">
              <div className="flex items-center gap-3 mb-4">
                <Calendar size={16} className="text-accent" />
                <h3 className="text-sm uppercase tracking-widest font-black text-white/60">Select Date</h3>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {availableDates.map(date => {
                  const d = new Date(date + 'T00:00:00');
                  const isToday = date === getTodayStr();
                  const isSelected = date === selectedDate;
                  return (
                    <button key={date}
                      onClick={() => { setSelectedDate(date); setSelectedSlots([]); }}
                      className={`flex-shrink-0 flex flex-col items-center p-3 rounded-2xl border transition-all min-w-[60px] ${isSelected ? 'bg-accent border-accent text-primary' : 'bg-white/5 border-white/10 hover:border-accent/30'}`}
                    >
                      <span className="text-[9px] uppercase font-black">{d.toLocaleDateString('en', { weekday: 'short' })}</span>
                      <span className="text-xl font-heading font-bold">{d.getDate()}</span>
                      <span className="text-[9px]">{d.toLocaleDateString('en', { month: 'short' })}</span>
                      {isToday && <span className={`text-[8px] font-black mt-1 ${isSelected ? 'text-primary/80' : 'text-accent'}`}>TODAY</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Screen Selector */}
            <div className="glass-card p-4 sm:p-6">
              <div className="flex items-center gap-3 mb-4">
                <Users size={16} className="text-accent" />
                <h3 className="text-sm uppercase tracking-widest font-black text-white/60">Select Screen</h3>
              </div>
              <div className="flex overflow-x-auto gap-2 pb-2 no-scrollbar scroll-smooth">
                {screens.map(screen => {
                  const isLocked = selectedCombo && selectedCombo.screen_type !== 'All' && selectedCombo.screen_type !== screen;
                  return (
                    <button key={screen} 
                      disabled={isLocked}
                      onClick={() => { if(!isLocked) { setSelectedScreen(screen); setSelectedSlots([]); } }}
                      className={`py-4 px-6 rounded-xl border text-center transition-all whitespace-nowrap text-[10px] uppercase font-black tracking-widest
                        ${selectedScreen === screen ? 'bg-accent border-accent text-primary shadow-[0_0_20px_rgba(212,169,95,0.4)]' : isLocked ? 'opacity-40 bg-black/40 border-white/5 cursor-not-allowed grayscale' : 'bg-white/5 border-white/10 hover:border-accent/40 text-white/40'}
                      `}
                    >
                      {screen}
                      {isLocked && <p className="text-[7px] mt-1 text-white/20 uppercase font-black tracking-tighter">Locked</p>}
                    </button>
                  );
                })}
              </div>
            </div>

            {combos.length > 0 && (
              <div className="pt-6 border-t border-white/10">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xl">🍹</span>
                  <h3 className="text-sm uppercase tracking-widest font-black text-white/60">Select A Combo (Optional)</h3>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                  <button
                    onClick={() => setSelectedCombo(null)}
                    className={`p-4 rounded-xl border text-left transition-all ${selectedCombo === null ? 'bg-accent/10 border-accent/50 shadow-[0_0_15px_rgba(212,169,95,0.2)]' : 'bg-white/5 border-white/10 hover:border-white/30'}`}
                  >
                    <span className="font-bold text-sm block mb-1">No Combo</span>
                    <span className="text-[10px] text-white/40">Just book the slot</span>
                  </button>
                  {combos.map(c => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCombo(c)}
                      className={`p-4 rounded-xl border text-left transition-all flex flex-col justify-between ${selectedCombo?.id === c.id ? 'bg-accent/10 border-accent shadow-[0_0_15px_rgba(212,169,95,0.4)]' : 'bg-white/5 border-white/10 hover:border-accent/40'}`}
                    >
                      <div>
                        <span className={`font-bold text-sm block mb-1 ${selectedCombo?.id === c.id ? 'text-accent' : ''}`}>{c.name}</span>
                        <span className="text-[10px] text-white/50 leading-tight block line-clamp-2 mb-2">{c.description}</span>
                      </div>
                      <span className="font-bold text-accent">₹{c.price}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6 lg:gap-8">
              {/* Main Selection Area */}
              <div className="lg:col-span-2 order-1 lg:order-1 space-y-6">
                <div className="flex items-center gap-3 mb-4">
                  <Clock size={16} className="text-accent" />
                  <h3 className="text-sm uppercase tracking-widest font-black text-white/60">Choose Your Time</h3>
                  <span className="text-[9px] text-white/30 ml-auto">Min. 1 required</span>
                </div>

                {loading ? (
                  <div className="glass-card py-20 flex items-center justify-center">
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
                    {SLOT_HOURS.map(hour => {
                      const status = slotStatus[hour];
                      const isSelected = selectedSlots.includes(hour);
                      const isAvail = status === 'available';
                      return (
                        <button key={hour} onClick={() => toggleSlot(hour)} disabled={!isAvail}
                          className={`p-3 sm:p-4 rounded-2xl border text-left transition-all relative
                            ${isSelected ? 'bg-accent border-accent' : ''}
                            ${isAvail && !isSelected ? 'bg-white/5 border-white/10 hover:border-accent/40 hover:bg-accent/10' : ''}
                            ${!isAvail ? 'opacity-50 cursor-not-allowed bg-white/[0.02] border-white/5' : ''}
                          `}
                        >
                          <div className={`text-xs sm:text-sm font-bold font-heading ${isSelected ? 'text-primary' : isAvail ? 'text-white' : 'text-white/30'}`}>
                            {getSlotLabel(hour).split(' - ')[0]}
                          </div>
                          <div className={`text-[8px] sm:text-[9px] mt-0.5 sm:mt-1 ${isSelected ? 'text-primary/70' : 'text-white/30'}`}>
                            to {getSlotLabel(hour).split(' - ')[1]}
                          </div>
                          {!isAvail && (
                            <span className={`absolute top-1 sm:top-2 right-1 sm:right-2 text-[7px] sm:text-[8px] uppercase font-black px-1.5 py-0.5 rounded-full ${status === 'booked' ? 'bg-red-500/20 text-red-400' : status === 'passed' ? 'bg-white/10 text-white/40' : 'bg-gray-500/20 text-gray-400'}`}>
                              {status === 'booked' ? 'Booked' : status === 'passed' ? 'Passed' : 'Closed'}
                            </span>
                          )}
                          {isSelected && <CheckCircle2 size={12} className="absolute top-1 sm:top-2 right-1 sm:right-2 text-primary" />}
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="flex gap-4 mt-4 text-[9px] uppercase tracking-widest">
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-accent/30 border border-accent inline-block" /> Selected</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-white/5 border border-white/10 inline-block" /> Available</span>
                  <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-500/10 border border-red-500/20 inline-block" /> Booked</span>
                </div>
              </div>

              {/* Reservation Sidebar */}
              <div className="space-y-4 order-2 lg:order-2">
                <div className="glass-card premium-border p-5 sm:p-6 space-y-6">
                  <h4 className="text-sm uppercase tracking-luxury font-black text-accent/60">Your Experience</h4>

                  {/* Membership Credits Toggle */}
                  {activeMembership && (
                    <div className={`navy-card p-5 border-accent/20 bg-accent/5 backdrop-blur-xl transition-all ${useCredits ? 'ring-2 ring-accent' : ''}`}>
                      <div className="flex items-center justify-between mb-4">
                         <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                               <Star className="text-accent" size={16} />
                            </div>
                            <div>
                               <p className="text-[8px] uppercase tracking-widest text-white/40 font-black leading-none mb-1">Elite Benefit</p>
                               <h3 className="text-xs font-heading gold-text-gradient font-black">Apply Credits</h3>
                            </div>
                         </div>
                         {(() => {
                            const getAvail = () => {
                              if (!activeMembership || !activeMembership.credits_remaining) return 0;
                              const credits = activeMembership.credits_remaining;
                              
                              // New screens data from pricingMap
                              const screenData = pricingMap[selectedScreen];
                              const legacyLink = screenData?.legacy_link;

                              // 1. Try type-based match (ANY)
                              if (activeMembership.credit_type === 'any') return Number(credits.total_hours || 0);
                              
                              // 2. Try the Explicit Legacy Link (BEST WAY)
                              if (legacyLink && legacyLink !== 'None' && credits.per_screen?.[legacyLink] !== undefined) {
                                return Number(credits.per_screen[legacyLink]);
                              }

                              // 3. Try direct screen name match
                              if (credits.per_screen?.[selectedScreen] !== undefined) return Number(credits.per_screen[selectedScreen]);
                              
                              // 4. Try legacy mapping fallback (In case Admin forgot to link)
                              const autoMap = { 'Screen 1': 'Mini Lounge', 'Screen 2': 'Studio Lounge', 'TV Screen': 'Grand Lounge' };
                              const legacyName = autoMap[selectedScreen];
                              if (legacyName && credits.per_screen?.[legacyName] !== undefined) return Number(credits.per_screen[legacyName]);

                              // 5. Universal Search
                              const allScreenQualifiers = Object.values(credits.per_screen || {});
                              const totalPerScreen = allScreenQualifiers.reduce((sum, v) => sum + Number(v || 0), 0);
                              return Math.max(Number(credits.total_hours || 0), totalPerScreen);
                            };

                            const avail = getAvail();
                            const canToggle = !!activeMembership;
                            
                            return (
                              <button 
                                disabled={!canToggle}
                                onClick={() => setUseCredits(!useCredits)}
                                className={`w-12 h-6 rounded-full transition-all relative ${useCredits ? 'bg-accent' : 'bg-white/10'} ${!canToggle ? 'opacity-30 grayscale cursor-not-allowed' : 'active:scale-95'}`}
                              >
                                 <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${useCredits ? 'left-7' : 'left-1'}`} />
                              </button>
                            );
                         })()}
                      </div>

                      <div className="grid grid-cols-2 pt-3 border-t border-white/10">
                         <div>
                            <p className="text-[8px] uppercase tracking-widest text-white/20 font-bold mb-0.5">Available</p>
                            <p className="text-sm font-black text-white">
                               {(() => {
                                  if (!activeMembership || !activeMembership.credits_remaining) return '0';
                                  const credits = activeMembership.credits_remaining;
                                  const screenData = pricingMap[selectedScreen];
                                  const legacyLink = screenData?.legacy_link;

                                  let val = activeMembership.credit_type === 'any' ? credits.total_hours : credits.per_screen?.[selectedScreen];
                                  
                                  // Priority check legacy link
                                  if (legacyLink && legacyLink !== 'None' && credits.per_screen?.[legacyLink] !== undefined) {
                                      val = credits.per_screen[legacyLink];
                                  } else if (!val) {
                                     const autoMap = { 'Screen 1': 'Mini Lounge', 'Screen 2': 'Studio Lounge', 'TV Screen': 'Grand Lounge' };
                                     val = credits.per_screen?.[autoMap[selectedScreen]];
                                  }
                                  
                                  if (!val || Number(val) === 0) {
                                     const allVals = Object.values(credits.per_screen || {});
                                     val = Math.max(Number(credits.total_hours || 0), ...allVals.map(v => Number(v || 0)), 0);
                                  }
                                  
                                  return Number(val || 0);
                               })()} Hrs
                            </p>
                         </div>
                         <div className="text-right">
                            <p className="text-[8px] uppercase tracking-widest text-white/20 font-bold mb-0.5">To Deduct</p>
                            <p className={`text-sm font-black ${useCredits ? 'text-accent' : 'text-white/20'}`}>{selectedSlots.length} Hrs</p>
                         </div>
                      </div>
                      
                      {selectedSlots.length > 0 && (() => {
                         const getAvail = () => {
                            if (!activeMembership || !activeMembership.credits_remaining) return 0;
                            const credits = activeMembership.credits_remaining;
                            const legacyMap = { 'Screen 1': 'Mini Lounge', 'Screen 2': 'Studio Lounge', 'TV Screen': 'Grand Lounge' };
                            const legacyName = legacyMap[selectedScreen];
                            let val = activeMembership.credit_type === 'any' ? credits.total_hours : credits.per_screen?.[selectedScreen];
                            if ((val === undefined || val === null) && legacyName) val = credits.per_screen?.[legacyName];
                            
                            if (!val || Number(val) === 0) {
                               const allVals = Object.values(credits.per_screen || {});
                               val = Math.max(Number(credits.total_hours || 0), ...allVals.map(v => Number(v || 0)), 0);
                            }
                            return Number(val || 0);
                         };
                         const avail = getAvail();
                         if (avail < selectedSlots.length && useCredits) return (
                           <p className="text-[7px] text-red-400 uppercase font-black mt-2 leading-tight">⚠ Low credit balance: {avail} available</p>
                         );
                         return null;
                      })()}
                    </div>
                  )}

            <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-[9px] uppercase tracking-widest text-white/30 font-black">Selected Date</p>
                      <p className="text-sm font-medium">{new Date(selectedDate + 'T00:00:00').toLocaleDateString('en', { weekday: 'short', month: 'long', day: 'numeric' })}</p>
                    </div>
                    <div className="space-y-2 text-right">
                      <p className="text-[9px] uppercase tracking-widest text-white/30 font-black">Lounge Area</p>
                      <p className="text-sm font-medium text-accent">{selectedScreen}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[9px] uppercase tracking-widest text-white/30">Slots ({selectedSlots.length})</p>
                    {selectedSlots.length === 0
                      ? <p className="text-white/20 text-sm italic">None selected</p>
                      : <div className="space-y-1">
                          {[...selectedSlots].sort((a, b) => a - b).map(h => (
                            <p key={h} className="text-sm text-accent font-medium">{getSlotLabel(h)}</p>
                          ))}
                        </div>
                    }
                  </div>

                  <div className="space-y-2">
                    <p className="text-[9px] uppercase tracking-widest text-white/30">Guests</p>
                    <div className="flex gap-2 flex-wrap">
                      {Array.from({length: (pricingMap[selectedScreen]?.max_guests || 6)}, (_, i) => i + 1).map(n => (
                        <button key={n} onClick={() => setGuestCount(n)}
                          className={`w-9 h-9 rounded-xl text-sm font-bold transition-all ${guestCount === n ? 'bg-accent text-primary' : 'bg-white/5 text-white/40 hover:bg-white/10'}`}>
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-white/5">
                    {selectedCombo && (
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[10px] uppercase tracking-widest text-white/30">Combo ({selectedCombo.name})</span>
                        <span className="text-sm font-bold">₹{selectedCombo.price}</span>
                      </div>
                    )}

                    {!selectedCombo && selectedSlots.length > 0 && (
                      [...selectedSlots].sort((a,b)=>a-b).map((h, i) => (
                        <div key={h} className="flex justify-between items-center mb-1">
                          <span className="text-[10px] uppercase tracking-widest text-white/30">
                            Slot {i + 1} ({getSlotLabel(h).split(' - ')[0]})
                          </span>
                          <span className="text-sm">₹{currentScreenPricing.pricing_type === 'per_person' ? (slotPrice * guestCount) : slotPrice}</span>
                        </div>
                      ))
                    )}
                    
                    <div className="mt-4 mb-4">
                      <p className="text-[9px] uppercase tracking-widest text-white/40 mb-2 font-black">Special Code</p>
                      <div className="flex gap-2 items-center overflow-hidden">
                        <input 
                          type="text" 
                          placeholder="COUPON CODE" 
                          value={couponCode} 
                          onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                          className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-sm uppercase focus:border-accent outline-none transition-all"
                        />
                        <button 
                          onClick={handleApplyCoupon} 
                          className="px-4 shrink-0 bg-accent text-primary rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-accent/80 transition-all active:scale-95 whitespace-nowrap"
                        >
                          Apply
                        </button>
                      </div>
                      {couponError && <p className="text-red-400 text-[10px] mt-2 ml-1">⚠ {couponError}</p>}
                      {appliedCoupon && <p className="text-green-400 text-[10px] mt-2 ml-1 flex items-center gap-1"><CheckCircle2 size={10} /> Promo code applied!</p>}
                    </div>

                    {appliedCoupon && (
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-[10px] uppercase tracking-widest text-white/30">Original Total</span>
                        <span className="text-sm font-bold">₹{totalOriginal}</span>
                      </div>
                    )}
                    {appliedCoupon && (
                      <div className="flex justify-between items-center text-green-400 mt-1">
                        <span className="text-[10px] uppercase tracking-widest">Coupon Discount</span>
                        <span className="text-sm">-₹{Math.round(discountAmountDisp)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center mt-2 pt-2 border-t border-white/10">
                      <span className="text-[10px] uppercase tracking-widest text-white/30">Total Payable</span>
                      <span className="text-xl font-heading gold-text-gradient font-black">₹{Math.round(finalPriceDisplay)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 bg-white/5 p-4 rounded-xl border border-white/10 mt-4 mb-2">
                  <input type="checkbox" id="terms" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} className="w-5 h-5 accent-accent cursor-pointer" />
                  <label htmlFor="terms" className="text-sm text-white/70">
                    I agree to the <a href="/terms" target="_blank" rel="noreferrer" className="text-accent underline font-bold hover:text-accent/80 transition-colors">Terms & Conditions</a>
                  </label>
                </div>

                  <button onClick={handleBooking} disabled={selectedSlots.length === 0 || loading || !termsAccepted}
                    className={`gold-button w-full py-5 uppercase tracking-widest font-black text-xs flex items-center justify-center gap-2 transform transition-all active:scale-95 ${(selectedSlots.length === 0 || !termsAccepted) ? 'opacity-40 cursor-not-allowed bg-white/10 text-white/20' : 'hover:shadow-[0_0_20px_rgba(212,169,95,0.3)]'}`}
                  >
                    <MessageCircle size={14} />
                    {loading ? 'Securing Slot...' : 'Confirm Reservation'}
                  </button>
                <p className="text-[9px] text-white/20 text-center uppercase tracking-widest">WhatsApp will open to confirm with admin</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── STEP 3: Confirmed ─── */}
        {step === 3 && confirmedBooking && (
          <motion.div key="step3" initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="max-w-xl mx-auto text-center space-y-8 py-10">
            <div className="w-24 h-24 bg-accent rounded-full flex items-center justify-center mx-auto shadow-[0_0_50px_rgba(212,169,95,0.4)]">
              <CheckCircle2 size={48} className="text-primary" />
            </div>
            <div>
              <h2 className="text-4xl font-heading mb-2 gold-text-gradient font-black">Request Sent!</h2>
              <p className="text-white/40 text-sm">Your booking request is pending admin confirmation.</p>
            </div>

            {/* Booking detail card */}
            <div className="glass-card p-8 text-left space-y-5 border-accent/20">
              <p className="text-[10px] uppercase tracking-widest text-accent/70 font-black">Booking Details</p>
              <div className="grid grid-cols-2 gap-5">
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-white/30 font-black mb-1">Status</p>
                  <p className="text-sm font-bold text-yellow-400">⏳ Pending Confirmation</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-white/30 font-black mb-1">Ref ID</p>
                  <p className="text-xs font-mono text-accent">{confirmedBooking.id.slice(0, 12)}…</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-white/30 font-black mb-1">Date</p>
                  <p className="text-sm font-medium">{confirmedBooking.date}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-white/30 font-black mb-1">Screen</p>
                  <p className="text-sm font-medium text-accent">{selectedScreen}</p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-white/30 font-black mb-1">Guests</p>
                  <p className="text-sm font-medium">{confirmedBooking.guests} People</p>
                </div>
                <div className="col-span-2">
                  <p className="text-[9px] uppercase tracking-widest text-white/30 font-black mb-1">Slots</p>
                  <p className="text-sm text-accent font-medium">{confirmedBooking.slotDisplay}</p>
                </div>
                {confirmedBooking.comboName && (
                  <div>
                    <p className="text-[9px] uppercase tracking-widest text-white/30 font-black mb-1">Combo</p>
                    <p className="text-sm font-medium text-accent">{confirmedBooking.comboName} (₹{confirmedBooking.comboPrice})</p>
                  </div>
                )}
                {confirmedBooking.extraSlotsInfo && confirmedBooking.extraSlotsInfo.length > 0 && (
                  <div className="col-span-2 space-y-1">
                    <p className="text-[9px] uppercase tracking-widest text-white/30 font-black mb-1">Slot Charges</p>
                    {confirmedBooking.extraSlotsInfo.map((info, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs text-white/70">
                        <span>Slot {idx + 1} ({info.label})</span>
                        <span>₹{info.price}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-white/30 font-black mb-1">Total Amount</p>
                  <p className="text-xl font-heading font-black gold-text-gradient">₹{confirmedBooking.price}</p>
                </div>
              </div>
              <div className="border-t border-white/10 pt-4">
                <p className="text-[9px] text-white/30 uppercase tracking-widest">✓ WhatsApp opened — Send message to admin to confirm your slot</p>
              </div>
            </div>

            <div className="flex gap-4 justify-center flex-wrap">
              <button 
                onClick={handleResendWhatsApp} 
                className="gold-button px-8 py-4 uppercase tracking-widest font-black text-xs flex items-center gap-2"
              >
                <MessageCircle size={14} /> Resend Request to WhatsApp
              </button>
              <button onClick={() => window.location.href = '/my-bookings'} className="glass-card px-8 py-4 uppercase tracking-widest font-black text-xs">My Bookings</button>
              <button onClick={() => window.location.href = '/menu'} className="glass-card px-8 py-4 uppercase tracking-widest font-black text-xs border-accent/30 hover:bg-accent/10 transition-colors">Order Food</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BookingPage;

