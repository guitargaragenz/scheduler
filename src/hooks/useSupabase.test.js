import { describe, it, expect } from 'vitest';
import { normalizeJobsFromDb } from './useSupabase.js';

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
