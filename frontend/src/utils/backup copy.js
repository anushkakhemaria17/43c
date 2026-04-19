/**
 * GOOGLE SHEETS BACKUP UTILITY
 * 
 * This utility handles sending data to a Google Apps Script Web App for backup and reporting.
 */

// ⚠️ PLEASE REPLACE WITH YOUR DEPLOYED GOOGLE APPS SCRIPT URL
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbyDsvpRDW0mnIGpcM7uU4ldwgt-_SjeQ-D_UISt85O7LQXLwpAMyw4z6unV08Wp20HNPw/exec";

/**
 * Send data to Google Sheets
 * @param {Object} data - { type: "booking"|"food"|"expense"|"deleted", name, mobile, details, amount, status }
 */
export const sendToGoogleSheet = async (data) => {
  if (!GOOGLE_SCRIPT_URL) {
    console.warn("Google Script URL not configured. Backup skipped.");
    return;
  }

  try {
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      mode: "no-cors", // Required for Apps Script Web App
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    return response;
  } catch (err) {
    console.error("Backup failed:", err);
  }
};

/**
 * Cleanup logic: Delete cancelled bookings older than 10 days
 * @param {Array} bookings - Current bookings list
 * @param {Function} onDelete - Callback to handle UI update
 */
export const runAutoCleanup = async (bookings, deleteBookingFn) => {
  const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;
  const now = new Date();

  const toDelete = bookings.filter(b => {
    if (b.status !== 'cancelled') return false;
    const bookingDate = new Date(b.booking_date);
    return (now - bookingDate) > TEN_DAYS_MS;
  });

  if (toDelete.length === 0) return 0;

  let count = 0;
  for (const b of toDelete) {
    try {
      // Ensure it's archived before deleting (final sync check)
      await sendToGoogleSheet({
        type: "deleted",
        reason: "Auto-cleanup (Older than 10 days)",
        data: JSON.stringify(b)
      });

      await deleteBookingFn(b.id);
      count++;
    } catch (err) {
      console.error(`Failed to cleanup booking ${b.id}:`, err);
    }
  }
  return count;
};
