import { describe, it, expect } from 'vitest';
import { parseTextItems } from './parseMultitrackPdf.js';

// These fixtures are hand-built positioned text items in the same shape pdfjs
// hands back (str + x/y in PDF points), laid out at the real printout's column
// x-positions and line spacing. Building them by hand rather than shipping a
// real PDF keeps a live customer list out of the repo, and lets each awkward
// case in the layout be tested in isolation.
const item = (str, x, y) => ({ str, x, y });

const HEADER = y => [
  item('Customer', 30, y), item('Manufacturer', 192, y),
  item('Model', 299, y), item('Status', 434, y), item('Job', 510, y),
];

function samplePage() {
  return [
    ...HEADER(700),

    // Row 1 — plain row, fault wraps onto a second line (14pt below).
    item('Dave Smith', 30, 680), item('Fender', 192, 680),
    item('Strat', 299, 680), item('Active', 434, 680), item('1601', 510, 680),
    item('Fault:', 30, 666), item('Fret buzz on the low E', 66, 666),
    item('past the 12th fret', 66, 652),

    // Row 2 — 18pt below the wrapped fault line, so it reads as a new row and
    // not as more fault text. Fault contains a broken fl ligature.
    item('Anne', 30, 634), item('Gibson', 192, 634),
    item('Les Paul', 299, 634), item('Waiting', 434, 634), item('1602', 510, 634),
    item('Fault:', 30, 620), item('restring with', 66, 620),
    item('fl', 140, 620), item('at-wounds', 150, 620),

    // A wrapped customer name belonging to row 3, printed ABOVE its own row
    // line and 20pt below row 2's fault — too far to be more fault text.
    item('Wellington Music', 30, 600),

    // Row 3 — its fault is long enough to spill past x=500 into the job-number
    // column. That bleed must stay fault text, not become a second job.
    item('Ltd', 30, 584), item('Ibanez', 192, 584),
    item('RG', 299, 584), item('Booked In', 434, 584), item('1603', 510, 584),
    item('Fault:', 30, 570), item('Full refret, new nut, check the neck', 66, 570),
    item('and the electronics', 520, 570),

    item('3 Jobs found', 30, 540),
  ];
}

describe('parseTextItems', () => {
  it('reads every row, its columns and its fault text', () => {
    const { jobs } = parseTextItems([samplePage()]);
    expect(jobs.map(j => j.ref)).toEqual(['1601', '1602', '1603']);
    expect(jobs[0]).toMatchObject({
      ref: '1601', customer: 'Dave Smith', manufacturer: 'Fender',
      model: 'Strat', status: 'Active',
      fault: 'Fret buzz on the low E past the 12th fret',
    });
  });

  it('captures the job count the PDF states in its own footer', () => {
    const { jobs, statedCount } = parseTextItems([samplePage()]);
    expect(statedCount).toBe(3);
    expect(jobs.length).toBe(statedCount);
  });

  it('reports statedCount as null when the footer is never reached', () => {
    const truncated = samplePage().filter(i => i.str !== '3 Jobs found');
    const { statedCount } = parseTextItems([truncated]);
    expect(statedCount).toBeNull();
  });

  it('rejoins fi/fl ligatures split into separate glyphs', () => {
    const { jobs } = parseTextItems([samplePage()]);
    expect(jobs[1].fault).toBe('restring with flat-wounds');
  });

  it('keeps a wrapped cell printed above its row line with that row', () => {
    const { jobs } = parseTextItems([samplePage()]);
    expect(jobs[2].customer).toBe('Wellington Music Ltd');
  });

  it('keeps fault text that bleeds past the job-number column as fault text', () => {
    const { jobs } = parseTextItems([samplePage()]);
    expect(jobs).toHaveLength(3); // not 4 — the bleed is not a new row
    expect(jobs[2].ref).toBe('1603');
    expect(jobs[2].fault).toBe('Full refret, new nut, check the neck and the electronics');
  });

  it('emits the six PDF fields and nothing else', () => {
    const { jobs } = parseTextItems([samplePage()]);
    for (const job of jobs) {
      expect(Object.keys(job).sort()).toEqual(
        ['customer', 'fault', 'manufacturer', 'model', 'ref', 'status']
      );
    }
  });

  it('skips a repeated header on a later page and keeps counting', () => {
    const pageTwo = [
      ...HEADER(700),
      item('Sam', 30, 680), item('Yamaha', 192, 680),
      item('Pacifica', 299, 680), item('Active', 434, 680), item('1604', 510, 680),
      item('Fault:', 30, 666), item('Loose jack', 66, 666),
      item('4 Jobs found', 30, 640),
    ];
    const page1 = samplePage().filter(i => i.str !== '3 Jobs found');
    const { jobs, statedCount } = parseTextItems([page1, pageTwo]);
    expect(jobs.map(j => j.ref)).toEqual(['1601', '1602', '1603', '1604']);
    expect(statedCount).toBe(4);
  });
});
