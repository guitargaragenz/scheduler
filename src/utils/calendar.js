// Local YYYY-MM-DD key — NOT toISOString().slice(0,10), which is UTC and drifts a day
// off local date for timezones ahead of UTC (e.g. NZ, UTC+12/+13) for large parts of the day.
export function localDateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Work hours config
export const WORK_HOURS = {
  weekday:  { start: 10, end: 24 }, // 10am–6pm + 9pm–12am Mon–Fri
  saturday: { start: 10, end: 24 }, // 10am–12am Sat (extended for catch-up)
  sunday:   { start: 10, end: 24 }, // 10am–12am Sun (extended for catch-up)
};

// Hours that exist in the weekday work range but are not bookable (the gap 7pm-9pm)
export function isGapHour(hour) {
  return hour >= 19 && hour < 21;
}

export const LUNCH = { start: 12, end: 13 };

export function getWeekDays(referenceDate = new Date()) {
  const days = [];
  const d = new Date(referenceDate);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  for (let i = 0; i < 7; i++) {
    const date = new Date(d);
    date.setDate(d.getDate() + i);
    days.push(date);
  }
  return days;
}

export function isSaturday(date) { return date.getDay() === 6; }
export function isSunday(date)   { return date.getDay() === 0; }

export function getWorkHours(date) {
  if (isSaturday(date)) return WORK_HOURS.saturday;
  if (isSunday(date))   return WORK_HOURS.sunday;
  return WORK_HOURS.weekday;
}

export function isLunchSlot(hour) {
  return hour === 12; // blocks both 12:00 and 12:30
}

export function formatHour(h) {
  if (h === 0 || h === 24) return '12:00 AM';
  if (h < 12)  return `${h}:00 AM`;
  if (h === 12) return '12:00 PM';
  return `${h - 12}:00 PM`;
}

export function formatDateRange(days) {
  if (!days || days.length === 0) return '';
  const opts = { month: 'short', day: 'numeric' };
  const first = days[0].toLocaleDateString('en-NZ', opts);
  const last  = days[days.length - 1].toLocaleDateString('en-NZ', opts);
  const year  = days[0].getFullYear();
  return `${first} – ${last}, ${year}`;
}

export function dayLabel(date) {
  return date.toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' });
}

// slot key now includes minute — e.g. "2026-05-11-10-30"
export function slotKey(date, hour, minute = 0) {
  const d = date instanceof Date ? date : new Date(date);
  const y  = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${y}-${mo}-${dy}-${hour}-${minute}`;
}

export function getAvailableSlots(scheduledSlots, weekDays) {
  const available = [];
  weekDays.forEach((date, dayIdx) => {
    const { start, end } = getWorkHours(date);
    const sat = isSaturday(date);
    const sun = isSunday(date);
    for (let h = start; h < end; h++) {
      if (!sat && !sun && isLunchSlot(h)) continue;
      if (isGapHour(h)) continue;
      for (const m of [0, 30]) {
        const key = slotKey(date, h, m);
        if (!scheduledSlots[key]) {
          available.push({ dayIdx, hour: h, minute: m, date, key });
        }
      }
    }
  });
  return available;
}
