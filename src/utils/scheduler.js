import { getWorkHours, isLunchSlot, isSaturday, isSunday, isGapHour, slotKey, getAvailableSlots } from './calendar.js';

const MAX_CONTINUOUS_SLOTS = 6; // 3 hours max = 6 × 30-min slots

// Returns the slot key for the half-slot immediately after `key`
export function nextHalfSlotKey(key) {
  const parts = key.split('-');
  const h = parseInt(parts[3]);
  const m = parseInt(parts[4]);
  const nM = m === 0 ? 30 : 0;
  const nH = m === 0 ? h : h + 1;
  return `${parts[0]}-${parts[1]}-${parts[2]}-${nH}-${nM}`;
}

// Find N available 30-min slots from startDay/startHour/startMinute onwards.
// externalBlocked: Set of slot keys blocked by Google Calendar appointments.
export function findAvailableSlots(startDayIdx, startHour, startMinute, needed, tempSlots, weekDays, externalBlocked) {
  const found = [];
  for (let d = startDayIdx; d < weekDays.length && found.length < needed; d++) {
    const date = weekDays[d];
    const { start, end } = getWorkHours(date);
    const sat = isSaturday(date);
    const sun = isSunday(date);
    const isWeekday = !sat && !sun;
    for (let h = start; h < end && found.length < needed; h++) {
      if (isWeekday && isLunchSlot(h)) continue;
      if (isGapHour(h)) continue;
      for (const m of [0, 30]) {
        if (d === startDayIdx && (h < startHour || (h === startHour && m < startMinute))) continue;
        const key = slotKey(weekDays[d], h, m);
        if (tempSlots[key]) continue;
        if (externalBlocked && externalBlocked.has(key)) continue;
        found.push({ dayIdx: d, hour: h, minute: m });
        if (found.length >= needed) break;
      }
    }
  }
  return found;
}

// Returns how many 30-min slots a job needs (capped at 6 = 3 hours)
export function slotsNeeded(job) {
  return Math.min(Math.ceil(job.hours * 2), MAX_CONTINUOUS_SLOTS);
}

export function scheduleUrgent(job, dayIdx, hour, minute = 0, weekDays, scheduledSlots) {
  const date = weekDays[dayIdx];
  const { start, end } = getWorkHours(date);
  const needed = slotsNeeded(job);
  const moved = [];

  const sat = isSaturday(date);
  const sun = isSunday(date);
  let h = hour, m = minute;
  for (let i = 0; i < needed; i++) {
    if (h >= end || isGapHour(h)) return null;
    if (!sat && !sun && isLunchSlot(h)) return null;
    const key = slotKey(date, h, m);
    if (scheduledSlots[key] && scheduledSlots[key] !== job.id && scheduledSlots[key] !== '__buffer__') {
      const displaced = scheduledSlots[key];
      if (!moved.includes(displaced)) moved.push(displaced);
    }
    if (m === 0) { m = 30; } else { m = 0; h++; }
  }

  return { moved, dayIdx, hour, minute };
}

