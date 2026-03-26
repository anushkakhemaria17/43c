import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { getWhatsAppNumber } from './settings';
import { formatSlotsDisplay, getSlotLabel } from './slots';

// ── Notification helpers ──────────────────────────────────────────

export const createNotification = async ({ userId, type, message, bookingId = null, orderId = null }) => {
  try {
    await addDoc(collection(db, 'notifications'), {
      user_id: userId,
      type,
      message,
      booking_id: bookingId,
      order_id: orderId,
      read: false,
      created_at: serverTimestamp(),
    });
  } catch (e) {
    console.error('Notification error:', e);
  }
};

// ── Auto-completion: mark past bookings as completed ─────────────

export const autoCompleteBookings = async (bookings, updateFn) => {
  const now = new Date();
  for (const b of bookings) {
    if (b.status !== 'confirmed') continue;
    // Find the latest slot end time
    if (!b.booking_date || !b.slots?.length) continue;
    const lastHour = Math.max(...b.slots);
    const slotEnd = new Date(`${b.booking_date}T${String(lastHour + 1).padStart(2, '0')}:00:00`);
    if (now > slotEnd) {
      try {
        await updateDoc(doc(db, 'bookings', b.id), { status: 'completed' });
        await createNotification({
          userId: b.customer_id,
          type: 'booking_completed',
          message: `Your booking at 43C on ${b.booking_date} is now marked completed. Thank you for visiting!`,
          bookingId: b.id,
        });
        updateFn(b.id, 'completed');
      } catch (e) {
        console.error(e);
      }
    }
  }
};

// ── WhatsApp: admin → customer ───────────────────────────────────

export const openAdminWhatsApp = ({ customerMobile, customerName, slots, date, guests, totalAmount }) => {
  const slotLabels = [...slots].sort((a, b) => a - b).map(h => getSlotLabel(h)).join(', ');
  const advance = Math.ceil(totalAmount * 0.5);
  const msg =
    `Dear ${customerName},\nWe are glad to welcome you at 43C.\n\n` +
    `Your selected slot(s): ${slotLabels}\nDate: ${date}\nGuests: ${guests}\n\n` +
    `To confirm your booking, please pay at least 50% advance (₹${advance}).\n\n` +
    `Looking forward to hosting you!`;
  const number = customerMobile.replace(/\D/g, '');
  const wa = number.startsWith('91') ? number : `91${number}`;
  window.open(`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`, '_blank');
};

// ── WhatsApp: notify customer on confirmation ────────────────────

export const sendBookingConfirmedWhatsApp = ({ customerMobile, customerName, slots, date, guests, totalAmount, advancePaid }) => {
  const slotLabels = formatSlotsDisplay(slots);
  const remaining = totalAmount - (advancePaid || 0);
  const msg =
    `Your booking at 43C is confirmed!\nDate: ${date}\nSlots: ${slotLabels}\nGuests: ${guests}\n\n` +
    `Total: ₹${totalAmount}\nAdvance Paid: ₹${advancePaid || 0}\nRemaining to pay on arrival: ₹${remaining}\n\nEnjoy your cinematic experience!`;
  const number = customerMobile.replace(/\D/g, '');
  const wa = number.startsWith('91') ? number : `91${number}`;
  window.open(`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`, '_blank');
};
