import { describe, it, expect } from 'vitest';
import { normalizeJobsFromDb, detectDisappearedJobs, departedJobNumbersFromDb } from './useSupabase.js';

// Brief E, Round 3, item 4 — agreeing the old and new blocked-job rules.
//
// deriveJobStatusFlags (the old rule) doesn't know about blockedPile (the
// new rule), so an INC job like 393 or 693 used to read schedulable: true
// here while every other screen treated it as blocked via blockedPile().
// normalizeJobsFromDb must fold blockedPile() into the schedulable flag so
// ACTIVE/BACKLOG bucketing (Sidebar, JobsPage) agrees with the bench-less
// blocked-pile rule everywhere else.
describe('normalizeJobsFromDb — schedulable agrees with blockedPile', () => {
  const dbJob = (over = {}) => ({
    id: 'x1', job: 393, customer: 'Alice', mfr: 'Fender', model: 'Strat',
    status: 'Booked In', bench: 'Luthier', hours: 2, days: 5,
    scheduled: false, desc: 'setup', tag: '', action: 'CI',
    vb: 'N', bl: 'N', pj: 'N', has_subtasks: false, subtasks: [],
    is_split: false, no_auto_split: false, is_subtask: false, is_derived: false,
    ...over,
  });

  it('marks an INC job (e.g. 393/693) unschedulable even though status is Booked In', () => {
    const [job] = normalizeJobsFromDb([dbJob({ job: 393, action: 'INC' })]);
    expect(job.schedulable).toBe(false);
  });

  it('leaves a normal workable job schedulable', () => {
    const [job] = normalizeJobsFromDb([dbJob({ job: 1001, status: 'Active', action: 'CI' })]);
    expect(job.schedulable).toBe(true);
  });

  it('keeps an On Hold + BL + GTS ready-to-start job schedulable', () => {
    const [job] = normalizeJobsFromDb([
      dbJob({ job: 2002, status: 'On Hold', action: 'GTS', bl: 'Y' }),
    ]);
    expect(job.schedulable).toBe(true);
  });

  it('marks a stalled Waiting job unschedulable', () => {
    const [job] = normalizeJobsFromDb([dbJob({ job: 3003, status: 'Waiting', action: 'CI' })]);
    expect(job.schedulable).toBe(false);
  });
});

// The read-side choke point for departures. Filtering here is what makes a
// departed job vanish from the Jobs Sheet, the Sidebar, the Jobs page and the
// Projects page at once — they all read this array.
describe('normalizeJobsFromDb — departed jobs come off the board', () => {
  const dbJob = (over = {}) => ({
    id: 'x1', job: 1601, customer: 'Alice', mfr: 'Fender', model: 'Strat',
    status: 'Active', bench: 'Luthier', hours: 2,
    scheduled: false, desc: 'setup', tag: 'M', action: 'GTS',
    vb: 'N', bl: 'N', pj: 'N', has_subtasks: false, subtasks: [],
    is_split: false, no_auto_split: false, is_subtask: false, is_derived: false,
    departed_at: null,
    ...over,
  });

  // The fixture's description and hours make it auto-split, so each live job
  // comes back as a parent plus its derived bench cards. That is not noise here
  // — it is the mechanism that removes the four orphaned split cards.
  const topLevel = out => out.filter(j => !j.parentId);

  it('leaves a live job on the board', () => {
    expect(topLevel(normalizeJobsFromDb([dbJob()]))).toHaveLength(1);
  });

  it('drops a job whose row is marked departed', () => {
    const out = normalizeJobsFromDb([dbJob({ departed_at: '2026-08-02T08:36:00Z' })]);
    expect(out).toHaveLength(0);
  });

  it('drops only the departed ones', () => {
    const out = normalizeJobsFromDb([
      dbJob({ id: '1601', job: 1601 }),
      dbJob({ id: '1619', job: 1619, departed_at: '2026-08-02T08:36:00Z' }),
      dbJob({ id: '1620', job: 1620 }),
    ]);
    expect(topLevel(out).map(j => j.id).sort()).toEqual(['1601', '1620']);
  });

  it("takes the departed parent's auto-split bench cards with it, with nothing to delete", () => {
    // This is the 1620_Electronics_0 / 1689_Luthier_1 case. Those cards are
    // derived, never stored, and regenerated on every load from whatever
    // parents survive the filter. Once the parent is gone they simply stop
    // being generated — there is no row anywhere to delete.
    const live = normalizeJobsFromDb([dbJob({ id: '1689', job: 1689 })]);
    expect(live.filter(j => j.parentId === '1689').length).toBeGreaterThan(0);

    const departed = normalizeJobsFromDb([
      dbJob({ id: '1689', job: 1689, departed_at: '2026-08-02T08:36:00Z' }),
    ]);
    expect(departed).toEqual([]);
  });

  it('brings a job back the moment departed_at is cleared, with its fields intact', () => {
    const [job] = normalizeJobsFromDb([dbJob({ id: '1619', job: 1619, departed_at: null, tag: 'M', hours: 4.5, action: 'GTS', bench: 'Luthier' })]);
    expect(job.id).toBe('1619');
    expect(job.tag).toBe('M');
    expect(job.hours).toBe(4.5);
    expect(job.action).toBe('GTS');
    expect(job.bench).toBe('Luthier');
  });
});

// Council amendment 4 — the difference between "Trevor approved this leaving"
// and "this vanished and might never have been invoiced".
describe('detectDisappearedJobs — deliberate departures raise no revenue prompt', () => {
  const job = (n, over = {}) => ({ id: String(n), job: n, parentId: null, isDerived: false, done: false, ...over });

  it('still reports a job whose row vanished from the table (CSV drift)', () => {
    const gone = detectDisappearedJobs([job(1601), job(1602)], [job(1601)], new Set());
    expect(gone.map(j => j.job)).toEqual([1602]);
  });

  it('says nothing about a job that departed deliberately', () => {
    const gone = detectDisappearedJobs([job(1601), job(1619)], [job(1601)], new Set([1619]));
    expect(gone).toEqual([]);
  });

  it('reports drift and stays quiet about departures in the same update', () => {
    // The exact case that matters: an import departs 16 jobs while a 17th has
    // genuinely gone missing. Only the 17th is worth a prompt.
    const prev = [job(1601), job(1619), job(1620), job(1777)];
    const incoming = [job(1601)];
    const gone = detectDisappearedJobs(prev, incoming, new Set([1619, 1620]));
    expect(gone.map(j => j.job)).toEqual([1777]);
  });

  it('raises nothing at all when all 16 depart together', () => {
    const nums = [1619, 1620, 1626, 1671, 1682, 1683, 1684, 1685, 1686, 1687, 1688, 1689, 1690, 1698, 1702, 1710];
    const prev = nums.map(n => job(n));
    const gone = detectDisappearedJobs(prev, [], new Set(nums));
    expect(gone).toEqual([]);
  });

  it('is not satisfied by simply switching the detector off', () => {
    // Same 16 departing, plus one drifting. If the suppression had been done by
    // disabling the detector, this would come back empty.
    const nums = [1619, 1620, 1626, 1671, 1682, 1683, 1684, 1685, 1686, 1687, 1688, 1689, 1690, 1698, 1702, 1710];
    const prev = [...nums.map(n => job(n)), job(1777)];
    const gone = detectDisappearedJobs(prev, [], new Set(nums));
    expect(gone.map(j => j.job)).toEqual([1777]);
  });
});

describe('departedJobNumbersFromDb', () => {
  it('reads the departed set from the RAW rows, before they are filtered away', () => {
    const set = departedJobNumbersFromDb([
      { id: '1601', job: 1601, departed_at: null },
      { id: '1619', job: 1619, departed_at: '2026-08-02T08:36:00Z' },
    ]);
    expect([...set]).toEqual([1619]);
  });

  it('is empty when nothing has departed', () => {
    expect(departedJobNumbersFromDb([{ id: '1601', job: 1601, departed_at: null }]).size).toBe(0);
  });
});
