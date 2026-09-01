import { describe, it, expect } from 'vitest';
import { previewBenchChanges, isReinferable } from './benchKeywordPreview.js';

const job = (over = {}) => ({
  id: '1', job: '1', desc: '', status: 'Booked In', action: 'GTS',
  model: '', mfr: '', bench: 'Setup', backlog: false, vb: false, ...over,
});

describe('previewBenchChanges', () => {
  it('lists a job whose bench the new keywords change', () => {
    const jobs = [job({ id: '101', job: '101', desc: 'full rewire', bench: 'Setup' })];
    const moves = previewBenchChanges(jobs, { Wiring: ['rewire'] });
    expect(moves).toEqual([{ id: '101', job: '101', from: 'Setup', to: 'Wiring' }]);
  });

  it('returns nothing when no job changes bench', () => {
    const jobs = [job({ id: '102', job: '102', desc: 'full rewire', bench: 'Wiring' })];
    expect(previewBenchChanges(jobs, { Wiring: ['rewire'] })).toEqual([]);
  });

  it('skips split children and split parents, as the apply step does', () => {
    const jobs = [
      job({ id: '103-WR', job: '103', desc: 'full rewire', parentId: '103' }),
      job({ id: '104', job: '104', desc: 'full rewire', isSplit: true }),
      job({ id: '105', job: '105', desc: 'full rewire', hasSubtasks: true }),
    ];
    expect(previewBenchChanges(jobs, { Wiring: ['rewire'] })).toEqual([]);
  });

  it('isReinferable matches the App apply filter', () => {
    expect(isReinferable(job())).toBe(true);
    expect(isReinferable(job({ parentId: 'x' }))).toBe(false);
    expect(isReinferable(job({ isSplit: true }))).toBe(false);
    expect(isReinferable(job({ hasSubtasks: true }))).toBe(false);
  });
});
