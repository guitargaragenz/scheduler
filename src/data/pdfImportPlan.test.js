import { describe, it, expect } from 'vitest';
import { buildPdfImportPlan, buildNewJob, applyPdfFields } from './pdfImportPlan.js';

const parsedJob = (ref, over = {}) => ({
  ref,
  customer: 'Dave Smith',
  manufacturer: 'Fender',
  model: 'Strat',
  status: 'Active',
  fault: 'Fret buzz on the low E',
  ...over,
});

// A job already on the board, with every one of Trevor's hand-kept fields set,
// so the tests can prove none of them are carried into a write.
const boardJob = (id, over = {}) => ({
  id, job: id, parentId: null, isDerived: false,
  customer: 'Old Name', mfr: 'Fender', model: 'Strat',
  status: 'Waiting', desc: 'old description',
  tag: 'M', hours: 4.5, action: 'CI', vb: true, backlog: true,
  bench: 'Luthier', days: 30,
  ...over,
});

describe('buildPdfImportPlan — the count sanity check', () => {
  it('refuses when the PDF never stated a count', () => {
    const plan = buildPdfImportPlan({ parsed: [parsedJob('1601')], statedCount: null });
    expect(plan.ok).toBe(false);
    expect(plan.error).toMatch(/Jobs found/);
  });

  it('refuses when fewer rows were read than the PDF claims', () => {
    const plan = buildPdfImportPlan({ parsed: [parsedJob('1601')], statedCount: 46 });
    expect(plan.ok).toBe(false);
    expect(plan.error).toMatch(/46 jobs but only 1/);
  });

  it('refuses when the same job number appears twice', () => {
    const plan = buildPdfImportPlan({
      parsed: [parsedJob('1601'), parsedJob('1601')], statedCount: 2,
    });
    expect(plan.ok).toBe(false);
    expect(plan.error).toMatch(/1601/);
  });

  it('proceeds when the count matches exactly', () => {
    const plan = buildPdfImportPlan({ parsed: [parsedJob('1601')], statedCount: 1 });
    expect(plan.ok).toBe(true);
  });
});

describe('buildPdfImportPlan — the three counts and two lists', () => {
  const parsed = [parsedJob('1601'), parsedJob('1602'), parsedJob('1603')];
  const jobs = [boardJob('1602'), boardJob('1603'), boardJob('1700')];
  const plan = buildPdfImportPlan({ parsed, statedCount: 3, jobs, filename: 'jobs.pdf' });

  it('counts brand-new jobs and names them', () => {
    expect(plan.newJobs.map(j => j.id)).toEqual(['1601']);
    expect(plan.newLabels[0].label).toBe('#1601 Fender Strat — Dave Smith');
  });

  it('counts jobs already on the board', () => {
    expect(plan.existingCount).toBe(2);
  });

  it('names the jobs that were on the board but are not in this drop', () => {
    expect(plan.missing.map(m => m.id)).toEqual(['1700']);
  });

  it('never deletes or completes a missing job — it only reports it', () => {
    expect(plan.writes.map(w => w.id).sort()).toEqual(['1601', '1602', '1603']);
    expect(plan.writes.some(w => w.id === '1700')).toBe(false);
  });
});

describe("buildPdfImportPlan — the app's own split cards", () => {
  it('never matches, writes or counts them', () => {
    const jobs = [
      boardJob('1620'),
      { ...boardJob('1620_Electronics_0'), parentId: '1620' },
      { ...boardJob('1620_Luthier_1'), isDerived: true, parentId: null },
    ];
    const plan = buildPdfImportPlan({ parsed: [parsedJob('1620')], statedCount: 1, jobs });
    expect(plan.existingCount).toBe(1);
    expect(plan.newJobs).toHaveLength(0);
    expect(plan.missing).toHaveLength(0);
    expect(plan.writes.map(w => w.id)).toEqual(['1620']);
  });
});

describe('buildPdfImportPlan — what gets written', () => {
  it('sends only the six PDF fields for a job already on the board', () => {
    const plan = buildPdfImportPlan({
      parsed: [parsedJob('1602')], statedCount: 1, jobs: [boardJob('1602')],
    });
    const write = plan.writes[0];
    expect(write.isNew).toBe(false);
    expect(Object.keys(write.data).sort())
      .toEqual(['customer', 'desc', 'job', 'mfr', 'model', 'status']);
  });

  it('adds bench and hours for a brand-new job, and nothing else', () => {
    const plan = buildPdfImportPlan({ parsed: [parsedJob('1601')], statedCount: 1 });
    const write = plan.writes[0];
    expect(write.isNew).toBe(true);
    expect(Object.keys(write.data).sort())
      .toEqual(['bench', 'customer', 'desc', 'hours', 'job', 'mfr', 'model', 'status']);
  });

  it("never sends Trevor's hand-kept fields, even though the board job has them", () => {
    const plan = buildPdfImportPlan({
      parsed: [parsedJob('1602')], statedCount: 1, jobs: [boardJob('1602')],
    });
    for (const field of ['tag', 'hours', 'action', 'vb', 'backlog', 'bl', 'days', 'bench']) {
      expect(Object.keys(plan.writes[0].data)).not.toContain(field);
    }
  });
});

describe('buildNewJob', () => {
  it('infers a bench from the PDF description', () => {
    const job = buildNewJob(parsedJob('1601', { fault: 'Full refret and new nut' }));
    expect(job.bench).toBeTruthy();
  });

  it('gives a schedulable job the one-hour default', () => {
    const job = buildNewJob(parsedJob('1601', { status: 'Active' }));
    expect(job.schedulable).toBe(true);
    expect(job.hours).toBe(1);
  });

  it('leaves a blocked job at zero hours rather than guessing', () => {
    const job = buildNewJob(parsedJob('1601', { status: 'Waiting' }));
    expect(job.hours).toBe(0);
  });

  it('starts Tag, Action, VB and BL visibly empty — the PDF does not carry them', () => {
    const job = buildNewJob(parsedJob('1601'));
    expect(job.tag).toBeNull();
    expect(job.action).toBeNull();
    expect(job.vb).toBe(false);
    expect(job.backlog).toBe(false);
  });

  it('is not scheduled and has no calendar slot', () => {
    const job = buildNewJob(parsedJob('1601'));
    expect(job.scheduled).toBe(false);
    expect(job.calendarSlot).toBeNull();
  });
});

describe('applyPdfFields', () => {
  const merged = applyPdfFields(boardJob('1602'), parsedJob('1602'));

  it('refreshes the six PDF fields', () => {
    expect(merged.customer).toBe('Dave Smith');
    expect(merged.desc).toBe('Fret buzz on the low E');
    expect(merged.status).toBe('Active');
  });

  it("leaves Trevor's fields exactly as they were", () => {
    expect(merged.tag).toBe('M');
    expect(merged.hours).toBe(4.5);
    expect(merged.action).toBe('CI');
    expect(merged.vb).toBe(true);
    expect(merged.backlog).toBe(true);
    expect(merged.bench).toBe('Luthier');
    expect(merged.days).toBe(30);
  });

  it('re-derives the status flags so the job moves pile straight away', () => {
    // Board job was Waiting (blocked). The PDF says Active, so it becomes
    // workable immediately rather than after the next reload — status from
    // the PDF always wins, because it is what drives the pile colours.
    expect(merged.schedulable).toBe(true);
  });

  it("still respects an action Trevor set, which the PDF cannot see", () => {
    // INC means "still being planned". The PDF saying Active must not drag
    // the job out of the planning pile — the action is Trevor's, not
    // Multitrack's, and it stays in charge.
    const planning = applyPdfFields(boardJob('1602', { action: 'INC' }), parsedJob('1602'));
    expect(planning.schedulable).toBe(false);
  });
});
