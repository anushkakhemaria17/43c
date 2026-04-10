/**
 * Utility to open WhatsApp with a pre-filled message.
 * Fixes issues with iOS Safari and ensures proper encoding.
 * 
 * @param {string} phone - Phone number with country code, no + sign (e.g., 919479810400)
 * @param {string} message - The message to be pre-filled
 */
export const openWhatsApp = (phone, message) => {
  if (!phone) {
    alert("Phone number is missing.");
    return;
  }

  // Ensure phone has no + sign and only digits
  const cleanPhone = phone.replace(/\D/g, '');
  
  // Basic validation: ensure it's not empty and seems like a valid length (e.g., at least 10 digits)
  if (cleanPhone.length < 10) {
    alert("Invalid phone number format. Please ensure country code is included (e.g., 91XXXXXXXXXX).");
    return;
  }

  const encodedMessage = encodeURIComponent(message);
  
  // Use api.whatsapp.com/send instead of wa.me for better iOS compatibility
  const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMessage}`;
  
  // Use window.location.href for iOS Safari compatibility as window.open is often blocked
  // if not triggered by a direct user action, but here we assume it IS called from a click.
  try {
    window.location.href = url;
  } catch (err) {
    console.error("WhatsApp redirect failed:", err);
    alert("If WhatsApp does not open, please ensure it is installed.");
  }
};
