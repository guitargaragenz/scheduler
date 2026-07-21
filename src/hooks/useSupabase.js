import { useEffect, useRef } from 'react';
import {
  isSupabaseConfigured,
  loadJobs, subscribeToJobs,
  loadScheduledSlots, subscribeToScheduledSlots,
  saveJob, deleteJob, upsertJobsBatch,
  appendConflictLog,
} from '../utils/supabase.js';
import { expandAutoSplits } from '../data/joinJobs.js';

// Detect top-level jobs that disappeared from the jobs table
// (e.g., CSV sync removed them without marking done in-app)
//
// `incomingJobs` here is the ALREADY-normalized/expanded array, so it is in
// app (camelCase) shape. Derived auto-split cards are excluded on both sides:
// they aren't real rows, they're regenerated every load, and a parent whose
// desc changed so it no longer auto-splits would otherwise report its old
// bench cards as vanished revenue.
function detectDisappearedJobs(prevJobs, incomingJobs) {
  const incomingJobNumbers = new Set(
    incomingJobs.filter(j => !j.parentId && !j.isDerived).map(j => j.job)
  );
  return prevJobs.filter(j =>
    !j.parentId && !j.isDerived && !j.done && j.job != null && !incomingJobNumbers.has(j.job)
  );
}

// Transform Supabase jobs (snake_case) back to app format (camelCase), then
// regenerate the derived auto-split bench cards. That regeneration step is
// not optional bookkeeping: auto-split cards are derived-not-stored by
// design, so without it big jobs simply never break into bench cards.
function normalizeJobsFromDb(dbJobs, benchHours = {}) {
  const mapped = dbJobs.map(j => ({
    id: j.id,
    parentId: j.parent_id || null,
    job: j.job,
    customer: j.customer,
    mfr: j.mfr,
    model: j.model,
    status: j.status,
    bench: j.bench,
    // Coerced: a NUMERIC column can come back as a string over PostgREST,
    // and every split calculation in createSubtasks() is arithmetic — a
    // string here turns the derived cards' hours into NaN.
    hours: j.hours == null ? j.hours : Number(j.hours),
    scheduled: j.scheduled,
    calendarSlot: j.calendar_slot || null,
    gcalEventId: j.gcal_event_id || null,
    desc: j.desc,
    tag: j.tag,
    action: j.action,
    VB: j.vb,
    BL: j.bl,
    PJ: j.pj,
    hasSubtasks: j.has_subtasks,
    subtasks: j.subtasks || [],
    isSplit: j.is_split,
    noAutoSplit: j.no_auto_split,
    isSubtask: j.is_subtask,
    isDerived: j.is_derived || false,
    sessionNote: j.session_note,
    sessionIndex: j.session_index,
    sessionTotal: j.session_total,
    pieceDone: j.piece_done,
    done: j.done,
    gcalEventIds: j.gcal_event_ids || [],
    pomoLog: j.pomo_log || [],
    bumpHistory: j.bump_history || [],
    created_at: j.created_at,
    updated_at: j.updated_at,
  }));

  return expandAutoSplits(mapped, benchHours);
}

// NOTE: slot normalization lives in loadScheduledSlots() in utils/supabase.js,
// which returns the map already shaped as slotKey -> jobId. A duplicate
// normalizer used to sit here building objects instead; it was dead code and
// the wrong shape, so it was removed rather than left as a trap.

export function useSupabase({
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
  const prevJoinedJobsRef = useRef([]);
  const hasSeenFirstSnapshotRef = useRef(false);

  // The init useEffect below has `[]` deps, so the realtime subscription
  // callback closes over whatever benchHours was on first render — Settings
  // are loaded asynchronously, so that is usually the empty default and the
  // subscription would regenerate every bench card with the wrong hours
  // forever. A ref kept current on every render is read instead of the
  // captured value.
  const benchHoursRef = useRef(benchHours);
  benchHoursRef.current = benchHours;

  // Load and normalize jobs from Supabase
  async function loadAndSetJobs() {
    const dbJobs = await loadJobs();
    const normalized = normalizeJobsFromDb(dbJobs, benchHoursRef.current);

    setJobs(normalized);
    prevJoinedJobsRef.current = normalized;
    setLastSyncedAt(new Date().toISOString());

    return normalized;
  }

  // Load and normalize scheduled slots
  async function loadAndSetSlots() {
    const dbSlots = await loadScheduledSlots();
    setScheduledSlots(dbSlots);
    return dbSlots;
  }

  // Initialize on mount
  useEffect(() => {
    if (!isSupabaseConfigured()) return;

    (async () => {
      await loadAndSetJobs();
      await loadAndSetSlots();
      setFirebaseReady(true);
    })();

    // Subscribe to jobs changes
    const unsubJobs = subscribeToJobs(async (updated) => {
      // Suppress echo if we just saved
      if (Date.now() - justSavedAt.current < 5000) return;

      const normalized = normalizeJobsFromDb(updated, benchHoursRef.current);

      // Detect disappeared jobs
      if (hasSeenFirstSnapshotRef.current) {
        const disappeared = detectDisappearedJobs(prevJoinedJobsRef.current, normalized);
        if (disappeared.length > 0) onJobsDisappeared?.(disappeared);
      } else {
        hasSeenFirstSnapshotRef.current = true;
      }

      setJobs(normalized);
      prevJoinedJobsRef.current = normalized;
      setLastSyncedAt(new Date().toISOString());
    });

    // Subscribe to slots changes
    const unsubSlots = subscribeToScheduledSlots(setScheduledSlots);

    return () => {
      unsubJobs?.();
      unsubSlots?.();
    };
  }, []);

  // Expose methods matching useFirebase.js interface
  return {
    loadJobs: loadAndSetJobs,
    loadScheduledSlots: loadAndSetSlots,
    saveJob,
    deleteJob,
    upsertJobsBatch,
    appendConflictLog,
  };
}
