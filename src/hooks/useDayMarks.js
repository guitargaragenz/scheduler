import { useEffect, useRef, useState } from 'react';
import {
  isSupabaseConfigured,
  loadDayMarks,
  upsertDayMarks,
  clearDayMarks,
  subscribeToDayMarks,
} from '../utils/supabase.js';

// The Daily Log's picks, kept in their own table and nowhere else.
//
// Shape held in state: { [dateKey]: { [itemId]: { kind, label } } }. A day with
// nothing on it has no entry — absence IS the empty day, so taking an item off
// deletes its row rather than writing an empty one.
//
// Deliberately strict about the same two things useWeekMarks is, for the same
// reasons:
//
//   1. It will not write until it has had ONE successful read. loadDayMarks()
//      returns null for a failed read and {} for a genuinely empty table; only
//      the second arms writing. Without that gate, a page opened while Supabase
//      was unreachable would look like an empty day and the first tap would
//      start writing into it.
//
//   2. It stops writing after repeated failures instead of retrying forever.
//
// `label` is stored at pick time and never re-read from the job. A split's text
// can change, or the split can stop existing; what the day says was worked on
// must not change underneath it.
const MAX_FAILED_SAVES = 3;

export function useDayMarks() {
  const [dayItems, setDayItems] = useState({});
  const [ready, setReady] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Set on every write so the realtime echo of our own change doesn't stomp the
  // optimistic local state a fraction of a second later.
  const justSavedAt = useRef(0);
  const failedSavesRef = useRef(0);
  // Read inside async callbacks, where the `ready` state value would be stale.
  const readyRef = useRef(false);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    let cancelled = false;

    (async () => {
      const data = await loadDayMarks();
      if (cancelled) return;
      if (data === null) {
        // Read failed. Stay un-ready: the page renders read-only rather than
        // pretending the day is empty.
        setSaveError('Could not read the day. The page is read-only until it reloads.');
        return;
      }
      setDayItems(data);
      readyRef.current = true;
      setReady(true);
    })();

    const unsub = subscribeToDayMarks((data) => {
      if (Date.now() - justSavedAt.current < 3000) return;
      setDayItems(data);
    });

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  // Put ONE item on a day. `label` is captured now, on purpose.
  // Returns { ok } — the caller surfaces a failure, it is never swallowed.
  async function addItem(dateKey, itemId, kind, label) {
    if (!readyRef.current) return { ok: false };
    if (!dateKey || !itemId) return { ok: false };
    if (failedSavesRef.current >= MAX_FAILED_SAVES) return { ok: false };

    const day = String(dateKey);
    const id = String(itemId);
    const entry = { kind: kind === 'task' ? 'task' : 'job', label: String(label ?? '') };

    // Optimistic: the list has to respond to a tap immediately.
    setDayItems(prev => ({
      ...prev,
      [day]: { ...(prev[day] || {}), [id]: entry },
    }));

    justSavedAt.current = Date.now();
    const res = await upsertDayMarks([{ dateKey: day, itemId: id, ...entry }]);

    if (!res?.ok) {
      failedSavesRef.current += 1;
      setSaveError('That did not save.');
      // Take it back off, so the screen isn't showing an item that only exists
      // in this browser tab.
      setDayItems(prev => {
        const forDay = { ...(prev[day] || {}) };
        delete forDay[id];
        const next = { ...prev };
        if (Object.keys(forDay).length === 0) delete next[day];
        else next[day] = forDay;
        return next;
      });
      return { ok: false };
    }

    failedSavesRef.current = 0;
    setSaveError(null);
    return { ok: true };
  }

  // Take ONE item off a day. Remove-only; there is no bulk write counterpart on
  // purpose, the same as useWeekMarks.
  async function removeItem(dateKey, itemId) {
    if (!readyRef.current) return { ok: false };
    if (!dateKey || !itemId) return { ok: false };
    if (failedSavesRef.current >= MAX_FAILED_SAVES) return { ok: false };

    const day = String(dateKey);
    const id = String(itemId);
    const previous = dayItems[day]?.[id];
    if (previous === undefined) return { ok: true };

    setDayItems(prev => {
      const forDay = { ...(prev[day] || {}) };
      delete forDay[id];
      const next = { ...prev };
      if (Object.keys(forDay).length === 0) delete next[day];
      else next[day] = forDay;
      return next;
    });

    justSavedAt.current = Date.now();
    const res = await clearDayMarks([{ dateKey: day, itemId: id }]);

    if (!res?.ok) {
      failedSavesRef.current += 1;
      setSaveError('That did not save.');
      setDayItems(prev => ({
        ...prev,
        [day]: { ...(prev[day] || {}), [id]: previous },
      }));
      return { ok: false };
    }

    failedSavesRef.current = 0;
    setSaveError(null);
    return { ok: true };
  }

  return { dayItems, ready, saveError, addItem, removeItem };
}
