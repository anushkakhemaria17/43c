import { db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const DEFAULTS = {
  whatsapp_number: '919479810400',
};

/**
 * Fetch the global settings doc from Firestore.
 * Returns merged defaults if not found.
 */
export const getSettings = async () => {
  try {
    const snap = await getDoc(doc(db, 'settings', 'global'));
    if (snap.exists()) {
      return { ...DEFAULTS, ...snap.data() };
    }
    return { ...DEFAULTS };
  } catch (err) {
    console.error('Settings fetch error:', err);
    return { ...DEFAULTS };
  }
};

/**
 * Get just the WhatsApp number for admin notifications.
 */
export const getWhatsAppNumber = async () => {
  const settings = await getSettings();
  const num = settings.whatsapp_number || DEFAULTS.whatsapp_number;
  if (num && num.length === 10) return '91' + num;
  return num;
};

/**
 * Save/update settings fields.
 */
export const updateSettings = async (fields) => {
  await setDoc(doc(db, 'settings', 'global'), fields, { merge: true });
};
