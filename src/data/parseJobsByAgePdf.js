// Parser for the Multitrack (mTrack) "Jobs by Age" (JBA) PDF printout.
//
// Build 1c, Brief G, extended by the Desc build (2026-08-01). This is the
// second Multitrack printout the app reads, and it exists for two facts: the
// date a job came in the door, and the job's description.
//
// TWO FIELDS AND NOTHING ELSE — and the second one was added deliberately,
// reversing Build 1c's original "ONE FIELD" rule. That rule is worth restating
// because it is still right about everything else: the JBA printout also
// carries Mfr, Model and Status, and it is very tempting to read them here too
// "while we're in the document". That is the two-masters bug — the Jobs PDF
// already owns those three columns, and two importers writing the same column
// means whichever PDF Trevor dropped last wins, silently, with neither of them
// wrong on its own.
//
// Desc is the one exception, and it is an exception because the two printouts
// are NOT equally good sources for it. The Jobs PDF prints the description
// truncated — genuinely cut off mid-word by Multitrack itself, not by our
// parser. Verified on the 31 Jul pair: job 1708 prints "...stp eli" on the Jobs
// PDF and "...stp elixir 12s Est $1000" here; 1632 prints "...deep" there and
// "...deep clean Q:$600 inc" here. The Jobs PDF line simply ends, with no
// continuation line for anyone to have dropped.
//
// So this is not two masters fighting. It is one master per lifecycle stage:
// the Jobs PDF introduces a job and writes its description ONCE at creation,
// and this printout owns the column from then on. That ownership is enforced
// structurally by JBA_IMPORT_FIELDS in utils/supabase.js, not by convention.
//
// Layout, same story as the Jobs PDF — a printed HTML table with no structure
// in it, only text runs at stable x positions:
//   date in ~30 | mfr ~111 | model ~218 | status ~380 | days ~461 | job no >=500
// Under a row sits a "Desc: ..." line (label at x~30, text from x~66), and
// manufacturer names wrap onto lines both ABOVE and BELOW their own row.
//
// The Desc line itself WRAPS, which is why this parser now does need the Jobs
// PDF's wrap-gap rule (imported, never re-implemented — see isWrapContinuation).
// Taking only the first Desc line would swap Multitrack's truncation for one of
// our own. Measured off the 31 Jul printout:
//   next table row      17.2 - 17.3pt below   -> not a continuation
//   wrapped Desc line          13.5pt below   -> continuation, and starts at x~30
//   wrapped Mfr name        6.7 - 6.8pt away  -> NOT ours, and sits at x~110.8
// The mfr wrap is closer than the wrap gap, so spacing alone cannot separate
// it from a Desc continuation. The x position can, and does: see DESC_TEXT_MAX_X.
//
// The footer differs from the Jobs PDF and this is easy to miss: the Jobs PDF
// ends "46 Jobs found", the JBA ends "47 Jobs by Age", printed as two separate
// text runs. The Jobs parser's footer pattern does not match it.

import { deriveRef, fixLigatures, isWrapContinuation, loadPdfPages } from './parseMultitrackPdf.js';

// Group positioned text items into visual lines, top of page downwards.
// Deliberately NOT shared with the Jobs PDF parser: line grouping is layout
// knowledge, and the two printouts are free to have different row spacing.
// The ref derivation and the pdfjs loading are shared; the layout is not.
function toLines(items) {
  const sorted = [...items]
    .filter(it => it.str.trim() !== '')
    .sort((a, b) => b.y - a.y || a.x - b.x);
  const lines = [];
  for (const it of sorted) {
    const last = lines[lines.length - 1];
    if (last && Math.abs(last.y - it.y) <= 3) last.items.push(it);
    else lines.push({ y: it.y, items: [it] });
  }
  return lines;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isHeaderLine(line) {
  const texts = line.items.map(i => i.str.trim());
  return texts.includes('Date In') && texts.includes('Days') && texts.includes('Job');
}

// A description line under a row. Checked before anything else, exactly as the
// Jobs parser checks "Fault:" first, so a long description can never be
// mistaken for table data.
function isDescLine(line) {
  return line.items[0]?.str.trim().startsWith('Desc');
}

// A wrapped Desc continuation starts back at the left margin (x~30, measured
// on the 31 Jul printout), where the "Desc:" label itself sits. A wrapped
// manufacturer name sits out in the Mfr column at x~110.8.
//
// This test is load-bearing and not belt-and-braces. A wrapped mfr name sits
// only 6.7pt from its row — well INSIDE the 15.5pt wrap gap — so if a job with
// a wrapped description were followed by a job with a wrapped manufacturer, the
// spacing rule alone would happily staple that manufacturer onto the previous
// job's description. The column position is the only thing that actually tells
// them apart. 100 is the same left-column boundary rowFields() uses for the
// date, kept identical so the two cannot drift.
const DESC_TEXT_MAX_X = 100;

// "47" and "Jobs by Age" arrive as two runs on the same line, so the footer
// cannot be matched against the first run alone.
const FOOTER_LABEL_RE = /^Jobs?\s+by\s+Age/i;
function footerCount(line) {
  const first = line.items[0]?.str.trim() ?? '';
  const second = line.items[1]?.str.trim() ?? '';
  if (!/^\d+$/.test(first)) return null;
  if (!FOOTER_LABEL_RE.test(second)) return null;
  return Number(first);
}

// A real table row must show BOTH a job number in the job column and a date in
// the date column. Requiring both is the guard against a wrapped description
// or manufacturer line being read as a row: those carry neither.
//
// The cost of requiring both is that a row printed without a date would be
// skipped — and that is the intended behaviour, not a gap. A skipped row makes
// the parsed count disagree with the footer's stated count, which the import
// plan refuses outright. A row silently imported with no date would instead
// look completely normal. Loud beats quiet.
function rowFields(line) {
  const refItem = line.items.find(i => i.x >= 500 && /^\d+$/.test(i.str.trim()));
  if (!refItem) return null;
  const dateItem = line.items.find(i => i.x < 100 && ISO_DATE_RE.test(i.str.trim()));
  if (!dateItem) return null;
  const ref = deriveRef([refItem.str.trim()]);
  if (!ref) return null;
  return { ref, dateIn: dateItem.str.trim() };
}

/**
 * Which of the two Multitrack printouts is this?
 *
 * Trevor drops both files onto the same button. Asking him to pick the right
 * one of two upload controls in three different places would be UI work, and
 * would also be a thing to get wrong at 8am — so the app reads the header row
 * and decides for itself. The JBA header carries "Date In" and "Days"; the Jobs
 * printout's header carries neither.
 *
 * Getting this wrong cannot corrupt anything: each parser only recognises its
 * own header, so a misdetected file parses zero rows and the stated-count
 * refusal in the import plan stops it dead with a message. It fails loudly.
 */
export function looksLikeJobsByAge(pages) {
  for (const pageItems of pages) {
    for (const line of toLines(pageItems)) {
      if (isHeaderLine(line)) return true;
    }
  }
  return false;
}

/**
 * Pure parse over positioned text items, one array per page, in page order.
 * Returns { jobs, statedCount } where each job is { ref, dateIn, desc? }:
 * dateIn is a YYYY-MM-DD string exactly as Multitrack printed it, and desc is
 * the full description with any wrapped second line joined on.
 *
 * `desc` is ABSENT, not empty, on a row that printed no Desc line or printed an
 * empty one. That distinction is deliberate and the import plan depends on it:
 * "this file has nothing to say about the description" must never be actioned
 * as "set the description to blank". The whole point of this build is fuller
 * descriptions, so blanking one on a printout quirk would be the worst possible
 * outcome — it would destroy text no other source still holds.
 *
 * statedCount is the number from the PDF's own footer, or null if the footer
 * was never reached (a truncated or unexpected document). A null or mismatched
 * statedCount is a refusal to import, never something to paper over — a short
 * parse of an age report looks identical to a genuinely shorter job list.
 */
export function parseJobsByAgeTextItems(pages) {
  const jobs = [];
  let statedCount = null;
  let started = false;
  let done = false;

  // The row whose description is currently being assembled, its text so far,
  // and the y of the last line that fed it. All three reset on every new row
  // and at every page break, so a description can never reach across either.
  let descTarget = null;
  let descParts = null;
  let lastDescY = null;

  const flushDesc = () => {
    if (!descTarget || !descParts) return;
    const text = fixLigatures(descParts.join(' ').trim()).trim();
    if (text) descTarget.desc = text;
  };

  const endDesc = () => {
    flushDesc();
    descTarget = null;
    descParts = null;
    lastDescY = null;
  };

  for (const pageItems of pages) {
    if (done) break;
    // y coordinates restart every page, so a stale y from the previous page
    // would make the gap arithmetic meaningless. Same reason the Jobs parser
    // resets lastFaultLineY per page.
    endDesc();
    for (const line of toLines(pageItems)) {
      if (isDescLine(line)) {
        // A Desc line before the header is not a description of anything.
        if (!started) continue;
        endDesc();
        // Attach to the row this Desc sits under — the most recent one read.
        // The printout always puts Desc after its row, never before it.
        const target = jobs[jobs.length - 1];
        if (target) {
          descTarget = target;
          descParts = line.items.slice(1).map(i => i.str.trim());
          lastDescY = line.y;
        }
        continue;
      }

      if (!started) {
        // Pages after the first carry no repeated header — rows start
        // immediately — so once started, stay started.
        if (isHeaderLine(line)) started = true;
        continue;
      }

      const stated = footerCount(line);
      if (stated !== null) {
        endDesc();
        statedCount = stated;
        done = true;
        break;
      }

      if (isHeaderLine(line)) continue; // repeated header, if it ever appears

      const row = rowFields(line);
      if (row) {
        endDesc();
        jobs.push(row);
        continue;
      }

      // A line that is neither a row nor a Desc label: either the current
      // description wrapping onward, or a wrapped manufacturer name belonging
      // to a neighbouring row. Both tests have to pass — see DESC_TEXT_MAX_X
      // for why the spacing rule alone is not enough.
      if (
        descParts &&
        isWrapContinuation(lastDescY, line.y) &&
        line.items[0].x < DESC_TEXT_MAX_X
      ) {
        for (const it of line.items) descParts.push(it.str.trim());
        lastDescY = line.y;
      }
    }
  }
  // Runs after the loop as well, so a description on the very last row before
  // the footer is still emitted.
  endDesc();

  return { jobs, statedCount };
}

/**
 * Browser entry: read a dropped Jobs-by-Age PDF's bytes and parse it.
 * Returns { jobs, statedCount }, same shape as parseJobsByAgeTextItems.
 */
export async function parseJobsByAgePdf(data) {
  return parseJobsByAgeTextItems(await loadPdfPages(data));
}
