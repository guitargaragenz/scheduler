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

const { default: JobShelf, dragModeVisible, pileOf, PILE_VALUES, BENCH_ORDER } = await import('./JobShelf.jsx');
const { blockedPile } = await import('../data/jobs.js');

// One of each: a Planning job (INC), two Waiting jobs (On Hold / In Transit),
// and a normal workable Setup job. `days` keeps the sort deterministic.
const PLANNING = { id: 'p1', job: 393, status: 'Booked In', action: 'INC', bench: null, mfr: 'Fender', model: 'Stratocaster', days: 4 };
const WAITING_HOLD = { id: 'w1', job: 1175, status: 'On Hold', action: 'CI', bench: null, mfr: 'Gibson', model: 'LesPaul', days: 3 };
const WAITING_TRANSIT = { id: 'w2', job: 1176, status: 'In Transit', action: 'CI', bench: null, mfr: 'Gretsch', model: 'Duojet', days: 2 };
const WORKABLE = { id: 'n1', job: 1001, status: 'Active', action: 'CI', bench: 'Setup', mfr: 'Ibanez', model: 'RGSeven', days: 1 };
// The double-count case: went On Hold in Supabase but kept its stale bench,
// because useSupabase takes bench verbatim and never re-runs inferBench.
const STALE_BENCH = { id: 's1', job: 1200, status: 'On Hold', action: 'CI', bench: 'Setup', mfr: 'Yamaha', model: 'Pacifica', days: 5 };

const noop = () => {};
function render(jobs, storedSelection = null) {
  if (storedSelection) store.jobShelfBench = storedSelection;
  else delete store.jobShelfBench;
  return renderToStaticMarkup(
    <JobShelf jobs={jobs} dragMode="regular" onDragModeChange={noop} onCsvUpload={noop} onJobClick={noop} />
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
    expect(blockedPile(WAITING_HOLD)).toBe('waiting');
    expect(blockedPile(WAITING_TRANSIT)).toBe('waiting');
    expect(blockedPile(WORKABLE)).toBe(null);
    expect(blockedPile(STALE_BENCH)).toBe('waiting');
  });
});

describe('pile chip counts', () => {
  it('counts each pile exactly as blockedPile() does', () => {
    const jobs = [PLANNING, WAITING_HOLD, WAITING_TRANSIT, WORKABLE];
    const markup = render(jobs);
    expect(chipCount(markup, 'Waiting')).toBe(jobs.filter(j => blockedPile(j) === 'waiting').length);
    expect(chipCount(markup, 'Planning')).toBe(jobs.filter(j => blockedPile(j) === 'planning').length);
  });

  it('hides a pile chip when its count is zero', () => {
    const markup = render([WORKABLE]);
    expect(chipCount(markup, 'Waiting')).toBe(null);
    expect(chipCount(markup, 'Planning')).toBe(null);
  });

  it('does not double-count a blocked job that kept a stale bench', () => {
    // STALE_BENCH is On Hold but still carries bench 'Setup'. It belongs to
    // Waiting only — Setup must not claim it too, or the chips stop summing.
    const markup = render([WORKABLE, STALE_BENCH]);
    expect(chipCount(markup, 'Setup')).toBe(1);
    expect(chipCount(markup, 'Waiting')).toBe(1);
  });
});

describe('selecting a pile filters the list', () => {
  it('shows only that pile’s jobs', () => {
    const markup = render([PLANNING, WAITING_HOLD, WAITING_TRANSIT, WORKABLE], 'pile:waiting');
    expect(markup).toContain('LesPaul');
    expect(markup).toContain('Duojet');
    expect(markup).not.toContain('Stratocaster');
    expect(markup).not.toContain('RGSeven');
  });

  it('keeps the piles separate', () => {
    const markup = render([PLANNING, WAITING_HOLD, WORKABLE], 'pile:planning');
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
    render([WAITING_HOLD], 'pile:waiting');
    expect(store.jobShelfBench).toBe('pile:waiting');
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
