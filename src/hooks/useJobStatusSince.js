import { useEffect, useRef, useState } from 'react';
import {
  isSupabaseConfigured,
  loadStatusSince,
  upsertStatusSince,
  clearStatusSince,
  subscribeToStatusSince,
} from '../utils/supabase.js';

// The stuck clock. Owns job_status_since: when each top-level job last entered
// its current status + action, which is what turns "waiting" into "waiting 12
// days". Multitrack does not carry this and nothing else in the system knows it.
//
// ── Why this is NOT a copy of useFocusList ─────────────────────────────────
// useFocusList gates its writes on a `ready` flag set only after its own table
// read succeeds. Copying that here would look right and still be destructive,
// because this hook depends on TWO reads, not one:
//
//   1. job_status_since  — guarded by `ready`, same as the focus list.
//   2. jobs[]            — NOT guarded by anything. loadJobs() fails silently
//                          and returns an empty array (utils/supabase.js,
//                          `return jobsCache`, which is [] on a cold load), and
//                          useSupabase.loadAndSetJobs() then calls setJobs([])
//                          unconditionally.
//
// So `ready === true` with `jobs === []` is a completely reachable state, and a
// naive "clear every stored row whose job is gone" rule would wipe the entire
// table in that state — destroying every real stuck age at once, irreversibly.
// hasSeenFirstSnapshotRef in useSupabase does not help: it is only ever flipped
// inside the realtime subscription, never by loadAndSetJobs.
//
// The fix is structural, not another guard layer: a row is only ever deleted
// when its job is PRESENT AND DONE. Absence is never a reason to delete. A
// stale row costs nothing — it is keyed by job_id and gets re-adopted if the
// job comes back, which is the same re-import case that is the reason there is
// no foreign key on this table. The extra gates below are belt-and-braces on
// top of that, not the primary defence.

// Whole days between two instants, computed from LOCAL midnights rather than a
// raw millisecond difference or toISOString(). NZ is UTC+12/+13: a UTC-based
// diff reads a day off for half of every day, and NZ observes DST so some local
// days are 23 or 25 hours long — hence Math.round on the day count rather than
// a floor over a fixed 86400000.
function localMidnight(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export function stuckDaysBetween(since, now = new Date()) {
  if (!since) return null;
  const start = since instanceof Date ? since : new Date(since);
  if (Number.isNaN(start.getTime())) return null;
  const days = Math.round((localMidnight(now) - localMidnight(start)) / 86400000);
  return days < 0 ? 0 : days;
}

// status/action are compared normalized so trailing whitespace or a case change
// in the export can't churn a clock that hasn't really moved.
function norm(v) {
  return (v == null ? '' : String(v)).trim().toUpperCase();
}

// Pure. Given the current jobs array and what the table is known to hold,
// returns the writes to make. Exported so every branch — including the two
// destructive ones — is unit-testable without mounting React.
//
// The rule:
//   for each top-level, not-done job:
//     no stored row                      -> upsert { status, action, since: now }
//     stored status or action differs    -> upsert { status, action, since: now }
//     otherwise                          -> leave alone
//   for each stored row whose job is PRESENT AND done -> delete
//
// Action is part of the comparison, not just status: Waiting/INC -> Waiting/CI
// has genuinely changed pile (Planning -> Waiting) and must restart the clock
// even though the status string is identical.
export function planStatusSinceReconcile({ jobs = [], stored = {}, now = new Date() }) {
  const sinceIso = now.toISOString();

  // Top-level only. Split children (parentId) and derived auto-split bench
  // cards (isDerived) have no MT status of their own — they inherit the
  // parent's by object spread, so giving them rows would multiply one job's
  // clock across several ids that all move together.
  const topLevel = jobs.filter(j => j && !j.parentId && !j.isDerived);

  const upserts = [];
  const doneWithRows = [];

  for (const job of topLevel) {
    const id = String(job.id);
    if (job.done) {
      if (stored[id]) doneWithRows.push(id);
      continue;
    }
    const row = stored[id];
    if (!row || norm(row.status) !== norm(job.status) || norm(row.action) !== norm(job.action)) {
      upserts.push({
        jobId: id,
        status: job.status ?? '',
        action: job.action ?? null,
        since: sinceIso,
      });
    }
  }

  // Last-resort brake. Nothing above should ever produce a mass delete — the
  // only delete reason is present-and-done — but if some future change did,
  // refusing the pass is cheap and losing every stuck age is not.
  const storedCount = Object.keys(stored).length;
  let deletes = doneWithRows;
  let refusedDelete = false;
  if (deletes.length > 0 && storedCount > 0 && deletes.length > storedCount / 2) {
    deletes = [];
    refusedDelete = true;
  }

  return { upserts, deletes, refusedDelete };
}

// jobs: the app's live jobs array. firebaseReady: App.jsx's flag saying the
// first real Supabase load has completed — the reconcile must not run before it.
export function useJobStatusSince(jobs, { firebaseReady = false } = {}) {
  const [statusSince, setStatusSince] = useState({});
  // Set only after job_status_since has been read back successfully. A failed
  // read leaves the hook read-only for the session; a reload retries.
  const [ready, setReady] = useState(false);
  // True once writes have failed. Round 2 renders this as an in-app banner
  // ("stuck ages unavailable, not saving"); until then stuckDays() returns null
  // so the UI shows nothing rather than a confident, wrong 0d. Brief D already
  // logged that a failed save is console-only and Trevor doesn't open the
  // console — a wrong number he trusts is far worse than a missing one.
  const [saveError, setSaveError] = useState(false);

  const storedRef = useRef({});
  const justSavedAt = useRef(0);
  const failedSavesRef = useRef(0);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    let alive = true;

    loadStatusSince().then(data => {
      if (!alive) return;
      if (data === null) {
        console.error('Job status clock failed to load — writes disabled this session to protect existing stuck ages.');
        return;
      }
      storedRef.current = data;
      setStatusSince(data);
      setReady(true);
    });

    const unsub = subscribeToStatusSince(data => {
      if (!alive) return;
      if (Date.now() - justSavedAt.current < 3000) return;
      storedRef.current = data;
      setStatusSince(data);
    });

    return () => { alive = false; unsub?.(); };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    // Gate 1: the table read must have succeeded.
    if (!ready) return;
    // Gate 2: the jobs read must have happened for real. firebaseReady is
    // App.jsx's "first Supabase load finished" flag; jobs.length > 0 catches the
    // empty first render and the silent loadJobs() failure that returns [].
    if (!firebaseReady) return;
    if (!Array.isArray(jobs) || jobs.length === 0) return;
    if (failedSavesRef.current >= 3) return;

    const { upserts, deletes, refusedDelete } = planStatusSinceReconcile({
      jobs,
      stored: storedRef.current,
    });

    if (refusedDelete) {
      console.error('Job status clock: refused a reconcile pass that would have cleared more than half the stored rows.');
    }
    if (upserts.length === 0 && deletes.length === 0) return;

    let cancelled = false;
    (async () => {
      justSavedAt.current = Date.now();
      let ok = true;
      if (upserts.length > 0) {
        const res = await upsertStatusSince(upserts);
        ok = ok && Boolean(res?.ok);
      }
      if (deletes.length > 0) {
        const res = await clearStatusSince(deletes);
        ok = ok && Boolean(res?.ok);
      }
      if (cancelled) return;
      if (!ok) {
        failedSavesRef.current += 1;
        setSaveError(true);
        return;
      }
      failedSavesRef.current = 0;
      setSaveError(false);
      const next = { ...storedRef.current };
      upserts.forEach(u => { next[u.jobId] = { status: u.status, action: u.action, since: u.since }; });
      deletes.forEach(id => { delete next[id]; });
      storedRef.current = next;
      setStatusSince(next);
    })();

    return () => { cancelled = true; };
  }, [jobs, ready, firebaseReady]);

  // Whole days the job has sat in its current status+action, or null if we
  // don't know — no clock row yet, the table never loaded, or writes are
  // failing. Callers must render nothing for null, never 0.
  function stuckDays(jobId) {
    if (!ready || saveError) return null;
    const row = statusSince[String(jobId)];
    if (!row) return null;
    return stuckDaysBetween(row.since);
  }

  return { statusSince, stuckDays, statusSinceReady: ready, statusSinceError: saveError };
}
