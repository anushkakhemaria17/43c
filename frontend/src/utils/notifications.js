// Admin WhatsApp number
const ADMIN_WHATSAPP = '919479810400';
import { openWhatsApp } from './whatsapp';

/**
 * Opens WhatsApp to send a message to the admin about a food order.
 * The message is sent by the customer.
 * @param {number} totalItems - total quantity of all items
 * @param {Array} items - array of {name, qty, price}
 * @param {string} customerMobile - customer's mobile number
 */
export const sendFoodOrderWhatsApp = (totalItems, items, customerMobile) => {
  const message = `I have placed my food order, with ${totalItems} item${totalItems !== 1 ? 's' : ''} (qty).`;
  openWhatsApp(ADMIN_WHATSAPP, message);
};

/**
 * Opens WhatsApp to notify admin about a new booking.
 * @param {string} slot - slot label(s) selected
 * @param {string} date - booking date
 * @param {string} mobile - customer mobile
 */
export const sendBookingWhatsApp = (slot, date, mobile) => {
  const message = `New booking at 43C. Slot: ${slot} on ${date} by mobile: ${mobile}. Please check.`;
  openWhatsApp(ADMIN_WHATSAPP, message);
};

/**
 * Sends an SMS notification to admin using Fast2SMS free API.
 * This calls the Fast2SMS quick SMS endpoint.
 * @param {string} message - SMS message to send
 */
export const sendAdminSMS = async (message) => {
  // Using Fast2SMS API (free tier) - admin needs to configure API key in env
  const apiKey = import.meta.env.VITE_FAST2SMS_API_KEY;
  if (!apiKey) {
    console.warn('SMS API key not configured. Skipping SMS notification.');
    return;
  }
  try {
    const response = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: {
        'authorization': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        route: 'q',
        message: message,
        language: 'english',
        flash: 0,
        numbers: '9479810400',
      }),
    });
    const data = await response.json();
    console.log('SMS response:', data);
  } catch (err) {
    console.error('SMS send failed:', err);
  }
};
