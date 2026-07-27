import { describe, it, expect } from 'vitest';
import { parseDays, blockedPile, blockedReason, benchColors, BENCH_COLORS, NO_BENCH_COLORS, parseCSV, preserveKnownDays } from './jobs.js';

// Brief E, Task 1 + the blockedPile helper.
//
// The bug these guard against is subtle and invisible: `parseInt(x) || 0`
// turned a blank Days cell into the number 0, so a job whose age Multitrack
// doesn't know rendered as "0d" — identical to a guitar booked in this
// morning. Nobody spots a wrong number that looks plausible, which is why it
// went unnoticed since 25 July. Every assertion below is about keeping
// "unknown" and "brand new" distinguishable.

describe('parseDays', () => {
  it('returns null for a blank cell, NOT 0', () => {
    expect(parseDays('')).toBeNull();
    expect(parseDays('   ')).toBeNull();
    expect(parseDays(null)).toBeNull();
    expect(parseDays(undefined)).toBeNull();
  });

  it('parses a real age', () => {
    expect(parseDays('274')).toBe(274);
    expect(parseDays(274)).toBe(274);
    expect(parseDays(' 12 ')).toBe(12);
  });

  it('keeps a genuine zero as 0, not null', () => {
    expect(parseDays('0')).toBe(0);
    expect(parseDays(0)).toBe(0);
  });

  it('returns null for non-numeric junk rather than 0', () => {
    expect(parseDays('n/a')).toBeNull();
    expect(parseDays('-')).toBeNull();
  });
});

describe('job age sort order', () => {
  // The sort comparator lives inside parseCSV; this exercises the same
  // expression directly so the ordering rule is pinned even if the call site
  // moves.
  const byAge = (a, b) => (b.days ?? -1) - (a.days ?? -1);

  it('sorts oldest first and pushes unknown ages past 0-day jobs', () => {
    const sorted = [{ days: null }, { days: 0 }, { days: 5 }].sort(byAge);
    expect(sorted.map(j => j.days)).toEqual([5, 0, null]);
  });
});

describe('parseCSV job age', () => {
  const header = 'Job,Customer,Mfr,Model,Status,Days,Tag,Hours,Action,Desc,VB,BL,PJ';
  const csv = [
    header,
    '1001,Alice,Fender,Strat,Active,274,,2,CI,restring,N,N,N',
    '1002,Bob,Gibson,LP,Active,,,2,CI,restring,N,N,N',
    '1003,Cass,Ibanez,RG,Active,0,,2,CI,restring,N,N,N',
  ].join('\n');

  it('reads a populated Days cell as a number and a blank one as null', () => {
    const jobs = parseCSV(csv);
    const byId = Object.fromEntries(jobs.map(j => [j.id, j]));
    expect(byId['1001'].days).toBe(274);
    expect(byId['1002'].days).toBeNull();
    expect(byId['1003'].days).toBe(0);
  });

  it('returns them oldest first, with the unknown age last', () => {
    const jobs = parseCSV(csv).filter(j => !j.parentId);
    expect(jobs.map(j => j.id)).toEqual(['1001', '1003', '1002']);
  });
});

describe('preserveKnownDays — the CSV import guard', () => {
  it('keeps the age we already know when the export comes through blank', () => {
    const parsed = [{ job: '1708', days: null }];
    const existing = [{ job: '1708', days: 274, parentId: null }];
    expect(preserveKnownDays(parsed, existing)[0].days).toBe(274);
  });

  it('takes a changed populated value — MT is authoritative when it says something', () => {
    const parsed = [{ job: '1708', days: 300 }];
    const existing = [{ job: '1708', days: 274, parentId: null }];
    expect(preserveKnownDays(parsed, existing)[0].days).toBe(300);
  });

  it('keeps an incoming 0 rather than treating it as blank', () => {
    const parsed = [{ job: '1708', days: 0 }];
    const existing = [{ job: '1708', days: 274, parentId: null }];
    expect(preserveKnownDays(parsed, existing)[0].days).toBe(0);
  });

  it('leaves a blank blank when we never knew the age either', () => {
    const parsed = [{ job: '1710', days: null }];
    const existing = [{ job: '1710', days: null, parentId: null }];
    expect(preserveKnownDays(parsed, existing)[0].days).toBeNull();
  });

  it('does not take an age from a split child row', () => {
    const parsed = [{ job: '1708', days: null }];
    const existing = [{ job: '1708', days: 274, parentId: '1708' }];
    expect(preserveKnownDays(parsed, existing)[0].days).toBeNull();
  });

  it('does not mutate the rows it is handed', () => {
    const parsed = [{ job: '1708', days: null }];
    preserveKnownDays(parsed, [{ job: '1708', days: 274, parentId: null }]);
    expect(parsed[0].days).toBeNull();
  });

  it('handles an empty or missing previous-jobs list', () => {
    expect(preserveKnownDays([{ job: '1', days: null }], [])[0].days).toBeNull();
    expect(preserveKnownDays()).toEqual([]);
  });
});

describe('blockedPile', () => {
  const job = (over = {}) => ({ status: 'Active', action: 'CI', backlog: false, ...over });

  it('puts any INC job in Planning, whatever its status', () => {
    // Settled at council 2026-07-27: Planning is INC alone. On the live data
    // the only INC jobs (393, 693) are `Booked In`, so the spec's original
    // `Waiting + INC` would have shipped an empty pile.
    expect(blockedPile(job({ status: 'Booked In', action: 'INC' }))).toBe('planning');
    expect(blockedPile(job({ status: 'Waiting', action: 'INC' }))).toBe('planning');
    expect(blockedPile(job({ status: 'Active', action: 'INC' }))).toBe('planning');
    expect(blockedPile(job({ status: 'On Hold', action: 'inc' }))).toBe('planning');
  });

  it('puts RS and RS-C jobs in Planning too — Trevor, 2026-07-28', () => {
    // Same still-figuring-it-out phase as INC, whatever the status column says.
    expect(blockedPile(job({ status: 'Active', action: 'RS' }))).toBe('planning');
    expect(blockedPile(job({ status: 'Booked In', action: 'RS-C' }))).toBe('planning');
    expect(blockedPile(job({ status: 'On Hold', action: 'rs-c' }))).toBe('planning');
  });

  it('puts On Hold + INC in Planning — INC is checked first, status-independent', () => {
    expect(blockedPile(job({ status: 'On Hold', action: 'INC' }))).toBe('planning');
  });

  it('puts stalled statuses in their own piles', () => {
    expect(blockedPile(job({ status: 'Waiting', action: '' }))).toBe('waiting');
    expect(blockedPile(job({ status: 'In Transit', action: '' }))).toBe('transit');
    expect(blockedPile(job({ status: 'On Hold', action: '' }))).toBe('hold');
  });

  it('does not independently block an Active job whose action is CI — CI only matters when a status already blocks it', () => {
    expect(blockedPile(job({ status: 'Active', action: 'CI' }))).toBeNull();
  });

  it('On Hold wins over CI — Trevor paused it on purpose', () => {
    expect(blockedPile(job({ status: 'On Hold', action: 'CI' }))).toBe('hold');
  });

  it('leaves workable jobs unblocked', () => {
    expect(blockedPile(job({ status: 'Active', action: '' }))).toBeNull();
    expect(blockedPile(job({ status: 'Booked In', action: '' }))).toBeNull();
    expect(blockedPile(job({ status: 'To Be Inv', action: '' }))).toBeNull();
  });

  it('does not block On Hold + BL=Y + GTS — parts arrived, good to start', () => {
    expect(blockedPile(job({ status: 'On Hold', action: 'GTS', backlog: true }))).toBeNull();
  });

  it('still blocks On Hold + GTS when the backlog flag is not set', () => {
    // readyToStart needs all three; two of three is still stuck.
    expect(blockedPile(job({ status: 'On Hold', action: 'GTS', backlog: false }))).toBe('hold');
  });

  it('tolerates a missing job without throwing', () => {
    expect(blockedPile(null)).toBeNull();
    expect(blockedPile(undefined)).toBeNull();
    expect(blockedPile({})).toBeNull();
  });

  it('does not match status with different casing or stray whitespace (exact-match regression guard)', () => {
    // blockedPile does exact string equality on status (no .trim()/.toUpperCase(),
    // unlike `act`). A future MT export casing/whitespace quirk should fail
    // loudly here rather than silently reproducing the status-string mismatch
    // that shipped the original bug.
    expect(blockedPile(job({ status: 'on hold', action: '' }))).toBeNull();
    expect(blockedPile(job({ status: 'On Hold ', action: '' }))).toBeNull();
    expect(blockedPile(job({ status: 'waiting', action: '' }))).toBeNull();
  });
});

// Brief E, Round 3 — blockedReason's CI-priority fix.
//
// Job 1175 is On Hold + CI. The old code checked `status === 'On Hold'`
// before `action === 'CI'`, so it reported "on hold" — which just restates
// the status column. CI means "waiting on the customer" and should win
// regardless of what status the job carries.
describe('blockedReason — CI takes priority over status', () => {
  it('reports "waiting on the customer" for On Hold + CI (job 1175)', () => {
    expect(blockedReason({ status: 'On Hold', action: 'CI' })).toBe('waiting on the customer');
  });

  it('still reports "waiting on the customer" for Waiting + CI', () => {
    expect(blockedReason({ status: 'Waiting', action: 'CI' })).toBe('waiting on the customer');
  });

  it('still reports "on hold" for On Hold with a non-CI action', () => {
    expect(blockedReason({ status: 'On Hold', action: 'GTS' })).toBe('on hold');
  });

  it('still reports "planning" for INC regardless of status or action ordering', () => {
    expect(blockedReason({ status: 'On Hold', action: 'INC' })).toBe('planning');
  });

  it('returns null for a workable job', () => {
    expect(blockedReason({ status: 'Active', action: '' })).toBeNull();
  });

  it('returns null for an Active job whose action is CI — CI alone does not block an otherwise-workable job', () => {
    // blockedPile no longer treats act === 'CI' as an independent trigger — CI only
    // matters when the job is already blocked by status (Waiting / In Transit).
    expect(blockedReason({ status: 'Active', action: 'CI' })).toBeNull();
  });
});

// Brief E, Round 3 — the wired-up bench-less colour helper.
//
// Blocked jobs carry bench: null. Every render site used to fall back to
// `BENCH_COLORS.Admin`, which visually lied — a bench-less job isn't on the
// Admin bench, it's not on any bench. benchColors() is the single place that
// answers "what colour is this job's bench chip", including the null case.
describe('benchColors', () => {
  it('returns the matching bench palette for a known bench', () => {
    expect(benchColors('Luthier')).toBe(BENCH_COLORS.Luthier);
  });

  it('returns the no-bench palette for null/undefined bench, not Admin', () => {
    expect(benchColors(null)).toBe(NO_BENCH_COLORS);
    expect(benchColors(undefined)).toBe(NO_BENCH_COLORS);
  });

  it('returns the no-bench palette for an unrecognised bench string', () => {
    expect(benchColors('NotARealBench')).toBe(NO_BENCH_COLORS);
  });
});
