import { useEffect, useRef, useState } from 'react';
import { isSupabaseConfigured, loadAdHocTasks, saveAdHocTasks, subscribeToAdHocTasks } from '../utils/supabase.js';
import { slotKey, localDateKey, isSaturday, isSunday, isLunchSlot, isGapHour, getWorkHours } from '../utils/calendar.js';

// crypto.randomUUID() only exists in secure contexts — see useDailyLog.js for why.
function genId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `adhoc-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function computeSlotKeys(date, hour, minute, hours) {
  const needed = Math.max(1, Math.round(hours * 2));
  const keys = [];
  let h = hour, m = minute;
  for (let i = 0; i < needed; i++) {
    keys.push(slotKey(date, h, m));
    if (m === 0) m = 30; else { m = 0; h++; }
  }
  return keys;
}

// Ad-hoc maintenance tasks — quick bujo notes scheduled onto the calendar
// without going through the CSV job pipeline. Stored in their own Supabase
// table (see utils/supabase.js) so they never touch the `jobs` array or the
// CSV drift-safety check.
export function useAdHocTasks() {
  const [adHocTasks, setAdHocTasks] = useState([]);
  const [ready, setReady] = useState(false);
  const justSavedAt = useRef(0);
  const saveTimerRef = useRef(null);

  useEffect(() => {
    if (!isSupabaseConfigured()) { setReady(true); return; }
    loadAdHocTasks().then(data => { setAdHocTasks(data); setReady(true); });
    const unsub = subscribeToAdHocTasks(data => {
      if (Date.now() - justSavedAt.current < 3000) return;
      setAdHocTasks(data);
    });
    return () => unsub();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isSupabaseConfigured() || !ready) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      justSavedAt.current = Date.now();
      saveAdHocTasks(adHocTasks);
    }, 500);
    return () => clearTimeout(saveTimerRef.current);
  }, [adHocTasks, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  // Try to schedule an ad-hoc task at an exact day/time. Never bumps or
  // searches for another slot — same philosophy as the deliberately-not-built
  // auto-cascade reschedule (see admin/context/parking-lot.md, 2026-06-15). If the exact
  // requested time isn't free, the caller shows the conflict and the user
  // picks a different time themselves.
  function scheduleAdHocTask({ text, date, hour, minute, hours, occupiedKeys }) {
    const { start, end } = getWorkHours(date);
    if (hour < start || hour >= end) return { ok: false, reason: 'Outside work hours' };
    const weekday = !isSaturday(date) && !isSunday(date);
    if (weekday && isLunchSlot(hour)) return { ok: false, reason: "That's lunch" };
    if (isGapHour(hour)) return { ok: false, reason: 'That hour is blocked' };

    const keys = computeSlotKeys(date, hour, minute, hours);
    const takenByAdHoc = new Set(adHocTasks.flatMap(t => t.slotKeys));
    const clash = keys.some(k => occupiedKeys.has(k) || takenByAdHoc.has(k));
    if (clash) return { ok: false, reason: 'That time is already booked' };

    const task = {
      id: genId(), text, hours,
      calendarSlot: keys[0], slotKeys: keys,
      dateKey: localDateKey(date),
      createdAt: new Date().toISOString(),
    };
    setAdHocTasks(prev => [...prev, task]);
    return { ok: true, task };
  }

  function removeAdHocTask(id) {
    setAdHocTasks(prev => prev.filter(t => t.id !== id));
  }

  return { adHocTasks, scheduleAdHocTask, removeAdHocTask };
}
