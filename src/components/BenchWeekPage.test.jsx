import { describe, it, expect } from 'vitest';
import {
  weekRows, cellMark, trailing, nextMark, slotDateKey, groupByBench, buildWeekExport,
  weekRowKey, benchSections, addableJobs,
  encodeTypedRow, decodeTypedRow, isTypedRowId, newTypedRowId, rowLabel,
  compareJobNumber,
} from './BenchWeekPage.jsx';

const WEEK = ['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14', '2026-08-15', '2026-08-16'];
const DAYS = WEEK.map(k => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
});

describe('slotDateKey', () => {
  it('takes the date off a calendarSlot without touching timezones', () => {
    expect(slotDateKey('2026-08-13-10-30')).toBe('2026-08-13');
    expect(slotDateKey('2026-08-13-9-0')).toBe('2026-08-13');
  });
  it('refuses anything that is not a slot key', () => {
    expect(slotDateKey(null)).toBeNull();
    expect(slotDateKey('')).toBeNull();
    expect(slotDateKey('not-a-slot')).toBeNull();
  });
});

describe('job number order', () => {
  it('reads oldest first, and treats the number as a number', () => {
    const ids = ['1714', '171', '17140', '980', '1714-ST'];
    expect([...ids].sort(compareJobNumber)).toEqual(['171', '980', '1714', '1714-ST', '17140']);
  });

  it('lists the week rows by job number, typed admin rows last', () => {
    const jobs = [
      { id: 'c', job: '1802', mfr: 'Fender', bench: 'Setup', calendarSlot: '2026-08-11-9-0' },
      { id: 'a', job: '1650', mfr: 'Gibson', bench: 'Setup', calendarSlot: '2026-08-12-9-0' },
      { id: 'b', job: '1714', mfr: 'Martin', bench: 'Setup', calendarSlot: '2026-08-13-9-0' },
    ];
    const marks = { [newTypedRowId(WEEK[0])]: { [weekRowKey(WEEK)]: encodeTypedRow('do the books') } };
    const rows = weekRows(jobs, WEEK, marks);
    expect(rows.map(r => r.job?.job ?? r.name)).toEqual(['1650', '1714', '1802', 'do the books']);
  });
});

describe('weekRows', () => {
  it('gives a split job ONE row, not one per split', () => {
    const jobs = [
      { id: 'p', job: '1714', mfr: 'Fender', model: 'Strat', isSplit: true, bench: 'Luthier' },
      { id: 'c1', parentId: 'p', bench: 'Fretwork', calendarSlot: '2026-08-11-9-0' },
      { id: 'c2', parentId: 'p', bench: 'Setup', calendarSlot: '2026-08-13-9-0' },
    ];
    const rows = weekRows(jobs, WEEK, {});
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe('1714 Fender Strat');
    expect([...rows[0].bookedDays].sort()).toEqual(['2026-08-11', '2026-08-13']);
  });

  it('leaves out jobs with nothing in this week', () => {
    const jobs = [{ id: 'a', job: '1', calendarSlot: '2026-09-01-9-0' }];
    expect(weekRows(jobs, WEEK, {})).toHaveLength(0);
  });

  it('keeps a job that has a mark this week even with no booking left', () => {
    const jobs = [{ id: 'a', job: '1', mfr: 'Gibson', calendarSlot: null }];
    const rows = weekRows(jobs, WEEK, { a: { '2026-08-12': 'slash' } });
    expect(rows).toHaveLength(1);
  });

  it('does not treat an auto-split child as a top-level job', () => {
    // Auto-split children inherit hasSubtasks from the parent they were spread
    // from, so only parentId/isDerived can be trusted here.
    const jobs = [
      { id: 'p', job: '9', hasSubtasks: true, subtasks: ['c'], calendarSlot: '2026-08-10-9-0' },
      { id: 'c', parentId: 'p', isDerived: true, hasSubtasks: true, calendarSlot: '2026-08-10-9-0' },
    ];
    expect(weekRows(jobs, WEEK, {}).map(r => r.id)).toEqual(['p']);
  });
});

describe('cellMark', () => {
  const row = { id: 'a', bookedDays: new Set(['2026-08-11']) };
  it('shows the booked dot without storing one', () => {
    expect(cellMark(row, '2026-08-11', {})).toBe('dot');
    expect(cellMark(row, '2026-08-12', {})).toBe('');
  });
  it('lets a stored mark win over the booking', () => {
    expect(cellMark(row, '2026-08-11', { '2026-08-11': 'slash' })).toBe('slash');
  });
});

describe('trailing', () => {
  it('carries an unfinished job into next week', () => {
    expect(trailing(WEEK, { '2026-08-11': 'slash' })).toEqual({ mark: 'arrow', doneIndex: -1 });
  });
  it('fills the trailing column from a cross, and reports where to rule off', () => {
    expect(trailing(WEEK, { '2026-08-13': 'cross' })).toEqual({ mark: 'cross', doneIndex: 3 });
  });
});

describe('nextMark', () => {
  it('cycles round to blank so a mis-tap is always undoable', () => {
    expect(nextMark('')).toBe('dot');
    expect(nextMark('dot')).toBe('slash');
    expect(nextMark('slash')).toBe('arrow');
    expect(nextMark('arrow')).toBe('cross');
    expect(nextMark('cross')).toBe('');
  });
});

describe('groupByBench', () => {
  it('gives an unlisted bench its own group instead of filing it as no bench', () => {
    const rows = [{ bench: 'Finishing' }, { bench: 'Setup' }, { bench: '' }];
    expect(groupByBench(rows).map(g => g.bench)).toEqual(['Setup', 'Finishing', 'No bench set']);
  });
});

describe('buildWeekExport', () => {
  const jobs = [{ id: 'a', job: '1714', mfr: 'Fender', model: 'Strat', bench: 'Setup', calendarSlot: '2026-08-11-9-0' }];
  it('writes one readable line per job under its bench', () => {
    const marks = { a: { '2026-08-11': 'slash', '2026-08-13': 'cross' } };
    const rows = weekRows(jobs, WEEK, marks);
    const text = buildWeekExport({ rows, weekKeys: WEEK, weekDays: DAYS, marks });
    expect(text).toContain('SETUP');
    const line = text.split('\n').find(l => l.includes('1714 Fender Strat'));
    expect(line).toContain('/');
    expect(line).toContain('×');
    expect(line.trim().endsWith('×')).toBe(true);
  });
  it('says so plainly when the week is empty', () => {
    const text = buildWeekExport({ rows: [], weekKeys: WEEK, weekDays: DAYS, marks: {} });
    expect(text).toContain('no jobs on the bench this week');
  });

  it('exports a hand-added job as a completely blank line', () => {
    const jobs2 = [{ id: 'a', job: '1714', mfr: 'Fender', bench: 'Setup' }];
    const marks = { a: { [weekRowKey(WEEK)]: 'row' } };
    const rows = weekRows(jobs2, WEEK, marks);
    const line = buildWeekExport({ rows, weekKeys: WEEK, weekDays: DAYS, marks })
      .split('\n').find(l => l.includes('1714 Fender'));
    // Only the name and the trailing carry-on symbol. No day symbol anywhere.
    expect(line.replace('1714 Fender', '').trim()).toBe('>');
  });
});

describe('weekRowKey', () => {
  it('is scoped to the week and is never one of the seven day keys', () => {
    const key = weekRowKey(WEEK);
    expect(key).toBe('week:2026-08-10');
    expect(WEEK).not.toContain(key);
  });
  it('has no key for a week with no days', () => {
    expect(weekRowKey([])).toBeNull();
  });
});

describe('adding a job to the week', () => {
  const jobs = [
    { id: 'a', job: '1714', mfr: 'Fender', bench: 'Setup' },
    { id: 'b', job: '1720', mfr: 'Gibson', bench: 'Setup' },
    { id: 'c', job: '1731', mfr: 'Ibanez', bench: 'Fretwork', done: true },
    { id: 'd', job: '1740', mfr: 'Yamaha' },
  ];

  it('puts a job on the week with no booking and no mark', () => {
    const marks = { a: { [weekRowKey(WEEK)]: 'row' } };
    const rows = weekRows(jobs, WEEK, marks);
    expect(rows.map(r => r.id)).toEqual(['a']);
    expect(rows[0].addedByHand).toBe(true);
  });

  it('leaves every day of an added row blank', () => {
    const marks = { a: { [weekRowKey(WEEK)]: 'row' } };
    const row = weekRows(jobs, WEEK, marks)[0];
    for (const k of WEEK) expect(cellMark(row, k, marks.a)).toBe('');
  });

  it('does not carry an added row into another week', () => {
    const marks = { a: { [weekRowKey(WEEK)]: 'row' } };
    const nextWeek = ['2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20', '2026-08-21', '2026-08-22', '2026-08-23'];
    expect(weekRows(jobs, nextWeek, marks)).toHaveLength(0);
  });

  it('offers the bench its own unfinished jobs, and not the done ones', () => {
    expect(addableJobs(jobs, 'Setup', []).map(o => o.id)).toEqual(['a', 'b']);
    expect(addableJobs(jobs, 'Fretwork', []).map(o => o.id)).toEqual([]);
  });

  it('lists the picker oldest first, not alphabetically', () => {
    // Sorted by name, 875 and 97 landed after 1718 — as text, "8" beats "1".
    const many = [
      { id: '1718', job: '1718', mfr: 'Marshall', bench: 'Setup' },
      { id: '97', job: '97', mfr: 'DB Tech', bench: 'Setup' },
      { id: '875', job: '875', mfr: 'RCF', bench: 'Setup' },
    ];
    expect(addableJobs(many, 'Setup', []).map(o => o.id)).toEqual(['97', '875', '1718']);
  });

  it('stops offering a job once it is a row', () => {
    const rows = weekRows(jobs, WEEK, { a: { [weekRowKey(WEEK)]: 'row' } });
    expect(addableJobs(jobs, 'Setup', rows).map(o => o.id)).toEqual(['b']);
  });

  it('will not offer a split job under its other bench', () => {
    // One row per job: this guitar is filed under Luthier, so Fretwork must not
    // still offer it even though a split of it sits on that bench.
    const split = [
      { id: 'p', job: '1714', mfr: 'Fender', isSplit: true, bench: 'Luthier' },
      { id: 'c1', parentId: 'p', bench: 'Fretwork' },
    ];
    const rows = weekRows(split, WEEK, { p: { [weekRowKey(WEEK)]: 'row' } });
    expect(rows).toHaveLength(1);
    expect(rows[0].bench).toBe('Luthier');
    expect(addableJobs(split, 'Fretwork', rows)).toEqual([]);
    expect(addableJobs(split, 'Luthier', rows)).toEqual([]);
  });

  it('never offers a job that has no bench', () => {
    const everywhere = ['Electronics', 'Fretwork', 'Setup', 'Luthier', 'Wiring', 'Admin'];
    for (const b of everywhere) {
      expect(addableJobs(jobs, b, []).map(o => o.id)).not.toContain('d');
    }
    expect(addableJobs(jobs, '', [])).toEqual([]);
  });
});

describe('typing a task that is not a job', () => {
  const jobs = [{ id: 'a', job: '1714', mfr: 'Fender', bench: 'Setup', calendarSlot: '2026-08-11-9-0' }];
  const KEY = weekRowKey(WEEK);
  const marksWith = (value, id = 'task:2026-08-10:zz') => ({ [id]: { [KEY]: value } });

  it('carries the name in the one mark value, always on Admin', () => {
    expect(decodeTypedRow(encodeTypedRow('buy strings')))
      .toEqual({ bench: 'Admin', name: 'buy strings' });
  });

  it('keeps a colon typed inside the name', () => {
    expect(decodeTypedRow(encodeTypedRow('research: 1714 trem')))
      .toEqual({ bench: 'Admin', name: 'research: 1714 trem' });
  });

  it('cannot land on any bench but Admin', () => {
    // encodeTypedRow takes no bench at all, so nothing can ask for another one.
    expect(encodeTypedRow.length).toBe(1);
    // And a value hand-written with a different bench still reads as Admin,
    // rather than drawing a typed row on a repair bench.
    expect(decodeTypedRow('task:Setup:sneak onto setup'))
      .toEqual({ bench: 'Admin', name: 'sneak onto setup' });
    const rows = weekRows(jobs, WEEK, marksWith('task:Fretwork:sneak in'));
    expect(rows.filter(r => r.typed).map(r => r.bench)).toEqual(['Admin']);
  });

  it('refuses an empty name and anything that is not a typed value', () => {
    expect(encodeTypedRow('   ')).toBeNull();
    expect(decodeTypedRow('row')).toBeNull();     // Build 1b's job-row marker
    expect(decodeTypedRow('slash')).toBeNull();
    expect(decodeTypedRow(null)).toBeNull();
  });

  it('makes an id no Multitrack job number could ever match', () => {
    const id = newTypedRowId(WEEK, () => 0.123456789);
    expect(isTypedRowId(id)).toBe(true);
    expect(id).toContain('2026-08-10');
    // Job numbers are digits with optional split suffix — never a colon.
    for (const jobId of ['1714', '1714-ST', 'a']) expect(isTypedRowId(jobId)).toBe(false);
  });

  it('draws the typed row on Admin, alongside real job rows', () => {
    const marks = marksWith(encodeTypedRow('buy strings'));
    const rows = weekRows(jobs, WEEK, marks);
    const typed = rows.find(r => r.typed);
    expect(typed.name).toBe('buy strings');
    expect(typed.bench).toBe('Admin');
    expect(typed.addedByHand).toBe(true);
    expect(rows.find(r => r.id === 'a')).toBeTruthy();
  });

  it('starts every day blank', () => {
    const marks = marksWith(encodeTypedRow('buy strings'));
    const row = weekRows(jobs, WEEK, marks).find(r => r.typed);
    for (const k of WEEK) expect(cellMark(row, k, {})).toBe('');
  });

  it('does not carry into another week', () => {
    const marks = marksWith(encodeTypedRow('buy strings'));
    const nextWeek = ['2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20', '2026-08-21', '2026-08-22', '2026-08-23'];
    expect(weekRows(jobs, nextWeek, marks).filter(r => r.typed)).toHaveLength(0);
  });

  it('exports as a blank line under the typed name, marked with a +', () => {
    const marks = marksWith(encodeTypedRow('buy strings'));
    const rows = weekRows(jobs, WEEK, marks);
    expect(rowLabel(rows.find(r => r.typed))).toBe('+ buy strings');
    const line = buildWeekExport({ rows, weekKeys: WEEK, weekDays: DAYS, marks })
      .split('\n').find(l => l.includes('buy strings'));
    expect(line.replace('+ buy strings', '').trim()).toBe('>');
  });

  it('exports a marked typed row the same way a job row does', () => {
    const id = 'task:2026-08-10:zz';
    const marks = { [id]: { [KEY]: encodeTypedRow('do the books'), '2026-08-12': 'cross' } };
    const rows = weekRows(jobs, WEEK, marks);
    const line = buildWeekExport({ rows, weekKeys: WEEK, weekDays: DAYS, marks })
      .split('\n').find(l => l.includes('do the books'));
    expect(line).toContain('×');
  });
});

describe('benchSections', () => {
  it('shows every shop bench even on an empty week, so a blank page can be filled', () => {
    expect(benchSections([]).map(g => g.bench))
      .toEqual(['Electronics', 'Fretwork', 'Setup', 'Luthier', 'Admin']);
  });
  it('adds an unlisted bench and refuses adding under "No bench set"', () => {
    const groups = benchSections([{ bench: 'Finishing' }, { bench: '' }]);
    expect(groups.map(g => g.bench)).toContain('Finishing');
    expect(groups.find(g => g.bench === 'No bench set').canAdd).toBe(false);
  });
});
