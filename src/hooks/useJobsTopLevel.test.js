import { describe, it, expect } from 'vitest';
import { topLevelJob } from './useJobs.js';
import { buildManualInvoiceJob, jobNumberFromId } from '../data/jobs.js';

// Two halves of the revenue fix that live outside supabase.js.
//
// 1. topLevelJob() — split work is invoiced COMBINED at the end of the job.
//    One invoice per job, never one per piece. PomoDrawer already refuses to
//    invoice a child, but CloseDayModal and CatchUpInterview resolve a Daily
//    Log bullet straight to whatever job id it holds, which can be a piece. So
//    the walk-up is what actually stops two revenue rows appearing for one job.
//
// 2. buildManualInvoiceJob() — the reconfirm path used to hard-code job: null,
//    which is why the one surviving row in the live database has a null
//    job_number and nothing reconciles it back to Multitrack.

const job = (id, over = {}) => ({ id, job: id, parentId: null, ...over });

describe('topLevelJob — one revenue row per job, not per piece', () => {
  it('leaves an ordinary top-level job alone', () => {
    const j = job('1687');
    expect(topLevelJob(j, [j])).toBe(j);
  });

  it('walks a manual split child (isSubtask) up to its parent', () => {
    const parent = job('1520');
    const child = job('1520_Luthier_0', { parentId: '1520', isSubtask: true, job: '1520' });
    expect(topLevelJob(child, [parent, child]).id).toBe('1520');
  });

  it('walks a derived auto-split bench card (isDerived) up to its parent', () => {
    const parent = job('2000');
    const card = job('2000-ST', { parentId: '2000', isDerived: true, job: '2000' });
    expect(topLevelJob(card, [parent, card]).id).toBe('2000');
  });

  it('BOTH pieces of one split resolve to the SAME id — the two-rows failure mode', () => {
    const parent = job('1520');
    const a = job('1520_Luthier_0', { parentId: '1520' });
    const b = job('1520_Setup_0', { parentId: '1520' });
    const jobs = [parent, a, b];
    expect(topLevelJob(a, jobs).id).toBe(topLevelJob(b, jobs).id);
  });

  it('takes the PARENT\'s customer and job number, not the piece\'s', () => {
    const parent = job('1520', { customer: 'Papamoa College', mfr: 'Ampeg', model: 'VT-22' });
    const child = job('1520_Setup_0', { parentId: '1520', customer: '', mfr: '', model: '' });
    expect(topLevelJob(child, [parent, child])).toMatchObject({
      job: '1520', customer: 'Papamoa College',
    });
  });

  it('returns the job itself when the parent is not on the board', () => {
    // A synthetic manual-invoice job, or a child whose parent has not loaded.
    // Keying the money on an id nothing else uses would be worse than keying
    // it on the piece.
    const orphan = job('1520_Setup_0', { parentId: '1520' });
    expect(topLevelJob(orphan, [orphan]).id).toBe('1520_Setup_0');
  });

  it('survives a parentId cycle instead of hanging the mark-done', () => {
    const a = job('A', { parentId: 'B' });
    const b = job('B', { parentId: 'A' });
    expect(['A', 'B']).toContain(topLevelJob(a, [a, b]).id);
  });

  it('handles a missing jobs list', () => {
    const j = job('1687');
    expect(topLevelJob(j, undefined)).toBe(j);
    expect(topLevelJob(j, [])).toBe(j);
  });
});

describe('buildManualInvoiceJob — the reconfirm path keeps the job number (checklist 6)', () => {
  it('carries the job number through instead of writing null', () => {
    const built = buildManualInvoiceJob({ jobId: '1712', text: 'Jules Lovell — Fender Telecaster' });
    expect(built.job).toBe('1712');
    expect(built.id).toBe('1712');
  });

  it('still splits the bullet text into customer and make, unchanged', () => {
    const built = buildManualInvoiceJob({ jobId: '1712', text: 'Jules Lovell — Fender Telecaster' });
    expect(built).toMatchObject({ customer: 'Jules Lovell', mfr: 'Fender Telecaster', model: '' });
  });

  it('recovers the number from a split-piece id too', () => {
    expect(buildManualInvoiceJob({ jobId: '1520_Luthier_0', text: 'x' }).job).toBe('1520');
    expect(buildManualInvoiceJob({ jobId: '2000-ST', text: 'x' }).job).toBe('2000');
  });

  it('returns null when the id genuinely carries no number', () => {
    expect(jobNumberFromId('wsproj-abc')).toBeNull();
    expect(jobNumberFromId(undefined)).toBeNull();
    expect(buildManualInvoiceJob({ jobId: undefined, text: 'Fender Telecaster' }).job).toBeNull();
  });
});
