import { describe, it, expect } from 'vitest';
import { typedWeekCellId } from './DailyLogPanel.jsx';

const weekKeys = ['2026-10-12', '2026-10-13'];

describe('typedWeekCellId', () => {
  it('finds the week cell of an admin task typed on the Weekly Log', () => {
    const id = 'task:2026-10-12:abc';
    const marks = { [id]: { 'week:2026-10-12': 'task:Admin:do the books' } };
    expect(typedWeekCellId(id, weekKeys, marks)).toBe(id);
  });
  it('is null for a task typed on the Daily Log only', () => {
    expect(typedWeekCellId('task:2026-10-13:xyz', weekKeys, {})).toBe(null);
  });
  it('is null for a job id', () => {
    expect(typedWeekCellId('1714', weekKeys, { 1714: { 'week:2026-10-12': 'row' } })).toBe(null);
  });
});
