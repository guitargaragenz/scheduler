import { describe, it, expect } from 'vitest';
import { buildRevenueWeekKeys } from './useJobs.js';

describe('buildRevenueWeekKeys', () => {
  it('undefined viewed key = this week only', () => {
    expect(buildRevenueWeekKeys(['2026-10-12'], undefined)).toEqual(['2026-10-12']);
  });
  it('viewing this week does not duplicate the key', () => {
    expect(buildRevenueWeekKeys(['2026-10-12'], '2026-10-12')).toEqual(['2026-10-12']);
  });
  it('viewing a past week adds it after this week', () => {
    expect(buildRevenueWeekKeys(['2026-10-12'], '2026-10-05')).toEqual(['2026-10-12', '2026-10-05']);
  });
  it('does not mutate the rollover array', () => {
    const thisWeek = ['2026-10-12'];
    buildRevenueWeekKeys(thisWeek, '2026-10-05');
    expect(thisWeek).toEqual(['2026-10-12']);
  });
  it('empty string viewed key is ignored', () => {
    expect(buildRevenueWeekKeys(['2026-10-12'], '')).toEqual(['2026-10-12']);
  });
});
