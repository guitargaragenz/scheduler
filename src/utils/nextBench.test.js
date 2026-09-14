import { describe, it, expect } from 'vitest';
import { nextBenchOf, partsOfJob, displayBenchOf } from './nextBench.js';

const part = (bench, pieceDone = false, extra = {}) => ({ id: `p-${bench}-${Math.random()}`, bench, pieceDone, parentId: 'J', ...extra });
const parent = (bench = 'Luthier', extra = {}) => ({ id: 'J', bench, isSplit: true, ...extra });

describe('nextBenchOf — first main bench with an unticked part', () => {
  it('shows Luthier while luthier work is open', () => {
    expect(nextBenchOf(parent('Fretwork'), [part('Fretwork'), part('Luthier'), part('Setup')])).toBe('Luthier');
  });
  it('moves to Fretwork once Luthier is ticked, whatever the parts order', () => {
    expect(nextBenchOf(parent(), [part('Setup'), part('Luthier', true), part('Fretwork')])).toBe('Fretwork');
  });
  it('moves to Setup once Luthier and Fretwork are ticked', () => {
    expect(nextBenchOf(parent(), [part('Luthier', true), part('Fretwork', true), part('Setup')])).toBe('Setup');
  });
});

describe('sub-benches', () => {
  it('Finishing counts as Luthier', () => {
    expect(nextBenchOf(parent('Fretwork'), [part('Fretwork'), part('Finishing')])).toBe('Luthier');
  });
  it('Wiring counts as Setup', () => {
    expect(nextBenchOf(parent('Fretwork'), [part('Fretwork', true), part('Wiring')])).toBe('Setup');
  });
  it('two parts on one bench hold the card until both are ticked', () => {
    const parts = [part('Luthier', true), part('Finishing'), part('Setup')];
    expect(nextBenchOf(parent(), parts)).toBe('Luthier');
    parts[1].pieceDone = true;
    expect(nextBenchOf(parent(), parts)).toBe('Setup');
  });
});

describe('ticks move the card on (read live from jobs[])', () => {
  it('follows pieceDone flipping on a child row, from any page', () => {
    const p = { id: 'J', bench: 'Luthier', hasSubtasks: true, subtasks: ['J-LU', 'J-S'] };
    const before = [p, { id: 'J-LU', bench: 'Luthier', parentId: 'J', pieceDone: false }, { id: 'J-S', bench: 'Setup', parentId: 'J', pieceDone: false }];
    expect(displayBenchOf(p, before)).toBe('Luthier');
    const after = before.map(j => j.id === 'J-LU' ? { ...j, pieceDone: true } : j);
    expect(displayBenchOf(p, after)).toBe('Setup');
  });
  it('finds manual-split parts by parentId', () => {
    const p = parent('Luthier');
    const jobs = [p, part('Luthier', true), part('Fretwork')];
    expect(partsOfJob(p, jobs)).toHaveLength(2);
    expect(displayBenchOf(p, jobs)).toBe('Fretwork');
  });
});

describe("falls back to the job's own bench", () => {
  it('no parts', () => {
    expect(nextBenchOf({ id: 'J', bench: 'Fretwork' }, [])).toBe('Fretwork');
    expect(displayBenchOf({ id: 'J', bench: 'Admin' }, [])).toBe('Admin');
  });
  it('all parts ticked', () => {
    expect(nextBenchOf(parent('Fretwork'), [part('Luthier', true), part('Setup', true)])).toBe('Fretwork');
  });
  it('Electronics is unchanged', () => {
    expect(nextBenchOf(parent('Electronics'), [part('Luthier')])).toBe('Electronics');
  });
  it('child part cards keep their own bench', () => {
    expect(nextBenchOf({ id: 'J-S', bench: 'Setup', parentId: 'J' }, [part('Luthier')])).toBe('Setup');
    expect(partsOfJob({ id: 'J-S', parentId: 'J' }, [part('Luthier')])).toEqual([]);
  });
  it('does not change the job or its parts', () => {
    const p = parent('Fretwork');
    const parts = [part('Luthier')];
    const snap = JSON.stringify([p, parts]);
    nextBenchOf(p, parts);
    expect(JSON.stringify([p, parts])).toBe(snap);
  });
});
