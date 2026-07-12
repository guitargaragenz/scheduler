import { useEffect, useRef } from 'react';
import {
  isFirebaseConfigured,
  loadJobsMaster, subscribeToJobsMaster,
  loadJobsState, subscribeToJobsState, batchWriteJobsState,
  loadScheduledSlots, saveScheduledSlots, subscribeToScheduledSlots,
  saveCompletedJobs, subscribeToCompletedJobs,
} from '../utils/firebase.js';
import { joinJobsMasterState, jobsStateFieldsFor } from '../data/joinJobs.js';

export { joinJobsMasterState };

// A top-level, not-yet-done job whose job number is present in `prevJobs`
// (last joined output) but absent from the freshly-arrived jobsMaster
// snapshot — it vanished from a CSV/Sheet sync without ever being marked
// done in-app (Trevor's real workflow finishes/invoices in Multitrack).
// Compares against jobsMaster only, per architecture brief — jobsState
// changes never drive this check.
function detectDisappearedJobs(prevJobs, incomingMasterDocs) {
  const incomingJobNos = new Set(incomingMasterDocs.map(j => j.job));
  return prevJobs.filter(j =>
    !j.parentId && !j.done && j.job != null && !incomingJobNos.has(j.job)
  );
}

// Manages Firebase load, real-time subscribe (jobsMaster + jobsState +
// scheduledSlots, each its own doc/collection), a debounced diff-based
// jobsState save, and completed jobs.
//
// Persistence model: the three-way subscribe (master/state/slots) recomputes
// the flat `jobs` shape via joinJobsMasterState() on every snapshot from any
// of the three. On the write side, most app-owned field changes (scheduling
// drag/drop via useScheduler, GCal poll bumps, pomodoro logging, mark-done)
// just call setJobs/setScheduledSlots as before — this hook diffs the
// resulting jobs[] against the last-known-saved jobsState per job id and
// writes only what actually changed, as one writeBatch(), debounced 1.5s.
// That keeps every existing call site working unchanged while every write
// still lands as a real per-document Firestore write, never a whole-array
// overwrite. Split-set changes (handleSaveDrawer in useJobs.js) bypass this
// debounce entirely and issue their own immediate, atomic writeBatch(),
// since a mid-split crash must never be allowed to land as a partial write
// (architecture brief design decision #5).
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
  onSplitOrphansFound,
  benchHours,
}) {
  const masterRef = useRef([]);
  const stateRef = useRef([]);
  const prevJoinedJobsRef = useRef([]);
  const hasSeenFirstMasterSnapshotRef = useRef(false);
  const lastSavedStateRef = useRef({}); // job id -> JSON string of last-known-saved jobsState fields
  const stateSaveTimerRef = useRef(null);

  function recompute() {
    const { jobs: joined, orphans } = joinJobsMasterState(masterRef.current, stateRef.current, benchHours || {});
    joined.forEach(job => {
      lastSavedStateRef.current[job.id] = JSON.stringify(jobsStateFieldsFor(job));
    });
    setJobs(joined);
    prevJoinedJobsRef.current = joined;
    if (orphans.length > 0) onSplitOrphansFound?.(orphans);
  }

  // Load on mount + subscribe to real-time updates from other devices
  useEffect(() => {
    if (!isFirebaseConfigured()) return;

    Promise.all([loadJobsMaster(), loadJobsState(), loadScheduledSlots()]).then(([master, state, slots]) => {
      masterRef.current = master;
      stateRef.current = state;
      setScheduledSlots(slots);
      recompute();
      setLastSyncedAt(new Date().toISOString());
      setFirebaseReady(true);
    });

    const unsubMaster = subscribeToJobsMaster(master => {
      if (Date.now() - justSavedAt.current < 5000) return;
      if (hasSeenFirstMasterSnapshotRef.current) {
        const disappeared = detectDisappearedJobs(prevJoinedJobsRef.current, master);
        if (disappeared.length > 0) onJobsDisappeared?.(disappeared);
      } else {
        hasSeenFirstMasterSnapshotRef.current = true;
      }
      masterRef.current = master;
      recompute();
      setLastSyncedAt(new Date().toISOString());
    });

    const unsubState = subscribeToJobsState(state => {
      if (Date.now() - justSavedAt.current < 5000) return;
      stateRef.current = state;
      recompute();
    });

    const unsubSlots = subscribeToScheduledSlots(slots => {
      if (Date.now() - justSavedAt.current < 5000) return;
      setScheduledSlots(slots);
    });

    return () => { unsubMaster(); unsubState(); unsubSlots(); };
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

  // Debounced diff-save of jobsState — coalesces rapid changes into one
  // writeBatch() that touches only the docs whose app-owned fields actually
  // changed since the last save/load. Never deletes: removing a split
  // child's jobsState doc is handleSaveDrawer's job (its own atomic batch),
  // not this generic backstop's.
  useEffect(() => {
    if (!isFirebaseConfigured() || !firebaseReady) return;
    clearTimeout(stateSaveTimerRef.current);
    stateSaveTimerRef.current = setTimeout(() => {
      const writes = [];
      for (const job of jobs) {
        const fields = jobsStateFieldsFor(job);
        const serialized = JSON.stringify(fields);
        if (lastSavedStateRef.current[job.id] === serialized) continue;
        writes.push({ id: job.id, data: fields });
        lastSavedStateRef.current[job.id] = serialized;
      }
      if (writes.length === 0) return;
      justSavedAt.current = Date.now();
      batchWriteJobsState(writes);
    }, 1500);
    return () => clearTimeout(stateSaveTimerRef.current);
  }, [jobs, firebaseReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // scheduledSlots — its own single-writer doc, debounced independently.
  const slotsSaveTimerRef = useRef(null);
  useEffect(() => {
    if (!isFirebaseConfigured() || !firebaseReady) return;
    clearTimeout(slotsSaveTimerRef.current);
    slotsSaveTimerRef.current = setTimeout(() => {
      justSavedAt.current = Date.now();
      saveScheduledSlots(scheduledSlots);
    }, 1500);
    return () => clearTimeout(slotsSaveTimerRef.current);
  }, [scheduledSlots, firebaseReady]); // eslint-disable-line react-hooks/exhaustive-deps

  return { saveCompletedJobs };
}
