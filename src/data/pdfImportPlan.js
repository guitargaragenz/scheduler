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

// The departure gate (council amendment 6).
//
// Departing a job is the one thing an import does that takes work OFF the
// board, and only ONE printout is allowed to do it: the Multitrack jobs list,
// where a job dropping off genuinely means "finished or invoiced". The
// Jobs-by-Age printout is a different population entirely — its `missing[]`
// means "no booked-in date available", not "job finished" — and a future edit
// that let it depart would silently wipe most of the workshop.
//
// So this is a token, not a comment. It is produced by buildPdfImportPlan()
// and by nothing else, it is required by writeDepartureBatch(), and
// buildJbaImportPlan() has no way to emit it: its plan simply has no
// departureSource key, so the JBA path hands `undefined` to the writer and the
// writer refuses. Verified by test, not asserted.
export const MULTITRACK_DEPARTURE_SOURCE = 'multitrack-printout';

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
//
// `vb` defaults to false because the PDF never carries VB — the same reason
// `action` is hardcoded empty on the new-job path. Callers that DO have a real
// job in hand (the Jobs Sheet, and applyPdfFields updating an existing row)
// pass it, or a VB job would read as schedulable here while blockedPile() calls
// it blocked everywhere else.
export function statusFlagsFor(fields, backlog = false, vb = false) {
  const flags = deriveJobStatusFlags(fields.status, fields.action ?? '', backlog);
  const blocked = blockedPile({ status: fields.status, action: fields.action ?? '', backlog, vb }) != null;
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
  const bench = inferBench(fields.desc, fields.status, '', fields.model, fields.mfr, benchKeywords, false, false);
  // Same rule the CSV importer used: a job with no hours figure that is ready to be
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
  return { ...job, ...fields, ...statusFlagsFor({ ...fields, action: job.action }, job.backlog === true, job.vb === true) };
}

/**
 * Compare a parsed PDF against the jobs currently on the board.
 *
 * Returns either { ok: false, error } — nothing may be written — or a plan:
 *   { ok: true, filename, statedCount,
 *     newJobs[], existingCount, returning[], departures[],  // the preview screen
 *     writes[], departureSource }            // what the writers get
 *
 * `knownJobIds` is the UNFILTERED list of job identities straight from the
 * jobs table — [{ id, departedAt }] — and it is not optional decoration.
 * The in-memory `jobs` array has already had departed rows filtered out of it,
 * so on its own it cannot tell "job number we have never seen" from "job number
 * that departed last month and is back". Getting that wrong writes a blank new
 * job over a real row and strands its hours, tag and notes behind a departed_at
 * that nothing ever clears (council amendment 1).
 *
 * Passing `null` (no database configured, or the read failed) is honoured
 * rather than guessed at: the plan comes back with canDepart false and departs
 * nothing. Departing on a failed read would empty the board.
 *
 * `weekMarks` and `weekMonday` are the week page's marks and the local
 * YYYY-MM-DD of the CURRENT week's Monday. They exist for one reason: a job
 * Trevor closed on the week page this week must stay visible on the board for
 * the rest of that week. Multitrack drops a job off its printout the moment it
 * is invoiced, so without this the next import takes the job off the board
 * mid-week and the week page loses the row Trevor just closed — the week's own
 * record of what got finished goes with it.
 *
 * They are arguments, not a lookup, so this function stays pure and testable:
 * it never reads the database and never asks what today is. The caller
 * (useJobs' preparePdfImport) hands in the marks it already has in memory and
 * the Monday of the real current week.
 *
 * This only ever DELAYS a departure. The job still departs on the first import
 * after the week rolls over, because the close key carries that week's Monday
 * and next week's key will not match it. Nothing here un-departs anything, and
 * nothing here departs a job that would not otherwise have departed.
 */
export function buildPdfImportPlan({ parsed, statedCount, jobs = [], filename = '', benchKeywords = {}, knownJobIds = null, weekMarks = null, weekMonday = null }) {
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

  // The unfiltered view of the jobs table. `canDepart` is false when we do not
  // have one — see the doc comment above.
  const canDepart = Array.isArray(knownJobIds);
  const departedIds = new Set(
    (knownJobIds || []).filter(k => k.departedAt).map(k => String(k.id))
  );

  const newJobs = [];
  const updates = [];
  const returning = [];
  for (const p of parsed) {
    const ref = String(p.ref);
    const current = onBoard.get(ref);
    if (current) {
      updates.push({ parsed: p, current });
    } else if (departedIds.has(ref)) {
      // Departed and back. Its row still holds everything Trevor put on it, so
      // this must be an UPDATE that clears departed_at — never a fresh
      // buildNewJob(), which would overwrite bench and hours with guesses.
      returning.push({ id: ref, label: `#${ref}`, parsed: p });
    } else {
      newJobs.push(buildNewJob(p, benchKeywords));
    }
  }

  // Jobs on the board that this printout no longer lists, minus any held back
  // by a close mark from this week (see below). Multitrack has
  // finished or invoiced them, so they come off the board — the row stays, with
  // every app-owned field intact, and comes back whole if the number ever
  // reappears. This is the list Trevor sees, by number, before he presses
  // Import: it is the last line of defence against a wrong-population PDF,
  // which the count refusal above cannot catch.
  const inPdf = new Set(parsed.map(p => String(p.ref)));

  // Held back: closed on the week page THIS week.
  //
  // The close mark lives in bench_week_marks under the job id, beside the seven
  // day keys, as the single key `close:<that week's Monday>`. The key is built
  // inline here rather than imported from the week page: this is the data
  // layer, and it must not depend on a page component (council amendment 2).
  // The format is the one weekCloseKey() writes, and the tests below pin it.
  //
  // Missing marks are simply no marks. `null` (never loaded, or the read
  // failed), `undefined` and `{}` all mean "nothing is held back" and the
  // import departs exactly as it did before. That is deliberately NOT the
  // `knownJobIds` rule above, where a failed read blocks every departure —
  // there, a bad read would depart the whole workshop, so refusing is the safe
  // side. Here a bad read at worst departs a job a week earlier than Trevor
  // would like, and its row keeps everything on it. Blocking every departure
  // because the marks table hiccupped would be the bigger harm.
  const closeKey = weekMonday ? `close:${weekMonday}` : null;
  const closedThisWeek = (id) => Boolean(closeKey && weekMarks && weekMarks[id]?.[closeKey]);

  const departingJobs = canDepart
    ? topLevel.filter(j => !inPdf.has(String(j.id)) && !closedThisWeek(String(j.id)))
    : [];
  const missing = departingJobs.map(j => ({ id: String(j.id), label: jobLabel(j) }));
  const departures = departingJobs.map(j => ({
    id: String(j.id),
    job: j.job,
    label: jobLabel(j),
    // Captured here, while the job is still on the board and still in memory.
    // After departure it is filtered out of jobs[] and these ids are only
    // reachable from the row itself, which is why writeDepartureBatch() parks
    // them in departed_gcal_event_ids rather than dropping them.
    gcalEventIds: j.gcalEventIds?.length ? j.gcalEventIds : (j.gcalEventId ? [j.gcalEventId] : []),
  }));

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
    ...returning.map(({ parsed: p }) => ({
      id: String(p.ref),
      isNew: false,
      isReturning: true,
      // departedAt: null is the whole point of this write. Without it the
      // upsert refreshes the six PDF fields on a row that stays invisible.
      //
      // done: false because a completed job never returns — returning work is
      // rebooked under a new number. So a reappearing job number is live work,
      // and a stale `done` from before it departed would hide it from the Jobs
      // page (which filters `!j.done`) while the Jobs Sheet still showed it.
      data: { ...pdfFieldsOf(p), departedAt: null, done: false },
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
    returning: returning.map(({ id, label }) => ({ id, label })),
    missing,
    departures,
    canDepart,
    // The token writeDepartureBatch() demands. Only this function emits it.
    departureSource: MULTITRACK_DEPARTURE_SOURCE,
    writes,
  };
}
