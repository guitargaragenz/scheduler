import { useEffect, useRef, useState } from 'react';
import { isSupabaseConfigured, loadFocusList, saveFocusList, subscribeToFocusList } from '../utils/supabase.js';

// Focus list — job IDs Trevor is prioritizing this week, picked from the
// Sunday board-meeting interview. Kept in its own doc so it never touches
// the `jobs` array or the CSV drift-safety check.
export function useFocusList() {
  const [focusList, setFocusList] = useState([]);
  // `ready` gates the auto-save. It is only ever set once the list has been
  // read back successfully, so a failed read can never arm the writer — a
  // save writes an empty list by clearing the table, which would destroy the
  // real data. A failed read leaves the app read-only for the session; a
  // reload retries.
  const [ready, setReady] = useState(false);
  const justSavedAt = useRef(0);
  const saveTimerRef = useRef(null);
  // Serialized copy of what the database is known to hold, so the save effect
  // can skip the no-op write that otherwise fires immediately after load.
  const persistedRef = useRef(null);
  // Bumped after every completed save so the save effect re-runs and re-diffs
  // against whatever state exists *now*. Without this, a change made while a
  // save was in flight could match the pre-save `persistedRef`, skip, and then
  // be left stranded when the save updated `persistedRef` underneath it.
  const [saveTick, setSaveTick] = useState(0);
  // Consecutive failed saves. Caps the retry loop so a persistently failing
  // database can't be hammered every 500ms forever.
  const failedSavesRef = useRef(0);

  useEffect(() => {
    if (!isSupabaseConfigured()) { setReady(true); return; }
    loadFocusList().then(data => {
      if (data === null) {
        console.error('Focus list failed to load — auto-save disabled this session to protect existing data.');
        return;
      }
      persistedRef.current = JSON.stringify(data);
      setFocusList(data);
      setReady(true);
    });
    const unsub = subscribeToFocusList(data => {
      if (Date.now() - justSavedAt.current < 3000) return;
      persistedRef.current = JSON.stringify(data);
      setFocusList(data);
    });
    return () => unsub();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isSupabaseConfigured() || !ready) return;
    const next = JSON.stringify(focusList);
    if (next === persistedRef.current) return;
    if (failedSavesRef.current >= 3) {
      console.error('Focus list: 3 consecutive failed saves — auto-save stopped. Reload to retry.');
      return;
    }
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      justSavedAt.current = Date.now();
      saveFocusList(focusList).then(ok => {
        if (ok) {
          persistedRef.current = next;
          failedSavesRef.current = 0;
        } else {
          failedSavesRef.current += 1;
        }
        // Re-diff against current state: it may have changed mid-flight.
        setSaveTick(t => t + 1);
      });
    }, 500);
    return () => clearTimeout(saveTimerRef.current);
  }, [focusList, ready, saveTick]); // eslint-disable-line react-hooks/exhaustive-deps

  return { focusList, setFocusList };
}
