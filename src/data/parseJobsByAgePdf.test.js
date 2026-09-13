import { describe, it, expect } from 'vitest';
import { parseJobsByAgeTextItems, looksLikeJobsByAge } from './parseJobsByAgePdf.js';

// Hand-built positioned text items in the same shape pdfjs hands back (str +
// x/y in PDF points), laid out at the real Jobs-by-Age printout's column
// x-positions and line spacing, read off the 29 Jul 2026 export. Built by hand
// rather than shipping a real PDF so a live customer list stays out of the
// repo, and so each awkward bit of the layout can be tested on its own.
const item = (str, x, y) => ({ str, x, y });

const HEADER = y => [
  item('Date In', 48.5, y), item('Mfr', 153.4, y), item('Model', 280, y),
  item('Status', 400.2, y), item('Days', 471.5, y), item('Job', 529, y),
];

function samplePage() {
  return [
    ...HEADER(659.7),

    // Row 1 — the oldest job in the real export, kept as-is because it is the
    // one that proves the age arithmetic (2017-12-01 was 3162 days before
    // 2026-07-29, and the app must produce the same number).
    item('2017-12-01', 30, 642.4), item('DB Tech', 110.8, 642.4),
    item('Opera 405D', 218.5, 642.4), item('Booked In', 380, 642.4),
    item('3162', 460.8, 642.4), item('97', 533, 642.4),

    // Row 2 — a description line sits under it. Since the Desc build the text
    // (but still nothing else on the row) is read.
    item('2018-01-14', 30, 607.9), item('DB Tech', 110.8, 607.9),
    item('Opera 515', 218.5, 607.9), item('On Hold', 380, 607.9),
    item('3118', 460.8, 607.9), item('112', 530, 607.9),
    item('Desc:', 30, 593), item('Needs a new power supply', 66, 593),

    // A manufacturer name that wraps ABOVE its own row line, then row 3, then
    // the rest of the same name wrapping BELOW it. Neither wrap line carries a
    // job number or a date, so neither can be mistaken for a row.
    item('Subtle Noise', 110.8, 573),
    item('2026-06-30', 30, 556), item('Maker', 110.8, 556),
    item('Custom Baritone', 218.5, 556), item('Booked In', 380, 556),
    item('29', 460.8, 556), item('1705', 526.3, 556),
    item('Instruments', 110.8, 540),

    // A free line with no job number and no date, sitting under a row that
    // printed no Desc line at all. There is no description in progress for it
    // to continue, so it is dropped rather than invented into one.
    item('Q:$600 inc', 30, 524),

    item('3', 61.8, 500), item('Jobs by Age', 110.8, 500),
  ];
}

describe('parseJobsByAgeTextItems', () => {
  it('reads the job number and date in from every row', () => {
    const { jobs } = parseJobsByAgeTextItems([samplePage()]);
    expect(jobs).toEqual([
      { ref: '97', dateIn: '2017-12-01' },
      { ref: '112', dateIn: '2018-01-14', desc: 'Needs a new power supply' },
      { ref: '1705', dateIn: '2026-06-30' },
    ]);
  });

  it('emits the job number, date and description and nothing else', () => {
    // The printout also carries Mfr, Model and Status. The Jobs PDF owns those
    // columns; a second writer for them is the bug this parser exists to avoid.
    // Desc is the one deliberate exception — see the parser's header.
    const { jobs } = parseJobsByAgeTextItems([samplePage()]);
    for (const job of jobs) {
      for (const key of Object.keys(job)) {
        expect(['ref', 'dateIn', 'desc']).toContain(key);
      }
    }
  });

  it('leaves desc absent, not empty, on a row that printed no Desc line', () => {
    // Absent and empty are not the same thing here and the import plan depends
    // on the difference: "this file said nothing about the description" must
    // never be actioned as "blank the description", which would destroy text no
    // other source still holds.
    const { jobs } = parseJobsByAgeTextItems([samplePage()]);
    const byRef = Object.fromEntries(jobs.map(j => [j.ref, j]));
    expect('desc' in byRef['97']).toBe(false);
    expect('desc' in byRef['1705']).toBe(false);
  });

  it('captures the job count the PDF states in its own footer', () => {
    const { jobs, statedCount } = parseJobsByAgeTextItems([samplePage()]);
    expect(statedCount).toBe(3);
    expect(jobs.length).toBe(statedCount);
  });

  it('reads the "N Jobs by Age" footer, which the Jobs PDF pattern misses', () => {
    // The Jobs PDF ends "46 Jobs found" as one run; this one ends as two runs,
    // "47" and "Jobs by Age". Matching the first run alone finds nothing.
    const { statedCount } = parseJobsByAgeTextItems([samplePage()]);
    expect(statedCount).toBe(3);
  });

  it('reports statedCount as null when the footer is never reached', () => {
    const truncated = samplePage().filter(i => i.str !== 'Jobs by Age');
    const { statedCount } = parseJobsByAgeTextItems([truncated]);
    expect(statedCount).toBeNull();
  });

  it('ignores description lines and wrapped manufacturer names', () => {
    const { jobs } = parseJobsByAgeTextItems([samplePage()]);
    expect(jobs).toHaveLength(3); // not 4, 5 or 6
  });

  it('does not read a description line that bleeds into the job column', () => {
    const page = samplePage();
    page.push(item('Desc:', 30, 480), item('replace tuners, see note', 66, 480));
    page.push(item('and quote 1699 first', 520, 466));
    const { jobs } = parseJobsByAgeTextItems([page]);
    expect(jobs.map(j => j.ref)).toEqual(['97', '112', '1705']);
  });

  it('skips a row printed without a date rather than importing it blank', () => {
    // A dateless row is dropped on purpose: the parsed count then disagrees
    // with the footer and the import refuses, which is loud. Importing it with
    // an empty date would look entirely normal.
    const page = samplePage().filter(i => i.str !== '2018-01-14');
    const { jobs, statedCount } = parseJobsByAgeTextItems([page]);
    expect(jobs.map(j => j.ref)).toEqual(['97', '1705']);
    expect(statedCount).toBe(3); // 2 parsed vs 3 stated — the import refuses
  });

  it('keeps reading rows on later pages, which carry no repeated header', () => {
    const pageOne = samplePage().filter(
      i => i.str !== 'Jobs by Age' && !(i.str === '3' && i.x === 61.8)
    );
    const pageTwo = [
      item('2026-07-10', 30, 700), item('Yamaha', 110.8, 700),
      item('Pacifica 112VM', 218.5, 700), item('Booked In', 380, 700),
      item('19', 460.8, 700), item('1712', 528, 700),
      item('4', 61.8, 660), item('Jobs by Age', 110.8, 660),
    ];
    const { jobs, statedCount } = parseJobsByAgeTextItems([pageOne, pageTwo]);
    expect(jobs.map(j => j.ref)).toEqual(['97', '112', '1705', '1712']);
    expect(statedCount).toBe(4);
  });

  it('stops at the footer and reads nothing after it', () => {
    const page = samplePage();
    page.push(item('2099-01-01', 30, 460), item('Ghost', 110.8, 460), item('9999', 530, 460));
    const { jobs } = parseJobsByAgeTextItems([page]);
    expect(jobs.map(j => j.ref)).toEqual(['97', '112', '1705']);
  });
});

// The Desc build (2026-08-01). Descriptions on this printout wrap onto a second
// line, and taking only the first would swap Multitrack's truncation for one of
// our own — which is the entire problem this build set out to fix.
//
// The text and the spacing below are the real ones, read off the 31 Jul 2026
// export: a Desc line sits 17.2pt under its row, a wrapped continuation 13.5pt
// under that, the next table row 17.2pt on again, and a manufacturer name that
// wraps ABOVE its own row sits just 6.7pt off it — closer than the wrap gap,
// which is why the x position has to decide and not the spacing alone.
describe('parseJobsByAgeTextItems — descriptions', () => {
  const descRow = (y, date, mfr, ref) => [
    item(date, 30, y), item(mfr, 110.8, y), item('Model X', 218.5, y),
    item('Booked In', 380, y), item('99', 460.8, y), item(ref, 530, y),
  ];

  function wrappedPage() {
    return [
      ...HEADER(659.7),

      // 1708 — the job that proves the point. The Jobs PDF prints this as
      // "Restring stp eli" and simply stops.
      ...descRow(642.4, '2026-07-02', 'Taylor', '1708'),
      item('Desc:', 30, 625.2), item('Restring stp elixir 12s Est', 66, 625.2),
      item('$1000', 30, 611.7),

      // 1632 — the Jobs PDF prints "Full service and deep".
      ...descRow(594.5, '2026-05-20', 'Gibson', '1632'),
      item('Desc:', 30, 577.3), item('Full service and deep', 66, 577.3),
      item('clean Q:$600 inc', 30, 563.8),

      // 842 — the Jobs PDF prints "Setup, check electronics".
      ...descRow(546.6, '2024-02-11', 'Fender', '842'),
      item('Desc:', 30, 529.4), item('Setup, check electronics', 66, 529.4),
      item('and rewire jack', 30, 515.9),
      // The wrapped Mfr name of the NEXT row, printed above that row and only
      // 6.7pt off it. That leaves it 10.5pt under 842's last description line —
      // INSIDE the 15.5pt wrap gap, so spacing alone would take it. It is out
      // in the Mfr column at x~110.8, and that is what saves it.
      item('Instruments', 110.8, 505.4),
      ...descRow(498.7, '2026-06-30', 'Subtle Noise', '1705'),
      item('Desc:', 30, 481.5), item('One knob a bit loose', 66, 481.5),

      item('4', 61.8, 450), item('Jobs by Age', 110.8, 450),
    ];
  }

  const descByRef = page =>
    Object.fromEntries(parseJobsByAgeTextItems([page]).jobs.map(j => [j.ref, j.desc]));

  it('joins a description that wraps onto a second line', () => {
    const d = descByRef(wrappedPage());
    expect(d['1708']).toBe('Restring stp elixir 12s Est $1000');
    expect(d['1632']).toBe('Full service and deep clean Q:$600 inc');
  });

  it('reads a single-line description whole', () => {
    expect(descByRef(wrappedPage())['1705']).toBe('One knob a bit loose');
  });

  it('does not swallow the next row\'s wrapped manufacturer name', () => {
    // The spacing rule alone would take it. The column position is the only
    // thing that tells a wrapped Mfr from a wrapped Desc apart, and getting it
    // wrong would read as a perfectly plausible description.
    const d = descByRef(wrappedPage());
    expect(d['842']).toBe('Setup, check electronics and rewire jack');
    expect(d['842']).not.toContain('Instruments');
  });

  it('never lets a description reach past the next row onto another job', () => {
    const { jobs } = parseJobsByAgeTextItems([wrappedPage()]);
    expect(jobs.map(j => j.ref)).toEqual(['1708', '1632', '842', '1705']);
    for (const j of jobs) expect(j.desc).not.toContain('Desc');
  });

  it('does not carry a description across a page break', () => {
    // y coordinates restart on every page, so a stale y would make the gap
    // arithmetic meaningless and could attach page 2's first line to page 1's
    // last job.
    const pageOne = [
      ...HEADER(659.7),
      ...descRow(642.4, '2026-07-02', 'Taylor', '1708'),
      item('Desc:', 30, 625.2), item('Restring stp elixir 12s Est', 66, 625.2),
    ];
    const pageTwo = [
      item('nothing to do with 1708', 30, 700),
      ...descRow(660, '2026-06-30', 'Yamaha', '1712'),
      item('2', 61.8, 620), item('Jobs by Age', 110.8, 620),
    ];
    const { jobs } = parseJobsByAgeTextItems([pageOne, pageTwo]);
    expect(jobs[0].desc).toBe('Restring stp elixir 12s Est');
    expect(jobs[1].desc).toBeUndefined();
  });

  it('repairs the fi/fl ligatures the printout breaks apart', () => {
    // Multitrack renders these as separate glyphs, so they extract with stray
    // spaces. Same repair as the Jobs PDF, from the same shared helper.
    const page = [
      ...HEADER(659.7),
      ...descRow(642.4, '2026-07-02', 'Yamaha', '1712'),
      item('Desc:', 30, 625.2), item('Loose', 66, 625.2), item('fi', 100, 625.2),
      item('nger on the Paci', 120, 625.2), item('fi', 200, 625.2), item('ca', 210, 625.2),
      item('1', 61.8, 600), item('Jobs by Age', 110.8, 600),
    ];
    expect(parseJobsByAgeTextItems([page]).jobs[0].desc).toBe('Loose finger on the Pacifica');
  });
});

// Trevor drops both Multitrack printouts on the same button, so the app has to
// tell them apart itself. Only the Jobs-by-Age header carries "Date In" and
// "Days"; the Jobs printout's header is Customer / Manufacturer / Model /
// Status / Job.
describe('looksLikeJobsByAge', () => {
  it('recognises the Jobs-by-Age printout', () => {
    expect(looksLikeJobsByAge([samplePage()])).toBe(true);
  });

  it('does not mistake the Jobs printout for it', () => {
    const jobsPdfPage = [
      item('Customer', 30, 700), item('Manufacturer', 192, 700),
      item('Model', 299, 700), item('Status', 434, 700), item('Job', 510, 700),
      item('Dave', 30, 680), item('Fender', 192, 680), item('Strat', 299, 680),
      item('Booked In', 434, 680), item('1601', 510, 680),
      item('46', 30, 640), item('Jobs found', 60, 640),
    ];
    expect(looksLikeJobsByAge([jobsPdfPage])).toBe(false);
  });

  it('says no for an unrelated PDF rather than guessing', () => {
    expect(looksLikeJobsByAge([[item('Invoice', 30, 700), item('Total', 400, 700)]])).toBe(false);
  });
});
