// Parser for the Multitrack (mTrack) "Job Search" PDF printout.
//
// Ported from the standalone workshop-scheduler prototype
// (BUILDS/NEW SCHEDULER BUILD/workshop-scheduler/lib/parseMultitrackPdf.ts),
// converted from TypeScript to plain JS because this repo builds with Vite/JSX
// and has no TypeScript toolchain. The parsing algorithm is unchanged from the
// prototype, which was tuned against the real PDF — the only addition is that
// the footer's own job count is now captured instead of discarded (the import
// path refuses to write when the count it parsed disagrees with the count the
// PDF states).
//
// The PDF is a printed HTML table, so there is no structured data in it at
// all: every cell arrives as a loose text run with an x/y position. What makes
// it parseable is that the column x-positions are stable:
//   customer ~30 | manufacturer ~192 | model ~299 | status ~434 | job no >=500
// Under each job row sits a "Fault: <description>" line (fault text at x ~66).
// Cells can wrap onto extra lines: wrapped lines sit 13-14pt from their
// neighbour, while separate table rows are 17-18pt apart — that gap is the
// only way to tell a wrapped fault line from the next row's wrapped customer.
//
// SIX FIELDS AND NOTHING ELSE. The PDF carries ref / customer / manufacturer /
// model / status / fault. Tag, Hours, Action, VB and BL are Trevor's own
// fields, maintained by hand and never printed by Multitrack. This parser must
// never invent them, so that the import path physically cannot overwrite them.

const WRAP_GAP = 15.5; // <= this many pt below the previous line = same paragraph

// The PDF renders fi/fl ligatures as separate glyphs, which extract with stray
// spaces: "fi x", "fl at-wounds", "Paci fi ca". Rejoin them. Matches only when
// "fi"/"fl" stands alone between spaces or starts a broken word, which real
// English essentially never produces.
// Exported for the Jobs-by-Age parser (Build 1c). Multitrack renders both
// printouts with the same font, so the same ligature damage appears in both —
// but there must only ever be ONE copy of this rule, or the two parsers will
// drift and the same manufacturer name will read differently depending on
// which PDF it came in on.
export function fixLigatures(s) {
  // Mid-word split like "Grif fi n" / "Paci fi ca": short tail after the
  // ligature means the word continues on both sides — close both gaps.
  // Longer tail ("loose fi nger") means only the ligature+tail form the word.
  return s
    .replace(/([A-Za-z]) (fi|fl) ([a-z]{1,2})(?![a-z-])/g, '$1$2$3')
    .replace(/(^| )(fi|fl) ([a-z])/g, '$1$2$3');
}

// The job reference, derived from the text runs that landed in the job-number
// column. Exported so the Jobs-by-Age parser (Build 1c) derives its refs with
// EXACTLY this logic and not a lookalike.
//
// This matters more than it looks. A job's ref IS its `id` in the jobs table,
// and every PDF write upserts ON CONFLICT (id). A ref that parses even
// slightly differently — a stray space, a non-breaking space, a zero-width
// character — does not fail: it quietly INSERTS a second row for a job that
// already exists, while every preview count still reads correctly. One shared
// helper is the only thing keeping the two parsers agreeing on identity.
export function deriveRef(parts) {
  return (parts ?? []).join(' ').trim();
}

// Group positioned text items into visual lines, top of page downwards.
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

function columnOf(x) {
  if (x >= 500) return 'ref';
  if (x >= 420) return 'status';
  if (x >= 290) return 'model';
  if (x >= 180) return 'manufacturer';
  return 'customer';
}

function isHeaderLine(line) {
  const texts = line.items.map(i => i.str.trim());
  return texts.includes('Customer') && texts.includes('Status') && texts.includes('Job');
}

function isRowLine(line) {
  return line.items.some(i => i.x >= 500 && /^\d+$/.test(i.str.trim()));
}

// Checked BEFORE any column assignment, deliberately. A handful of fault
// descriptions are long enough to spill past x=500 into the job-number
// column; because they all sit on a "Fault:" line, catching the line first
// means that bleed never gets mistaken for a job number.
function isFaultLine(line) {
  return line.items[0]?.str.trim().startsWith('Fault');
}

// The printout ends with its own tally, e.g. "46 Jobs found". That number is
// Multitrack's word for how many rows it printed, and it is the only
// independent check available on whether the parse read the whole document.
const FOOTER_COUNT_RE = /^(\d+)\s+Jobs?\s+found/i;

/**
 * Pure parse over positioned text items, one array per page, in page order.
 * Returns { jobs, statedCount } — statedCount is the number from the PDF's own
 * footer, or null if the footer was never reached (a truncated or unexpected
 * document). Callers must treat a null or mismatched statedCount as a refusal
 * to import, not as something to paper over.
 */
export function parseTextItems(pages) {
  const jobs = [];
  let statedCount = null;

  // Cells of the record currently being assembled, per column.
  let cells = null;
  let fault = null;
  let lastFaultLineY = null; // for wrap-gap check, per page
  // Fragment lines seen before the next row line (wrapped cells of the
  // upcoming record, e.g. a long customer name's first line).
  let pendingFragments = [];
  let started = false;
  let done = false;

  const addCell = (target, it) => {
    const col = columnOf(it.x);
    (target[col] ??= []).push(it.str.trim());
  };

  const finalize = () => {
    if (!cells) return;
    const ref = deriveRef(cells.ref);
    if (ref) {
      jobs.push({
        ref,
        customer: fixLigatures((cells.customer ?? []).join(' ').trim()),
        manufacturer: fixLigatures((cells.manufacturer ?? []).join(' ').trim()),
        model: fixLigatures((cells.model ?? []).join(' ').trim()),
        // Status is NOT ligature-fixed: it is a fixed vocabulary of short
        // words from Multitrack, never free text, so there is nothing to
        // repair and every reason not to alter it.
        status: (cells.status ?? []).join(' ').trim(),
        fault: fixLigatures((fault ?? []).join(' ').trim()),
      });
    }
    cells = null;
    fault = null;
  };

  for (const pageItems of pages) {
    if (done) break;
    lastFaultLineY = null; // y coordinates reset every page
    for (const line of toLines(pageItems)) {
      const firstText = line.items[0].str.trim();

      if (!started) {
        if (isHeaderLine(line)) started = true;
        continue;
      }
      const footer = FOOTER_COUNT_RE.exec(firstText);
      if (footer) {
        statedCount = Number(footer[1]);
        done = true;
        break;
      }
      if (isHeaderLine(line)) continue; // repeated header on a later page

      if (isFaultLine(line)) {
        // Wrapped cells that appeared between the row line and its fault line
        // (e.g. second line of a long customer name) belong to the current row.
        if (cells) {
          for (const it of pendingFragments) addCell(cells, it);
          pendingFragments = [];
        }
        fault = line.items.slice(1).map(i => i.str.trim());
        lastFaultLineY = line.y;
        continue;
      }

      if (isRowLine(line)) {
        finalize();
        cells = {};
        for (const it of pendingFragments) addCell(cells, it);
        pendingFragments = [];
        for (const it of line.items) addCell(cells, it);
        lastFaultLineY = null;
        continue;
      }

      // A line with no job number: either the current fault wrapping onward,
      // or a wrapped cell of a neighbouring row. Line spacing decides.
      if (fault !== null && lastFaultLineY !== null && lastFaultLineY - line.y <= WRAP_GAP) {
        for (const it of line.items) fault.push(it.str.trim());
        lastFaultLineY = line.y;
      } else {
        pendingFragments.push(...line.items);
      }
    }
  }
  // Runs after the loop as well as on every row boundary, so the last record
  // before the footer is still emitted.
  finalize();
  return { jobs, statedCount };
}

/**
 * Read a PDF's bytes and return its positioned text runs, one array per page,
 * in page order. Shared by both Multitrack parsers (Build 1c) — this is
 * pdfjs plumbing, not layout knowledge, and the Vite worker setup below is
 * fiddly enough that a second copy would eventually diverge and 404.
 */
export async function loadPdfPages(data) {
  // Both imports are dynamic on purpose. pdfjs is a large dependency used by
  // exactly one screen, and this keeps it out of the main bundle until Trevor
  // actually drops a PDF.
  const pdfjs = await import('pdfjs-dist');
  // Vite-specific: `?url` makes Vite emit the worker as a build asset and hand
  // back its final hashed URL. The prototype used
  // `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)`, which is
  // a webpack/Next idiom — Vite does not resolve bare package specifiers inside
  // new URL(), so that form builds cleanly and then 404s the worker at runtime.
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const doc = await pdfjs.getDocument({ data }).promise;
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    pages.push(
      content.items.flatMap(it =>
        'str' in it ? [{ str: it.str, x: it.transform[4], y: it.transform[5] }] : []
      )
    );
  }
  return pages;
}

/**
 * Browser entry: read a dropped PDF file's bytes and parse it.
 * Returns { jobs, statedCount }, same as parseTextItems.
 */
export async function parseMultitrackPdf(data) {
  return parseTextItems(await loadPdfPages(data));
}
