import { useEffect, useRef, useState } from 'react';
import { isFirebaseConfigured, loadFocusList, saveFocusList, subscribeToFocusList } from '../utils/firebase.js';

// Focus list — job IDs Trevor is prioritizing this week, picked from the
// Sunday board-meeting interview. Kept in its own doc so it never touches
// the `jobs` array or the CSV drift-safety check.
export function useFocusList() {
  const [focusList, setFocusList] = useState([]);
  const [ready, setReady] = useState(false);
  const justSavedAt = useRef(0);
  const saveTimerRef = useRef(null);

  useEffect(() => {
    if (!isFirebaseConfigured()) { setReady(true); return; }
    loadFocusList().then(data => { setFocusList(data); setReady(true); });
    const unsub = subscribeToFocusList(data => {
      if (Date.now() - justSavedAt.current < 3000) return;
      setFocusList(data);
    });
    return () => unsub();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!isFirebaseConfigured() || !ready) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      justSavedAt.current = Date.now();
      saveFocusList(focusList);
    }, 500);
    return () => clearTimeout(saveTimerRef.current);
  }, [focusList, ready]); // eslint-disable-line react-hooks/exhaustive-deps

  return { focusList, setFocusList };
}
