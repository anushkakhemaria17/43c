import * as XLSX from 'xlsx';

/**
 * Export analytics data to an Excel file.
 * @param {Array} rows - [{ date, bookingTotal, foodTotal, total }]
 * @param {Array} bookingDetails - flat list of booking records
 * @param {Array} foodDetails - flat list of food order records
 * @param {string} monthLabel - e.g. "March 2026"
 * @param {number} totalExpenses - total monthly expenses
 */
export const exportAnalyticsExcel = (rows, bookingDetails, foodDetails, monthLabel, totalExpenses = 0) => {
  const wb = XLSX.utils.book_new();

  // ─── Sheet 1: Monthly Summary ───
  const summaryHeaders = ['Date', 'Booking Revenue (₹)', 'Food Revenue (₹)', 'Grand Total (₹)'];
  const summaryRows = rows.map(r => [r.date, r.bookingTotal, r.foodTotal, r.total]);
  const totalBooking = rows.reduce((s, r) => s + r.bookingTotal, 0);
  const totalFood = rows.reduce((s, r) => s + r.foodTotal, 0);
  const grandTotal = totalBooking + totalFood;
  summaryRows.push([]);
  summaryRows.push(['TOTAL', totalBooking, totalFood, grandTotal]);
  summaryRows.push(['Total Expenses', '', '', totalExpenses]);
  summaryRows.push(['Net Profit', '', '', grandTotal - totalExpenses]);

  const summaryWs = XLSX.utils.aoa_to_sheet([summaryHeaders, ...summaryRows]);
  // Column widths
  summaryWs['!cols'] = [{ wch: 14 }, { wch: 22 }, { wch: 18 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Monthly Summary');

  // ─── Sheet 2: Booking Details ───
  const bookingHeaders = ['Booking ID', 'Date', 'Customer', 'Slots', 'Guests', 'Original Price (₹)', 'Final Price (₹)', 'Advance Paid (₹)', 'Remaining Amount (₹)', 'Status'];
  const bookingRows = bookingDetails.map(b => [
    b.id,
    b.booking_date,
    b.customer_name,
    (b.slots || []).join(', '),
    b.guest_count,
    b.original_price || b.price || 0,
    b.final_price || b.price || 0,
    b.advance_paid || 0,
    b.remaining_amount || (b.final_price || b.price || 0),
    b.status || '-',
  ]);
  const bookingWs = XLSX.utils.aoa_to_sheet([bookingHeaders, ...bookingRows]);
  bookingWs['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 20 }, { wch: 30 }, { wch: 8 }, { wch: 18 }, { wch: 14 }, { wch: 16 }, { wch: 20 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, bookingWs, 'Bookings');

  // ─── Sheet 3: Food Order Details ───
  const foodHeaders = ['Order ID', 'Date', 'Customer', 'Items', 'Original Total (₹)', 'Final Total (₹)', 'Status'];
  const foodRows = foodDetails.map(o => {
    const itemsStr = (o.items || []).map(i => `${i.name} x${i.qty}`).join(', ');
    const ts = o.created_at?.seconds ? new Date(o.created_at.seconds * 1000).toISOString().split('T')[0] : '-';
    return [
      o.id,
      ts,
      o.customer_name,
      itemsStr,
      o.original_price || o.total || 0,
      o.final_price || o.total || 0,
      o.status || '-',
    ];
  });
  const foodWs = XLSX.utils.aoa_to_sheet([foodHeaders, ...foodRows]);
  foodWs['!cols'] = [{ wch: 20 }, { wch: 12 }, { wch: 20 }, { wch: 40 }, { wch: 18 }, { wch: 14 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, foodWs, 'Food Orders');

  XLSX.writeFile(wb, `43C_Analytics_${monthLabel.replace(' ', '_')}.xlsx`);
};
