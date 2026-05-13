// Work hours config
export const WORK_HOURS = {
  weekday: { start: 10, end: 18 }, // 10am-6pm Mon-Fri
  saturday: { start: 10, end: 14 }, // 10am-2pm Sat
};
export const LUNCH = { start: 12, end: 13 }; // 12:00-1:00pm

export function getWeekDays(referenceDate = new Date()) {
  const days = [];
  const d = new Date(referenceDate);
  // Get Monday of current week
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);

  for (let i = 0; i < 6; i++) {
    const date = new Date(d);
    date.setDate(d.getDate() + i);
    days.push(date);
  }
  return days;
}

export function isSaturday(date) {
  return date.getDay() === 6;
}

export function getWorkHours(date) {
  return isSaturday(date) ? WORK_HOURS.saturday : WORK_HOURS.weekday;
}

export function getTimeSlots(date) {
  const { start, end } = getWorkHours(date);
  const slots = [];
  for (let h = start; h < end; h++) {
    slots.push(h);
    // Only add half-hour for weekdays (not sat which ends at 14:00 sharp)
    if (!isSaturday(date) || h < end - 1) {
      // We use full 1-hr blocks; sub-slots are visual only
    }
  }
  return slots;
}

export function isLunchTime(hour) {
  return hour >= LUNCH.start && hour < LUNCH.end;
}

export function isLunchSlot(hour) {
  // 12:00-1:00 PM locked
  return hour === 12;
}

export function formatHour(h) {
  if (h === 0) return '12:00 AM';
  if (h < 12) return `${h}:00 AM`;
  if (h === 12) return '12:00 PM';
  return `${h - 12}:00 PM`;
}

export function formatDateRange(days) {
  if (!days || days.length === 0) return '';
  const opts = { month: 'short', day: 'numeric' };
  const first = days[0].toLocaleDateString('en-NZ', opts);
  const last = days[days.length - 1].toLocaleDateString('en-NZ', opts);
  const year = days[0].getFullYear();
  return `${first} – ${last}, ${year}`;
}

export function dayLabel(date) {
  return date.toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function slotKey(dayIdx, hour) {
  return `${dayIdx}-${hour}`;
}

export function getAvailableSlots(scheduledSlots, weekDays) {
  const available = [];
  weekDays.forEach((date, dayIdx) => {
    const { start, end } = getWorkHours(date);
    for (let h = start; h < end; h++) {
      if (isLunchSlot(h) && !isSaturday(date)) continue;
      const key = slotKey(dayIdx, h);
      if (!scheduledSlots[key]) {
        available.push({ dayIdx, hour: h, date, key });
      }
    }
  });
  return available;
}
