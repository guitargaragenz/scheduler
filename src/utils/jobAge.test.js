import { describe, it, expect } from 'vitest';
import { daysSinceDateKey, jobAgeDays } from './jobAge.js';

// Local noon, so nothing here depends on the machine's timezone offset.
const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h, 0, 0);

describe('daysSinceDateKey', () => {
  it('matches Multitrack: job 97, in on 2017-12-01, is 3162 days old on 2026-07-29', () => {
    // The verification criterion for Build 1c, straight from the real JBA
    // export. The database's stored value on that date was 3159.
    expect(daysSinceDateKey('2017-12-01', at(2026, 7, 29))).toBe(3162);
  });

  it('counts a job booked in today as 0, not 1 and not null', () => {
    expect(daysSinceDateKey('2026-07-29', at(2026, 7, 29))).toBe(0);
  });

  it('counts yesterday as 1', () => {
    expect(daysSinceDateKey('2026-07-28', at(2026, 7, 29))).toBe(1);
  });

  it('is stable across a whole NZ day — no off-by-one at either midnight edge', () => {
    // The bug this guards is toISOString(): at 11am NZDT the UTC date is
    // already tomorrow, so a naive implementation reads a day older here and a
    // day younger just after local midnight. Every hour of the day must agree.
    const ages = [];
    for (let h = 0; h < 24; h++) ages.push(daysSinceDateKey('2026-07-01', at(2026, 7, 29, h)));
    expect(new Set(ages)).toEqual(new Set([28]));
  });

  it('does not gain or lose a day across the NZ daylight-saving switch', () => {
    // NZDT ends the first Sunday in April; local midnights are 25 hours apart
    // over it. Subtracting two local Date objects would report 30 days here.
    expect(daysSinceDateKey('2026-03-15', at(2026, 4, 14))).toBe(30);
    // And the September switch the other way, where the gap is 23 hours.
    expect(daysSinceDateKey('2026-09-01', at(2026, 10, 1))).toBe(30);
  });

  it('spans leap years correctly', () => {
    expect(daysSinceDateKey('2024-02-28', at(2024, 3, 1))).toBe(2);
  });

  it('returns null for a missing or unreadable date rather than 0', () => {
    // 0 would read on the card as "booked in today", which is a lie about a
    // job whose date we simply do not have.
    expect(daysSinceDateKey(null)).toBeNull();
    expect(daysSinceDateKey(undefined)).toBeNull();
    expect(daysSinceDateKey('')).toBeNull();
    expect(daysSinceDateKey('not a date')).toBeNull();
    expect(daysSinceDateKey('01/12/2017')).toBeNull();
  });

  it('accepts a full timestamp, in case the column ever comes back as one', () => {
    expect(daysSinceDateKey('2026-07-28T00:00:00+12:00', at(2026, 7, 29))).toBe(1);
  });
});

describe('jobAgeDays', () => {
  it('prefers the computed age over the stored number', () => {
    // Job 97 exactly: stored 3159, real answer 3162. The stored value is stale
    // by definition and must never win.
    expect(jobAgeDays('2017-12-01', 3159, at(2026, 7, 29))).toBe(3162);
  });

  it('falls back to the stored days while a job has no date yet', () => {
    expect(jobAgeDays(null, 412, at(2026, 7, 29))).toBe(412);
  });

  it('coerces a stored value that came back from PostgREST as a string', () => {
    expect(jobAgeDays(null, '412', at(2026, 7, 29))).toBe(412);
  });

  it('keeps a genuine 0-day stored age as 0, not as unknown', () => {
    expect(jobAgeDays(null, 0, at(2026, 7, 29))).toBe(0);
  });

  it('shows no age for a job with neither — expected for a brand-new PDF job', () => {
    expect(jobAgeDays(null, null, at(2026, 7, 29))).toBeNull();
  });
});
