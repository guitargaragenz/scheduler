import { describe, it, expect } from 'vitest';
import { dayJobOptions, newDayTaskId, isDayTaskId } from './DailyLogPanel.jsx';
import { weekRowKey } from './BenchWeekPage.jsx';

const WEEK = ['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14', '2026-08-15', '2026-08-16'];

describe('dayJobOptions', () => {
  // The rule the whole page hangs off: not on the week, can't go on a day.
  it('offers a job that is booked on the week', () => {
    const jobs = [{ id: 'a', job: '1714', mfr: 'Fender', model: 'Strat', bench: 'Setup', calendarSlot: '2026-08-11-9-0' }];
    expect(dayJobOptions(jobs, WEEK, {}).map(o => o.id)).toEqual(['a']);
  });

  it('does not offer a job that is not on the week at all', () => {
    const jobs = [{ id: 'b', job: '1800', mfr: 'Gibson', bench: 'Setup' }];
    expect(dayJobOptions(jobs, WEEK, {})).toEqual([]);
  });

  it('offers a job added to the week by hand', () => {
    const jobs = [{ id: 'a', job: '1714', mfr: 'Fender', bench: 'Setup' }];
    const marks = { a: { [weekRowKey(WEEK)]: 'row' } };
    expect(dayJobOptions(jobs, WEEK, marks).map(o => o.id)).toEqual(['a']);
  });

  // A typed admin line has no job behind it, so there is nothing to put on a
  // day from it — day tasks are typed on the day itself.
  it('skips typed week rows', () => {
    const marks = { 'task:2026-08-10:zz': { [weekRowKey(WEEK)]: 'typed:do the books' } };
    expect(dayJobOptions([], WEEK, marks)).toEqual([]);
  });

  it('never offers the same thing twice', () => {
    const jobs = [{ id: 'a', job: '1714', mfr: 'Fender', bench: 'Setup', calendarSlot: '2026-08-11-9-0' }];
    const ids = dayJobOptions(jobs, WEEK, {}).map(o => o.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('survives being called before the jobs have loaded', () => {
    expect(dayJobOptions(undefined, WEEK, undefined)).toEqual([]);
  });
});

describe('newDayTaskId', () => {
  it('keeps typed tasks out of job space', () => {
    const id = newDayTaskId('2026-08-13');
    expect(isDayTaskId(id)).toBe(true);
    // A Multitrack job id is digits with an optional split suffix, so a colon
    // is what guarantees a typed task can never collide with one.
    expect(id).toContain(':');
  });

  it('gives two tasks made in the same moment different ids', () => {
    // Same day, same millisecond — only the random part separates them, which
    // is exactly the case that would overwrite one task with the other.
    let n = 0;
    const rand = () => [0.1111111, 0.2222222][n++];
    const a = newDayTaskId('2026-08-13', rand);
    const b = newDayTaskId('2026-08-13', rand);
    expect(a).not.toBe(b);
  });

  it('refuses to make an id with no day', () => {
    expect(newDayTaskId('')).toBe(null);
    expect(newDayTaskId(undefined)).toBe(null);
  });
});
