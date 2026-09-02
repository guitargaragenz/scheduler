import { describe, it, expect } from 'vitest';
import { parseDays, blockedPile, blockedReason, benchColors, inferBench, BENCH_COLORS, NO_BENCH_COLORS } from './jobs.js';

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
  // The comparator this pins used to live inside parseCSV, which went with the
  // CSV path in Build 2a. The rule itself is still live — JobShelf, DailyLogPage
  // and joinJobs all sort by `days` this way — so it is exercised directly here.
  const byAge = (a, b) => (b.days ?? -1) - (a.days ?? -1);

  it('sorts oldest first and pushes unknown ages past 0-day jobs', () => {
    const sorted = [{ days: null }, { days: 0 }, { days: 5 }].sort(byAge);
    expect(sorted.map(j => j.days)).toEqual([5, 0, null]);
  });
});

// The preserveKnownDays block that sat here went with the function in Brief H,
// Build 2b. It guarded a stored age against a blank CSV cell; there is no CSV
// import and no stored age left for it to guard. Age is computed from the
// booked-in date now, and src/utils/jobAge.test.js covers it.

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

  // Replaces the two On Hold + BL=Y + GTS tests that asserted the opposite.
  // That exemption (readyToStart) was deleted 2026-08-05 — Trevor: "that would
  // never happen." On Hold now wins whatever BL and GTS say.
  it('blocks On Hold + BL=Y + GTS — the old readyToStart exemption is gone', () => {
    expect(blockedPile(job({ status: 'On Hold', action: 'GTS', backlog: true }))).toBe('hold');
    expect(blockedPile(job({ status: 'On Hold', action: 'GTS', backlog: false }))).toBe('hold');
  });

  it('treats DG exactly like INC — both are planning, whatever the status', () => {
    expect(blockedPile(job({ status: 'Active', action: 'DG' }))).toBe('planning');
    expect(blockedPile(job({ status: 'Booked In', action: 'DG' }))).toBe('planning');
    expect(blockedPile(job({ status: 'On Hold', action: 'dg' }))).toBe('planning');
  });

  it('blocks a VB job regardless of status and action — the guitar is not in the shop', () => {
    expect(blockedPile(job({ status: 'Active', action: 'GTS', vb: true }))).toBe('waiting');
    expect(blockedPile(job({ status: 'Booked In', action: '', vb: true }))).toBe('waiting');
    // A real status still wins, because it says more than "VB".
    expect(blockedPile(job({ status: 'On Hold', action: '', vb: true }))).toBe('hold');
  });

  it('blocks a BL job that nothing else caught', () => {
    expect(blockedPile(job({ status: 'Active', action: 'GTS', backlog: true }))).toBe('hold');
    expect(blockedPile(job({ status: 'Active', action: 'GTS', backlog: false }))).toBeNull();
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

  it('reports "planning" for RS, RS-C and DG too, not just INC', () => {
    expect(blockedReason({ status: 'Active', action: 'RS' })).toBe('planning');
    expect(blockedReason({ status: 'Active', action: 'RS-C' })).toBe('planning');
    expect(blockedReason({ status: 'Active', action: 'DG' })).toBe('planning');
  });

  it('says what is actually stopping a VB or BL job', () => {
    expect(blockedReason({ status: 'Active', action: 'GTS', vb: true }))
      .toBe('customer still has the instrument');
    expect(blockedReason({ status: 'Active', action: 'GTS', backlog: true })).toBe('backlog');
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

// Added with the shared-settings build, 2026-08-01. Bench keywords now arrive
// over the network instead of from this browser, so a partial or odd-shaped
// keyword object is reachable in more ways than "the tech deleted every chip".
// Trevor's ruling, 2026-08-04: blocked work carries the Admin bench, not a
// blank. A bench is a promise you can work the job; Admin is the honest answer
// for work that is his to sort out.
describe('inferBench — blocked work gets Admin', () => {
  it('returns Admin for every blocked shape, not null', () => {
    expect(inferBench('full setup', 'On Hold', '', '', 'Fender')).toBe('Admin');
    expect(inferBench('full setup', 'Waiting', '', '', 'Fender')).toBe('Admin');
    expect(inferBench('full setup', 'In Transit', '', '', 'Fender')).toBe('Admin');
    expect(inferBench('full setup', 'Active', 'INC', '', 'Fender')).toBe('Admin');
    expect(inferBench('full setup', 'Active', 'DG', '', 'Fender')).toBe('Admin');
    // 8th positional parameter is vb; 7th is backlog.
    expect(inferBench('full setup', 'Active', 'GTS', '', 'Fender', undefined, true, false)).toBe('Admin');
    expect(inferBench('full setup', 'Active', 'GTS', '', 'Fender', undefined, false, true)).toBe('Admin');
  });

  it('leaves a workable job on its real inferred bench', () => {
    expect(inferBench('full setup and restring', 'Active', 'GTS', '', 'Fender')).toBe('Setup');
    expect(inferBench('refret', 'Booked In', 'GTS', '', 'Fender')).toBe('Fretwork');
  });

  it('still returns null for a workable job it genuinely cannot classify', () => {
    // Not the Admin case — this one needs a human to pick the bench, and
    // JobDrawer's "Needs a bench" option is what catches it.
    expect(inferBench('zzz unclassifiable', 'Active', 'GTS', '', 'Nobody')).toBeNull();
  });
});

describe('inferBench with broken keyword settings', () => {
  const setupJob = ['full setup and restring', 'Booked In', '', '', 'Fender'];

  it('falls back to a bench\'s defaults when its list is emptied', () => {
    // The bug being guarded: [].join('|') is new RegExp(''), which matches
    // EVERY job, so an emptied Fretwork list would drag the whole board onto
    // the Fretwork bench.
    expect(inferBench(...setupJob, { Fretwork: [] })).toBe('Setup');
  });

  it('does not send a plain setup job to a bench whose list was emptied', () => {
    expect(inferBench(...setupJob, { Electronics: [], Luthier: [] })).toBe('Setup');
  });

  it('still honours a real custom keyword list', () => {
    expect(inferBench('flurb job', 'Booked In', '', '', 'Fender', { Fretwork: ['flurb'] }))
      .toBe('Fretwork');
  });

  it('survives no keyword object at all', () => {
    expect(inferBench(...setupJob, undefined)).toBe('Setup');
    expect(inferBench(...setupJob, {})).toBe('Setup');
    expect(inferBench(...setupJob, null)).toBe('Setup');
  });
});
