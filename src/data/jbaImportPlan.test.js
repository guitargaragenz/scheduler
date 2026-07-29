import { describe, it, expect } from 'vitest';
import { buildJbaImportPlan } from './jbaImportPlan.js';

// Brief G, Build 1c — the Jobs-by-Age preview.
//
// The plan is what Trevor reads before he clicks. Two things matter most: an
// overwrite of a date already on the board must be counted and shown
// separately (Trevor's ruling, 2026-07-29 — Multitrack wins, but never
// silently), and a ref in the file that is not on the board must be skipped
// rather than inserted as a half-blank phantom job.

const boardJob = (id, extra = {}) => ({
  id, job: id, customer: 'Dave', mfr: 'Fender', model: 'Strat', firstSeen: null, ...extra,
});

const base = {
  parsed: [{ ref: '97', dateIn: '2017-12-01' }],
  statedCount: 1,
  jobs: [boardJob('97')],
  filename: 'jba.pdf',
};

describe('buildJbaImportPlan — refusals', () => {
  it('refuses a file with no footer count, so a truncated read cannot import', () => {
    const plan = buildJbaImportPlan({ ...base, statedCount: null });
    expect(plan.ok).toBe(false);
    expect(plan.error).toMatch(/Jobs by Age/);
  });

  it('refuses when fewer rows were read than the file says it printed', () => {
    const plan = buildJbaImportPlan({ ...base, statedCount: 47 });
    expect(plan.ok).toBe(false);
    expect(plan.error).toMatch(/47 jobs but only 1/);
  });

  it('refuses when the same job number appears twice', () => {
    const plan = buildJbaImportPlan({
      ...base,
      parsed: [{ ref: '97', dateIn: '2017-12-01' }, { ref: '97', dateIn: '2018-01-01' }],
      statedCount: 2,
    });
    expect(plan.ok).toBe(false);
    expect(plan.error).toMatch(/more than once/);
  });
});

describe('buildJbaImportPlan — counts and writes', () => {
  it('counts a job with no date yet as filled in, and queues one write', () => {
    const plan = buildJbaImportPlan(base);
    expect(plan.ok).toBe(true);
    expect(plan.filled).toHaveLength(1);
    expect(plan.changed).toHaveLength(0);
    expect(plan.unchangedCount).toBe(0);
    expect(plan.writes).toEqual([{ id: '97', job: '97', data: { firstSeen: '2017-12-01' } }]);
  });

  it('counts a job whose date already matches as already right, and writes nothing', () => {
    const plan = buildJbaImportPlan({
      ...base, jobs: [boardJob('97', { firstSeen: '2017-12-01' })],
    });
    expect(plan.unchangedCount).toBe(1);
    expect(plan.filled).toHaveLength(0);
    expect(plan.writes).toHaveLength(0);
  });

  it('counts a differing date as CHANGED and shows both dates — an overwrite is never invisible', () => {
    const plan = buildJbaImportPlan({
      ...base, jobs: [boardJob('97', { firstSeen: '2018-06-30' })],
    });
    expect(plan.filled).toHaveLength(0);
    expect(plan.changed).toEqual([
      { id: '97', label: '#97 Fender Strat — Dave', from: '2018-06-30', to: '2017-12-01' },
    ]);
    expect(plan.writes).toHaveLength(1);
  });

  it('treats a stored full timestamp as the same date, not as a change', () => {
    // A DATE column can come back from PostgREST as a timestamp string. Without
    // trimming to the day, every job would report as changed on every import.
    const plan = buildJbaImportPlan({
      ...base, jobs: [boardJob('97', { firstSeen: '2017-12-01T00:00:00+13:00' })],
    });
    expect(plan.changed).toHaveLength(0);
    expect(plan.unchangedCount).toBe(1);
  });

  it('skips a ref that is not on the board rather than inserting a half-blank job', () => {
    const plan = buildJbaImportPlan({
      ...base,
      parsed: [{ ref: '97', dateIn: '2017-12-01' }, { ref: '9999', dateIn: '2026-07-01' }],
      statedCount: 2,
    });
    expect(plan.unknown).toEqual([{ id: '9999', dateIn: '2026-07-01' }]);
    expect(plan.writes.map(w => w.id)).toEqual(['97']);
  });

  it('reports jobs on the board that are not in the file, but never writes them', () => {
    const plan = buildJbaImportPlan({
      ...base, jobs: [boardJob('97'), boardJob('1601')],
    });
    expect(plan.missing).toEqual([{ id: '1601', label: '#1601 Fender Strat — Dave' }]);
    expect(plan.writes.map(w => w.id)).toEqual(['97']);
  });

  it("ignores the app's own split cards entirely — the printout has never heard of them", () => {
    const plan = buildJbaImportPlan({
      ...base,
      jobs: [boardJob('97'), { ...boardJob('97_Electronics_0'), parentId: '97' }],
    });
    expect(plan.missing).toHaveLength(0);
    expect(plan.writes).toHaveLength(1);
  });

  it('carries the job number on every write, because the database demands it', () => {
    const plan = buildJbaImportPlan({
      ...base,
      parsed: [{ ref: '97', dateIn: '2017-12-01' }, { ref: '1601', dateIn: '2026-01-05' }],
      statedCount: 2,
      jobs: [boardJob('97'), boardJob('1601')],
    });
    expect(plan.writes.every(w => w.job)).toBe(true);
  });

  it('tags itself as the Jobs-by-Age plan so the preview screen shows the right one', () => {
    expect(buildJbaImportPlan(base).kind).toBe('jba');
  });
});
