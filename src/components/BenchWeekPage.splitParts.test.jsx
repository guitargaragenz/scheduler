// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import BenchWeekPage, {
  weekRows, orderedParts, rowBenchOf, buildWeekExport, addableJobs, groupByBench, weekRowKey, partsOf,
} from './BenchWeekPage.jsx';

// Weekly Log split dropdown (scope lock 2026-09-30, job 1635).

const WEEK_DAYS = Array.from({ length: 7 }, (_, i) => new Date(2026, 7, 10 + i));
const WEEK = ['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14', '2026-08-15', '2026-08-16'];
const ROW = { [weekRowKey(WEEK)]: 'row' };

// 1635: Luthier done, Finishing, Wiring and Setup still waiting.
const J1635 = [
  { id: 'p', job: '1635', mfr: 'Gibson', isSplit: true, bench: 'Luthier' },
  { id: 'c4', parentId: 'p', bench: 'Setup' },
  { id: 'c2', parentId: 'p', bench: 'Finishing' },
  { id: 'c1', parentId: 'p', bench: 'Luthier', pieceDone: true },
  { id: 'c3', parentId: 'p', bench: 'Wiring' },
];

function bench(jobs) {
  const all = jobs;
  const byId = new Map(all.map(j => [j.id, j]));
  return rowBenchOf(all[0], partsOf(all[0], all, byId));
}

describe('orderedParts', () => {
  it('lists parts in shop order, other benches after alphabetically', () => {
    const parts = [
      { id: 1, bench: 'Setup' }, { id: 2, bench: 'Zeta' }, { id: 3, bench: 'Wiring' },
      { id: 4, bench: 'Electronics' }, { id: 5, bench: 'Finishing' }, { id: 6, bench: 'Luthier' },
      { id: 7, bench: 'Fretwork' },
    ];
    expect(orderedParts(parts).map(p => p.bench))
      .toEqual(['Fretwork', 'Luthier', 'Finishing', 'Wiring', 'Setup', 'Electronics', 'Zeta']);
  });

  it('carries the session note and keeps same-bench sessions in session order', () => {
    const parts = [
      { id: 1, bench: 'Luthier', sessionIndex: 2, sessionNote: ' clamp neck ' },
      { id: 2, bench: 'Luthier', sessionIndex: 1 },
    ];
    expect(orderedParts(parts).map(p => [p.id, p.note])).toEqual([['2', ''], ['1', 'clamp neck']]);
  });

  it('reads pieceDone, not done, and badges the first not-done part as next', () => {
    const out = orderedParts([
      { id: 1, bench: 'Luthier', pieceDone: true },
      { id: 2, bench: 'Setup', done: true },
      { id: 3, bench: 'Fretwork', pieceDone: true },
    ]);
    expect(out.map(p => [p.bench, p.done, p.next])).toEqual([
      ['Fretwork', true, false], ['Luthier', true, false], ['Setup', false, true],
    ]);
  });

  it('has no next when every part is done', () => {
    expect(orderedParts([{ id: 1, bench: 'Setup', pieceDone: true }]).some(p => p.next)).toBe(false);
  });
});

describe('filing uses the Board next-bench rule', () => {
  it('1635 stays on Luthier while Finishing is open, then moves to Setup', () => {
    // Finishing counts as Luthier and is still open, so it stays on Luthier.
    expect(bench(J1635)).toBe('Luthier');
    const finished = J1635.map(j => (j.id === 'c2' ? { ...j, pieceDone: true } : j));
    expect(bench(finished)).toBe('Setup');
  });

  it('Luthier before Fretwork before Setup', () => {
    expect(bench([
      { id: 'p', isSplit: true, bench: 'Setup' },
      { id: 'a', parentId: 'p', bench: 'Setup' },
      { id: 'b', parentId: 'p', bench: 'Fretwork' },
    ])).toBe('Fretwork');
  });

  it('an Electronics job stays put', () => {
    expect(bench([
      { id: 'p', isSplit: true, bench: 'Electronics' },
      { id: 'a', parentId: 'p', bench: 'Setup' },
    ])).toBe('Electronics');
  });

  it('all parts done files under the job own bench', () => {
    expect(bench([
      { id: 'p', isSplit: true, bench: 'Fretwork' },
      { id: 'a', parentId: 'p', bench: 'Setup', pieceDone: true },
      { id: 'b', parentId: 'p', bench: 'Luthier', pieceDone: true },
    ])).toBe('Fretwork');
  });

  it('an unsplit job still files on its own bench', () => {
    expect(bench([{ id: 'p', bench: 'Wiring' }])).toBe('Setup');
  });

  it('the saved week file groups under the same headings as the page', () => {
    const jobs = [...J1635.map(j => (j.id === 'c2' ? { ...j, pieceDone: true } : j)),
      { id: 'q', job: '1700', bench: 'Luthier' }];
    const rows = weekRows(jobs, WEEK, { p: ROW, q: ROW });
    const text = buildWeekExport({ rows, weekKeys: WEEK, weekDays: WEEK_DAYS, marks: {} });
    const headings = groupByBench(rows).map(g => g.bench);
    expect(headings).toEqual(['Setup', 'Luthier']);
    const setupAt = text.indexOf('\nSETUP\n');
    const luthAt = text.indexOf('\nLUTHIER\n');
    expect(setupAt).toBeGreaterThan(-1);
    expect(text.indexOf('1635')).toBeGreaterThan(setupAt);
    expect(text.indexOf('1635')).toBeLessThan(luthAt);
  });

  it('the picker never offers a job already on the week under another heading', () => {
    const rows = weekRows(J1635, WEEK, { p: ROW });
    for (const b of ['Electronics', 'Fretwork', 'Setup', 'Luthier', 'Admin']) {
      expect(addableJobs(J1635, b, rows)).toEqual([]);
    }
  });
});

function setup(jobs = J1635) {
  const setMark = vi.fn(async () => ({ ok: true }));
  render(
    <BenchWeekPage
      jobs={jobs} weekDays={WEEK_DAYS} marks={{ p: ROW }} ready saveError={null}
      setMark={setMark} clearJobKeys={vi.fn()} onCloseJob={vi.fn()}
      onBookedOnDay={vi.fn()} isMobile={false} showToast={vi.fn()}
    />,
  );
  return { setMark };
}

const toggle = () => screen.getByRole('button', { name: /^Parts of/ });
const list = () => screen.queryByRole('list', { name: /^Parts of/ });

afterEach(() => cleanup());

describe('the parts dropdown', () => {
  it('is closed when the page opens', () => {
    setup();
    expect(list()).toBeNull();
  });

  it('opens on tap and closes on a second tap', () => {
    setup();
    fireEvent.click(toggle());
    const items = screen.getAllByRole('listitem');
    expect(items.map(i => i.textContent)).toEqual(['✓Luthier', '○Finishingnext', '○Wiring', '○Setup']);
    expect(items[0].dataset.done).toBe('yes');
    fireEvent.click(toggle());
    expect(list()).toBeNull();
  });

  it('a tap away closes it and still reaches the day cell underneath', () => {
    const { setMark } = setup();
    fireEvent.click(toggle());
    const day = screen.getByRole('button', { name: /1635 Gibson — 2026-08-11/ });
    fireEvent.pointerDown(day, { clientX: 1, clientY: 1 });
    fireEvent.pointerUp(day);
    fireEvent.click(day);
    expect(list()).toBeNull();
    expect(setMark).toHaveBeenCalledWith('p', '2026-08-11', 'dot');
  });

  it('a job with no splits has no dropdown', () => {
    setup([{ id: 'p', job: '1635', mfr: 'Gibson', bench: 'Luthier' }]);
    expect(screen.queryByRole('button', { name: /^Parts of/ })).toBeNull();
  });

  it('opening it writes nothing', () => {
    const { setMark } = setup();
    fireEvent.click(toggle());
    expect(setMark).not.toHaveBeenCalled();
  });
});
