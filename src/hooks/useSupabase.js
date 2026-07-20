import { useEffect, useRef } from 'react';
import {
  isSupabaseConfigured,
  loadJobs, subscribeToJobs,
  loadScheduledSlots, subscribeToScheduledSlots,
  saveJob, deleteJob, upsertJobsBatch,
  appendConflictLog,
} from '../utils/supabase.js';

// Detect top-level jobs that disappeared from the jobs table
// (e.g., CSV sync removed them without marking done in-app)
function detectDisappearedJobs(prevJobs, incomingJobs) {
  const incomingJobNumbers = new Set(
    incomingJobs.filter(j => !j.parent_id).map(j => j.job)
  );
  return prevJobs.filter(j =>
    !j.parentId && !j.done && j.job != null && !incomingJobNumbers.has(j.job)
  );
}

// Transform Supabase jobs (snake_case) back to app format (camelCase)
function normalizeJobsFromDb(dbJobs) {
  return dbJobs.map(j => ({
    id: j.id,
    parentId: j.parent_id || null,
    job: j.job,
    customer: j.customer,
    mfr: j.mfr,
    model: j.model,
    status: j.status,
    bench: j.bench,
    hours: j.hours,
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
    created_at: j.created_at,
    updated_at: j.updated_at,
  }));
}

// Transform Supabase scheduledSlots (array) to app format (map)
function normalizeSlotsFromDb(dbSlots) {
  const map = {};
  (dbSlots || []).forEach(s => {
    map[s.slot_id] = {
      jobId: s.job_id,
      bench: s.bench,
      calendarSlot: s.slot_id,
    };
  });
  return map;
}

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

  // Load and normalize jobs from Supabase
  async function loadAndSetJobs() {
    const dbJobs = await loadJobs();
    const normalized = normalizeJobsFromDb(dbJobs);

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

      const normalized = normalizeJobsFromDb(updated);

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
