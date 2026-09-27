// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import DailyLogPanel, { departedOwnerId, departedOnDay, benchFromPieceId } from './DailyLogPanel.jsx';
import BenchWeekPage, { departedWeekRows, withDepartedRows, weekRows, LONG_PRESS_MS } from './BenchWeekPage.jsx';
import { normalizeJobsFromDb, departedJobsFromDb } from '../hooks/useSupabase.js';
import { localDateKey } from '../utils/calendar.js';

// Logs keep finished jobs — Part A.
//
// Trevor, 2026-09-27: "There is no data in WL or DL showing any completed jobs
// dating back from 2 weeks and back." A job that leaves the Multitrack printout
// keeps its row but is dropped from the live list, and the logs were built from
// that list alone. The logs now also get a separate, display-only list of
// departed jobs, drawn and LOCKED. Job 1735 is the real case: finished 10 Sept,
// departed 14 Sept, its 7 Sept pieces cut under ids that no longer exist.

vi.mock('../utils/googleCalendar.js', () => ({
  isSignedIn: () => false,
  listEvents: async () => [],
}));

const MON = '2026-09-07';
const TUE = '2026-09-08';
const WEEK_DAYS = Array.from({ length: 7 }, (_, i) => new Date(2026, 8, 7 + i));
const NAME = '1735 Yamaha RGX 321FP';

// Database rows, shaped as Supabase returns them.
const dbRow = (over = {}) => ({
  customer: 'C', status: 'Booked In', hours: 1, scheduled: false, desc: 'setup',
  tag: '', action: 'CI', vb: 'N', bl: 'N', pj: 'N', has_subtasks: false, subtasks: [],
  is_split: false, no_auto_split: false, is_subtask: false, is_derived: false,
  parent_id: null, departed_at: null, done: false,
  ...over,
});

function dbRows() {
  return [
    // 1735 as it really is: done, departed, and its two leftover piece rows,
    // which carry no departed_at of their own.
    dbRow({
      id: '1735', job: '1735', mfr: 'Yamaha', model: 'RGX 321FP', bench: 'Setup',
      done: true, departed_at: '2026-09-14T00:00:00Z', no_auto_split: true,
    }),
    dbRow({ id: '1735-ST', job: '1735', parent_id: '1735', is_derived: true, bench: null, piece_done: true }),
    dbRow({ id: '1735-WR', job: '1735', parent_id: '1735', is_derived: true, bench: null, piece_done: true }),
    // A live job on the same week, added to it by hand.
    dbRow({ id: '1800', job: '1800', mfr: 'Fender', model: 'Strat', bench: 'Setup' }),
  ];
}

const liveJobs = () => normalizeJobsFromDb(dbRows());
const goneJobs = () => departedJobsFromDb(dbRows());

const weekMarks = () => ({
  1800: { 'week:2026-09-07': 'row' },
  1735: {
    'week:2026-09-07': 'row',
    [MON]: 'slash',
    [TUE]: 'cross',
    'close:2026-09-07': 'closed',
  },
});

const dayItems = () => ({
  // 3 Sept: taken off that day before it was finished.
  '2026-09-03': { 1735: { kind: 'hidden', label: NAME } },
  // 7 Sept: three manual pieces whose ids no longer exist as rows.
  [MON]: {
    '1735_Wiring_0': { kind: 'job', label: `${NAME} — Wiring` },
    '1735_Wiring_1': { kind: 'job', label: `${NAME} — Wiring` },
    '1735_Setup_0': { kind: 'job', label: `${NAME} — Setup` },
    'mark:1735_Wiring_0': { kind: 'mark', label: 'cross' },
    'mark:1735_Wiring_1': { kind: 'mark', label: 'cross' },
    'mark:1735_Setup_0': { kind: 'mark', label: 'arrow' },
    'mark:1735': { kind: 'mark', label: 'slash' },
    'note:1735_Setup_0:abc': { kind: 'note', label: 'neck relief' },
  },
  // 8 Sept: the auto-split ids.
  [TUE]: {
    '1735-ST': { kind: 'job', label: `${NAME} — Setup` },
    '1735-WR': { kind: 'job', label: `${NAME} — Wiring` },
    'mark:1735-ST': { kind: 'mark', label: 'cross' },
    'mark:1735-WR': { kind: 'mark', label: 'cross' },
    'mark:1735': { kind: 'mark', label: 'cross' },
  },
});

const settle = () => new Promise(r => setTimeout(r, 30));

afterEach(() => { cleanup(); vi.useRealTimers(); });
beforeEach(() => vi.clearAllMocks());

describe('departedJobsFromDb — the separate display-only list', () => {
  it('holds the departed job and its pieces, all tagged departed', () => {
    const gone = goneJobs();
    expect(gone.map(j => j.id)).toEqual(['1735']);
    expect(gone.every(j => j.departed === true)).toBe(true);
  });

  it('carries a manual split’s stored pieces, which have no departed_at of their own', () => {
    const rows = [
      dbRow({ id: '900', job: '900', bench: 'Setup', departed_at: '2026-09-14T00:00:00Z' }),
      dbRow({ id: '900_Setup_0', job: '900', parent_id: '900', bench: 'Setup', is_subtask: true }),
      dbRow({ id: '901', job: '901', bench: 'Setup' }),
    ];
    const gone = departedJobsFromDb(rows);
    expect(gone.map(j => j.id).sort()).toEqual(['900', '900_Setup_0']);
    expect(gone.find(j => j.id === '900_Setup_0').parentId).toBe('900');
  });

  it('is empty when nothing has departed', () => {
    expect(departedJobsFromDb([dbRow({ id: '1', job: '1' })])).toEqual([]);
  });

  it('leaves the live list exactly as it was — no departed job gets in', () => {
    const live = liveJobs();
    expect(live.map(j => j.id)).toEqual(['1800']);
    expect(live.some(j => j.departed)).toBe(false);
  });
});

describe('matching a day row to its departed job', () => {
  const gone = goneJobs();
  it.each(['1735', '1735-ST', '1735-WR', '1735_Wiring_0', '1735_Setup_0'])('%s belongs to 1735', (id) => {
    expect(departedOwnerId(id, gone)).toBe('1735');
  });
  it.each(['17350', '173', 'task:2026-09-07:x', '1800', ''])('%s does not', (id) => {
    expect(departedOwnerId(id, gone)).toBeNull();
  });
  it('reads the bench off an old manual piece id', () => {
    expect(benchFromPieceId('1735_Wiring_0')).toBe('Wiring');
    expect(benchFromPieceId('1735-ST')).toBe('');
  });
  it('puts the job on a day only where the week marked it', () => {
    expect(departedOnDay(gone, MON, weekMarks()).map(r => r.id)).toEqual(['1735']);
    expect(departedOnDay(gone, '2026-09-09', weekMarks())).toEqual([]);
  });
});

function dl(overrides = {}) {
  const addItem = vi.fn(async () => ({ ok: true }));
  const removeItem = vi.fn(async () => ({ ok: true }));
  const setWeekMark = vi.fn(async () => ({ ok: true }));
  const onMarkPieceDone = vi.fn();
  const showToast = vi.fn();
  render(
    <DailyLogPanel
      jobs={liveJobs()}
      departedJobs={goneJobs()}
      weekDays={WEEK_DAYS}
      marks={weekMarks()}
      dayItems={dayItems()}
      ready
      saveError={null}
      addItem={addItem}
      removeItem={removeItem}
      weekReady
      setWeekMark={setWeekMark}
      onMarkPieceDone={onMarkPieceDone}
      isMobile={false}
      showToast={showToast}
      {...overrides}
    />,
  );
  return { addItem, removeItem, setWeekMark, onMarkPieceDone, showToast };
}

const markBoxes = (labelStart) => screen.getAllByRole('combobox')
  .filter(el => (el.getAttribute('aria-label') || '').startsWith(`Mark for ${labelStart}`));

// The Daily Log opens on the week's Monday when today is not in the week.
describe('Daily Log — 1735 on 7 Sept', () => {
  it('shows the job with its three pieces, from the saved labels', () => {
    dl();
    // Header + three pieces.
    const boxes = markBoxes(NAME);
    expect(boxes).toHaveLength(4);
    expect(boxes.map(b => b.value)).toEqual(['slash', 'cross', 'cross', 'arrow']);
    expect(screen.getAllByText('Wiring', { selector: 'span' })).toHaveLength(2);
    expect(screen.getAllByText('Setup', { selector: 'span' })).toHaveLength(1);
    // The note is shown too.
    expect(screen.getByDisplayValue('neck relief')).toBeTruthy();
  });

  it('locks every line: mark boxes and notes disabled, no Remove, no + note, no Task', () => {
    dl();
    for (const b of markBoxes(NAME)) expect(b.disabled).toBe(true);
    expect(screen.getByDisplayValue('neck relief').disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
    expect(screen.queryByRole('button', { name: '+ note' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Task/ })).toBeNull();
  });

  it('writes nothing if a mark is forced through anyway', async () => {
    const { addItem, removeItem, setWeekMark, onMarkPieceDone, showToast } = dl();
    for (const b of markBoxes(NAME)) fireEvent.change(b, { target: { value: 'dot' } });
    fireEvent.blur(screen.getByDisplayValue('neck relief'), { target: { value: 'changed' } });
    await settle();
    expect(addItem).not.toHaveBeenCalled();
    expect(removeItem).not.toHaveBeenCalled();
    expect(setWeekMark).not.toHaveBeenCalled();
    expect(onMarkPieceDone).not.toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith(expect.stringMatching(/locked/));
  });

  it('keeps the departed job out of the picker', () => {
    dl();
    fireEvent.change(screen.getByPlaceholderText('+ Put a job on this day…'), { target: { value: '1735' } });
    expect(screen.getByText('Nothing on the week matches that.')).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText('+ Put a job on this day…'), { target: { value: '1800' } });
    expect(screen.queryByText('Nothing on the week matches that.')).toBeNull();
  });
});

describe('Daily Log — 1735 on 8 Sept', () => {
  it('shows the job and its auto-split pieces, locked', () => {
    // Moving the day picker to Tuesday.
    dl();
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: TUE } });
    const boxes = markBoxes(NAME);
    expect(boxes).toHaveLength(3);
    expect(boxes.map(b => b.value)).toEqual(['cross', 'cross', 'cross']);
    for (const b of boxes) expect(b.disabled).toBe(true);
  });
});

describe('Daily Log — a hidden departed job stays hidden', () => {
  it('3 Sept: taken off that day, and still off it', () => {
    const marks = { 1735: { '2026-09-03': 'dot' } };
    const days = Array.from({ length: 7 }, (_, i) => new Date(2026, 7, 31 + i));
    dl({ marks, weekDays: days });
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: '2026-09-03' } });
    expect(markBoxes(NAME)).toHaveLength(0);
  });
});

function wl(overrides = {}) {
  const setMark = vi.fn(async () => ({ ok: true }));
  const clearJobKeys = vi.fn(async () => ({ ok: true }));
  const onCloseJob = vi.fn();
  const showToast = vi.fn();
  render(
    <BenchWeekPage
      jobs={liveJobs()}
      departedJobs={goneJobs()}
      weekDays={WEEK_DAYS}
      marks={weekMarks()}
      ready
      saveError={null}
      setMark={setMark}
      clearJobKeys={clearJobKeys}
      onCloseJob={onCloseJob}
      onBookedOnDay={vi.fn()}
      isMobile={false}
      showToast={showToast}
      {...overrides}
    />,
  );
  return { setMark, clearJobKeys, onCloseJob, showToast };
}

const wlCell = (dateKey) => screen.getAllByRole('button')
  .find(el => (el.getAttribute('aria-label') || '') === `${NAME} — ${dateKey}`);

describe('Weekly Log — 1735 in the week of 7 Sept', () => {
  it('shows the row with its marks, closed', () => {
    wl();
    expect(screen.getByText(NAME)).toBeTruthy();
    expect(wlCell(MON).getAttribute('data-mark')).toBe('slash');
    expect(wlCell(TUE).getAttribute('data-mark')).toBe('cross');
    expect(screen.getByRole('button', { name: `End box for ${NAME}` }).textContent).toBe('×');
  });

  it('is locked: cells and end box disabled, no Remove, taps and holds write nothing', async () => {
    const { setMark, clearJobKeys, onCloseJob } = wl();
    expect(wlCell(MON).disabled).toBe(true);
    expect(wlCell('2026-09-09').disabled).toBe(true);
    const end = screen.getByRole('button', { name: `End box for ${NAME}` });
    expect(end.disabled).toBe(true);
    expect(screen.queryByTitle(`Take ${NAME} off this week`)).toBeNull();

    fireEvent.click(wlCell('2026-09-09'));
    vi.useFakeTimers();
    fireEvent.pointerDown(wlCell(MON), { clientX: 5, clientY: 5 });
    act(() => { vi.advanceTimersByTime(LONG_PRESS_MS); });
    vi.useRealTimers();
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(end);
    await settle();
    expect(setMark).not.toHaveBeenCalled();
    expect(clearJobKeys).not.toHaveBeenCalled();
    expect(onCloseJob).not.toHaveBeenCalled();
  });

  it('keeps the departed job out of the add-a-job picker', () => {
    wl();
    expect(screen.queryByRole('option', { name: /1735/ })).toBeNull();
  });

  it('the live job alongside it is untouched and still editable', async () => {
    const { setMark } = wl();
    const cell = screen.getAllByRole('button')
      .find(el => (el.getAttribute('aria-label') || '') === `1800 Fender Strat — 2026-09-09`);
    expect(cell.disabled).toBe(false);
    fireEvent.click(cell);
    await vi.waitFor(() => expect(setMark).toHaveBeenCalledWith('1800', '2026-09-09', 'dot'));
  });

  it('is not on a week where it has no marks', () => {
    const next = Array.from({ length: 7 }, (_, i) => new Date(2026, 8, 14 + i));
    wl({ weekDays: next });
    expect(screen.queryByText(NAME)).toBeNull();
  });
});

describe('departedWeekRows / withDepartedRows', () => {
  const keys = WEEK_DAYS.map(localDateKey);
  it('never draws a job twice if it is somehow both live and departed', () => {
    const live = weekRows(liveJobs(), keys, { 1800: { [MON]: 'dot' } });
    const rows = departedWeekRows(goneJobs(), keys, weekMarks(), new Set(['1735']));
    expect(rows).toEqual([]);
    expect(withDepartedRows(live, [], keys, {})).toBe(live);
  });
});
