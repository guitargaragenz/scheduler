import { useEffect, useRef } from 'react';
import { isFirebaseConfigured, loadSchedule, saveSchedule, subscribeToSchedule, saveCompletedJobs, subscribeToCompletedJobs } from '../utils/firebase.js';
import { createSubtasks } from '../data/jobs.js';

// Re-expand split subtasks after Firebase load so hard refresh doesn't wipe them.
// Splits are derived from createSubtasks() on each job — not stored as raw Firebase entries.
function withSplitsExpanded(rawJobs, existingJobs = [], knownSlots = {}) {
  const existingById = Object.fromEntries(existingJobs.map(j => [j.id, j]));
  const scheduledIds = new Set(Object.values(knownSlots));
  const result = [];
  for (const job of rawJobs) {
    if (job.parentId) continue;
    const subtasks = createSubtasks(job);
    if (subtasks && subtasks.length > 0) {
      result.push({ ...job, hasSubtasks: true, subtasks: subtasks.map(s => s.id) });
      for (const st of subtasks) {
        const prev = existingById[st.id];
        result.push({
          ...st,
          scheduled:    prev?.scheduled    ?? scheduledIds.has(st.id),
          calendarSlot: prev?.calendarSlot ?? null,
          gcalEventId:  prev?.gcalEventId  ?? null,
        });
      }
    } else {
      result.push({ ...job, hasSubtasks: false, subtasks: null, manualSplits: false });
    }
  }
  return result;
}

export { withSplitsExpanded };

// Manages Firebase load, real-time subscribe, debounced save, and completed jobs.
// justSavedAt: shared ref owned by App.jsx — stamp before any mutation to suppress echo snapshots.
export function useFirebase({
  jobs,
  scheduledSlots,
  setJobs,
  setScheduledSlots,
  setFirebaseReady,
  setLastSyncedAt,
  setCompletedJobs,
  setDoneJobIds,
  justSavedAt,
  firebaseReady,
}) {
  const saveTimerRef = useRef(null);

  // Load on mount + subscribe to real-time updates from other devices
  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    loadSchedule().then(data => {
      if (data) {
        if (data.jobs) setJobs(prev => withSplitsExpanded(data.jobs, prev, data.scheduledSlots || {}));
        if (data.scheduledSlots) setScheduledSlots(data.scheduledSlots);
        if (data.updatedAt) setLastSyncedAt(data.updatedAt);
      }
      setFirebaseReady(true);
    });

    const unsub = subscribeToSchedule(data => {
      if (Date.now() - justSavedAt.current < 5000) return;
      if (data.jobs) setJobs(prev => withSplitsExpanded(data.jobs, prev, data.scheduledSlots || {}));
      if (data.scheduledSlots) setScheduledSlots(data.scheduledSlots);
      if (data.updatedAt) setLastSyncedAt(data.updatedAt);
    });
    return () => unsub();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Subscribe to completed jobs / done IDs
  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    const unsub = subscribeToCompletedJobs(data => {
      setCompletedJobs(data.records || []);
      setDoneJobIds(data.doneJobIds || []);
    });
    return () => unsub();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced save — coalesces rapid changes into a single write
  useEffect(() => {
    if (!isFirebaseConfigured() || !firebaseReady) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      justSavedAt.current = Date.now();
      saveSchedule(jobs, scheduledSlots);
    }, 1500);
    return () => clearTimeout(saveTimerRef.current);
  }, [jobs, scheduledSlots, firebaseReady]); // eslint-disable-line react-hooks/exhaustive-deps

  return { saveCompletedJobs };
}
