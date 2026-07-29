// Brief G, Build 1a — turning a parsed Multitrack PDF into a reviewable plan.
//
// Nothing here writes anything. This module answers one question: "if we
// imported this PDF, what would change?" — so that Trevor sees the answer and
// says yes before a single row is touched. It also carries the two refusals
// that stop a bad drop reaching the database at all.

import { inferBench, deriveJobStatusFlags, blockedPile } from './jobs.js';

// A top-level job on the board is one Multitrack knows about, and its id is
// its job number. The app's own split cards (1620_Electronics_0, 1689_Luthier_1
// and the like) are the app's business entirely — the PDF has never heard of
// them, so they are excluded from matching, from writing, and from every count
// on the preview screen.
// Exported since Brief G, Build 1b: the Jobs Sheet page needs exactly the same
// test, and two copies of "what counts as a top-level job" would drift.
export function isTopLevelJob(job) {
  return !job.parentId && !job.isDerived && /^\d+$/.test(String(job.id ?? ''));
}

export function jobLabel(job) {
  const kit = [job.mfr, job.model].filter(Boolean).join(' ');
  const who = job.customer ? ` — ${job.customer}` : '';
  return `#${job.job}${kit ? ` ${kit}` : ''}${who}`;
}

// The six PDF fields, in app-shape names. Status is included and always wins:
// it is what drives the pile colours, and Multitrack is the authority on it.
function pdfFieldsOf(parsedJob) {
  return {
    job: parsedJob.ref,
    customer: parsedJob.customer,
    mfr: parsedJob.manufacturer,
    model: parsedJob.model,
    status: parsedJob.status,
    desc: parsedJob.fault,
  };
}

// Status flags are app-side derived state, not stored columns — recomputed
// here so a status change from the PDF moves the job to the right pile
// immediately, rather than only after the next reload.
//
// Exported since Brief G, Build 1b. The Jobs Sheet page needs the identical
// recompute for the opposite reason: it edits `action` and `backlog`, which
// are the OTHER two inputs to these flags. The realtime subscription is muted
// for five seconds after any of our own writes (justSavedAt in useSupabase),
// so the echo that would have refreshed these flags is deliberately dropped —
// whoever changes one of the three inputs has to recompute them itself, or a
// job Trevor moves to INC keeps its old pile until the next reload. One copy,
// so the PDF path and the sheet page can never disagree about the rule.
export function statusFlagsFor(fields, backlog = false) {
  const flags = deriveJobStatusFlags(fields.status, fields.action ?? '', backlog);
  const blocked = blockedPile({ status: fields.status, action: fields.action ?? '', backlog }) != null;
  return { ...flags, schedulable: flags.schedulable && !blocked };
}

/**
 * Build the app-shape object for a job the PDF has introduced for the first
 * time. Shaped to match what normalizeJobsFromDb() will hand back on the next
 * load, so the card does not visibly change the moment the write lands.
 *
 * Bench is inferred from the PDF's own description, using the same
 * inferBench() the CSV path has always used. Hours takes the same 1-hour
 * default a schedulable job gets there.
 *
 * Tag, Action, VB and BL are deliberately left empty. The PDF does not carry
 * them, nothing here may guess at them, and there is no editor for them in
 * this build — that is Build 1b.
 */
export function buildNewJob(parsedJob, benchKeywords = {}) {
  const fields = pdfFieldsOf(parsedJob);
  const flags = statusFlagsFor(fields);
  const bench = inferBench(fields.desc, fields.status, '', fields.model, fields.mfr, benchKeywords, false);
  // Same rule as parseCSV: a job with no hours figure that is ready to be
  // worked on gets one hour, so it is schedulable rather than invisible.
  // Anything blocked stays at 0 until Trevor says otherwise.
  const hours = flags.schedulable ? 1 : 0;

  return {
    id: String(parsedJob.ref),
    parentId: null,
    ...fields,
    bench,
    hours,
    days: null,
    scheduled: false,
    calendarSlot: null,
    gcalEventId: null,
    tag: null,
    action: null,
    vb: false,
    backlog: false,
    project: false,
    ...flags,
    hasSubtasks: false,
    subtasks: [],
    isSplit: false,
    noAutoSplit: false,
    isSubtask: false,
    isDerived: false,
    sessionNote: null,
    sessionIndex: null,
    sessionTotal: null,
    pieceDone: false,
    done: false,
    gcalEventIds: [],
    pomoLog: [],
    bumpHistory: [],
  };
}

/** Apply only the six PDF fields to a job already on the board. */
export function applyPdfFields(job, parsedJob) {
  const fields = pdfFieldsOf(parsedJob);
  return { ...job, ...fields, ...statusFlagsFor({ ...fields, action: job.action }, job.backlog === true) };
}

/**
 * Compare a parsed PDF against the jobs currently on the board.
 *
 * Returns either { ok: false, error } — nothing may be written — or a plan:
 *   { ok: true, filename, statedCount,
 *     newJobs[], existingCount, missing[],   // the preview screen
 *     writes[] }                             // what writePdfImportBatch gets
 */
export function buildPdfImportPlan({ parsed, statedCount, jobs = [], filename = '', benchKeywords = {} }) {
  // Refusal 1 — the count sanity check. The printout ends with Multitrack's
  // own tally ("46 Jobs found"). If we read a different number of rows than
  // the PDF says it printed, we have misread the document, and importing part
  // of a workshop is worse than importing none of it: the jobs we missed
  // would show up on the preview as "no longer in this drop", which reads as
  // "these are finished" when it actually means "we couldn't read them".
  if (statedCount == null) {
    return {
      ok: false,
      error: "Couldn't find the \"N Jobs found\" line at the end of this PDF, so there's no way to check the whole thing was read. Nothing imported.",
    };
  }
  if (parsed.length !== statedCount) {
    return {
      ok: false,
      error: `This PDF says it has ${statedCount} jobs but only ${parsed.length} could be read. Nothing imported — the file may be damaged, or Multitrack may have changed its layout.`,
    };
  }

  // Refusal 2 — the same job number twice in one PDF. That can only be a
  // misread, and it would also make the database reject the whole write.
  const seen = new Set();
  const duplicates = [];
  for (const p of parsed) {
    if (seen.has(p.ref)) duplicates.push(p.ref);
    seen.add(p.ref);
  }
  if (duplicates.length > 0) {
    return {
      ok: false,
      error: `Job ${duplicates.join(', ')} appears more than once in this PDF. Nothing imported.`,
    };
  }

  const topLevel = jobs.filter(isTopLevelJob);
  const onBoard = new Map(topLevel.map(j => [String(j.id), j]));

  const newJobs = [];
  const updates = [];
  for (const p of parsed) {
    const ref = String(p.ref);
    const current = onBoard.get(ref);
    if (current) updates.push({ parsed: p, current });
    else newJobs.push(buildNewJob(p, benchKeywords));
  }

  // Reported, never acted on. A job that has dropped off the printout has
  // usually been finished or invoiced in Multitrack, but "usually" is not
  // good enough to delete live job data on, so this build only tells Trevor.
  const inPdf = new Set(parsed.map(p => String(p.ref)));
  const missing = topLevel
    .filter(j => !inPdf.has(String(j.id)))
    .map(j => ({ id: String(j.id), label: jobLabel(j) }));

  const writes = [
    ...newJobs.map(j => ({
      id: j.id,
      isNew: true,
      data: {
        job: j.job, customer: j.customer, mfr: j.mfr, model: j.model,
        status: j.status, desc: j.desc, bench: j.bench, hours: j.hours,
      },
    })),
    ...updates.map(({ parsed: p }) => ({
      id: String(p.ref),
      isNew: false,
      data: pdfFieldsOf(p),
    })),
  ];

  return {
    ok: true,
    filename,
    statedCount,
    newJobs,
    newLabels: newJobs.map(j => ({ id: j.id, label: jobLabel(j) })),
    existingCount: updates.length,
    updates,
    missing,
    writes,
  };
}
