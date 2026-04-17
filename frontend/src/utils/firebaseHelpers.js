import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, getDocs, updateDoc, doc } from 'firebase/firestore';
import { getWhatsAppNumber } from './settings';
import { formatSlotsDisplay, getSlotLabel } from './slots';
import { openWhatsApp } from './whatsapp';

// ── Notification helpers ──────────────────────────────────────────

/**
 * Create a notification for a customer (and optionally admin).
 * Fields: user_id, type, message, booking_id?, order_id?, read, created_at, target('customer'|'admin')
 */
export const createNotification = async ({ userId, type, message, bookingId = null, orderId = null, notifyAdmin = false, adminMessage = null }) => {
  try {
    // Customer notification
    if (userId) {
      await addDoc(collection(db, 'notifications'), {
        user_id: userId,
        type,
        message,
        booking_id: bookingId,
        order_id: orderId,
        read: false,
        target: 'customer',
        created_at: serverTimestamp(),
      });
    }

    // Admin notification (always notify admin for new bookings / orders)
    if (notifyAdmin) {
      await addDoc(collection(db, 'notifications'), {
        user_id: 'admin',
        type,
        message: adminMessage || message,
        booking_id: bookingId,
        order_id: orderId,
        read: false,
        target: 'admin',
        created_at: serverTimestamp(),
      });
    }
  } catch (e) {
    console.error('Notification error:', e);
  }
};

// ── Auto-completion: mark past confirmed bookings as completed ─────────────

export const autoCompleteBookings = async (bookings, updateFn) => {
  const now = new Date();
  for (const b of bookings) {
    if (b.status !== 'confirmed') continue;
    if (!b.booking_date || !b.slots?.length) continue;
    const lastHour = Math.max(...b.slots);
    const slotEnd = new Date(`${b.booking_date}T${String(lastHour + 1).padStart(2, '0')}:00:00`);
    if (now > slotEnd) {
      try {
        await updateDoc(doc(db, 'bookings', b.id), { status: 'completed' });
        await createNotification({
          userId: b.customer_id,
          type: 'booking_completed',
          message: `Your booking at 43C on ${b.booking_date} is now marked completed. Thank you for visiting! ✨`,
          bookingId: b.id,
        });
        updateFn(b.id, 'completed');
      } catch (e) {
        console.error(e);
      }
    }
  }
};

// ── Auto-cancel: mark unconfirmed past bookings as cancelled ─────────────

export const autoCancelPendingBookings = async (bookings, updateFn) => {
  const now = new Date();
  for (const b of bookings) {
    if (b.status !== 'pending') continue;
    if (!b.booking_date || !b.slots?.length) continue;
    const lastHour = Math.max(...b.slots);
    const slotEnd = new Date(`${b.booking_date}T${String(lastHour + 1).padStart(2, '0')}:00:00`);
    if (now > slotEnd) {
      try {
        await updateDoc(doc(db, 'bookings', b.id), {
          status: 'cancelled',
          cancel_reason: 'Auto-cancelled: booking time passed without confirmation',
        });
        await createNotification({
          userId: b.customer_id,
          type: 'booking_cancelled',
          message: `Your booking on ${b.booking_date} was auto-cancelled as it was not confirmed in time.`,
          bookingId: b.id,
        });
        updateFn(b.id, 'cancelled');
      } catch (e) {
        console.error(e);
      }
    }
  }
};

// ── WhatsApp: admin → customer for booking confirmation & payment ─────────────────

const encryptAmount = (amount) => btoa(amount.toString());

export const openAdminWhatsApp = ({ customerMobile, customerName, slots, date, guests, totalAmount, comboName }) => {
  const slotLabels = formatSlotsDisplay(slots);
  const advance = Math.ceil(totalAmount * 0.5);
  const encryptedAmount = encryptAmount(advance);
  
  // Custom Domain - usually window.location.origin but since this is utility, we use a placeholder or the actual domain if known.
  // Using window.location.origin if available, otherwise just /payment
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const paymentLink = `${baseUrl}/payment?amount=${encryptedAmount}&name=${encodeURIComponent(customerName)}&type=booking`;

  const msg =
    `Dear ${customerName},\n\n` +
    `We are happy to confirm your booking at 43C ✨\n\n` +
    `📅 Date: ${date}\n` +
    `🕒 Slot: ${slotLabels}\n` +
    `👥 Guests: ${guests}${comboName ? `\n🎁 Combo: ${comboName}` : ''}\n\n` +
    `To confirm your booking, please pay advance amount: ₹${advance}\n\n` +
    `💳 Payment Link:\n${paymentLink}\n\n` +
    `After payment, kindly share screenshot on WhatsApp.\n\n` +
    `We look forward to hosting you 🎬`;

  const number = customerMobile.replace(/\D/g, '');
  const wa = number.startsWith('91') ? number : `91${number}`;
  openWhatsApp(wa, msg);
};

// ── WhatsApp: notify customer on final confirmation after payment ────────────

export const sendBookingConfirmedWhatsApp = ({ customerMobile, customerName, slots, date, guests, totalAmount, advancePaid, comboName }) => {
  const slotLabels = formatSlotsDisplay(slots);
  const remaining = totalAmount - (advancePaid || 0);
  const comboSection = comboName ? `\nCombo: ${comboName}` : '';
  const msg =
    `Dear ${customerName},\n\nYour booking at 43C is CONFIRMED! ✅\n\n` +
    `Date: ${date}\n` +
    `Slots: ${slotLabels}\n` +
    `Guests: ${guests}${comboSection}\n\n` +
    `Advance Paid: ₹${advancePaid || 0}\n` +
    `Remaining on Arrival: ₹${remaining}\n\n` +
    `Your Entry OTP will be sent to this number 30 mins before your time slot. Have a great experience! ✨`;
  const number = customerMobile.replace(/\D/g, '');
  const wa = number.startsWith('91') ? number : `91${number}`;
  openWhatsApp(wa, msg);
};

// ── WhatsApp: food order confirmation ────────────────────────────

export const sendFoodOrderWhatsApp = ({ customerMobile, customerName, items, totalAmount }) => {
  const itemList = items.map(item => `· ${item.qty}x ${item.name}`).join('\n');
  const encryptedAmount = encryptAmount(totalAmount);
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const paymentLink = `${baseUrl}/payment?amount=${encryptedAmount}&name=${encodeURIComponent(customerName)}&type=food`;

  const msg =
    `Hello ${customerName},\n\n` +
    `Your food order has been confirmed 🍽️\n\n` +
    `🧾 Order Details:\n${itemList}\n\n` +
    `💰 Total Amount: ₹${totalAmount}\n\n` +
    `Please complete payment using the link below:\n\n` +
    `💳 Payment Link:\n${paymentLink}\n\n` +
    `After payment, share screenshot for confirmation.\n\n` +
    `Thank you!`;

  const number = customerMobile.replace(/\D/g, '');
  const wa = number.startsWith('91') ? number : `91${number}`;
  openWhatsApp(wa, msg);
};
