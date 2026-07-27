import { describe, it, expect, vi } from 'vitest';

vi.mock('../utils/supabase.js', () => ({
  isSupabaseConfigured: () => true,
  loadStatusSince: vi.fn(),
  upsertStatusSince: vi.fn(),
  clearStatusSince: vi.fn(),
  subscribeToStatusSince: vi.fn(() => () => {}),
}));

const { planStatusSinceReconcile, stuckDaysBetween } = await import('./useJobStatusSince.js');

// Brief E, Task 3 — council amendment D.
//
// The failure mode this file exists to prevent: job_status_since is the ONLY
// place the stuck ages live. Multitrack doesn't have them and they cannot be
// recomputed from anything. A single bad reconcile pass — one where jobs[]
// happened to be empty or short because loadJobs() failed silently and
// returned [] — would delete rows that took months to accumulate, with no way
// back. So the rule is deliberately structural: absence is NEVER a reason to
// delete. Only a job that is present AND done gets its row cleared.

const job = (over = {}) => ({ id: '1001', status: 'Waiting', action: 'CI', done: false, ...over });
const NOW = new Date('2026-07-27T09:00:00+12:00');

describe('planStatusSinceReconcile — starting a clock', () => {
  it('stamps a job that has no row yet', () => {
    const { upserts, deletes } = planStatusSinceReconcile({ jobs: [job()], stored: {}, now: NOW });
    expect(deletes).toEqual([]);
    expect(upserts).toEqual([
      { jobId: '1001', status: 'Waiting', action: 'CI', since: NOW.toISOString() },
    ]);
  });

  it('leaves an unchanged job completely alone — the clock must keep running', () => {
    const stored = { '1001': { status: 'Waiting', action: 'CI', since: '2026-07-01T00:00:00Z' } };
    const { upserts, deletes } = planStatusSinceReconcile({ jobs: [job()], stored, now: NOW });
    expect(upserts).toEqual([]);
    expect(deletes).toEqual([]);
  });

  it('restarts the clock when the status changes', () => {
    const stored = { '1001': { status: 'On Hold', action: 'CI', since: '2026-07-01T00:00:00Z' } };
    const { upserts } = planStatusSinceReconcile({ jobs: [job()], stored, now: NOW });
    expect(upserts).toHaveLength(1);
    expect(upserts[0].since).toBe(NOW.toISOString());
  });

  it('restarts the clock when only the ACTION changes', () => {
    // Waiting/INC -> Waiting/CI is a move from the Planning pile to the
    // Waiting pile. Same status string, genuinely different situation.
    const stored = { '1001': { status: 'Waiting', action: 'INC', since: '2026-07-01T00:00:00Z' } };
    const { upserts } = planStatusSinceReconcile({ jobs: [job({ action: 'CI' })], stored, now: NOW });
    expect(upserts).toHaveLength(1);
  });

  it('does not churn on whitespace or case noise from the export', () => {
    const stored = { '1001': { status: 'Waiting', action: 'ci', since: '2026-07-01T00:00:00Z' } };
    const { upserts } = planStatusSinceReconcile({ jobs: [job({ action: ' CI ' })], stored, now: NOW });
    expect(upserts).toEqual([]);
  });

  it('ignores split children and derived bench cards', () => {
    const jobs = [
      job(),
      job({ id: '1001-ST', parentId: '1001' }),
      job({ id: '1001-WR', parentId: '1001', isDerived: true }),
    ];
    const { upserts } = planStatusSinceReconcile({ jobs, stored: {}, now: NOW });
    expect(upserts.map(u => u.jobId)).toEqual(['1001']);
  });
});

describe('planStatusSinceReconcile — deletion (amendment D req 1)', () => {
  it('does NOT delete a row just because its job is missing from jobs[]', () => {
    // This is the whole point. A job absent from the array might be finished,
    // or might be a truncated CSV, a filtered view, or a silently-failed load.
    // A stale row costs nothing; a deleted one is gone forever.
    const stored = {
      '1001': { status: 'Waiting', action: 'CI', since: '2026-01-01T00:00:00Z' },
      '9999': { status: 'On Hold', action: null, since: '2026-01-01T00:00:00Z' },
    };
    const { deletes, refusedDelete } = planStatusSinceReconcile({ jobs: [job()], stored, now: NOW });
    expect(deletes).toEqual([]);
    expect(refusedDelete).toBe(false);
  });

  it('clears the row for a job that is present AND done', () => {
    const stored = {
      '1001': { status: 'Waiting', action: 'CI', since: '2026-01-01T00:00:00Z' },
      '1002': { status: 'Waiting', action: 'CI', since: '2026-01-01T00:00:00Z' },
      '1003': { status: 'Waiting', action: 'CI', since: '2026-01-01T00:00:00Z' },
    };
    const jobs = [job({ id: '1001', done: true }), job({ id: '1002' }), job({ id: '1003' })];
    const { deletes } = planStatusSinceReconcile({ jobs, stored, now: NOW });
    expect(deletes).toEqual(['1001']);
  });

  it('does not try to delete a done job that has no row', () => {
    const { deletes } = planStatusSinceReconcile({ jobs: [job({ done: true })], stored: {}, now: NOW });
    expect(deletes).toEqual([]);
  });

  it('never upserts a done job', () => {
    const { upserts } = planStatusSinceReconcile({ jobs: [job({ done: true })], stored: {}, now: NOW });
    expect(upserts).toEqual([]);
  });
});

describe('planStatusSinceReconcile — the >half brake (amendment D req 3)', () => {
  it('refuses a pass that would clear more than half the stored rows', () => {
    const stored = {
      '1': { status: 'Waiting', action: null, since: 'x' },
      '2': { status: 'Waiting', action: null, since: 'x' },
      '3': { status: 'Waiting', action: null, since: 'x' },
    };
    const jobs = [
      job({ id: '1', done: true }),
      job({ id: '2', done: true }),
      job({ id: '3' }),
    ];
    const { deletes, refusedDelete } = planStatusSinceReconcile({ jobs, stored, now: NOW });
    expect(deletes).toEqual([]);
    expect(refusedDelete).toBe(true);
  });

  it('allows a pass that clears exactly half', () => {
    const stored = {
      '1': { status: 'Waiting', action: null, since: 'x' },
      '2': { status: 'Waiting', action: null, since: 'x' },
    };
    const jobs = [job({ id: '1', done: true }), job({ id: '2' })];
    const { deletes, refusedDelete } = planStatusSinceReconcile({ jobs, stored, now: NOW });
    expect(deletes).toEqual(['1']);
    expect(refusedDelete).toBe(false);
  });
});

describe('planStatusSinceReconcile — empty inputs', () => {
  it('an empty jobs array produces no writes at all', () => {
    // The hook gates on jobs.length > 0 as well; this is the second line of
    // defence, so that even if it were called with [] nothing is destroyed.
    const stored = {
      '1': { status: 'Waiting', action: null, since: 'x' },
      '2': { status: 'Waiting', action: null, since: 'x' },
    };
    const { upserts, deletes, refusedDelete } = planStatusSinceReconcile({ jobs: [], stored, now: NOW });
    expect(upserts).toEqual([]);
    expect(deletes).toEqual([]);
    expect(refusedDelete).toBe(false);
  });

  it('handles being called with nothing at all', () => {
    expect(planStatusSinceReconcile({})).toEqual({ upserts: [], deletes: [], refusedDelete: false });
  });

  it('skips null entries in jobs[] rather than throwing', () => {
    const { upserts } = planStatusSinceReconcile({ jobs: [null, job()], stored: {}, now: NOW });
    expect(upserts).toHaveLength(1);
  });
});

describe('stuckDaysBetween', () => {
  it('counts whole local days', () => {
    const now = new Date(2026, 6, 27, 9, 0);
    expect(stuckDaysBetween(new Date(2026, 6, 27, 23, 30), now)).toBe(0);
    expect(stuckDaysBetween(new Date(2026, 6, 26, 1, 0), now)).toBe(1);
    expect(stuckDaysBetween(new Date(2026, 6, 13, 23, 59), now)).toBe(14);
  });

  it('uses local midnights, not UTC — NZ is UTC+12 so a UTC diff reads a day off', () => {
    // Same local calendar day either side of UTC midnight: still 0 days stuck.
    const now = new Date(2026, 6, 27, 1, 0);
    expect(stuckDaysBetween(new Date(2026, 6, 27, 23, 0), now)).toBe(0);
  });

  it('accepts an ISO string', () => {
    const now = new Date(2026, 6, 27, 9, 0);
    const since = new Date(2026, 6, 20, 9, 0).toISOString();
    expect(stuckDaysBetween(since, now)).toBe(7);
  });

  it('returns null for a missing or unparseable timestamp, never 0', () => {
    expect(stuckDaysBetween(null)).toBeNull();
    expect(stuckDaysBetween('')).toBeNull();
    expect(stuckDaysBetween('not a date')).toBeNull();
  });

  it('clamps a future timestamp to 0 rather than going negative', () => {
    const now = new Date(2026, 6, 27, 9, 0);
    expect(stuckDaysBetween(new Date(2026, 6, 30), now)).toBe(0);
  });
});
