import { describe, it, expect } from 'vitest';
import { dayJobOptions, groupsOf, matchesSearch, newDayTaskId, isDayTaskId } from './DailyLogPanel.jsx';
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

  // Trevor, 2026-08-22: 1632 offered 7 pieces where the job card showed the 4
  // still to do. The card has always hidden finished pieces; the picker did not.
  it('does not offer a piece that is already ticked off', () => {
    const jobs = [
      { id: 'p', job: '1632', mfr: 'Hofner', model: 'Verythin', isSplit: true, calendarSlot: '2026-08-11-9-0' },
      { id: 'c1', job: '1632', parentId: 'p', bench: 'Setup' },
      { id: 'c2', job: '1632', parentId: 'p', bench: 'Fretwork', pieceDone: true },
    ];
    expect(dayJobOptions(jobs, WEEK, {}).map(o => o.id)).toEqual(['c1']);
  });

  // An unsplit job IS its own single piece, so the same rule has to reach it.
  it('does not offer an unsplit job that is ticked off', () => {
    const jobs = [{ id: 'a', job: '1714', mfr: 'Fender', bench: 'Setup', pieceDone: true, calendarSlot: '2026-08-11-9-0' }];
    expect(dayJobOptions(jobs, WEEK, {})).toEqual([]);
  });

  // The group heading is the job; the option under it is just the bench, since
  // repeating the number on every line is what the grouping removes. `label`
  // stays whole because it is what gets STORED on the placed row, which has no
  // heading above it.
  it('tags each option with its job for the heading, and keeps the stored label whole', () => {
    const jobs = [
      { id: 'p', job: '1632', mfr: 'Hofner', model: 'Verythin', isSplit: true, calendarSlot: '2026-08-11-9-0' },
      { id: 'c1', job: '1632', parentId: 'p', bench: 'Setup' },
    ];
    const [opt] = dayJobOptions(jobs, WEEK, {});
    expect(opt.group).toBe('1632 Hofner Verythin');
    expect(opt.short).toBe('Setup');
    expect(opt.label).toContain('1632');
  });
});

describe('matchesSearch', () => {
  const opt = { group: '1632 Hofner Verythin', short: 'Fretwork', label: '1632 Hofner Verythin — Fretwork', note: 'level and crown' };

  // An empty box is the whole week, grouped. The search narrows the list; it is
  // not a gate you have to type past before anything appears.
  it('matches everything when nothing is typed', () => {
    expect(matchesSearch(opt, '')).toBe(true);
    expect(matchesSearch(opt, '   ')).toBe(true);
  });

  it('finds by job number, by make, by bench, and by the note', () => {
    expect(matchesSearch(opt, '1632')).toBe(true);
    expect(matchesSearch(opt, 'hofner')).toBe(true);
    expect(matchesSearch(opt, 'fret')).toBe(true);
    expect(matchesSearch(opt, 'crown')).toBe(true);
  });

  it('ignores case', () => {
    expect(matchesSearch(opt, 'HOFNER')).toBe(true);
  });

  // Typed at the bench, in whatever order it comes out.
  it('takes several words in any order', () => {
    expect(matchesSearch(opt, '1632 fret')).toBe(true);
    expect(matchesSearch(opt, 'fret 1632')).toBe(true);
  });

  it('says no when one of the words is not there', () => {
    expect(matchesSearch(opt, '1632 banjo')).toBe(false);
    expect(matchesSearch(opt, 'gibson')).toBe(false);
  });
});

describe('groupsOf', () => {
  it('puts every piece of one job under a single heading', () => {
    const groups = groupsOf([
      { id: 'c1', group: '1632 Hofner' },
      { id: 'c2', group: '1632 Hofner' },
      { id: 'd1', group: '1714 Fender' },
    ]);
    expect(groups.map(g => g.name)).toEqual(['1632 Hofner', '1714 Fender']);
    expect(groups[0].items.map(o => o.id)).toEqual(['c1', 'c2']);
  });

  // The Weekly Log lists jobs oldest first. The picker has to agree with the
  // page behind it, so grouping must not re-sort anything.
  it('keeps the order it was given', () => {
    const groups = groupsOf([
      { id: 'a', group: '875 Maton' },
      { id: 'b', group: '1714 Fender' },
    ]);
    expect(groups.map(g => g.name)).toEqual(['875 Maton', '1714 Fender']);
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
