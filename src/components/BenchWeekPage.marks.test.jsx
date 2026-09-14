// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import BenchWeekPage, { LONG_PRESS_MS } from './BenchWeekPage.jsx';

// The Weekly Log's day cells used to CYCLE on tap — one tap for each symbol,
// wrapping back to blank. Then dropdowns (2026-08-22). Now (Trevor, 2026-09-14) a tap
// toggles · and a long press opens the full list.
//
// These tests render the page and change a real cell. The one failure this page
// has actually shipped (2026-08-20) was a dropped `setMark` prop: every unit
// test passed, the page looked right, and every tap did nothing. Only touching
// the control on screen catches that. `BenchWeekPage.wiring.test.js` guards the
// same failure from the App.jsx side, and predates jsdom being available here.

const WEEK_DAYS = Array.from({ length: 7 }, (_, i) => new Date(2026, 7, 10 + i));
const MONDAY = '2026-08-10';
// Monday is booked by the job's calendar slot, so it already reads ·. Tuesday is blank.
const TUESDAY = '2026-08-11';

function setup(overrides = {}) {
  const setMark = vi.fn(async () => ({ ok: true }));
  const showToast = vi.fn();
  const onBookedOnDay = vi.fn();

  render(
    <BenchWeekPage
      jobs={[{ id: 'p', job: '1714', mfr: 'Fender', model: 'Strat', bench: 'Setup', calendarSlot: `${MONDAY}-9-0` }]}
      weekDays={WEEK_DAYS}
      marks={{}}
      ready
      saveError={null}
      setMark={setMark}
      clearJobKeys={vi.fn()}
      onCloseJob={vi.fn()}
      onBookedOnDay={onBookedOnDay}
      isMobile={false}
      showToast={showToast}
      {...overrides}
    />,
  );
  return { setMark, showToast, onBookedOnDay };
}

// The cell for one job on one day, found by the label the page gives it.
function cell(dateKey) {
  const match = screen.getAllByRole('button')
    .find(el => (el.getAttribute('aria-label') || '').endsWith(dateKey));
  if (!match) throw new Error(`no cell for ${dateKey}`);
  return match;
}

function hold(el) {
  vi.useFakeTimers();
  fireEvent.pointerDown(el, { clientX: 5, clientY: 5 });
  act(() => { vi.advanceTimersByTime(LONG_PRESS_MS); });
  fireEvent.pointerUp(el);
  fireEvent.click(el); // the click a browser fires on lift
  vi.useRealTimers();
}

const pick = (name) => fireEvent.click(screen.getByRole('menuitem', { name }));

afterEach(() => { cleanup(); vi.useRealTimers(); });
beforeEach(() => vi.clearAllMocks());

describe('tapping a day box', () => {
  it('books a blank day with ·', async () => {
    const { setMark } = setup();
    fireEvent.click(cell(TUESDAY));
    await vi.waitFor(() => expect(setMark).toHaveBeenCalledWith('p', TUESDAY, 'dot'));
  });

  it('clears a · day', async () => {
    const { setMark } = setup({ marks: { p: { [MONDAY]: 'dot' } } });
    fireEvent.click(cell(MONDAY));
    await vi.waitFor(() => expect(setMark).toHaveBeenCalledWith('p', MONDAY, ''));
  });

  it.each(['slash', 'arrow', 'cross'])('leaves a %s day alone', (mark) => {
    const { setMark } = setup({ marks: { p: { [MONDAY]: mark } } });
    fireEvent.click(cell(MONDAY));
    expect(setMark).not.toHaveBeenCalled();
  });

  it('shows what is already stored', () => {
    setup({ marks: { p: { [MONDAY]: 'cross' } } });
    expect(cell(MONDAY).textContent).toBe('\u00d7');
  });

  it('says so and writes nothing when the week has not loaded', async () => {
    const { setMark, showToast } = setup({ ready: false });
    fireEvent.click(cell(MONDAY));
    expect(setMark).not.toHaveBeenCalled();
    // A silent refusal is this project's own past failure.
    await vi.waitFor(() => expect(showToast).toHaveBeenCalled());
  });
});

describe('holding a day box', () => {
  it('opens the list and the lift does not also tap', () => {
    const { setMark } = setup();
    hold(cell(MONDAY));
    expect(screen.getByRole('menu')).toBeTruthy();
    expect(setMark).not.toHaveBeenCalled();
  });

  it('saves the symbol picked straight off the list', async () => {
    const { setMark } = setup();
    hold(cell(MONDAY));
    pick(/^>/);
    await vi.waitFor(() => expect(setMark).toHaveBeenCalledWith('p', MONDAY, 'arrow'));
    expect(setMark).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  // Build B, 2026-08-22: erase and dot both drew `·`, so the dot one line too
  // high wiped the cell. Clear stays last and spelled out.
  it('lists Clear last, never drawn as ·', async () => {
    const { setMark } = setup({ marks: { p: { [MONDAY]: 'slash' } } });
    hold(cell(MONDAY));
    const items = screen.getAllByRole('menuitem');
    expect(items[items.length - 1].textContent).toBe('Clear');
    expect(items.filter(i => i.textContent.trim().startsWith('·'))).toHaveLength(1);
    pick('Clear');
    await vi.waitFor(() => expect(setMark).toHaveBeenCalledWith('p', MONDAY, ''));
  });

  it('keeps the cell 30px', () => {
    setup();
    expect(cell(MONDAY).style.height).toBe('30px');
  });
});

// Build 1, 2026-08-23. Trevor: "if I take job off via DL or WL I should be able
// to put it straight back on with no recourse".
describe('booking a job onto a day it was taken off', () => {
  it('tells the day to drop its "keep it off" note', async () => {
    const { onBookedOnDay } = setup();
    fireEvent.click(cell(TUESDAY));
    await vi.waitFor(() => expect(onBookedOnDay).toHaveBeenCalledWith('p', TUESDAY));
  });

  it('does not, when the cell is being cleared instead', async () => {
    const { setMark, onBookedOnDay } = setup({ marks: { p: { [MONDAY]: 'dot' } } });
    fireEvent.click(cell(MONDAY));
    await vi.waitFor(() => expect(setMark).toHaveBeenCalled());
    expect(onBookedOnDay).not.toHaveBeenCalled();
  });

  it('does not, when the mark failed to save', async () => {
    const setMark = vi.fn(async () => ({ ok: false }));
    const { onBookedOnDay } = setup({ setMark });
    fireEvent.click(cell(TUESDAY));
    await vi.waitFor(() => expect(setMark).toHaveBeenCalled());
    expect(onBookedOnDay).not.toHaveBeenCalled();
  });
});
