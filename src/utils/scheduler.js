import { getWorkHours, isLunchSlot, isSaturday, slotKey, getAvailableSlots } from './calendar.js';

const MAX_CONTINUOUS_HOURS = 3;

// Returns how many 1-hr slots a job needs (capped at 3 per block)
export function slotsNeeded(job) {
  return Math.min(Math.ceil(job.hours), MAX_CONTINUOUS_HOURS);
}

// Check if a slot is valid for placing a job
export function canPlace(dayIdx, hour, job, weekDays, scheduledSlots) {
  const date = weekDays[dayIdx];
  const { start, end } = getWorkHours(date);
  const needed = slotsNeeded(job);

  if (hour < start) return { ok: false, reason: 'Before work hours' };
  if (hour + needed > end) return { ok: false, reason: 'Extends past end of day' };

  if (!isSaturday(date)) {
    for (let h = hour; h < hour + needed; h++) {
      if (isLunchSlot(h)) return { ok: false, reason: 'Overlaps lunch block (12:30–1:45 PM)' };
    }
  }

  for (let h = hour; h < hour + needed; h++) {
    const key = slotKey(dayIdx, h);
    if (scheduledSlots[key] && scheduledSlots[key] !== job.id) {
      return { ok: false, reason: `Slot occupied by job #${scheduledSlots[key]}` };
    }
  }

  return { ok: true };
}

// Auto-schedule a job urgently — clear blocking jobs back to sidebar
export function scheduleUrgent(job, dayIdx, hour, weekDays, scheduledSlots, calendarEntries) {
  const date = weekDays[dayIdx];
  const { start, end } = getWorkHours(date);
  const needed = slotsNeeded(job);
  const moved = [];

  if (hour < start || hour + needed > end) return null;

  // Collect jobs that need to move
  for (let h = hour; h < hour + needed; h++) {
    const key = slotKey(dayIdx, h);
    if (scheduledSlots[key] && scheduledSlots[key] !== job.id) {
      const displaced = scheduledSlots[key];
      if (!moved.includes(displaced)) moved.push(displaced);
    }
  }

  return { moved, dayIdx, hour };
}

// Auto-schedule a regular job into the first available slot
export function autoSchedule(job, weekDays, scheduledSlots, personalBlocks = []) {
  const available = getAvailableSlots(scheduledSlots, weekDays);
  const needed = slotsNeeded(job);

  for (let i = 0; i <= available.length - needed; i++) {
    const slot = available[i];
    let fits = true;

    for (let j = 0; j < needed; j++) {
      if (i + j >= available.length) { fits = false; break; }
      const s = available[i + j];
      if (s.dayIdx !== slot.dayIdx || s.hour !== slot.hour + j) { fits = false; break; }
      if (personalBlocks.some(b => b.dayIdx === s.dayIdx && b.hour === s.hour)) { fits = false; break; }
    }

    if (fits) return { dayIdx: slot.dayIdx, hour: slot.hour };
  }
  return null;
}
