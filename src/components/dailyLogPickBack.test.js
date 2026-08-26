import { describe, it, expect } from 'vitest';
import { pickableOnDay } from './DailyLogPanel.jsx';

// Why this test exists (2026-08-26).
//
// Taking a job off a day does not delete anything. An auto row appears BECAUSE
// nothing is stored for it, so Remove stores a 'hidden' row — a "keep it off
// this day" note — instead. Nothing in the Daily Log has ever cleared that note:
// the only clearing path is the Weekly Log's setCell() -> onBookedOnDay
// (App.jsx). The picker then filtered hidden ids out of what it offered, so the
// job could not be picked to clear it either. A job taken off a day was stuck
// off it, from the Daily Log's side, forever.
//
// Against Trevor's rule, 2026-08-23: "if I take job off via DL or WL I should be
// able to put it straight back on with no recourse".
//
// The note lives at (date_key, item_id) and addItem() upserts on exactly that
// key, so picking the job REPLACES the note with a real row. Offering it is the
// entire fix — nothing has to delete the note separately.

const opt = (id) => ({ id, label: `job ${id}`, note: '' });

describe('pickableOnDay', () => {
  it('offers a job that is not on the day', () => {
    expect(pickableOnDay([opt('1730')], []).map(o => o.id)).toEqual(['1730']);
  });

  it('does not offer a job already on the day', () => {
    const onDay = [{ id: '1730', label: 'job 1730', auto: true }];
    expect(pickableOnDay([opt('1730')], onDay)).toEqual([]);
  });

  // The regression. A removed auto row leaves a 'hidden' note and drops out of
  // dayJobs — so it is NOT on the day, and must be offered again.
  it('offers a job whose auto row was removed, so it can be put straight back', () => {
    const onDay = []; // the hidden note keeps it out of dayJobs
    expect(pickableOnDay([opt('1730')], onDay).map(o => o.id)).toEqual(['1730']);
  });

  it('takes no hidden argument — filtering on hidden again is the bug', () => {
    expect(pickableOnDay.length).toBe(2);
  });

  it('compares ids as text, so a numeric job id still matches', () => {
    const onDay = [{ id: 1730, label: 'job 1730', auto: true }];
    expect(pickableOnDay([opt('1730')], onDay)).toEqual([]);
  });

  it('survives empty and missing input', () => {
    expect(pickableOnDay(null, null)).toEqual([]);
    expect(pickableOnDay([], undefined)).toEqual([]);
  });
});
