import { useEffect, useRef, useState } from 'react';
import {
  isSupabaseConfigured,
  loadWeekMarks,
  upsertWeekMarks,
  clearWeekMarks,
  subscribeToWeekMarks,
} from '../utils/supabase.js';

// The week page's marks, kept in their own table and nowhere else.
//
// Shape held in state: { [jobId]: { [dateKey]: mark } }. A cell with no mark
// has no entry — absence IS the blank cell, so clearing a mark deletes the row
// rather than writing an empty one.
//
// Two things this hook is deliberately strict about, both copied from
// useJobStatusSince for the same reasons:
//
//   1. It will not write until it has had ONE successful read. loadWeekMarks()
//      returns null for a failed read and {} for a genuinely empty table; only
//      the second arms writing. Without that gate, a page opened while Supabase
//      was unreachable would look like an empty week and the first tap would
//      start writing into it.
//
//   2. It stops writing after repeated failures instead of retrying forever.
//      A silent write loop against a table that is rejecting writes is how you
//      get a page that looks like it is saving and is not.
const MAX_FAILED_SAVES = 3;

export function useWeekMarks() {
  const [marks, setMarks] = useState({});
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
      const data = await loadWeekMarks();
      if (cancelled) return;
      if (data === null) {
        // Read failed. Stay un-ready: the page renders read-only rather than
        // pretending the week is empty.
        setSaveError('Could not read the week marks. The page is read-only until it reloads.');
        return;
      }
      setMarks(data);
      readyRef.current = true;
      setReady(true);
    })();

    const unsub = subscribeToWeekMarks((data) => {
      if (Date.now() - justSavedAt.current < 3000) return;
      setMarks(data);
    });

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  // Set or clear ONE cell. `mark` of null/'' clears it.
  // Returns { ok } — the caller surfaces a failure, it is never swallowed.
  async function setMark(jobId, dateKey, mark) {
    if (!readyRef.current) return { ok: false };
    if (!jobId || !dateKey) return { ok: false };
    if (failedSavesRef.current >= MAX_FAILED_SAVES) return { ok: false };

    const id = String(jobId);
    const day = String(dateKey);
    const previous = marks[id]?.[day];

    // Optimistic: the grid has to respond to a tap immediately.
    setMarks(prev => {
      const forJob = { ...(prev[id] || {}) };
      if (mark) forJob[day] = mark;
      else delete forJob[day];
      const next = { ...prev };
      if (Object.keys(forJob).length === 0) delete next[id];
      else next[id] = forJob;
      return next;
    });

    justSavedAt.current = Date.now();
    const res = mark
      ? await upsertWeekMarks([{ jobId: id, dateKey: day, mark }])
      : await clearWeekMarks([{ jobId: id, dateKey: day }]);

    if (!res?.ok) {
      failedSavesRef.current += 1;
      setSaveError('That mark did not save.');
      // Put the cell back the way it was, so the screen isn't showing a mark
      // that only exists in this browser tab.
      setMarks(prev => {
        const forJob = { ...(prev[id] || {}) };
        if (previous) forJob[day] = previous;
        else delete forJob[day];
        const next = { ...prev };
        if (Object.keys(forJob).length === 0) delete next[id];
        else next[id] = forJob;
        return next;
      });
      return { ok: false };
    }

    failedSavesRef.current = 0;
    setSaveError(null);
    return { ok: true };
  }

  // Clear SEVERAL keys for one job in a single go — the week page's "take this
  // job off the week", which has to drop the day marks and the week's row key
  // together. Doing it one setMark() at a time would leave a job half-removed if
  // the third call failed, and would flash the row through four redraws.
  //
  // Only ever removes. There is no bulk write counterpart on purpose: a bug in
  // one would scribble over a week, and nothing needs one.
  async function clearJobKeys(jobId, dateKeys) {
    if (!readyRef.current) return { ok: false };
    if (!jobId || !Array.isArray(dateKeys) || dateKeys.length === 0) return { ok: false };
    if (failedSavesRef.current >= MAX_FAILED_SAVES) return { ok: false };

    const id = String(jobId);
    const keys = [...new Set(dateKeys.map(String).filter(Boolean))];
    // Only the keys this job actually has. Deleting a row that was never there
    // is harmless but pointless, and it makes the request bigger than the change.
    const present = keys.filter(k => marks[id]?.[k] !== undefined);
    if (present.length === 0) return { ok: true };
    const previous = { ...(marks[id] || {}) };

    setMarks(prev => {
      const forJob = { ...(prev[id] || {}) };
      present.forEach(k => delete forJob[k]);
      const next = { ...prev };
      if (Object.keys(forJob).length === 0) delete next[id];
      else next[id] = forJob;
      return next;
    });

    justSavedAt.current = Date.now();
    const res = await clearWeekMarks(present.map(k => ({ jobId: id, dateKey: k })));

    if (!res?.ok) {
      failedSavesRef.current += 1;
      setSaveError('That did not save.');
      // Put the whole job's marks back as they were. clearWeekMarks() deletes
      // cell by cell, so a failure part-way through may have removed some of
      // them — the next read from Supabase is the truth, and this just stops the
      // screen claiming a change that did not fully happen.
      setMarks(prev => ({ ...prev, [id]: previous }));
      return { ok: false };
    }

    failedSavesRef.current = 0;
    setSaveError(null);
    return { ok: true };
  }

  return { marks, ready, saveError, setMark, clearJobKeys };
}
