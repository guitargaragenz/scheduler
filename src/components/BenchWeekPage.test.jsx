import { describe, it, expect } from 'vitest';
import {
  weekRows, cellMark, trailing, nextMark, slotDateKey, groupByBench, buildWeekExport,
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
});
