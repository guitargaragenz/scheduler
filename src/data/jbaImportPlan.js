// Brief G, Build 1c — turning a parsed Jobs-by-Age PDF into a reviewable plan.
//
// Same shape and the same job as pdfImportPlan.js, and deliberately a separate
// module rather than a branch inside that one: the two printouts share nothing
// but their refusals. The Jobs PDF writes six columns and introduces new jobs;
// this one writes a single column, `first_seen`, and introduces nothing.
//
// Nothing here writes. It answers "if we imported this, what would change?"
// and hands the answer to the preview screen.

import { isTopLevelJob, jobLabel } from './pdfImportPlan.js';

/**
 * Compare a parsed Jobs-by-Age PDF against the jobs currently on the board.
 *
 * Returns either { ok: false, error } — nothing may be written — or a plan:
 *   { ok: true, kind: 'jba', filename, statedCount,
 *     filled[], unchangedCount, changed[], missing[], unknown[],
 *     writes[] }   // what writeJbaImportBatch() gets
 */
export function buildJbaImportPlan({ parsed, statedCount, jobs = [], filename = '' }) {
  // Refusal 1 — the count sanity check, identical in spirit to the Jobs PDF's.
  // The JBA footer reads "47 Jobs by Age". If we read a different number of
  // rows than the document says it printed, we misread it, and a partial age
  // import is worse than none: the rows we missed would appear on the preview
  // as "on the board but not in this file", which reads as "these are finished"
  // when it actually means "we couldn't read them".
  if (statedCount == null) {
    return {
      ok: false,
      error: "Couldn't find the \"N Jobs by Age\" line at the end of this PDF, so there's no way to check the whole thing was read. Nothing imported.",
    };
  }
  if (parsed.length !== statedCount) {
    return {
      ok: false,
      error: `This PDF says it has ${statedCount} jobs but only ${parsed.length} could be read. Nothing imported — the file may be damaged, or Multitrack may have changed its layout.`,
    };
  }

  // Refusal 2 — the same job number twice. A misread, and the database would
  // reject the whole write anyway.
  const seen = new Set();
  const duplicates = [];
  for (const p of parsed) {
    if (seen.has(String(p.ref))) duplicates.push(p.ref);
    seen.add(String(p.ref));
  }
  if (duplicates.length > 0) {
    return {
      ok: false,
      error: `Job ${duplicates.join(', ')} appears more than once in this PDF. Nothing imported.`,
    };
  }

  const topLevel = jobs.filter(isTopLevelJob);
  const onBoard = new Map(topLevel.map(j => [String(j.id), j]));

  const filled = [];     // had no date, now has one
  const changed = [];    // had a DIFFERENT date, and this file overwrites it
  const unknown = [];    // in the PDF, not on the board — reported, never written
  let unchangedCount = 0;
  const writes = [];

  for (const p of parsed) {
    const ref = String(p.ref);
    const job = onBoard.get(ref);

    // A ref in this file that is not on the board is skipped, never inserted.
    // The Jobs-by-Age printout owns one column and is not how jobs get onto the
    // board — inserting here would create a row carrying a job number and a
    // date and nothing else: a half-blank phantom that looks like a real job.
    // Drop the Jobs PDF to introduce it, then this file will fill its date.
    if (!job) {
      unknown.push({ id: ref, dateIn: p.dateIn });
      continue;
    }

    const current = job.firstSeen ? String(job.firstSeen).slice(0, 10) : null;
    if (current === p.dateIn) {
      unchangedCount++;
      continue; // already correct — no point writing it again
    }

    if (current) {
      // Trevor's ruling, 2026-07-29: a differing date in the printout wins.
      // Multitrack is the authority on when a guitar came in the door. But an
      // overwrite must never be invisible, which is why this is counted and
      // listed on the preview rather than folded in with the rest.
      changed.push({ id: ref, label: jobLabel(job), from: current, to: p.dateIn });
    } else {
      filled.push({ id: ref, label: jobLabel(job), to: p.dateIn });
    }

    // `job` rides along on every row because Postgres checks NOT NULL against
    // the proposed insert row before ON CONFLICT resolves it onto the existing
    // one — see the comment block at joinJobs.js:135-171. writeJbaImportBatch()
    // rejects a row without it.
    writes.push({ id: ref, job: job.job, data: { firstSeen: p.dateIn } });
  }

  // Reported, never acted on — same rule as the Jobs PDF. A job absent from the
  // age report has usually been finished or invoiced in Multitrack, but
  // "usually" is not good enough to touch live job data on.
  const inPdf = new Set(parsed.map(p => String(p.ref)));
  const missing = topLevel
    .filter(j => !inPdf.has(String(j.id)))
    .map(j => ({ id: String(j.id), label: jobLabel(j) }));

  return {
    ok: true,
    kind: 'jba',
    filename,
    statedCount,
    filled,
    changed,
    unchangedCount,
    missing,
    unknown,
    writes,
  };
}
