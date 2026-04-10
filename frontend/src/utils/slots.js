// Fixed slots: 10:00 AM to 11:00 PM (each 1 hour)
export const SLOT_HOURS = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];

const pad = (n) => String(n).padStart(2, '0');

export const formatHour = (hour) => {
  const suffix = hour < 12 ? 'AM' : 'PM';
  const h = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${h}:00 ${suffix}`;
};

export const getSlotLabel = (hour) => {
  return `${formatHour(hour)} - ${formatHour(hour + 1)}`;
};

export const getSlot24Label = (hour) => {
  return `${pad(hour)}:00 - ${pad(hour + 1)}:00`;
};

const getLocalYYYYMMDD = (d = new Date()) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Returns array of date strings "YYYY-MM-DD" for today to today+30
export const getAvailableDates = () => {
  const dates = [];
  const today = new Date();
  for (let i = 0; i <= 30; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i);
    dates.push(getLocalYYYYMMDD(d));
  }
  return dates;
};

export const getTodayStr = () => getLocalYYYYMMDD();

/**
 * Returns { hour: 'available' | 'booked' | 'closed' | 'passed' }
 * IMPORTANT: Only bookings with status "confirmed" or "completed" block a slot.
 * "pending" bookings do NOT block slots — admin must confirm first.
 * For shared screens, it only blocks if seats booked >= capacity.
 */
export const getSlotStatusMap = (dateStr, bookings, closedSlots, screen, screenMeta = {}) => {
  const map = {};
  const seatsBooked = {};
  
  const todayStr = getLocalYYYYMMDD();
  const currentHour = new Date().getHours();
  
  SLOT_HOURS.forEach(h => { 
    if (dateStr === todayStr && h <= currentHour) {
      map[h] = 'passed';
    } else {
      map[h] = 'available';
    }
    seatsBooked[h] = 0;
  });

  const isShared = screenMeta.type === 'shared';
  const capacity = screenMeta.max_guests || 6;

  // Mark booked — only confirmed/completed bookings block the slot
  bookings.forEach(b => {
    const bScreen = b.screen || 'Screen 1';
    if (b.booking_date === dateStr && bScreen === screen) {
      const status = (b.status || '').toLowerCase();
      // Only block if confirmed or completed
      if (status === 'confirmed' || status === 'completed') {
        const bookedHours = b.slots || [];
        bookedHours.forEach(h => {
          if (map[h] !== undefined) {
             if (isShared) {
               seatsBooked[h] += Number(b.guest_count || 1);
               if (seatsBooked[h] >= capacity) {
                 map[h] = 'booked';
               }
             } else {
               map[h] = 'booked';
             }
          }
        });
      }
    }
  });

  // Mark closed (admin-closed slots)
  closedSlots.forEach(cs => {
    const cScreen = cs.screen || 'Screen 1';
    if (cs.date === dateStr && cScreen === screen) {
      const h = Number(cs.hour);
      if (map[h] !== undefined && map[h] !== 'booked') map[h] = 'closed';
    }
  });

  return map;
};

export const formatSlotsDisplay = (hours) => {
  if (!hours || hours.length === 0) return 'No slots';
  const sorted = [...hours].sort((a, b) => a - b);
  return sorted.map(h => getSlotLabel(h)).join(', ');
};
