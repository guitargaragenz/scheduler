import { describe, it, expect } from 'vitest';
import { joinJobsMasterState, keyReviewItemsById } from './joinJobs.js';

// Minimal jobsMaster fixture factory — only the fields the join layer and
// createSubtasks() actually read.
function master(overrides = {}) {
  return {
    id: '1000',
    job: '1000',
    mfr: 'Fender',
    model: 'Strat',
    status: 'Active',
    desc: 'general check',
    action: '',
    hours: 2,
    bench: 'Setup',
    schedulable: true,
    ...overrides,
  };
}

describe('joinJobsMasterState', () => {
  it('a normal (unsplit) job passes through with jobsState fields merged in', () => {
    const masters = [master({ id: '1000', job: '1000', desc: 'general check', bench: 'Setup', hours: 2 })];
    const states = [{ id: '1000', scheduled: true, calendarSlot: '2026-07-13-9-0', done: false }];

    const { jobs, orphans } = joinJobsMasterState(masters, states);

    expect(orphans).toHaveLength(0);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({
      id: '1000', mfr: 'Fender', model: 'Strat',
      scheduled: true, calendarSlot: '2026-07-13-9-0',
      hasSubtasks: false, isSplit: false, subtasks: null,
    });
  });

  it('a job with no jobsState doc yet still joins cleanly (fresh CSV row, never touched by the app)', () => {
    const masters = [master({ id: '2000', job: '2000' })];
    const { jobs, orphans } = joinJobsMasterState(masters, []);
    expect(orphans).toHaveLength(0);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].scheduled).toBeUndefined();
    expect(jobs[0].hasSubtasks).toBe(false);
  });

  it('a manual split restores stored children and marks the parent isSplit, never regenerating an auto-split', () => {
    const masters = [master({ id: '1520', job: '1520', desc: 'refret and setup', bench: 'Fretwork', hours: 4 })];
    const states = [
      { id: '1520', done: false },
      {
        id: '1520_Luthier_0', parentId: '1520', isSubtask: true, bench: 'Luthier',
        hours: 1.5, sessionIndex: 1, sessionTotal: 1, scheduled: true, calendarSlot: '2026-07-13-9-0',
        job: '1520', mfr: 'Ampeg', model: 'SVT-6 Pro',
      },
      {
        id: '1520_Setup_0', parentId: '1520', isSubtask: true, bench: 'Setup',
        hours: 2.5, sessionIndex: 1, sessionTotal: 1, scheduled: false, calendarSlot: null,
        job: '1520', mfr: 'Ampeg', model: 'SVT-6 Pro',
      },
    ];

    const { jobs, orphans } = joinJobsMasterState(masters, states);

    expect(orphans).toHaveLength(0);
    const parent = jobs.find(j => j.id === '1520');
    expect(parent.isSplit).toBe(true);
    expect(parent.hasSubtasks).toBe(false);

    const children = jobs.filter(j => j.parentId === '1520');
    expect(children).toHaveLength(2);
    expect(children.map(c => c.id).sort()).toEqual(['1520_Luthier_0', '1520_Setup_0']);
    const luthierChild = children.find(c => c.id === '1520_Luthier_0');
    expect(luthierChild.scheduled).toBe(true);
    expect(luthierChild.calendarSlot).toBe('2026-07-13-9-0');
    // This is the exact bug scenario: even though the master's desc/bench
    // would auto-split this job too (Fretwork + refret+setup keywords), the
    // stored manual children win — createSubtasks() must never be allowed to
    // silently override or duplicate a real manual split.
    expect(jobs).toHaveLength(3); // parent + 2 manual children, no auto-split leakage
  });

  it('an auto split (no stored jobsState for the parent) regenerates children from createSubtasks() and can still carry scheduling state per child', () => {
    const masters = [master({ id: '3000', job: '3000', desc: 'refret and level', bench: 'Fretwork', hours: 4 })];
    const states = [
      { id: '3000-R', scheduled: true, calendarSlot: '2026-07-14-10-0' },
    ];

    const { jobs, orphans } = joinJobsMasterState(masters, states);

    expect(orphans).toHaveLength(0);
    const parent = jobs.find(j => j.id === '3000');
    expect(parent.hasSubtasks).toBe(true);
    expect(parent.isSplit).toBe(false);
    expect(parent.subtasks).toEqual(expect.arrayContaining(['3000-R', '3000-LC']));

    const refretChild = jobs.find(j => j.id === '3000-R');
    expect(refretChild.scheduled).toBe(true);
    expect(refretChild.calendarSlot).toBe('2026-07-14-10-0');
    expect(refretChild.parentId).toBe('3000');

    const otherChild = jobs.find(j => j.id === '3000-LC');
    expect(otherChild.scheduled).toBe(false); // no jobsState doc for this one yet
  });

  it('an auto-split child\'s pomoLog/done/sessionNote/bumpHistory survive the join, not just its scheduling fields', () => {
    // Regression for the narrow 4-field overlay bug: an auto-split child's
    // full jobsState doc (Pomodoro logged against that one bench-card,
    // marked done, a session note, a bump-history entry) must all come
    // through — this data is real and Pomodoro-log preservation across
    // reloads is a named feature (root CLAUDE.md), not incidental.
    const masters = [master({ id: '3100', job: '3100', desc: 'refret and level', bench: 'Fretwork', hours: 4 })];
    const bumpEntry = { ts: 12345, reason: 'Parts', fromSlot: 'a', toSlot: 'b' };
    const states = [
      {
        id: '3100-R',
        scheduled: true,
        calendarSlot: '2026-07-14-10-0',
        pomoLog: [{ pomos: 2, ts: 111 }],
        done: true,
        sessionNote: 'Frets levelled, needs re-crown tomorrow',
        bumpHistory: [bumpEntry],
      },
    ];

    const { jobs } = joinJobsMasterState(masters, states);
    const refretChild = jobs.find(j => j.id === '3100-R');

    expect(refretChild.scheduled).toBe(true);
    expect(refretChild.calendarSlot).toBe('2026-07-14-10-0');
    expect(refretChild.pomoLog).toEqual([{ pomos: 2, ts: 111 }]);
    expect(refretChild.done).toBe(true);
    expect(refretChild.sessionNote).toBe('Frets levelled, needs re-crown tomorrow');
    expect(refretChild.bumpHistory).toEqual([bumpEntry]);

    // Fields that only createSubtasks() knows (never stored in jobsState)
    // must still come from the freshly-derived base, not get wiped by the
    // overlay.
    expect(refretChild.bench).toBe('Fretwork');
    expect(refretChild.parentId).toBe('3100');
  });

  it('an auto-split child\'s stale stored hours/bench/label are ignored in favour of the freshly-derived createSubtasks() value, while pomoLog/done/sessionNote/bumpHistory still carry forward', () => {
    // The regression the coordinator's second review caught: jobsStateFieldsFor()
    // (the write side) saves the FULL joined record for any split child,
    // including CSV-shaped fields (bench/hours/label/hoursRange) that just
    // happen to also be sitting in the jobsState doc — not real app-owned
    // data. If the parent's hours/desc are edited after that child was last
    // saved, the stored doc's hours/bench/label go stale. The join must
    // never let that stale doc win over the fresh createSubtasks() value —
    // doing so would also create a feedback loop via the diff-save (stale
    // value gets read back, re-saved, permanently pinned).
    const masters = [master({ id: '4100', job: '4100', desc: 'refret and level', bench: 'Fretwork', hours: 6 })];
    // createSubtasks() on hours:6 currently derives half = 3 for both
    // '4100-R' and '4100-LC' (fretworkHours=6, half=round(6/2*2)/2=3).
    const states = [
      {
        id: '4100-R',
        // Stale values from a previous save, back when the parent's hours
        // were different (or before a bench-keyword reclassification) —
        // none of these should win.
        hours: 2, bench: 'WrongBench', label: 'stale label', hoursRange: '2',
        // Real app-owned data that MUST still carry forward.
        pomoLog: [{ pomos: 1, ts: 222 }],
        done: false,
        sessionNote: 'left off after refret, needs crown+polish next',
        bumpHistory: [{ ts: 999, reason: 'Other', fromSlot: 'x', toSlot: 'y' }],
        scheduled: true,
        calendarSlot: '2026-07-16-9-0',
      },
    ];

    const { jobs } = joinJobsMasterState(masters, states);
    const refretChild = jobs.find(j => j.id === '4100-R');

    // Fresh createSubtasks() values win — stale stored CSV-shaped fields do not.
    expect(refretChild.hours).toBe(3);
    expect(refretChild.bench).toBe('Fretwork');
    expect(refretChild.label).toBe('Refret');

    // Real app-owned state still carries forward correctly.
    expect(refretChild.pomoLog).toEqual([{ pomos: 1, ts: 222 }]);
    expect(refretChild.sessionNote).toBe('left off after refret, needs crown+polish next');
    expect(refretChild.bumpHistory).toEqual([{ ts: 999, reason: 'Other', fromSlot: 'x', toSlot: 'y' }]);
    expect(refretChild.scheduled).toBe(true);
    expect(refretChild.calendarSlot).toBe('2026-07-16-9-0');
  });

  it('an orphaned split — jobsState exists with real split data but jobsMaster is missing — is surfaced as an orphan, never silently dropped', () => {
    // This is the exact production incident: #1520's parent record dropped
    // out of a CSV sync, but its manually-split children survived in
    // jobsState. The old withSplitsExpanded() only visited children whose
    // parent was present, so the orphan silently vanished on the next save.
    const masters = []; // parent's jobsMaster doc is gone
    const states = [
      {
        id: '1520_Luthier_0', parentId: '1520', isSubtask: true, bench: 'Luthier',
        hours: 1.5, job: '1520', mfr: 'Ampeg', model: 'SVT-6 Pro', scheduled: true,
      },
    ];

    const { jobs, orphans } = joinJobsMasterState(masters, states);

    expect(jobs).toHaveLength(0);
    expect(orphans).toHaveLength(1);
    expect(orphans[0]).toMatchObject({ id: '1520_Luthier_0', parentId: '1520', job: '1520', mfr: 'Ampeg' });
  });

  it('a jobsState doc with only empty/default fields and no jobsMaster parent is NOT flagged as an orphan (nothing real to lose)', () => {
    const states = [{ id: '9999', scheduled: false, calendarSlot: null, pomoLog: [] }];
    const { jobs, orphans } = joinJobsMasterState([], states);
    expect(jobs).toHaveLength(0);
    expect(orphans).toHaveLength(0);
  });

  it('a done job with splits keeps its manual children and is not flagged as an orphan even if its master doc later disappears', () => {
    const states = [
      { id: '1175', done: true },
      { id: '1175_Wiring_0', parentId: '1175', isSubtask: true, bench: 'Wiring', hours: 1, job: '1175', done: true },
    ];
    // Master gone (job invoiced and rolled off the CSV) — done jobs are
    // expected to eventually roll off; they're not a revenue-review case.
    const { jobs, orphans } = joinJobsMasterState([], states);
    expect(jobs).toHaveLength(0);
    expect(orphans).toHaveLength(0); // done:true short-circuits orphan surfacing
  });

  it('a done job with splits still present in jobsMaster joins normally with done:true carried through', () => {
    const masters = [master({ id: '1175', job: '1175', desc: 'rewire pots', bench: 'Wiring', hours: 2 })];
    const states = [
      { id: '1175', done: true },
      { id: '1175_Wiring_0', parentId: '1175', isSubtask: true, bench: 'Wiring', hours: 1, job: '1175', done: true, scheduled: true },
      { id: '1175_Wiring_1', parentId: '1175', isSubtask: true, bench: 'Wiring', hours: 1, job: '1175', done: true, scheduled: true },
    ];
    const { jobs, orphans } = joinJobsMasterState(masters, states);
    expect(orphans).toHaveLength(0);
    const parent = jobs.find(j => j.id === '1175');
    expect(parent.done).toBe(true);
    expect(parent.isSplit).toBe(true);
    expect(jobs.filter(j => j.parentId === '1175')).toHaveLength(2);
  });

  it('a bench-keyword-edited job carries the updated jobsMaster bench through the join without needing any jobsState change', () => {
    // Simulates App.jsx's onBenchKeywordsChange handler having already
    // written the new bench to jobsMaster (design decision #2) — the join
    // layer itself doesn't re-infer bench, it just reflects whatever
    // jobsMaster currently says.
    const masters = [master({ id: '4000', job: '4000', desc: 'scratchy pot', bench: 'Electronics', hours: 1 })];
    const states = [{ id: '4000', scheduled: false }];
    const { jobs } = joinJobsMasterState(masters, states);
    expect(jobs[0].bench).toBe('Electronics');
  });

  it('never produces duplicate ids across the joined array', () => {
    const masters = [
      master({ id: '5000', job: '5000', desc: 'refret and setup', bench: 'Fretwork', hours: 4 }),
      master({ id: '6000', job: '6000', desc: 'general check', bench: 'Setup', hours: 1 }),
    ];
    const states = [
      { id: '5000_Setup_0', parentId: '5000', isSubtask: true, bench: 'Setup', hours: 2 },
    ];
    const { jobs } = joinJobsMasterState(masters, states);
    const ids = jobs.map(j => j.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('two simultaneous orphans — a top-level orphan (no job field) and an orphaned split child — are both returned distinctly, never merged', () => {
    const states = [
      // Top-level orphan: jobsMaster gone entirely for id '7000'. Top-level
      // jobsState docs never carry `job` (jobsMaster owns it) — this is the
      // shape that used to collide with every other job-less orphan under
      // the old String(j.job) key.
      { id: '7000', scheduled: true, calendarSlot: '2026-07-15-9-0' },
      // Orphaned split child of a different, also-missing parent '8000'.
      { id: '8000_Setup_0', parentId: '8000', isSubtask: true, bench: 'Setup', hours: 1, job: '8000' },
    ];
    const { orphans } = joinJobsMasterState([], states);
    expect(orphans).toHaveLength(2);
    expect(orphans.map(o => o.id).sort()).toEqual(['7000', '8000_Setup_0']);
  });

  it('two orphaned split children of the SAME missing parent (identical job number) are both returned distinctly', () => {
    // This is the sibling-collision case: both children share job '9000' —
    // keying by job number alone would let the second overwrite the first.
    const states = [
      { id: '9000_Setup_0', parentId: '9000', isSubtask: true, bench: 'Setup', hours: 1, job: '9000', mfr: 'Roland', model: 'JC-120' },
      { id: '9000_Wiring_0', parentId: '9000', isSubtask: true, bench: 'Wiring', hours: 1, job: '9000', mfr: 'Roland', model: 'JC-120' },
    ];
    const { orphans } = joinJobsMasterState([], states);
    expect(orphans).toHaveLength(2);
    expect(orphans.map(o => o.id).sort()).toEqual(['9000_Setup_0', '9000_Wiring_0']);

    // The regression this whole fix is about: converting the orphans array
    // into the pendingRevenueReview map used to key by job number and
    // silently drop one sibling. keyReviewItemsById (used by both
    // usePendingRevenueReview.js and firebase.js's addPendingRevenueReviewItems)
    // must key by each item's own doc id instead, so both survive.
    const keyed = keyReviewItemsById(orphans);
    expect(Object.keys(keyed).sort()).toEqual(['9000_Setup_0', '9000_Wiring_0']);
    expect(keyed['9000_Setup_0'].bench).toBe('Setup');
    expect(keyed['9000_Wiring_0'].bench).toBe('Wiring');
  });

  it('keyReviewItemsById never collides a top-level orphan (job undefined) with anything else', () => {
    const topLevelOrphan = { id: '7000', scheduled: true }; // no `job` field
    const splitOrphan = { id: '8000_Setup_0', parentId: '8000', job: '8000', bench: 'Setup' };
    const keyed = keyReviewItemsById([topLevelOrphan, splitOrphan]);
    expect(Object.keys(keyed)).toHaveLength(2);
    expect(keyed['7000']).toBeDefined();
    expect(keyed['8000_Setup_0']).toBeDefined();
  });
});
