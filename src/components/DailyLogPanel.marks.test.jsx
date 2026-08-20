// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import DailyLogPanel from './DailyLogPanel.jsx';

// These tests RENDER the panel and pick a mark on it, rather than calling the
// helpers underneath. That is deliberate: this project has shipped a green
// build before where every helper passed and every tap on screen did nothing,
// because nothing was wired to the control. Only a real pick proves the wiring.

// The Daily Log reads Google Calendar for the day's appointments. Nothing in
// these tests is about appointments, and a real read would go to the network.
vi.mock('../utils/googleCalendar.js', () => ({
  isSignedIn: () => false,
  listEvents: async () => [],
}));

const DAY = '2026-08-10';
const WEEK_DAYS = Array.from({ length: 7 }, (_, i) => new Date(2026, 7, 10 + i));

// One job, two bench splits, both booked on the Monday. The parent is what the
// Weekly Log draws; the splits are what the Daily Log offers.
function makeJobs() {
  return [
    { id: 'p', job: '1714', mfr: 'Fender', model: 'Strat', bench: 'Setup', isSplit: true },
    { id: 'c1', job: '1714', parentId: 'p', bench: 'Setup', calendarSlot: `${DAY}-9-0`, sessionNote: 'level and crown' },
    { id: 'c2', job: '1714', parentId: 'p', bench: 'Electronics', calendarSlot: `${DAY}-13-0` },
  ];
}

function setup(overrides = {}) {
  const addItem = vi.fn(async () => ({ ok: true }));
  const removeItem = vi.fn(async () => ({ ok: true }));
  const setWeekMark = vi.fn(async () => ({ ok: true }));
  const onMarkPieceDone = vi.fn();
  const showToast = vi.fn();

  const props = {
    jobs: makeJobs(),
    weekDays: WEEK_DAYS,
    marks: {},
    dayItems: {},
    ready: true,
    saveError: null,
    addItem,
    removeItem,
    weekReady: true,
    setWeekMark,
    onMarkPieceDone,
    isMobile: false,
    showToast,
    ...overrides,
  };

  render(<DailyLogPanel {...props} />);
  return { addItem, removeItem, setWeekMark, onMarkPieceDone, showToast };
}

// The mark box for one row, found by the row it belongs to.
function markBox(labelStart) {
  const match = screen.getAllByRole('combobox')
    .find(el => (el.getAttribute('aria-label') || '').startsWith(`Mark for ${labelStart}`));
  if (!match) throw new Error(`no mark box for ${labelStart}`);
  return match;
}

function pick(labelStart, value) {
  fireEvent.change(markBox(labelStart), { target: { value } });
}

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

describe('picking a mark in the Daily Log', () => {
  it('writes the same mark to the Weekly Log cell, under the top-level job id', async () => {
    const { addItem, setWeekMark } = setup();

    pick('1714', 'cross');

    // The day row itself is marked, storing the KEY and not the symbol.
    await vi.waitFor(() => expect(addItem).toHaveBeenCalledWith(DAY, 'mark:c1', 'mark', 'cross'));
    // And the week cell — under 'p', the parent. 'c1' is a row the Weekly Log
    // never draws, so a mark filed there would show nowhere.
    await vi.waitFor(() => expect(setWeekMark).toHaveBeenCalledWith('p', DAY, 'cross'));
  });

  it('lets the same row change its own mark, and the week cell follows', async () => {
    // The week cell already holds what this row put there last time.
    const { setWeekMark, showToast } = setup({
      marks: { p: { [DAY]: 'cross' } },
      dayItems: { [DAY]: { 'mark:c1': { kind: 'mark', label: 'cross' } } },
    });

    pick('1714', 'slash');

    await vi.waitFor(() => expect(setWeekMark).toHaveBeenCalledWith('p', DAY, 'slash'));
    expect(showToast).not.toHaveBeenCalled();
  });

  it('clears the week cell when the row clears its own mark', async () => {
    const { setWeekMark, removeItem } = setup({
      marks: { p: { [DAY]: 'slash' } },
      dayItems: { [DAY]: { 'mark:c1': { kind: 'mark', label: 'slash' } } },
    });

    pick('1714', '');

    await vi.waitFor(() => expect(removeItem).toHaveBeenCalledWith(DAY, 'mark:c1'));
    await vi.waitFor(() => expect(setWeekMark).toHaveBeenCalledWith('p', DAY, ''));
  });

  it('overwrites a cell Trevor set by hand — the Daily Log drives', async () => {
    // He rejected refusing this on the preview: picking in the D Log must show
    // in the W Log, whatever the cell already holds.
    const { setWeekMark, showToast } = setup({ marks: { p: { [DAY]: 'cross' } } });

    pick('1714', 'slash');

    await vi.waitFor(() => expect(setWeekMark).toHaveBeenCalledWith('p', DAY, 'slash'));
    expect(showToast).not.toHaveBeenCalled();
  });

  it('lets the second split of the same job win the shared cell', async () => {
    // One cell per job per day, so the last pick is what shows.
    const { setWeekMark } = setup({
      marks: { p: { [DAY]: 'slash' } },
      dayItems: { [DAY]: { 'mark:c1': { kind: 'mark', label: 'slash' } } },
    });

    pick('1714 — Electronics', 'cross');

    await vi.waitFor(() => expect(setWeekMark).toHaveBeenCalledWith('p', DAY, 'cross'));
  });

  it('says so and writes nothing at all when the week has not loaded', async () => {
    const { addItem, setWeekMark, showToast } = setup({ weekReady: false });

    pick('1714', 'slash');

    await vi.waitFor(() => expect(showToast).toHaveBeenCalled());
    expect(showToast.mock.calls[0][0]).toMatch(/Weekly Log has not loaded/i);
    // Neither half. A day marked with the week silently missed is worse than
    // no mark, because the screen would look like it worked.
    expect(addItem).not.toHaveBeenCalled();
    expect(setWeekMark).not.toHaveBeenCalled();
  });

  it('shows the week gate on screen, not only when something is tapped', () => {
    setup({ weekReady: false });
    expect(screen.getByText(/Weekly Log has not loaded/i)).toBeTruthy();
  });
});

describe('the board tick (pieceDone)', () => {
  it('ticks the piece done when the mark becomes a cross', async () => {
    const { onMarkPieceDone } = setup();

    pick('1714', 'cross');

    await vi.waitFor(() => expect(onMarkPieceDone).toHaveBeenCalledWith('p', 'c1', true));
  });

  it('un-ticks it when the mark moves off the cross', async () => {
    const { onMarkPieceDone } = setup({
      dayItems: { [DAY]: { 'mark:c1': { kind: 'mark', label: 'cross' } } },
      marks: { p: { [DAY]: 'cross' } },
    });

    pick('1714', 'slash');

    await vi.waitFor(() => expect(onMarkPieceDone).toHaveBeenCalledWith('p', 'c1', false));
  });

  it('leaves a piece already ticked on the board alone when the row was never a cross', async () => {
    // The board ticked this piece done. Picking `/` because more work happened
    // must not reach back and un-tick it.
    const { onMarkPieceDone, setWeekMark } = setup({
      jobs: makeJobs().map(j => (j.id === 'c1' ? { ...j, pieceDone: true } : j)),
    });

    pick('1714', 'slash');

    await vi.waitFor(() => expect(setWeekMark).toHaveBeenCalled());
    expect(onMarkPieceDone).not.toHaveBeenCalled();
  });
});

describe('a hand-typed task', () => {
  it('has a mark box, saves the mark, and adds no Weekly Log row', async () => {
    const { addItem, setWeekMark, showToast } = setup({
      dayItems: { [DAY]: { 'task:2026-08-10:zz': { kind: 'task', label: 'order strings' } } },
    });

    pick('order strings', 'arrow');

    await vi.waitFor(() =>
      expect(addItem).toHaveBeenCalledWith(DAY, 'mark:task:2026-08-10:zz', 'mark', 'arrow'));
    expect(setWeekMark).not.toHaveBeenCalled();
    expect(showToast).not.toHaveBeenCalled();
  });
});
