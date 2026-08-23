// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import BenchWeekPage from './BenchWeekPage.jsx';

// The Weekly Log's day cells used to CYCLE on tap — one tap for each symbol,
// wrapping back to blank. They are dropdowns now (Trevor, 2026-08-22), so the
// symbol is chosen straight off a list.
//
// These tests render the page and change a real cell. The one failure this page
// has actually shipped (2026-08-20) was a dropped `setMark` prop: every unit
// test passed, the page looked right, and every tap did nothing. Only touching
// the control on screen catches that. `BenchWeekPage.wiring.test.js` guards the
// same failure from the App.jsx side, and predates jsdom being available here.

const WEEK_DAYS = Array.from({ length: 7 }, (_, i) => new Date(2026, 7, 10 + i));
const MONDAY = '2026-08-10';

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
  const match = screen.getAllByRole('combobox')
    .find(el => (el.getAttribute('aria-label') || '').endsWith(dateKey));
  if (!match) throw new Error(`no cell for ${dateKey}`);
  return match;
}

afterEach(cleanup);
beforeEach(() => vi.clearAllMocks());

describe('marking a day on the Weekly Log', () => {
  it('saves the symbol picked, without cycling to reach it', async () => {
    const { setMark } = setup();

    fireEvent.change(cell(MONDAY), { target: { value: 'arrow' } });

    // Straight to 'arrow'. Cycling would have gone dot → slash → arrow, so a
    // cycle still in place here would save the wrong symbol on the first go.
    await vi.waitFor(() => expect(setMark).toHaveBeenCalledWith('p', MONDAY, 'arrow'));
    expect(setMark).toHaveBeenCalledTimes(1);
  });

  it('shows what is already stored', () => {
    setup({ marks: { p: { [MONDAY]: 'cross' } } });
    expect(cell(MONDAY).value).toBe('cross');
  });

  it('clears the cell when the blank option is picked', async () => {
    const { setMark } = setup({ marks: { p: { [MONDAY]: 'slash' } } });

    fireEvent.change(cell(MONDAY), { target: { value: '' } });

    await vi.waitFor(() => expect(setMark).toHaveBeenCalledWith('p', MONDAY, ''));
  });

  it('says so and writes nothing when the week has not loaded', async () => {
    const { setMark, showToast } = setup({ ready: false });

    fireEvent.change(cell(MONDAY), { target: { value: 'slash' } });

    expect(setMark).not.toHaveBeenCalled();
    // A silent refusal is this project's own past failure.
    await vi.waitFor(() => expect(showToast).toHaveBeenCalled());
  });
});

// Build B, 2026-08-22. The erase option and the dot mark both drew `·`, with
// erase on top — so picking the dot one line too high cleared the cell, and a
// job held on the week only by that mark dropped off the page for good.
describe('the blank option in a day cell', () => {
  it('is not drawn as a dot, and is not first in the list', () => {
    setup();
    const options = [...cell(MONDAY).querySelectorAll('option')];

    const blank = options.find(o => o.value === '');
    expect(blank).toBeTruthy();
    expect(blank.textContent.trim()).not.toBe('·');
    // Exactly one line in the list draws `·`, and it is the dot MARK.
    expect(options.filter(o => o.textContent.trim() === '·')).toHaveLength(1);
    expect(options[0].value).not.toBe('');
    expect(options[options.length - 1].value).toBe('');
    expect(cell(MONDAY).querySelector('optgroup')?.label).toBe('clear');
  });

  it('sets the dot mark when the dot is picked, rather than wiping the cell', async () => {
    const { setMark } = setup({ marks: { p: { [MONDAY]: 'slash' } } });

    const dot = [...cell(MONDAY).querySelectorAll('option')]
      .find(o => o.textContent.trim() === '·');
    fireEvent.change(cell(MONDAY), { target: { value: dot.value } });

    await vi.waitFor(() => expect(setMark).toHaveBeenCalledWith('p', MONDAY, 'dot'));
  });

  it('keeps the cell 30px and centred, arrow still stripped', () => {
    setup();
    const style = cell(MONDAY).style;
    expect(style.height).toBe('30px');
    expect(style.appearance).toBe('none');
    expect(style.textAlignLast).toBe('center');
  });
});

// Build 1, 2026-08-24. Trevor: "if I take job off via DL or WL I should be able
// to put it straight back on with no recourse". Taking a job off the Daily Log
// leaves a note against that DATE, and booking the job back onto the same day
// used to leave the note behind — so the job stayed off for the rest of the day.
describe('booking a job onto a day it was taken off', () => {
  it('tells the day to drop its "keep it off" note', async () => {
    const { onBookedOnDay } = setup();

    fireEvent.change(cell(MONDAY), { target: { value: 'dot' } });

    await vi.waitFor(() => expect(onBookedOnDay).toHaveBeenCalledWith('p', MONDAY));
  });

  it('does not, when the cell is being cleared instead', async () => {
    const { onBookedOnDay } = setup({ marks: { p: { [MONDAY]: 'dot' } } });

    fireEvent.change(cell(MONDAY), { target: { value: '' } });

    await vi.waitFor(() => expect(onBookedOnDay).not.toHaveBeenCalled());
  });

  it('does not, when the mark failed to save', async () => {
    const setMark = vi.fn(async () => ({ ok: false }));
    const { onBookedOnDay } = setup({ setMark });

    fireEvent.change(cell(MONDAY), { target: { value: 'dot' } });

    await vi.waitFor(() => expect(setMark).toHaveBeenCalled());
    expect(onBookedOnDay).not.toHaveBeenCalled();
  });
});
