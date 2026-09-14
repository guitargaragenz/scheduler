// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// A ticked part must always save as done.
//
// The old handleMarkPieceDone read the ticked child out of variables set
// INSIDE its setJobs(prev => ...) updater, then bailed if they were still
// empty. React does not promise to run that updater straight away — when it
// defers it, the handler saw nothing, returned early, and the database write
// never happened. The tick showed on screen and was gone on reload.
//
// The fix plans the change up front from a ref of the current board
// (planPieceDone), so the save no longer depends on when React runs the updater.

const batchWriteJobsState = vi.fn(() => Promise.resolve({ ok: true }));

vi.mock('../utils/supabase.js', () => ({
  isSupabaseConfigured: () => true,
  batchWriteJobsState: (...args) => batchWriteJobsState(...args),
  appendCompletedJob: vi.fn(),
  loadCompletedJobs: vi.fn(() => Promise.resolve(null)),
  subscribeToCompletedJobs: vi.fn(() => () => {}),
  saveJob: vi.fn(),
  deleteChildJobs: vi.fn(),
  writePdfImportBatch: vi.fn(),
  writeJbaImportBatch: vi.fn(),
  logPdfImport: vi.fn(),
  loadJobIdentities: vi.fn(),
  writeDepartureBatch: vi.fn(),
  deleteScheduledSlotsForJobs: vi.fn(),
}));
vi.mock('../utils/googleCalendar.js', () => ({ deleteEvent: vi.fn() }));

const { planPieceDone, useJobs } = await import('./useJobs.js');

const parent = { id: '1520', job: '1520', bench: 'Luthier', parentId: null };
const a = { id: '1520_Luthier_0', job: '1520', bench: 'Luthier', parentId: '1520', isSubtask: true, pieceDone: false };
const b = { id: '1520_Setup_0', job: '1520', bench: 'Setup', parentId: '1520', isSubtask: true, pieceDone: false };

describe('planPieceDone', () => {
  it('ticks the child and leaves the input array untouched', () => {
    const jobs = [parent, a, b];
    const plan = planPieceDone(jobs, '1520', a.id, true);
    expect(plan.updatedChild).toMatchObject({ id: a.id, pieceDone: true });
    expect(plan.parentJob.id).toBe('1520');
    expect(plan.allChildrenDone).toBe(false);
    expect(a.pieceDone).toBe(false);
  });

  it('reports all children done when the last piece is ticked', () => {
    const plan = planPieceDone([parent, { ...a, pieceDone: true }, b], '1520', b.id, true);
    expect(plan.allChildrenDone).toBe(true);
    expect(plan.children.map(c => c.id).sort()).toEqual([a.id, b.id].sort());
  });

  it('untick plans pieceDone false and never reports all done', () => {
    const plan = planPieceDone([parent, { ...a, pieceDone: true }, { ...b, pieceDone: true }], '1520', b.id, false);
    expect(plan.updatedChild.pieceDone).toBe(false);
    expect(plan.allChildrenDone).toBe(false);
  });

  it('uses the parent subtasks list when the parent has hasSubtasks', () => {
    const p = { ...parent, hasSubtasks: true, subtasks: [a.id] };
    const plan = planPieceDone([p, a, b], '1520', a.id, true);
    expect(plan.children.map(c => c.id)).toEqual([a.id]);
    expect(plan.allChildrenDone).toBe(true);
  });

  it('returns nulls when the child or parent is missing', () => {
    expect(planPieceDone([parent, a], '1520', 'nope', true).updatedChild).toBeNull();
    expect(planPieceDone([a], '1520', a.id, true).parentJob).toBeNull();
  });
});

describe('handleMarkPieceDone — saves even when React defers the updater', () => {
  beforeEach(() => batchWriteJobsState.mockClear());

  function setup(jobs) {
    const deferred = [];
    const setJobs = vi.fn(fn => { deferred.push(fn); }); // never runs it now
    const showToast = vi.fn();
    const { result } = renderHook(() => useJobs({
      jobs, setJobs, scheduledSlots: {}, setScheduledSlots: vi.fn(),
      doneJobIds: [], completedJobs: [], setCompletedJobs: vi.fn(), setDoneJobIds: vi.fn(),
      benchKeywords: {}, benchHours: {}, justSavedAt: { current: 0 },
      setPomoJob: vi.fn(), setHighlightedJobId: vi.fn(), setSidebarOpen: vi.fn(),
      showToast, addChangelog: vi.fn(),
    }));
    return { result, setJobs, deferred, showToast };
  }

  it('writes the ticked child to the database', () => {
    const { result, deferred } = setup([parent, a, b]);
    result.current.handleMarkPieceDone('1520', a.id, true);
    expect(batchWriteJobsState).toHaveBeenCalledTimes(1);
    const [[writes]] = batchWriteJobsState.mock.calls;
    expect(writes[0].id).toBe(a.id);
    expect(writes[0].data.pieceDone).toBe(true);
    // The updater, when React does run it, only flips that child's pieceDone.
    const next = deferred[0]([parent, a, b]);
    expect(next.find(j => j.id === a.id).pieceDone).toBe(true);
    expect(next.find(j => j.id === b.id).pieceDone).toBe(false);
  });

  it('two quick ticks before a re-render still finish the job', () => {
    const { result } = setup([parent, a, b]);
    const onAll = vi.fn();
    result.current.handleMarkPieceDone('1520', a.id, true, onAll);
    result.current.handleMarkPieceDone('1520', b.id, true, onAll);
    expect(batchWriteJobsState).toHaveBeenCalledTimes(2);
    expect(onAll).toHaveBeenCalledTimes(1);
    expect(onAll.mock.calls[0][0].id).toBe('1520');
  });
});
