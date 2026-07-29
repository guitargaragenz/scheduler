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

    // Row 2 — a description line sits under it. None of it is read.
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

    // A free continuation line with no job number and no date at all —
    // quotes and notes print like this. Ignored.
    item('Q:$600 inc', 30, 524),

    item('3', 61.8, 500), item('Jobs by Age', 110.8, 500),
  ];
}

describe('parseJobsByAgeTextItems', () => {
  it('reads the job number and date in from every row', () => {
    const { jobs } = parseJobsByAgeTextItems([samplePage()]);
    expect(jobs).toEqual([
      { ref: '97', dateIn: '2017-12-01' },
      { ref: '112', dateIn: '2018-01-14' },
      { ref: '1705', dateIn: '2026-06-30' },
    ]);
  });

  it('emits the job number and date and nothing else', () => {
    // The printout also carries Mfr, Model, Status and Desc. The Jobs PDF
    // already owns those columns; a second writer for them is the bug this
    // parser exists to avoid.
    const { jobs } = parseJobsByAgeTextItems([samplePage()]);
    for (const job of jobs) {
      expect(Object.keys(job).sort()).toEqual(['dateIn', 'ref']);
    }
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
