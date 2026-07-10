import { useEffect, useRef } from 'react';
import { isFirebaseConfigured, loadSchedule, saveSchedule, subscribeToSchedule, saveCompletedJobs, subscribeToCompletedJobs } from '../utils/firebase.js';
import { createSubtasks } from '../data/jobs.js';

// Re-expand split subtasks after Firebase load so hard refresh doesn't wipe them.
// Manual splits (isSplit: true, drawer-created) are stored in Firebase and restored directly.
// Auto-splits are re-derived from createSubtasks() since they're not stored as separate entries.
function withSplitsExpanded(rawJobs, existingJobs = [], knownSlots = {}) {
  const existingById = Object.fromEntries(existingJobs.map(j => [j.id, j]));
  const scheduledIds = new Set(Object.values(knownSlots));

  // Collect stored sub-tasks (parentId set) keyed by parentId
  const storedSubtasksByParent = {};
  for (const job of rawJobs) {
    if (!job.parentId) continue;
    if (!storedSubtasksByParent[job.parentId]) storedSubtasksByParent[job.parentId] = [];
    storedSubtasksByParent[job.parentId].push(job);
  }

  const result = [];
  for (const job of rawJobs) {
    if (job.parentId) continue;

    // Manual splits — stored manual children (isSubtask) are authoritative:
    // restore them even if the parent's isSplit flag was lost (self-heals flag
    // loss; safe now that un-split deletes children). Auto-split children can
    // also appear in the stored doc — they lack isSubtask and are re-derived
    // below instead of restored.
    const storedManualKids = (storedSubtasksByParent[job.id] || []).filter(st => st.isSubtask);
    if (storedManualKids.length > 0) {
      result.push({ ...job, isSplit: true });
      for (const st of storedManualKids) {
        result.push({
          ...st,
          scheduled:    scheduledIds.has(st.id),
          calendarSlot: st.calendarSlot ?? null,
          gcalEventId:  st.gcalEventId  ?? null,
          gcalEventIds: st.gcalEventIds ?? [],
        });
      }
      continue;
    }

    // User deliberately un-split this job (handleSaveDrawer collapsed it to a
    // single card). createSubtasks() derives purely from bench/desc/hours,
    // which haven't changed, so without this persisted marker there is no way
    // to distinguish "never auto-split" from "user un-split it" — regenerating
    // here would silently revert the un-split on every reload/subscription tick.
    if (job.noAutoSplit) {
      result.push({ ...job, hasSubtasks: false, subtasks: null, manualSplits: false });
      continue;
    }

    // Auto-splits — regenerate from createSubtasks()
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
          gcalEventIds: prev?.gcalEventIds ?? [],
        });
      }
    } else {
      result.push({ ...job, hasSubtasks: false, subtasks: null, manualSplits: false });
    }
  }
  return result;
}

export { withSplitsExpanded };

// A top-level, not-yet-done job whose job number is present in `prevJobs` but
// absent from `incomingJobs` — it vanished from a CSV/Sheet sync without ever
// being marked done in-app (Trevor's real workflow finishes in Multitrack).
function detectDisappearedJobs(prevJobs, incomingJobs) {
  const incomingTopLevelJobNos = new Set(
    incomingJobs.filter(j => !j.parentId).map(j => j.job)
  );
  return prevJobs.filter(j =>
    !j.parentId && !j.done && j.job != null && !incomingTopLevelJobNos.has(j.job)
  );
}

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
  onJobsDisappeared,
}) {
  const saveTimerRef = useRef(null);
  // No prior jobs[] to diff against on the very first onSnapshot tick after
  // mount — skip disappearance detection that one time to avoid flagging
  // every job as "disappeared" against an empty/default baseline.
  const hasSeenFirstSnapshotRef = useRef(false);

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
      if (data.jobs) {
        setJobs(prev => {
          if (hasSeenFirstSnapshotRef.current) {
            const disappeared = detectDisappearedJobs(prev, data.jobs);
            if (disappeared.length > 0) onJobsDisappeared?.(disappeared);
          } else {
            hasSeenFirstSnapshotRef.current = true;
          }
          return withSplitsExpanded(data.jobs, prev, data.scheduledSlots || {});
        });
      }
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
