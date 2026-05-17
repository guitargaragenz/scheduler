import { getWorkHours, isLunchSlot, isSaturday, isSunday, isGapHour, slotKey, getAvailableSlots } from './calendar.js';

const MAX_CONTINUOUS_SLOTS = 6; // 3 hours max = 6 × 30-min slots

// Returns how many 30-min slots a job needs (capped at 6 = 3 hours)
export function slotsNeeded(job) {
  return Math.min(Math.ceil(job.hours * 2), MAX_CONTINUOUS_SLOTS);
}

export function canPlace(dayIdx, hour, minute = 0, job, weekDays, scheduledSlots) {
  const date = weekDays[dayIdx];
  const { start, end } = getWorkHours(date);
  const needed = slotsNeeded(job);
  if (hour < start) return { ok: false, reason: 'Before work hours' };
  return { ok: true };
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

export function autoSchedule(job, weekDays, scheduledSlots) {
  const available = getAvailableSlots(scheduledSlots, weekDays);
  const needed = slotsNeeded(job);

  for (let i = 0; i <= available.length - needed; i++) {
    const slot = available[i];
    let fits = true;
    for (let j = 0; j < needed; j++) {
      if (i + j >= available.length) { fits = false; break; }
      const s = available[i + j];
      // Must be consecutive 30-min slots on the same day
      const expectedM = (slot.minute + j * 30) % 60;
      const extraHours = Math.floor((slot.minute + j * 30) / 60);
      if (s.dayIdx !== slot.dayIdx || s.hour !== slot.hour + extraHours || s.minute !== expectedM) {
        fits = false; break;
      }
    }
    if (fits) return { dayIdx: slot.dayIdx, hour: slot.hour, minute: slot.minute };
  }
  return null;
}
