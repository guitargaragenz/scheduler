// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act, waitFor } from '@testing-library/react';
import BenchWeekPage, { LONG_PRESS_MS, encodeTypedRow } from './BenchWeekPage.jsx';

// The end box: tap toggles ×, a long press opens Send / Close / Clear. These
// render the real page, because a handler wired to the wrong prop passes every
// unit test and does nothing on screen.

const WEEK_DAYS = Array.from({ length: 7 }, (_, i) => new Date(2026, 7, 10 + i));
const MONDAY = '2026-08-10';
const JOB = { id: 'p', job: '1714', mfr: 'Fender', model: 'Strat', bench: 'Setup', calendarSlot: `${MONDAY}-9-0` };

function setup(marks = {}, jobs = [JOB]) {
  const setMark = vi.fn(async () => ({ ok: true }));
  const onCloseJob = vi.fn();
  render(
    <BenchWeekPage
      jobs={jobs} weekDays={WEEK_DAYS} marks={marks} ready saveError={null}
      setMark={setMark} clearJobKeys={vi.fn()} onCloseJob={onCloseJob}
      onBookedOnDay={vi.fn()} isMobile={false} showToast={vi.fn()}
    />,
  );
  return { setMark, onCloseJob };
}

const endBox = (name = /1714/) => screen.getAllByRole('button', { name: /^End box for/ })
  .find(b => name.test(b.getAttribute('aria-label')));

function longPress(box) {
  vi.useFakeTimers();
  fireEvent.pointerDown(box, { clientX: 5, clientY: 5 });
  act(() => { vi.advanceTimersByTime(LONG_PRESS_MS); });
  fireEvent.pointerUp(box);
  fireEvent.click(box); // the click a browser fires on lift
  vi.useRealTimers();
}

afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('the end box', () => {
  it('is blank by default', () => {
    setup();
    expect(endBox().textContent.trim()).toBe('');
  });

  it('shows > once sent', () => {
    setup({ p: { 'next:2026-08-10': 'sent' } });
    expect(endBox().textContent).toBe('>');
  });

  it('a long press opens the menu and does not also close the job', () => {
    const { setMark, onCloseJob } = setup();
    longPress(endBox());
    expect(screen.getByRole('menu')).toBeTruthy();
    expect(setMark).not.toHaveBeenCalled();
    expect(onCloseJob).not.toHaveBeenCalled();
  });

  it('a plain tap still closes', async () => {
    const { setMark } = setup();
    fireEvent.click(endBox());
    await waitFor(() => expect(setMark).toHaveBeenCalledWith('p', 'close:2026-08-10', expect.anything()));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('Send writes next week\'s row key and this week\'s send key', async () => {
    const { setMark } = setup();
    longPress(endBox());
    fireEvent.click(screen.getByRole('menuitem', { name: /Send to next week/ }));
    await waitFor(() => expect(setMark).toHaveBeenCalledTimes(2));
    expect(setMark).toHaveBeenNthCalledWith(1, 'p', 'week:2026-08-17', 'row');
    expect(setMark).toHaveBeenNthCalledWith(2, 'p', 'next:2026-08-10', 'sent');
  });

  it('Clear takes the job off next week when next week is unmarked', async () => {
    const { setMark } = setup({ p: { 'next:2026-08-10': 'sent', 'week:2026-08-17': 'row' } });
    longPress(endBox());
    fireEvent.click(screen.getByRole('menuitem', { name: 'Clear' }));
    await waitFor(() => expect(setMark).toHaveBeenCalledTimes(2));
    expect(setMark).toHaveBeenCalledWith('p', 'next:2026-08-10', '');
    expect(setMark).toHaveBeenCalledWith('p', 'week:2026-08-17', '');
  });

  it('Clear leaves next week alone once a day there is marked', async () => {
    const { setMark } = setup({ p: { 'next:2026-08-10': 'sent', 'week:2026-08-17': 'row', '2026-08-18': 'slash' } });
    longPress(endBox());
    fireEvent.click(screen.getByRole('menuitem', { name: 'Clear' }));
    await waitFor(() => expect(setMark).toHaveBeenCalledWith('p', 'next:2026-08-10', ''));
    await new Promise(r => setTimeout(r, 20));
    expect(setMark).not.toHaveBeenCalledWith('p', 'week:2026-08-17', '');
  });

  it('Close on a sent job takes it off next week when next week is unmarked', async () => {
    const { setMark } = setup({ p: { 'next:2026-08-10': 'sent', 'week:2026-08-17': 'row' } });
    longPress(endBox());
    fireEvent.click(screen.getByRole('menuitem', { name: /Close/ }));
    await waitFor(() => expect(setMark).toHaveBeenCalledWith('p', 'week:2026-08-17', ''));
    expect(setMark).toHaveBeenCalledWith('p', 'close:2026-08-10', expect.anything());
    expect(setMark).toHaveBeenCalledWith('p', 'next:2026-08-10', '');
  });

  it('Close on a sent job keeps next week when a day there is marked', async () => {
    const { setMark } = setup({ p: { 'next:2026-08-10': 'sent', 'week:2026-08-17': 'row', '2026-08-20': 'cross' } });
    longPress(endBox());
    fireEvent.click(screen.getByRole('menuitem', { name: /Close/ }));
    await waitFor(() => expect(setMark).toHaveBeenCalledWith('p', 'next:2026-08-10', ''));
    await new Promise(r => setTimeout(r, 20));
    expect(setMark).not.toHaveBeenCalledWith('p', 'week:2026-08-17', '');
  });

  it('sends a typed row with its name and bench copied across', async () => {
    const id = 'task:2026-08-10:zz';
    const value = encodeTypedRow('do the books');
    const { setMark } = setup({ [id]: { 'week:2026-08-10': value } }, []);
    longPress(endBox(/do the books/));
    fireEvent.click(screen.getByRole('menuitem', { name: /Send to next week/ }));
    await waitFor(() => expect(setMark).toHaveBeenCalledTimes(2));
    expect(setMark).toHaveBeenNthCalledWith(1, id, 'week:2026-08-17', value);
    expect(setMark).toHaveBeenNthCalledWith(2, id, 'next:2026-08-10', 'sent');
  });
});
