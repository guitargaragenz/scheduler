import { describe, it, expect, vi, beforeEach } from 'vitest';

// persistMove's two writes must be SEQUENCED (jobs row first, then the slot
// row) because scheduled_slots.job_id REFERENCES jobs(id) and a derived
// auto-split bench card has no jobs row until its first state write lands.
// These mocks record call order so a regression back to Promise.all fails
// here instead of as a broken first drag in production.
const calls = [];
const mockBatchWriteJobsState = vi.fn(async () => { calls.push('jobs'); return { ok: true }; });
const mockSaveScheduledSlotsBatch = vi.fn(async () => { calls.push('slots'); return { ok: true }; });

vi.mock('../utils/supabase.js', () => ({
  isSupabaseConfigured: () => true,
  batchWriteJobsState: (...a) => mockBatchWriteJobsState(...a),
  saveScheduledSlotsBatch: (...a) => mockSaveScheduledSlotsBatch(...a),
}));
vi.mock('../utils/googleCalendar.js', () => ({ deleteEvent: vi.fn() }));

const { persistMove } = await import('./useScheduler.js');

const args = {
  addRecords: [{ slotId: '2026-07-22-9-0', jobId: '2000-ST', bench: 'Setup' }],
  removedSlotKeys: [],
  undoSlotAdds: [],
  undoSlotRemoves: ['2026-07-22-9-0'],
  jobWrites: [{ id: '2000-ST', data: { scheduled: true, parentId: '2000', isDerived: true } }],
  undoJobWrites: [{ id: '2000-ST', data: { scheduled: false } }],
};

describe('persistMove write ordering (FK: scheduled_slots.job_id -> jobs.id)', () => {
  beforeEach(() => {
    calls.length = 0;
    mockBatchWriteJobsState.mockClear();
    mockSaveScheduledSlotsBatch.mockClear();
    mockBatchWriteJobsState.mockImplementation(async () => { calls.push('jobs'); return { ok: true }; });
    mockSaveScheduledSlotsBatch.mockImplementation(async () => { calls.push('slots'); return { ok: true }; });
  });

  it('writes the jobs row BEFORE the slot row, and reports ok', async () => {
    const result = await persistMove(args);
    expect(calls).toEqual(['jobs', 'slots']);
    expect(result).toBe('ok');
  });

  it('never attempts the slot insert when the job row write fails', async () => {
    // This is the whole point: attempting the slot insert anyway would
    // violate the FK for a derived card that has no jobs row yet.
    mockBatchWriteJobsState.mockImplementation(async () => { calls.push('jobs'); return { ok: false }; });
    const result = await persistMove(args);
    expect(calls).toEqual(['jobs']);
    expect(mockSaveScheduledSlotsBatch).not.toHaveBeenCalled();
    expect(result).toBe('reverted');
  });

  it('compensates the job write when the slot write fails', async () => {
    mockSaveScheduledSlotsBatch.mockImplementation(async () => { calls.push('slots'); return { ok: false }; });
    const result = await persistMove(args);
    expect(calls).toEqual(['jobs', 'slots', 'jobs']);
    expect(mockBatchWriteJobsState).toHaveBeenLastCalledWith(args.undoJobWrites);
    expect(result).toBe('reverted');
  });

  it('reports inconsistent when the compensating undo also fails', async () => {
    mockSaveScheduledSlotsBatch.mockImplementation(async () => { calls.push('slots'); return { ok: false }; });
    mockBatchWriteJobsState
      .mockImplementationOnce(async () => { calls.push('jobs'); return { ok: true }; })
      .mockImplementationOnce(async () => { calls.push('jobs'); return { ok: false }; });
    const result = await persistMove(args);
    expect(result).toBe('inconsistent');
  });
});
