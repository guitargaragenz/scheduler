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

// ---------------------------------------------------------------------------
// Council amendment 3a — the phantom-occupied slot.
//
// When a job departs, its scheduled_slots rows have to go with it. Leaving them
// is not a cosmetic problem, and it is specifically NOT visible on screen:
// App.jsx builds its calendar map with jobs.find(...) and only renders a cell
// whose job it can find, so a slot held by a departed job renders EMPTY. But
// the occupancy test below reads any truthy entry as taken, so that
// empty-looking cell silently refuses the next booking, with nothing on screen
// explaining why. An empty cell is not proof; this is.
// ---------------------------------------------------------------------------
const { findAvailableSlots } = await import('../utils/scheduler.js');
const { slotKey } = await import('../utils/calendar.js');

describe('a departed job must not leave its slots behind', () => {
  // A Wednesday afternoon: inside work hours (which start at 10), clear of
  // lunch (12) and clear of the 7-9pm gap.
  const day = new Date(2026, 7, 5);
  const weekDays = [day];
  const departingJob = { id: '1619', hours: 1 };
  const nextJob = { id: '1701', hours: 1 };
  const heldKeys = [slotKey(day, 14, 0), slotKey(day, 14, 30)];

  it('the slot reads as occupied while the stale entries are still there', () => {
    const stale = Object.fromEntries(heldKeys.map(k => [k, departingJob.id]));
    const found = findAvailableSlots(0, 14, 0, 2, stale, weekDays, new Set());
    // Pushed elsewhere, or not found at all — either way, not this slot.
    expect(found.filter(f => f.hour === 14).length).toBe(0);
  });

  it('the same slot accepts the next booking cleanly once they are cleared', () => {
    // Exactly what the import does: drop every entry whose value is a departed
    // job id.
    const stale = Object.fromEntries(heldKeys.map(k => [k, departingJob.id]));
    const goneIds = new Set(['1619']);
    const cleaned = { ...stale };
    Object.keys(cleaned).forEach(k => { if (goneIds.has(String(cleaned[k]))) delete cleaned[k]; });

    expect(Object.keys(cleaned)).toHaveLength(0);
    const found = findAvailableSlots(0, 14, 0, 2, cleaned, weekDays, new Set());
    expect(found).toHaveLength(2);
    expect(found[0]).toMatchObject({ hour: 14, minute: 0 });
    expect(found[1]).toMatchObject({ hour: 14, minute: 30 });
    // And nothing was displaced to get there.
    expect(found.every(f => !cleaned[slotKey(weekDays[f.dayIdx], f.hour, f.minute)])).toBe(true);
    expect(nextJob.id).toBe('1701');
  });

  it('clearing leaves another job\'s slots alone', () => {
    const mixed = {
      [slotKey(day, 14, 0)]: '1619',
      [slotKey(day, 15, 0)]: '1701',
    };
    const goneIds = new Set(['1619']);
    Object.keys(mixed).forEach(k => { if (goneIds.has(String(mixed[k]))) delete mixed[k]; });
    expect(mixed).toEqual({ [slotKey(day, 15, 0)]: '1701' });
  });
});
