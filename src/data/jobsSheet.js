// Brief G, Build 1b — the rules behind the Jobs Sheet page.
//
// Everything here is pure: no React, no Supabase, no dates. The page component
// is the eyes and hands; this file is the judgement. It exists separately so
// the parts that can quietly go wrong — which tag means how many hours, what
// "2-4" in the Hours box means, and which columns a Commit is actually allowed
// to write — can be tested without rendering anything.

import { statusFlagsFor } from './pdfImportPlan.js';

// The six fields Trevor owns, in app-shape names. `backlog` is the BL column
// and `project` is the PJ column (the old CSV header name). Kept in step with
// APP_OWNED_JOB_FIELDS in joinJobs.js — that constant decides what the CSV may
// no longer write, this one decides what the sheet may edit. Same six.
export const SHEET_EDITABLE_FIELDS = Object.freeze([
  'tag', 'hours', 'action', 'vb', 'backlog', 'project',
]);

// The Multitrack facts. Shown, never editable here — the PDF import owns them.
export const SHEET_READONLY_FIELDS = Object.freeze([
  'job', 'customer', 'mfr', 'model', 'status', 'desc',
]);

// Difficulty bands, and the hours picking each one fills in. These are the
// bottom of the next band up (EZ tops out at 1.5, M at 3, T at 5.5), so the
// number offered is the honest worst case for that tag rather than a midpoint
// that quietly under-books the day. H has no ceiling; 6 is the starting point.
// Same order as inferTag() in jobs.js: EZ, M, T, H.
export const TAG_HOURS = Object.freeze({
  EZ: 1.5,
  M: 3,
  T: 5.5,
  H: 6,
});

export const TAG_OPTIONS = Object.freeze(['', 'EZ', 'M', 'T', 'H']);

// Workflow codes. These drive the Planning and Waiting piles, which is exactly
// why the sheet offers a list instead of a text box — a typo like "IMC" does
// not error, it silently drops the job out of the pile it belongs in.
// WP (Waiting Parts) is Trevor's own marker, added 2026-07-31. Multitrack has a
// distinct "Waiting Parts" status but the import flattens every flavour of
// waiting to plain `Waiting`, so the app cannot tell a parts hold from a
// customer hold on status alone. WP is a label only — it deliberately does NOT
// change `schedulable` in jobs.js, so a WP job stays visible in the week's
// candidates and just carries the tag.
// FB (Fabrication) means a jig or fixture has to be made before the repair can
// start. The jig itself is booked as a manual split on the Admin bench — it is
// real hours but never charged out, so it must not sit on a revenue bench.
// Like WP, FB is a label only and does not change `schedulable`.
export const ACTION_OPTIONS = Object.freeze(['', 'GTS', 'INC', 'CI', 'RS', 'RS-C', 'DG', 'WP', 'FB']);

// A value already on a job that the picker does not offer — 'SKP' on a handful
// of jobs, or anything an older import left behind. The sheet shows it as-is
// and lets Trevor keep it. Nothing branches on it; it is just not thrown away.
export function withLegacyOption(options, current) {
  const v = (current ?? '').toString();
  if (!v || options.includes(v)) return options;
  return [...options, v];
}

// Hours the picker offers for a tag, or null for "no tag, no opinion".
export function hoursForTag(tag) {
  const h = TAG_HOURS[(tag ?? '').toString().trim().toUpperCase()];
  return h === undefined ? null : h;
}

// What Trevor typed in an Hours box, as a number.
//
// A range is the point of this function. He estimates in ranges — "2-4" means
// somewhere between two and four hours — and the Sheet has always averaged
// those to a single number for scheduling. Losing that would mean re-learning
// a habit to suit the software.
//
// Returns null for blank or unparseable rather than 0: an unknown estimate and
// a zero-hour job are different things, and `hours` is a nullable column.
export function parseHoursInput(raw) {
  const s = (raw ?? '').toString().trim();
  if (!s) return null;

  // Only a range in the middle counts. A leading '-' is a negative number, and
  // hours are never negative.
  const range = s.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);
  if (range) {
    const lo = Number(range[1]);
    const hi = Number(range[2]);
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
    return round2((lo + hi) / 2);
  }

  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return round2(n);
}

// Averaging 2-3 gives 2.5; averaging 1-2.05 would give 1.525. Two decimal
// places is more precision than a bench estimate ever has, and it keeps the
// number readable in the cell.
function round2(n) {
  return Math.round(n * 100) / 100;
}

// Whether an Hours box holds something we could not read. Blank is fine — it
// just means "not estimated yet". Anything else that fails to parse is a typo
// worth flagging before Commit, not silently discarding.
export function isHoursInputInvalid(raw) {
  const s = (raw ?? '').toString().trim();
  if (!s) return false;
  return parseHoursInput(s) === null;
}

// The starting state of one row's editable boxes, taken off the live job.
export function initialRowDraft(job) {
  return {
    tag: job.tag ?? '',
    hoursText: job.hours === null || job.hours === undefined || job.hours === '' ? '' : String(job.hours),
    action: job.action ?? '',
    vb: !!job.vb,
    backlog: !!job.backlog,
    project: !!job.project,
  };
}

// Picking a tag fills in the matching hours. It does NOT lock them — the box
// stays typeable, and a tag whose hours Trevor has already overridden is left
// alone unless he picks the tag again. Clearing the tag leaves hours as they
// are; forgetting a tag should not wipe an estimate.
export function applyTagToDraft(draft, tag) {
  const h = hoursForTag(tag);
  if (h === null) return { ...draft, tag };
  return { ...draft, tag, hoursText: String(h) };
}

// What actually changed on one row, in app-shape field names.
//
// Comparison is done on the parsed value, not the text, so retyping "3" as
// "3.0" or "2-4" as "1-5"'s equal average is not a change and does not get
// written. Booleans compare as booleans.
export function draftChanges(job, draft) {
  const changes = {};

  // Cleared boxes are written as null, not empty string. That is what the
  // column already holds elsewhere — job 1671's bad Action was blanked to NULL
  // by hand during checkpoint 3b — and both readers of these fields
  // (deriveJobStatusFlags and blockedPile in jobs.js) coerce with `|| ''`, so
  // null and '' behave identically in the app. One shape in the database beats
  // two that mean the same thing.
  const tag = (draft.tag ?? '').toString();
  if (tag !== (job.tag ?? '').toString()) changes.tag = tag || null;

  const action = (draft.action ?? '').toString();
  if (action !== (job.action ?? '').toString()) changes.action = action || null;

  const hours = parseHoursInput(draft.hoursText);
  const current = job.hours === null || job.hours === undefined || job.hours === ''
    ? null
    : Number(job.hours);
  const currentNorm = Number.isFinite(current) ? current : null;
  // An unreadable box is left out entirely rather than written as null — the
  // page flags it instead, so a typo can never blank a real estimate.
  if (!isHoursInputInvalid(draft.hoursText) && hours !== currentNorm) changes.hours = hours;

  if (!!draft.vb !== !!job.vb) changes.vb = !!draft.vb;
  if (!!draft.backlog !== !!job.backlog) changes.backlog = !!draft.backlog;
  if (!!draft.project !== !!job.project) changes.project = !!draft.project;

  return changes;
}

// Turn the whole sheet into the write list batchWriteJobsState() expects.
//
// Two things matter here and both are about not damaging rows we aren't
// editing. First: only genuinely changed columns go in, so a Commit that
// touched one Action writes one column on one row. Second: `job` rides along
// on every row even though the sheet cannot edit it — the jobs table has
// `job TEXT NOT NULL`, and batchWriteJobsState upserts, so a row without it
// would be rejected outright. Its value is copied straight off the live job,
// so it is written back unchanged.
//
// batchWriteJobsState groups rows by their exact column set before sending, so
// rows with different edits never NULL-fill each other. Nothing here goes near
// a fixed-row batch writer, which would rewrite every column on every row.
export function buildSheetWrites(jobs, drafts) {
  const writes = [];
  for (const job of jobs) {
    const draft = drafts[job.id];
    if (!draft) continue;
    const changes = draftChanges(job, draft);
    if (Object.keys(changes).length === 0) continue;
    writes.push({ id: job.id, data: { ...changes, job: job.job } });
  }
  return writes;
}

// Apply a committed row's changes to the in-memory job.
//
// This is not cosmetic. Two of the six fields Trevor edits here — Action and
// BL — are inputs to the Planning / Waiting / Ready piles, and those piles are
// worked out when jobs are loaded, not stored in the database. The realtime
// subscription that would normally re-derive them is deliberately muted for
// five seconds after any of our own writes, so if the page only patched the
// raw fields, a job moved to INC would sit in the wrong pile until a reload.
// statusFlagsFor is the same one-and-only copy of that rule the PDF import
// uses, so the two paths cannot drift apart.
//
// `job` is stripped: it rides along on the write purely to satisfy the NOT NULL
// column and its value never changed, so it has no business in a merge.
export function applySheetEdits(job, changes) {
  const { job: _ignored, ...fields } = changes;
  const merged = { ...job, ...fields };
  return { ...merged, ...statusFlagsFor(merged, merged.backlog === true) };
}
