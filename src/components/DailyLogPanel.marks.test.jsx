// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within, waitFor } from '@testing-library/react';
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
  it('writes the header row\u2019s mark to the Weekly Log cell, under the job id', async () => {
    const { addItem, setWeekMark } = setup();

    // A bare '1714' matches the parent's own header line, which is not a split
    // and so is the row that still drives the week.
    pick('1714', 'slash');

    // The day row itself is marked, storing the KEY and not the symbol.
    await vi.waitFor(() => expect(addItem).toHaveBeenCalledWith(DAY, 'mark:p', 'mark', 'slash'));
    await vi.waitFor(() => expect(setWeekMark).toHaveBeenCalledWith('p', DAY, 'slash'));
  });

  it('keeps a split\u2019s own mark off the week entirely', async () => {
    // Trevor on the preview, 2026-08-22: the \u00d7 was held back but `/` still
    // landed on the whole guitar's row. One bench's progress is not the job's.
    const { addItem, setWeekMark } = setup();

    pick('1714 \u2014 Setup', 'slash');

    // Still recorded on the day \u2014 only the week write is suppressed.
    await vi.waitFor(() => expect(addItem).toHaveBeenCalledWith(DAY, 'mark:c1', 'mark', 'slash'));
    expect(setWeekMark).not.toHaveBeenCalled();
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

  it('clears the week cell when the header row clears its own mark', async () => {
    const { setWeekMark, removeItem } = setup({
      marks: { p: { [DAY]: 'slash' } },
      dayItems: { [DAY]: { 'mark:p': { kind: 'mark', label: 'slash' } } },
    });

    pick('1714', '');

    await vi.waitFor(() => expect(removeItem).toHaveBeenCalledWith(DAY, 'mark:p'));
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

  it('leaves the cell alone when a second split of the same job is marked', async () => {
    // The old rule was \"last split to pick wins the shared cell\". Trevor
    // rejected that on the preview: no split writes to the week at all now, so
    // a cell he set by hand survives both of them.
    const { setWeekMark } = setup({
      marks: { p: { [DAY]: 'slash' } },
      dayItems: { [DAY]: { 'mark:c1': { kind: 'mark', label: 'slash' } } },
    });

    pick('1714 \u2014 Electronics', 'arrow');

    expect(setWeekMark).not.toHaveBeenCalled();
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

  // Trevor, 2026-08-22 on the preview: "if I delete job from DL the mark
  // should clear in WL". Leaving the week cell behind showed a job worked on a
  // day it was no longer on.
  it('clears the week cell when the job comes off the day', async () => {
    // c2 has no slot on this day, so c1 is the job's only line on it.
    const { removeItem, setWeekMark } = setup({
      jobs: makeJobs().map(j => j.id === 'c2' ? { ...j, calendarSlot: null } : j),
      marks: { p: { [DAY]: 'slash' } },
      dayItems: { [DAY]: { 'mark:p': { kind: 'mark', label: 'slash' } } },
    });

    // Removing it takes the whole job off the day.
    const row = markBox('1714 \u2014 Setup').closest('div');
    fireEvent.click(within(row).getByRole('button', { name: 'Remove' }));

    // The line's own mark goes, and the header's with it...
    await vi.waitFor(() => expect(removeItem).toHaveBeenCalledWith(DAY, 'mark:c1'));
    await vi.waitFor(() => expect(removeItem).toHaveBeenCalledWith(DAY, 'mark:p'));
    // ...and so does the week cell the header drove.
    await vi.waitFor(() => expect(setWeekMark).toHaveBeenCalledWith('p', DAY, ''));
  });

  it('leaves the week cell alone while another piece is still on the day', async () => {
    // Both pieces on the day. Taking one off leaves the job there, so the
    // cell the header line drove must survive.
    const { setWeekMark } = setup({
      marks: { p: { [DAY]: 'slash' } },
      dayItems: { [DAY]: {
        'mark:c1': { kind: 'mark', label: 'slash' },
        'mark:c2': { kind: 'mark', label: 'slash' },
      } },
    });

    const row = markBox('1714 \u2014 Setup').closest('div');
    fireEvent.click(within(row).getByRole('button', { name: 'Remove' }));

    await vi.waitFor(() => expect(setWeekMark).not.toHaveBeenCalled());
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

  it('keeps a non-\u00d7 mark on a split off the week too', async () => {
    // Widened on the preview, 2026-08-22. The gate used to let `\u00b7`, `/` and
    // `>` through; Trevor's objection applies to all of them equally.
    const { setWeekMark } = setup();

    pick('1714 \u2014 Electronics', 'slash');

    expect(setWeekMark).not.toHaveBeenCalled();
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
    // On the header row \u2014 a split's marks no longer reach the week at all.
    const { addItem, setWeekMark } = setup();

    pick('1714', 'dot');

    await vi.waitFor(() => expect(addItem).toHaveBeenCalledWith(DAY, 'mark:p', 'mark', 'dot'));
    await vi.waitFor(() => expect(setWeekMark).toHaveBeenCalledWith('p', DAY, 'dot'));
  });
});

// Build 2, 2026-08-23. Trevor: "Book in WL adds to DL. Book in DL adds to WL".
// Putting a job on the day used to write nothing to the week, so the two logs
// disagreed until a mark was picked by hand.
describe('putting a job on the day', () => {
  // A whole job of its own, held on the week by a mark on the TUESDAY. That is
  // what makes it pickable: the picker never offers a piece that already has a
  // calendar booking, and a job with no mark and no booking is not on the week
  // at all. So a Tuesday mark is the one shape that puts a job on the week and
  // still leaves Monday free.
  const TUE = '2026-08-11';
  const LOOSE = { id: 'solo', job: '1720', mfr: 'Gibson', model: 'LP', bench: 'Setup' };
  const looseProps = { jobs: [...makeJobs(), LOOSE], marks: { solo: { [TUE]: 'dot' } } };

  function pickFromSearch(text, label) {
    fireEvent.change(
      screen.getByLabelText('Search the week for a job to put on this day'),
      { target: { value: text } },
    );
    fireEvent.click(screen.getByRole('button', { name: new RegExp(label) }));
  }

  it("puts a dot in that job's week cell", async () => {
    const { setWeekMark } = setup(looseProps);
    pickFromSearch('1720', 'Setup');
    // The week write happens after the day write resolves, so it needs a tick.
    await waitFor(() => expect(setWeekMark).toHaveBeenCalledWith('solo', DAY, 'dot'));
  });

  it('writes nothing to the week before the week has loaded', async () => {
    const { setWeekMark } = setup({ ...looseProps, weekReady: false });
    pickFromSearch('1720', 'Setup');
    expect(setWeekMark).not.toHaveBeenCalled();
  });

  it('writes nothing to the week for a split', async () => {
    // A piece of job 1714, which the Weekly Log draws as one row. No split mark
    // reaches the week; only a job's own line drives it.
    const jobs = makeJobs().map(j => (j.id === 'c2' ? { ...j, calendarSlot: null } : j));
    const { setWeekMark } = setup({ jobs });
    pickFromSearch('1714', 'Electronics');
    expect(setWeekMark).not.toHaveBeenCalled();
  });

  it('still puts the job on the day itself', async () => {
    const { addItem } = setup(looseProps);
    pickFromSearch('1720', 'Setup');
    expect(addItem).toHaveBeenCalledWith(DAY, 'solo', 'job', expect.any(String));
  });
});
