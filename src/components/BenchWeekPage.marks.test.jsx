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
      isMobile={false}
      showToast={showToast}
      {...overrides}
    />,
  );
  return { setMark, showToast };
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
