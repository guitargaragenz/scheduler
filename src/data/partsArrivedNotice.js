import { partsMayHaveArrived } from './jobs.js';

// The "parts may have arrived" notice — who it names, and who it has stopped
// naming because Trevor already dismissed them.
//
// Membership is `partsMayHaveArrived()` and nothing else. This file adds no new
// rule about what counts as unstuck; it only decides which of those jobs are
// still worth putting on screen.
//
// WHY THIS IS DERIVED FROM `jobs[]` RATHER THAN FROM THE IMPORT RESULT
//
// The notice has to survive a page reload, and after a reload there is no
// import result left to remember — only the jobs and the dismissed list. So the
// banner is a pure function of those two things: every job that qualifies right
// now, minus every job number he has already waved away. That gives the
// reload-survival and the "don't nag me twice" behaviour from one piece of
// stored state instead of two that could disagree.
//
// THE DISMISSED LIST IS PRUNED, NOT APPENDED FOREVER
//
// A job number leaves the dismissed list the moment it stops qualifying — i.e.
// when Multitrack puts it back on Waiting/Hold/In Transit, or the WP tag comes
// off. That is the whole mechanism behind "a job that re-blocks and later comes
// free notifies again": it is not a special case anywhere, it falls out of
// keeping the dismissed list to only the jobs it is currently suppressing.
//
// Job NUMBERS, not row ids, because the number is what he reads on the
// Multitrack printout and what the banner prints.

/** Job numbers as strings, ignoring blanks. */
export function jobNumberOf(job) {
  const n = job?.job;
  if (n === null || n === undefined || n === '') return null;
  return String(n);
}

/**
 * The real, top-level jobs that qualify right now.
 *
 * Done jobs are out (there is nothing left to book). Child rows are out too:
 * split pieces and auto-split bench cards carry their parent's job number, so
 * including them would print the same number two or three times in one banner.
 */
export function qualifyingJobs(jobs = []) {
  const seen = new Set();
  const out = [];
  for (const job of jobs) {
    if (!job || job.done || job.parentId || job.isDerived) continue;
    if (!partsMayHaveArrived(job)) continue;
    const num = jobNumberOf(job);
    if (!num || seen.has(num)) continue;
    seen.add(num);
    out.push(job);
  }
  return out.sort((a, b) => Number(jobNumberOf(a)) - Number(jobNumberOf(b)));
}

/** Whatever came out of the settings store, as a clean list of job-number strings. */
export function sanitizeDismissed(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  const seen = new Set();
  for (const v of value) {
    if (v === null || v === undefined || v === '') continue;
    const s = String(v).trim();
    if (!s || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }
  return out;
}

/**
 * The dismissed list with the entries it no longer needs to suppress removed.
 *
 * Returns the SAME array instance when nothing needed dropping, so a caller can
 * use identity to decide whether a write to the settings store is warranted and
 * not churn the database on every render.
 */
export function pruneDismissed(dismissed, jobs = []) {
  const clean = sanitizeDismissed(dismissed);
  const qualifying = new Set(qualifyingJobs(jobs).map(jobNumberOf));
  const kept = clean.filter(num => qualifying.has(num));
  return kept.length === clean.length ? dismissed : kept;
}

/** The jobs the banner should name: qualifying, minus already dismissed. */
export function noticeJobs(jobs = [], dismissed = []) {
  const hidden = new Set(sanitizeDismissed(dismissed));
  return qualifyingJobs(jobs).filter(j => !hidden.has(jobNumberOf(j)));
}

/**
 * The dismissed list after ✕.
 *
 * Everything currently on the notice goes on, on top of whatever was already
 * there. Anything stale in the stored list is dropped in the same move, so ✕ is
 * also the moment the list gets tidied — a dismissal cannot resurrect a number
 * that stopped qualifying while the banner was up.
 */
export function dismissAll(jobs = [], dismissed = []) {
  const stillValid = sanitizeDismissed(pruneDismissed(dismissed, jobs));
  const nowShowing = noticeJobs(jobs, dismissed).map(jobNumberOf);
  return sanitizeDismissed([...stillValid, ...nowShowing]);
}
