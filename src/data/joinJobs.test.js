import { describe, it, expect, vi } from 'vitest';
import { joinJobsMasterState, keyReviewItemsById, expandAutoSplits, jobsStateFieldsFor, pickMasterFields } from './joinJobs.js';

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

  it('a job with no jobsState doc yet still joins cleanly (fresh CSV row, never touched by the app) with explicit defaults, not undefined', () => {
    // Regression: production verification found 189 diffs after real
    // cutover, all traced to top-level jobs with no jobsState doc yet —
    // pickTopLevelState(state) on an empty {} leaves scheduled/pomoLog/
    // calendarSlot/gcalEventId(s) as `undefined` instead of explicit
    // false/[]/null. Downstream code isn't guaranteed to guard against
    // `undefined` (e.g. a bare pomoLog.length), and it's inconsistent with
    // how split children already get explicit fallbacks.
    const masters = [master({ id: '2000', job: '2000' })];
    const { jobs, orphans } = joinJobsMasterState(masters, []);
    expect(orphans).toHaveLength(0);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].scheduled).toBe(false);
    expect(jobs[0].pomoLog).toEqual([]);
    expect(jobs[0].calendarSlot).toBeNull();
    expect(jobs[0].gcalEventId).toBeNull();
    expect(jobs[0].gcalEventIds).toEqual([]);
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

describe('expandAutoSplits (flat single-table Supabase path)', () => {
  // A Setup job whose desc mentions both setup and wiring qualifies for a
  // 2-card auto-split via createSubtasks().
  function splittable(overrides = {}) {
    return master({
      id: '2000', job: '2000', bench: 'Setup', hours: 3,
      desc: 'full setup and rewire scratchy pot', ...overrides,
    });
  }

  it('a qualifying job produces fresh derived bench cards', () => {
    const out = expandAutoSplits([splittable()]);

    const parent = out.find(j => j.id === '2000');
    const kids = out.filter(j => j.parentId === '2000');

    expect(parent).toMatchObject({ hasSubtasks: true, isSplit: false });
    expect(parent.subtasks).toEqual(kids.map(k => k.id));
    expect(kids).toHaveLength(2);
    kids.forEach(k => {
      expect(k.isDerived).toBe(true);
      // Derived cards are never themselves split, and never inherit the
      // parent's split bookkeeping or done flag.
      expect(k.isSubtask).toBe(false);
      expect(k.isSplit).toBe(false);
      expect(k.hasSubtasks).toBe(false);
      expect(k.subtasks).toBeNull();
      expect(k.done).toBe(false);
      // Explicit defaults, not undefined, for a card never scheduled/logged.
      expect(k.scheduled).toBe(false);
      expect(k.calendarSlot).toBeNull();
      expect(k.gcalEventIds).toEqual([]);
    });
    expect(kids.map(k => k.bench).sort()).toEqual(['Setup', 'Wiring']);
  });

  it('a noAutoSplit job is never regenerated (deliberate un-split is respected)', () => {
    const out = expandAutoSplits([splittable({ noAutoSplit: true })]);

    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: '2000', hasSubtasks: false, subtasks: null, isSplit: false });
    expect(out.some(j => j.isDerived)).toBe(false);
  });

  it('a job with stored manual children is not auto-split, and the children pass through untouched', () => {
    // isSubtask is deliberately absent/null on one child: the DB column is
    // nullable, so parentId != null is the only reliable child test.
    const flat = [
      splittable(),
      { id: '2000_Setup_0', parentId: '2000', isSubtask: true, bench: 'Setup', hours: 1.5, job: '2000', label: 'Setup' },
      { id: '2000_Wiring_0', parentId: '2000', isSubtask: null, bench: 'Wiring', hours: 1.5, job: '2000', label: 'Wiring' },
    ];
    const out = expandAutoSplits(flat);

    expect(out).toHaveLength(3);
    expect(out.find(j => j.id === '2000')).toMatchObject({ isSplit: true, hasSubtasks: false, subtasks: null });
    const kids = out.filter(j => j.parentId === '2000');
    expect(kids.map(k => k.id).sort()).toEqual(['2000_Setup_0', '2000_Wiring_0']);
    expect(kids.some(k => k.isDerived)).toBe(false);
    // No derived card ids leaked in alongside the stored ones.
    expect(out.some(j => j.id === '2000-ST' || j.id === '2000-WR')).toBe(false);
  });

  it('pomoLog on a derived card survives regeneration, but stale shape fields never beat the fresh ones', () => {
    // A previously-materialised derived row: it holds real app-owned state
    // (pomoLog/scheduled) AND stale CSV-shaped fields from before the guards
    // existed. The state must cross over; the stale shape must not.
    const stored = {
      id: '2000-ST', parentId: '2000', isDerived: true,
      pomoLog: [{ start: '2026-07-22T09:00:00Z', mins: 25 }],
      scheduled: true, calendarSlot: '2026-07-22-9-0', pieceDone: true,
      bench: 'Admin', hours: 99,
    };
    const out = expandAutoSplits([splittable(), stored]);

    const card = out.find(j => j.id === '2000-ST');
    expect(card).toBeDefined();
    expect(card.pomoLog).toEqual(stored.pomoLog);
    expect(card.scheduled).toBe(true);
    expect(card.calendarSlot).toBe('2026-07-22-9-0');
    expect(card.pieceDone).toBe(true);
    // Fresh from createSubtasks(), not the stale stored values.
    expect(card.bench).toBe('Setup');
    expect(card.hours).not.toBe(99);
    expect(card.isDerived).toBe(true);
    // The stale derived row is reconciled into the regenerated card, never
    // emitted twice and never treated as a stored manual child.
    expect(out.filter(j => j.id === '2000-ST')).toHaveLength(1);
    expect(out.find(j => j.id === '2000').hasSubtasks).toBe(true);
  });
});

describe('jobsStateFieldsFor — derived-card write guard', () => {
  it('a derived card persists only its app-owned state, never its CSV-shaped body', () => {
    const card = {
      id: '2000-ST', parentId: '2000', job: '2000', isDerived: true,
      bench: 'Setup', hours: 1.5, desc: 'full setup and rewire', label: 'Setup',
      hoursRange: '1-2', mfr: 'Fender', isSubtask: false, subtasks: null,
      pomoLog: [{ mins: 25 }], scheduled: true, pieceDone: true,
    };
    const out = jobsStateFieldsFor(card);

    expect(out).toEqual({
      scheduled: true, pieceDone: true, pomoLog: [{ mins: 25 }],
      job: '2000', parentId: '2000', isDerived: true,
    });
    ['bench', 'hours', 'desc', 'label', 'hoursRange', 'mfr', 'isSubtask', 'subtasks']
      .forEach(f => expect(out).not.toHaveProperty(f));
  });

  it('a stored manual child still persists its whole record (unchanged behaviour)', () => {
    const kid = { id: '2000_Setup_0', parentId: '2000', isSubtask: true, bench: 'Setup', hours: 1.5 };
    const out = jobsStateFieldsFor(kid);
    expect(out).toMatchObject({ parentId: '2000', isSubtask: true, bench: 'Setup', hours: 1.5 });
    expect(out).not.toHaveProperty('id');
  });
});

describe('pickMasterFields — derived-card materialisation guard', () => {
  // The drawer-on-a-derived-card path: a derived bench card IS clickable, and
  // before the isDerived gating it fell through to the parent save branch,
  // which called saveJob(id, pickMasterFields(job)). NON_MASTER_FIELDS strips
  // parentId, so that wrote a full CSV-shaped row under the derived card's
  // synthetic id with parent_id = NULL — a permanent phantom top-level job.
  // pickMasterFields is the last line of defence and must refuse outright.
  const derivedCard = {
    id: '2000-ST', parentId: '2000', job: '2000', isDerived: true,
    bench: 'Setup', hours: 1.5, desc: 'full setup and rewire', mfr: 'Fender',
  };

  it('refuses a derived card, returning null rather than a row', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(pickMasterFields(derivedCard)).toBeNull();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('refuses a stored manual child too', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(pickMasterFields({ id: '2000_Setup_0', parentId: '2000', bench: 'Setup' })).toBeNull();
    spy.mockRestore();
  });

  it('null spreads harmlessly at the call sites that spread it', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect({ ...{ id: 'x' }, ...pickMasterFields(derivedCard) }).toEqual({ id: 'x' });
    spy.mockRestore();
  });

  it('still returns a real row for a genuine top-level job', () => {
    const row = pickMasterFields(master({ id: '3000', job: '3000', scheduled: true, isSplit: true, label: 'nope' }));
    expect(row).toMatchObject({ job: '3000', mfr: 'Fender', bench: 'Setup' });
    ['id', 'scheduled', 'isSplit', 'label', 'isDerived', 'parentId'].forEach(f =>
      expect(row).not.toHaveProperty(f));
  });
});
