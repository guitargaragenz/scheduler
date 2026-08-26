// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import DailyLogPanel, { dayJobOptions, groupsOf, matchesSearch, newDayTaskId, isDayTaskId, bookedOnDay, piecesForJob, markIdFor } from './DailyLogPanel.jsx';
import { weekRowKey, weekCloseKey, weekRows } from './BenchWeekPage.jsx';

// The Daily Log reads Google Calendar for the day's appointments. Nothing here
// is about appointments, and a real read would go to the network.
vi.mock('../utils/googleCalendar.js', () => ({
  isSignedIn: () => false,
  listEvents: async () => [],
}));

const WEEK = ['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14', '2026-08-15', '2026-08-16'];

describe('dayJobOptions', () => {
  // The rule the whole page hangs off: not on the week, can't go on a day.
  //
  // A piece that is BOOKED, though, is not offered — changed 2026-08-22 on
  // Trevor's call so the picker matches the job card, which keeps only
  // unscheduled sub-tasks (`Sidebar.jsx:20`). A booked piece already turns up
  // on its own day through `bookedOnDay()`, so the picker's job is the pieces
  // that have no day yet.
  it('does not offer a piece already booked on a day', () => {
    const jobs = [{ id: 'a', job: '1714', mfr: 'Fender', model: 'Strat', bench: 'Setup', calendarSlot: '2026-08-11-9-0' }];
    expect(dayJobOptions(jobs, WEEK, {})).toEqual([]);
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

  // The bug this filter exists for. `pieceDone` is only ever written for a
  // SPLIT, so crossing an UNSPLIT job off the Daily Log wrote nothing the
  // picker read, and the job came back in the list forever. Trevor,
  // 2026-08-26: "it's happening to all Jobs."
  describe('a row crossed off on the Daily Log', () => {
    const unsplit = [{ id: 'a', job: '1714', mfr: 'Fender', bench: 'Setup' }];
    const onWeek = { a: { [weekRowKey(WEEK)]: 'row' } };
    const crossedOn = (day, id = 'a') => ({ [day]: { [markIdFor(id)]: { label: 'cross' } } });

    it('is not offered again, even when it is an unsplit job', () => {
      expect(dayJobOptions(unsplit, WEEK, onWeek, crossedOn('2026-08-10'))).toEqual([]);
    });

    it('comes back the moment the cross is taken off', () => {
      expect(dayJobOptions(unsplit, WEEK, onWeek, {}).map(o => o.id)).toEqual(['a']);
    });

    // Marks are walked in date order, last one wins: crossed Monday, then
    // reopened with a `/` on Wednesday, is live work again.
    it('is offered again if a later day gives it a different mark', () => {
      const items = {
        ...crossedOn('2026-08-10'),
        '2026-08-12': { [markIdFor('a')]: { label: 'slash' } },
      };
      expect(dayJobOptions(unsplit, WEEK, onWeek, items).map(o => o.id)).toEqual(['a']);
    });

    it('still offers a row marked part-done or deferred', () => {
      for (const mark of ['slash', 'arrow']) {
        const items = { '2026-08-10': { [markIdFor('a')]: { label: mark } } };
        expect(dayJobOptions(unsplit, WEEK, onWeek, items).map(o => o.id)).toEqual(['a']);
      }
    });

    it('hides a crossed split without hiding its siblings', () => {
      const jobs = [
        { id: 'p', job: '1632', mfr: 'Hofner', model: 'Verythin', isSplit: true, calendarSlot: '2026-08-11-9-0' },
        { id: 'c1', job: '1632', parentId: 'p', bench: 'Setup' },
        { id: 'c2', job: '1632', parentId: 'p', bench: 'Fretwork' },
      ];
      const ids = dayJobOptions(jobs, WEEK, {}, crossedOn('2026-08-10', 'c2')).map(o => o.id);
      expect(ids).toEqual(['c1']);
    });

    // The board's tick is a separate signal and still counts on its own — a
    // piece closed off on the calendar was never crossed here.
    it('still hides a piece ticked off on the board but never crossed here', () => {
      const jobs = [{ id: 'a', job: '1714', mfr: 'Fender', bench: 'Setup', pieceDone: true, calendarSlot: '2026-08-11-9-0' }];
      expect(dayJobOptions(jobs, WEEK, {}, {})).toEqual([]);
    });
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

// A day is a record of what happened, so nothing that was ever on it may leave.
// Before 2026-08-26 the Daily Log took its rows from weekRows(), which drops
// finished jobs, and a job ticked off wiped its own lines off the day.
describe('bookedOnDay keeps a finished job on the day', () => {
  const DAY = '2026-08-11';

  it('keeps a booked job on its day after it is finished', () => {
    const jobs = [{ id: 'a', job: '1714', mfr: 'Fender', model: 'Strat', bench: 'Setup', calendarSlot: `${DAY}-9-0`, done: true }];
    expect(bookedOnDay(jobs, WEEK, DAY, {}).map(o => o.id)).toEqual(['a']);
  });

  // The one that used to go for good: worked this week, closed in a later one,
  // so this week carries no close mark to save it.
  it('keeps a past day when the job was closed in a later week', () => {
    const jobs = [{ id: 'a', job: '1714', mfr: 'Fender', bench: 'Setup', calendarSlot: `${DAY}-9-0`, done: true }];
    const laterWeek = ['2026-08-17', '2026-08-18', '2026-08-19', '2026-08-20', '2026-08-21', '2026-08-22', '2026-08-23'];
    const marks = { a: { [weekCloseKey(laterWeek)]: 'x' } };
    expect(bookedOnDay(jobs, WEEK, DAY, marks).map(o => o.id)).toEqual(['a']);
  });

  it('keeps a finished job put on the day by a week mark', () => {
    const jobs = [{ id: 'a', job: '1714', mfr: 'Fender', bench: 'Setup', done: true }];
    const marks = { a: { [DAY]: 'dot' } };
    expect(bookedOnDay(jobs, WEEK, DAY, marks).map(o => o.id)).toEqual(['a']);
  });

  it('keeps a finished job that has splits, one line per booked piece', () => {
    const jobs = [
      { id: 'p', job: '1714', mfr: 'Fender', bench: 'Setup', done: true, isSplit: true },
      { id: 'c1', parentId: 'p', job: '1714', bench: 'Fretwork', calendarSlot: `${DAY}-9-0`, pieceDone: true },
    ];
    expect(bookedOnDay(jobs, WEEK, DAY, {}).map(o => o.id)).toEqual(['c1']);
  });

  // The Weekly Log must not change: a finished job still drops off the week.
  it('does not put a finished job back on the Weekly Log', () => {
    const jobs = [{ id: 'a', job: '1714', mfr: 'Fender', bench: 'Setup', calendarSlot: `${DAY}-9-0`, done: true }];
    expect(weekRows(jobs, WEEK, {})).toHaveLength(0);
  });

  // And the picker still does not offer finished work.
  it('does not offer a finished job in the picker', () => {
    const jobs = [{ id: 'a', job: '1714', mfr: 'Fender', bench: 'Setup', done: true }];
    const marks = { a: { [weekRowKey(WEEK)]: 'row' } };
    expect(dayJobOptions(jobs, WEEK, marks)).toEqual([]);
  });
});

// The Task picker on a job's own line: a shorter way to reach that job's
// remaining pieces than typing its number into the search box.
describe('piecesForJob', () => {
  // The reason this takes an id and not the heading text. Two jobs on one week
  // reading the same is ordinary — same make, same model, two customers — and
  // matching on the words would hang one job's pieces off the other's line.
  it('binds pieces to the job by id, not by how the job reads', () => {
    const jobs = [
      { id: 'p1', job: '1714', mfr: 'Fender', model: 'Strat', isSplit: true },
      { id: 'a1', job: '1714', parentId: 'p1', bench: 'Setup' },
      { id: 'p2', job: '1715', mfr: 'Fender', model: 'Strat', isSplit: true },
      { id: 'b1', job: '1715', parentId: 'p2', bench: 'Setup' },
    ];
    const pickable = [
      { id: 'a1', group: '1714 Fender Strat', short: 'Setup' },
      { id: 'b1', group: '1715 Fender Strat', short: 'Setup' },
    ];
    expect(piecesForJob(pickable, 'p1', jobs).map(o => o.id)).toEqual(['a1']);
    expect(piecesForJob(pickable, 'p2', jobs).map(o => o.id)).toEqual(['b1']);
  });

  it('answers for an unsplit job with its own line', () => {
    const jobs = [{ id: 'a', job: '1714', mfr: 'Fender', bench: 'Setup' }];
    const pickable = [{ id: 'a', group: '1714 Fender', short: 'Setup' }];
    expect(piecesForJob(pickable, 'a', jobs).map(o => o.id)).toEqual(['a']);
  });

  it('offers nothing when there is no job to hang pieces off', () => {
    expect(piecesForJob([{ id: 'a' }], null, [])).toEqual([]);
  });
});

// These tests RENDER the panel and tap the control, rather than calling the
// helper underneath: this project has shipped a build where every helper passed
// and nothing on screen did anything, because nothing was wired to the control.
describe('the Task picker on a job line', () => {
  const DAY = '2026-08-10';
  const WEEK_DAYS = Array.from({ length: 7 }, (_, i) => new Date(2026, 7, 10 + i));

  // 1714: one piece already booked on the day (so the job has a line to hang
  // the control off), two still to place, one booked elsewhere and one ticked
  // off — the two that must never be offered.
  // 1715: a second job, to prove one list closes when the other opens.
  function makeJobs() {
    return [
      { id: 'p', job: '1714', mfr: 'Fender', model: 'Strat', isSplit: true },
      { id: 'c1', job: '1714', parentId: 'p', bench: 'Setup', calendarSlot: `${DAY}-9-0` },
      { id: 'c2', job: '1714', parentId: 'p', bench: 'Fretwork' },
      { id: 'c3', job: '1714', parentId: 'p', bench: 'Wiring' },
      { id: 'c4', job: '1714', parentId: 'p', bench: 'Electronics', calendarSlot: '2026-08-12-9-0' },
      { id: 'c5', job: '1714', parentId: 'p', bench: 'Admin', pieceDone: true },
      { id: 'q', job: '1715', mfr: 'Gibson', model: 'SG', isSplit: true },
      { id: 'd1', job: '1715', parentId: 'q', bench: 'Setup', calendarSlot: `${DAY}-13-0` },
      { id: 'd2', job: '1715', parentId: 'q', bench: 'Luthier' },
    ];
  }

  function setup(overrides = {}) {
    const addItem = vi.fn(async () => ({ ok: true }));
    const removeItem = vi.fn(async () => ({ ok: true }));
    const setWeekMark = vi.fn(async () => ({ ok: true }));
    render(<DailyLogPanel
      jobs={makeJobs()}
      weekDays={WEEK_DAYS}
      marks={{}}
      dayItems={{}}
      ready
      saveError={null}
      addItem={addItem}
      removeItem={removeItem}
      weekReady
      setWeekMark={setWeekMark}
      onMarkPieceDone={vi.fn()}
      isMobile={false}
      showToast={vi.fn()}
      {...overrides}
    />);
    return { addItem, setWeekMark };
  }

  const taskButton = (label) => screen.getByRole('button', { name: `Tasks for ${label}` });
  const ticks = () => screen.getAllByRole('checkbox');

  afterEach(cleanup);
  beforeEach(() => vi.clearAllMocks());

  it('shows the job its own remaining pieces, and never a booked or finished one', () => {
    setup();
    fireEvent.click(taskButton('1714 Fender Strat'));
    const offered = ticks().map(el => el.getAttribute('aria-label'));
    // Fretwork and Wiring only: Setup is on this day already, Electronics is
    // booked to the Wednesday, and Admin is ticked off.
    expect(offered.some(l => l.includes('Fretwork'))).toBe(true);
    expect(offered.some(l => l.includes('Wiring'))).toBe(true);
    expect(offered.some(l => l.includes('Setup'))).toBe(false);
    expect(offered.some(l => l.includes('Electronics'))).toBe(false);
    expect(offered.some(l => l.includes('Admin'))).toBe(false);
    // And nothing from the other job on the day.
    expect(offered.some(l => l.includes('Luthier'))).toBe(false);
  });

  it('places every ticked piece on one confirm', async () => {
    const { addItem, setWeekMark } = setup();
    fireEvent.click(taskButton('1714 Fender Strat'));
    ticks().forEach(el => fireEvent.click(el));
    fireEvent.click(screen.getByRole('button', { name: /Add 2 to this day/ }));

    await waitFor(() => expect(addItem).toHaveBeenCalledTimes(2));
    const placed = addItem.mock.calls.map(c => c[1]);
    expect(new Set(placed)).toEqual(new Set(['c2', 'c3']));
    expect(addItem.mock.calls.every(c => c[0] === '2026-08-10' && c[2] === 'job')).toBe(true);
    // Placing pieces is not a week write: handlePickJob stops a split before
    // the Weekly Log, and this control only ever places pieces.
    expect(setWeekMark).not.toHaveBeenCalled();
  });

  it('closes one job’s list when another job’s is opened', () => {
    setup();
    fireEvent.click(taskButton('1714 Fender Strat'));
    expect(ticks().map(el => el.getAttribute('aria-label')).some(l => l.includes('Fretwork'))).toBe(true);

    fireEvent.click(taskButton('1715 Gibson SG'));
    const offered = ticks().map(el => el.getAttribute('aria-label'));
    expect(offered.some(l => l.includes('Luthier'))).toBe(true);
    expect(offered.some(l => l.includes('Fretwork'))).toBe(false);
  });

  it('closes again on a second tap, placing nothing', () => {
    const { addItem } = setup();
    fireEvent.click(taskButton('1714 Fender Strat'));
    fireEvent.click(ticks()[0]);
    fireEvent.click(taskButton('1714 Fender Strat'));
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(addItem).not.toHaveBeenCalled();
  });
});
