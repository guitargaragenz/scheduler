// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
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

    // Build 2 gives the parent job its own header line ("1714 Fender Strat"),
    // so a bare '1714' now matches that header first. Pick the split by its
    // fuller label to land on c1, same as the "second split" test below.
    pick('1714 — Setup', 'slash');

    // The day row itself is marked, storing the KEY and not the symbol.
    await vi.waitFor(() => expect(addItem).toHaveBeenCalledWith(DAY, 'mark:c1', 'mark', 'slash'));
    // And the week cell — under 'p', the parent. 'c1' is a row the Weekly Log
    // never draws, so a mark filed there would show nowhere.
    await vi.waitFor(() => expect(setWeekMark).toHaveBeenCalledWith('p', DAY, 'slash'));
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

    pick('1714 — Setup', '');

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
    // One cell per job per day, so the last pick is what shows. Still true for
    // every mark except the ×, which has its own rule below.
    const { setWeekMark } = setup({
      marks: { p: { [DAY]: 'slash' } },
      dayItems: { [DAY]: { 'mark:c1': { kind: 'mark', label: 'slash' } } },
    });

    pick('1714 — Electronics', 'arrow');

    await vi.waitFor(() => expect(setWeekMark).toHaveBeenCalledWith('p', DAY, 'arrow'));
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

    pick('1714 — Setup', 'cross');

    await vi.waitFor(() => expect(onMarkPieceDone).toHaveBeenCalledWith('p', 'c1', true));
  });

  it('un-ticks it when the mark moves off the cross', async () => {
    const { onMarkPieceDone } = setup({
      dayItems: { [DAY]: { 'mark:c1': { kind: 'mark', label: 'cross' } } },
      marks: { p: { [DAY]: 'cross' } },
    });

    pick('1714 — Setup', 'slash');

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

describe('the "+ Put a job on this day…" picker', () => {
  // A helper returning the right shape proves nothing about what is on screen —
  // this project has shipped a green build where every tap did nothing. So this
  // reads the rendered dropdown.
  // Pieces with NO day yet — which, since 2026-08-22, is what the picker is
  // for. The parent keeps its booking so the job is still on the week; the
  // pieces have none, so they are the ones that still need a day.
  function pickableJobs() {
    return makeJobs().map(j => (j.parentId ? { ...j, calendarSlot: null } : { ...j, calendarSlot: `${DAY}-9-0` }));
  }

  // The picker draws its own list, so its pieces are buttons, not <option>s —
  // that is the whole reason it stopped being a <select>.
  function pieceButtons() {
    return screen.getAllByRole('button')
      .filter(b => /^(Setup|Electronics)( —|$)/.test(b.textContent))
      .map(b => b.textContent);
  }

  // Nothing shows until something is typed, so every test here types first.
  function search(text) {
    fireEvent.change(screen.getByLabelText(/Search the week/i), { target: { value: text } });
  }

  it('heads each job once and lists its pieces by bench underneath', () => {
    setup({ jobs: pickableJobs() });
    search('1714');

    // The heading is the job, once — not repeated on every line.
    expect(screen.getAllByText('1714 Fender Strat')).toHaveLength(1);
    expect(pieceButtons()).toEqual(['Setup — level and crown', 'Electronics']);
  });

  it('leaves out a piece already ticked off', () => {
    setup({ jobs: pickableJobs().map(j => (j.id === 'c2' ? { ...j, pieceDone: true } : j)) });
    search('1714');

    expect(pieceButtons()).toEqual(['Setup — level and crown']);
  });

  it('places the piece when its line is clicked', async () => {
    const { addItem } = setup({ jobs: pickableJobs() });
    search('electr');

    fireEvent.click(screen.getByRole('button', { name: 'Electronics' }));

    await vi.waitFor(() => expect(addItem).toHaveBeenCalledWith(DAY, 'c2', 'job', expect.any(String)));
  });

  // A job going on a day is nearly always several of its pieces, and the whole
  // point of searching once is to place them all from that one search.
  it('stays open after a pick so the rest of the job can be tapped too', async () => {
    const { addItem } = setup({ jobs: pickableJobs() });
    search('1714');

    fireEvent.click(screen.getByRole('button', { name: 'Setup — level and crown' }));
    await vi.waitFor(() => expect(addItem).toHaveBeenCalledWith(DAY, 'c1', 'job', expect.any(String)));

    // No re-typing: the box still holds '1714' and the other piece is still
    // there to tap.
    expect(screen.getByLabelText(/Search the week/i).value).toBe('1714');
    fireEvent.click(screen.getByRole('button', { name: 'Electronics' }));
    await vi.waitFor(() => expect(addItem).toHaveBeenCalledWith(DAY, 'c2', 'job', expect.any(String)));
  });

  it('narrows to what was typed, and keeps the heading above it', () => {
    setup({ jobs: pickableJobs() });

    search('electr');

    expect(pieceButtons()).toEqual(['Electronics']);
    expect(screen.getAllByText('1714 Fender Strat')).toHaveLength(1);
  });

  it('says so when nothing on the week matches', () => {
    setup({ jobs: pickableJobs() });

    search('banjo');

    expect(pieceButtons()).toEqual([]);
    expect(screen.getByText(/Nothing on the week matches that/i)).toBeTruthy();
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

  // Shipped broken: the Remove button handed `handleRemove` the bare id, but it
  // reads `row.id`, so the delete went out with no id, failed, and only raised a
  // toast — the task stayed on the day. Every helper passed; nothing rendered
  // the button and clicked it. So this test clicks it.
  it('comes off the day when Remove is clicked', async () => {
    const { removeItem, showToast } = setup({
      dayItems: { [DAY]: { 'task:2026-08-10:zz': { kind: 'task', label: 'order strings' } } },
    });

    const row = screen.getByText('order strings').closest('div');
    fireEvent.click(within(row).getByRole('button', { name: 'Remove' }));

    await vi.waitFor(() =>
      expect(removeItem).toHaveBeenCalledWith(DAY, 'task:2026-08-10:zz'));
    expect(showToast).not.toHaveBeenCalled();
  });
});

// Build A, 2026-08-22. One piece finished is not the guitar finished, so a × on
// a split stays in the Daily Log until it is the LAST piece without one.
// Every test here renders the panel and changes a real mark box.
describe('a × on a split, and what the Weekly Log gets', () => {
  it('writes nothing to the week while another piece is still unfinished', async () => {
    const { addItem, setWeekMark, showToast } = setup();

    pick('1714 — Setup', 'cross');

    // The Daily Log still records it — this is a suppressed WEEK write, not a
    // refused mark.
    await vi.waitFor(() => expect(addItem).toHaveBeenCalledWith(DAY, 'mark:c1', 'mark', 'cross'));
    expect(setWeekMark).not.toHaveBeenCalled();
    // Silently doing less is this project's own past failure, so check no
    // apology was raised either — nothing went wrong.
    expect(showToast).not.toHaveBeenCalled();
  });

  it('writes the × when it is the last piece without one', async () => {
    // The other piece was crossed off on an earlier day of the same week.
    const { setWeekMark } = setup({
      dayItems: { '2026-08-11': { 'mark:c2': { kind: 'mark', label: 'cross' } } },
    });

    pick('1714 — Setup', 'cross');

    await vi.waitFor(() => expect(setWeekMark).toHaveBeenCalledWith('p', DAY, 'cross'));
  });

  it('decides that on the Daily Log marks, not on the board tick', async () => {
    // c2 is ticked done on the board but was never marked here. The board is
    // not Trevor saying so on this page, so the × still writes nothing.
    const { setWeekMark } = setup({
      jobs: makeJobs().map(j => (j.id === 'c2' ? { ...j, pieceDone: true } : j)),
    });

    pick('1714 — Setup', 'cross');

    await vi.waitFor(() => expect(setWeekMark).not.toHaveBeenCalled());
  });

  it('counts the latest day for a piece marked on more than one day', async () => {
    // c2 was crossed on the Monday and then re-opened with a `/` on the
    // Tuesday, so it is NOT finished and this × writes nothing.
    const { setWeekMark } = setup({
      dayItems: {
        '2026-08-10': { 'mark:c2': { kind: 'mark', label: 'cross' } },
        '2026-08-11': { 'mark:c2': { kind: 'mark', label: 'slash' } },
      },
    });

    pick('1714 — Setup', 'cross');

    await vi.waitFor(() => expect(setWeekMark).not.toHaveBeenCalled());
  });

  it('clears the cell when the × comes off the last piece', async () => {
    const { removeItem, setWeekMark } = setup({
      marks: { p: { [DAY]: 'cross' } },
      dayItems: {
        [DAY]: { 'mark:c1': { kind: 'mark', label: 'cross' } },
        '2026-08-11': { 'mark:c2': { kind: 'mark', label: 'cross' } },
      },
    });

    pick('1714 — Setup', '');

    await vi.waitFor(() => expect(removeItem).toHaveBeenCalledWith(DAY, 'mark:c1'));
    await vi.waitFor(() => expect(setWeekMark).toHaveBeenCalledWith('p', DAY, ''));
  });

  it('leaves the cell alone when a × that wrote nothing is taken off', async () => {
    // c1's × never reached the week (c2 was unfinished), so removing it must
    // not wipe whatever the week cell holds.
    const { removeItem, setWeekMark } = setup({
      marks: { p: { [DAY]: 'slash' } },
      dayItems: { [DAY]: { 'mark:c1': { kind: 'mark', label: 'cross' } } },
    });

    pick('1714 — Setup', '');

    await vi.waitFor(() => expect(removeItem).toHaveBeenCalledWith(DAY, 'mark:c1'));
    expect(setWeekMark).not.toHaveBeenCalled();
  });

  it('still passes a non-× mark on a split straight through', async () => {
    const { setWeekMark } = setup();

    pick('1714 — Electronics', 'slash');

    await vi.waitFor(() => expect(setWeekMark).toHaveBeenCalledWith('p', DAY, 'slash'));
  });

  it('leaves the job header row alone — its own × still writes', async () => {
    // The header is the whole job, not a piece, so nothing here gates it.
    const { setWeekMark } = setup();

    pick('1714 Fender Strat', 'cross');

    await vi.waitFor(() => expect(setWeekMark).toHaveBeenCalledWith('p', DAY, 'cross'));
  });

  it('still moves the board tick for a piece whose × the week never sees', async () => {
    const { onMarkPieceDone, setWeekMark } = setup();

    pick('1714 — Setup', 'cross');

    await vi.waitFor(() => expect(onMarkPieceDone).toHaveBeenCalledWith('p', 'c1', true));
    expect(setWeekMark).not.toHaveBeenCalled();
  });
});

// Build B, 2026-08-22. The erase option and the dot mark both drew `·`, erase
// first, so picking one line too high wiped the row's mark instead of setting
// it. Trevor's call the same day: the Daily Log does not get an erase line at
// all, and an unmarked box rests on `·`. Clearing a cell is a Weekly Log job.
describe('the mark box on a Daily Log line', () => {
  it('offers no erase line, and only one `·`', () => {
    setup();
    const box = markBox('1714 — Setup');
    const options = [...box.querySelectorAll('option')];

    expect(options.find(o => o.value === '')).toBeUndefined();
    expect(box.querySelector('optgroup')).toBeNull();
    expect(options.filter(o => o.textContent.trim() === '·')).toHaveLength(1);
  });

  it('rests on the dot when the line has no mark yet', () => {
    setup();
    expect(markBox('1714 — Setup').value).toBe('dot');
  });

  it('still sets the dot mark when the dot is picked', async () => {
    const { setWeekMark } = setup();

    pick('1714 — Setup', 'dot');

    await vi.waitFor(() => expect(setWeekMark).toHaveBeenCalledWith('p', DAY, 'dot'));
  });
});
