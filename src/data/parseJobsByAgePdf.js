// Parser for the Multitrack (mTrack) "Jobs by Age" (JBA) PDF printout.
//
// Build 1c, Brief G. This is the second Multitrack printout the app reads, and
// it exists for exactly ONE fact: the date a job came in the door. Multitrack
// prints that nowhere else, and without it the app can only ever store the age
// it was told once, frozen, instead of computing it fresh every morning.
//
// ONE FIELD AND NOTHING ELSE. The JBA printout also carries Mfr, Model, Status
// and a Desc line, and it is very tempting to read them here too "while we're
// in the document". That is the two-masters bug in a new place: the Jobs PDF
// already owns those four columns. Two importers writing the same column means
// whichever PDF Trevor dropped last wins, silently, and neither of them is
// wrong on its own. So this parser emits the job number and the date in, and
// deliberately throws the rest of the document away.
//
// Layout, same story as the Jobs PDF — a printed HTML table with no structure
// in it, only text runs at stable x positions:
//   date in ~30 | mfr ~111 | model ~218 | status ~380 | days ~461 | job no >=500
// Under a row may sit a "Desc: ..." line, and manufacturer names wrap onto
// lines both ABOVE and BELOW their own row. None of that is read here, which
// is why this parser needs none of the Jobs PDF's wrap-gap machinery.
//
// The footer differs from the Jobs PDF and this is easy to miss: the Jobs PDF
// ends "46 Jobs found", the JBA ends "47 Jobs by Age", printed as two separate
// text runs. The Jobs parser's footer pattern does not match it.

import { deriveRef, loadPdfPages } from './parseMultitrackPdf.js';

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
 * Pure parse over positioned text items, one array per page, in page order.
 * Returns { jobs, statedCount } where each job is { ref, dateIn } and dateIn is
 * a YYYY-MM-DD string exactly as Multitrack printed it.
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

  for (const pageItems of pages) {
    if (done) break;
    for (const line of toLines(pageItems)) {
      if (isDescLine(line)) continue;

      if (!started) {
        // Pages after the first carry no repeated header — rows start
        // immediately — so once started, stay started.
        if (isHeaderLine(line)) started = true;
        continue;
      }

      const stated = footerCount(line);
      if (stated !== null) {
        statedCount = stated;
        done = true;
        break;
      }

      if (isHeaderLine(line)) continue; // repeated header, if it ever appears

      const row = rowFields(line);
      if (row) jobs.push(row);
    }
  }

  return { jobs, statedCount };
}

/**
 * Browser entry: read a dropped Jobs-by-Age PDF's bytes and parse it.
 * Returns { jobs, statedCount }, same shape as parseJobsByAgeTextItems.
 */
export async function parseJobsByAgePdf(data) {
  return parseJobsByAgeTextItems(await loadPdfPages(data));
}
