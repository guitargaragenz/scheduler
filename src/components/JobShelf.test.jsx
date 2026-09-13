import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// Brief F — the Waiting / Planning chips on the bench-picker row.
//
// Covers brief scope item 6: chip counts match blockedPile(), clicking a chip
// filters to that pile, and a pile value is never treated as a real bench
// downstream. Plus the round-2 regression on the drag-mode guard.
//
// These render the real component with renderToStaticMarkup, same approach as
// JobCard.test.jsx. Two things need stubbing to do that in the node test env:
// dnd-kit (no DOM) and localStorage (which JobShelf reads on mount).
vi.mock('@dnd-kit/core', () => ({
  useDraggable: () => ({ attributes: {}, listeners: {}, setNodeRef: () => {}, transform: null, isDragging: false }),
}));
vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Translate: { toString: () => '' } },
}));

const store = {};
globalThis.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; },
};

const { default: JobShelf, dragModeVisible, pileOf, PILE_VALUES, BENCH_ORDER, PARTS_ARRIVED_VALUE } = await import('./JobShelf.jsx');
const { blockedPile } = await import('../data/jobs.js');

// One of each: a Planning job (INC), a Hold job (On Hold), a Transit job
// (In Transit), a genuine Waiting job (Waiting), and a normal workable
// Setup job. `days` keeps the sort deterministic.
const PLANNING = { id: 'p1', job: 393, status: 'Booked In', action: 'INC', bench: null, mfr: 'Fender', model: 'Stratocaster', days: 4 };
const HOLD_JOB = { id: 'w1', job: 1175, status: 'On Hold', action: '', bench: null, mfr: 'Gibson', model: 'LesPaul', days: 3 };
const TRANSIT_JOB = { id: 'w2', job: 1176, status: 'In Transit', action: '', bench: null, mfr: 'Gretsch', model: 'Duojet', days: 2 };
const WAITING_PARTS = { id: 'w3', job: 1177, status: 'Waiting', action: '', bench: null, mfr: 'PRS', model: 'CE24', days: 6 };
const WORKABLE = { id: 'n1', job: 1001, status: 'Active', action: '', bench: 'Setup', mfr: 'Ibanez', model: 'RGSeven', days: 1 };
// The double-count case: went On Hold in Supabase but kept its stale bench,
// because useSupabase takes bench verbatim and never re-runs inferBench.
const STALE_BENCH = { id: 's1', job: 1200, status: 'On Hold', action: '', bench: 'Setup', mfr: 'Yamaha', model: 'Pacifica', days: 5 };

const noop = () => {};
function render(jobs, storedSelection = null) {
  if (storedSelection) store.jobShelfBench = storedSelection;
  else delete store.jobShelfBench;
  return renderToStaticMarkup(
    <JobShelf jobs={jobs} dragMode="regular" onDragModeChange={noop} onJobClick={noop} />
  );
}

// Reads the count rendered inside a chip, e.g. `Waiting <span ...>2</span>`.
function chipCount(markup, label) {
  const m = markup.match(new RegExp(`${label} <span[^>]*>(\\d+)</span>`));
  return m ? Number(m[1]) : null;
}

beforeEach(() => { delete store.jobShelfBench; });

describe('fixture sanity — blockedPile agrees with what these tests assume', () => {
  it('classifies the fixtures into the piles the tests expect', () => {
    expect(blockedPile(PLANNING)).toBe('planning');
    expect(blockedPile(HOLD_JOB)).toBe('hold');
    expect(blockedPile(TRANSIT_JOB)).toBe('transit');
    expect(blockedPile(WAITING_PARTS)).toBe('waiting');
    expect(blockedPile(WORKABLE)).toBe(null);
    expect(blockedPile(STALE_BENCH)).toBe('hold');
  });
});

describe('pile chip counts', () => {
  it('counts each pile exactly as blockedPile() does', () => {
    const jobs = [PLANNING, HOLD_JOB, TRANSIT_JOB, WAITING_PARTS, WORKABLE];
    const markup = render(jobs);
    expect(chipCount(markup, 'Waiting')).toBe(jobs.filter(j => blockedPile(j) === 'waiting').length);
    expect(chipCount(markup, 'Planning')).toBe(jobs.filter(j => blockedPile(j) === 'planning').length);
    expect(chipCount(markup, 'Hold')).toBe(jobs.filter(j => blockedPile(j) === 'hold').length);
    expect(chipCount(markup, 'In Transit')).toBe(jobs.filter(j => blockedPile(j) === 'transit').length);
  });

  it('hides a pile chip when its count is zero', () => {
    const markup = render([WORKABLE]);
    expect(chipCount(markup, 'Waiting')).toBe(null);
    expect(chipCount(markup, 'Planning')).toBe(null);
    expect(chipCount(markup, 'Hold')).toBe(null);
    expect(chipCount(markup, 'In Transit')).toBe(null);
  });

  it('does not double-count a blocked job that kept a stale bench', () => {
    // STALE_BENCH is On Hold but still carries bench 'Setup'. It belongs to
    // Hold only — Setup must not claim it too, or the chips stop summing.
    const markup = render([WORKABLE, STALE_BENCH]);
    expect(chipCount(markup, 'Setup')).toBe(1);
    expect(chipCount(markup, 'Hold')).toBe(1);
  });
});

describe('selecting a pile filters the list', () => {
  it('shows only the Waiting pile’s jobs', () => {
    const markup = render([PLANNING, HOLD_JOB, TRANSIT_JOB, WAITING_PARTS, WORKABLE], 'pile:waiting');
    expect(markup).toContain('CE24');
    expect(markup).not.toContain('LesPaul');
    expect(markup).not.toContain('Duojet');
    expect(markup).not.toContain('Stratocaster');
    expect(markup).not.toContain('RGSeven');
  });

  it('shows only the Hold pile’s jobs', () => {
    const markup = render([PLANNING, HOLD_JOB, TRANSIT_JOB, WORKABLE], 'pile:hold');
    expect(markup).toContain('LesPaul');
    expect(markup).not.toContain('Duojet');
    expect(markup).not.toContain('Stratocaster');
  });

  it('shows only the In Transit pile’s jobs', () => {
    const markup = render([PLANNING, HOLD_JOB, TRANSIT_JOB, WORKABLE], 'pile:transit');
    expect(markup).toContain('Duojet');
    expect(markup).not.toContain('LesPaul');
    expect(markup).not.toContain('Stratocaster');
  });

  it('keeps the piles separate', () => {
    const markup = render([PLANNING, HOLD_JOB, WORKABLE], 'pile:planning');
    expect(markup).toContain('Stratocaster');
    expect(markup).not.toContain('LesPaul');
  });

  it('excludes a stale-bench blocked job from its old bench view', () => {
    const markup = render([WORKABLE, STALE_BENCH], 'Setup');
    expect(markup).toContain('RGSeven');
    expect(markup).not.toContain('Pacifica');
  });
});

describe('a pile is never treated as a real bench', () => {
  it('keeps pile values out of BENCH_ORDER and namespaced apart from bench names', () => {
    for (const v of PILE_VALUES) {
      expect(BENCH_ORDER).not.toContain(v);
      expect(v.startsWith('pile:')).toBe(true);
    }
  });

  it('decodes only prefixed values as piles', () => {
    expect(pileOf('pile:waiting')).toBe('waiting');
    expect(pileOf('Setup')).toBe(null);
    expect(pileOf(null)).toBe(null);
  });

  it('discards a stored selection that is neither a bench nor a pile', () => {
    // A dead stored value would boot the shelf into a filter nothing can match.
    render([WORKABLE], 'NotABench');
    expect(store.jobShelfBench).toBeUndefined();
  });

  it('keeps a valid stored pile selection', () => {
    render([HOLD_JOB], 'pile:hold');
    expect(store.jobShelfBench).toBe('pile:hold');
  });
});

describe('drag-mode toggle visibility', () => {
  it('hides the toggle when a pile is what is driving the list', () => {
    expect(dragModeVisible({ selectedPile: 'waiting', searching: false })).toBe(false);
  });

  // The round-2 regression: a pile stays selected while search takes over the
  // list. Search shows ordinary draggable jobs, and the chip row is hidden
  // while searching — so dropping the toggle there looked like a bug with
  // nothing on screen to explain it.
  it('keeps the toggle while search drives the list, even with a pile still selected', () => {
    expect(dragModeVisible({ selectedPile: 'waiting', searching: true })).toBe(true);
  });

  // Round 3: the first fix also exempted focusOnly, which was wrong. `visible`
  // ranks the pile branch ABOVE focusOnly, so turning the Focus pill on while a
  // pile is selected leaves the list showing blocked cards. Exempting it put
  // drag controls above undraggable cards — the exact thing C5 prevents.
  it('still hides the toggle when Focus is on but a pile outranks it', () => {
    expect(dragModeVisible({ selectedPile: 'waiting', searching: false, focusOnly: true })).toBe(false);
  });

  it('keeps the toggle for an ordinary bench selection', () => {
    expect(dragModeVisible({ selectedPile: null, searching: false })).toBe(true);
  });

  // Not covered: the focusOnly and searching cases at component level. Both are
  // internal state with no prop to set them, so a static render can't reach
  // them — dragModeVisible() is tested directly instead, and its correctness
  // depends on mirroring `visible`'s searching → pile → bench → focusOnly
  // precedence. Reshuffle that order and this guard goes quietly wrong.
});

// --- 🔧 Parts Arrived chip ---
//
// A WP job Multitrack has moved off Waiting. Deliberately given a bench: these
// are workable jobs, which is the whole reason missing them costs money.
const PARTS_ARRIVED = { id: 'pa1', job: 1679, status: 'Active', action: 'WP', bench: 'Setup', mfr: 'Fender', model: 'Telecaster', days: 7 };
// Still genuinely stuck — WP tag AND Multitrack still saying Waiting.
const STILL_WAITING_PARTS = { id: 'pa2', job: 1705, status: 'Waiting', action: 'WP', bench: null, mfr: 'Gibson', model: 'SG', days: 8 };

describe('🔧 Parts Arrived chip', () => {
  it('counts the WP jobs Multitrack has moved off Waiting', () => {
    const markup = render([PARTS_ARRIVED, STILL_WAITING_PARTS, WORKABLE]);
    expect(chipCount(markup, '🔧 Parts Arrived')).toBe(1);
  });

  it('is hidden entirely when nothing qualifies', () => {
    const markup = render([WORKABLE, STILL_WAITING_PARTS]);
    expect(markup).not.toContain('Parts Arrived');
  });

  it('filters the list to those jobs when selected', () => {
    const markup = render([PARTS_ARRIVED, STILL_WAITING_PARTS, WORKABLE], PARTS_ARRIVED_VALUE);
    expect(markup).toContain('#1679');
    expect(markup).not.toContain('#1001');
    expect(markup).not.toContain('#1705');
  });

  it('keeps a stored Parts Arrived selection rather than clearing it as junk', () => {
    render([PARTS_ARRIVED], PARTS_ARRIVED_VALUE);
    expect(store.jobShelfBench).toBe(PARTS_ARRIVED_VALUE);
  });

  // WP does not change `schedulable`, so these cards CAN be dragged onto the
  // calendar. Namespacing the chip `filter:` instead of `pile:` is what keeps
  // the drag-mode toggle on screen above them.
  it('is not treated as a blocked pile', () => {
    expect(pileOf(PARTS_ARRIVED_VALUE)).toBe(null);
    expect(PILE_VALUES).not.toContain(PARTS_ARRIVED_VALUE);
    expect(dragModeVisible({ selectedPile: pileOf(PARTS_ARRIVED_VALUE), searching: false })).toBe(true);
  });

  // The Week View sidebar carves these jobs out of its other groups because it
  // lists every group at once. This panel shows one filter at a time, so the
  // job stays in its bench chip — hiding real bookable work from the bench he
  // is picking from would be the worse bug.
  it('leaves the job in its bench count too, because only one filter shows at a time', () => {
    const markup = render([PARTS_ARRIVED]);
    expect(chipCount(markup, 'Setup')).toBe(1);
    expect(chipCount(markup, '🔧 Parts Arrived')).toBe(1);
  });
});
