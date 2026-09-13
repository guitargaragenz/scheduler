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
  // Brief H, Build 2b: the stored-`days` fallback arm is gone. The signature is
  // now (firstSeen, now) — the old middle argument was storedDays, and the
  // second positional slot is the CLOCK. The cases below pin that, because a
  // call site left un-updated would pass a small integer like 412 as `now` and
  // compute every age against a bogus date with nothing visibly broken.

  it('computes the age from first_seen', () => {
    // Job 97 exactly: the database's stored number on this date was 3159 and
    // the real answer is 3162. Nothing stored can win any more — there is
    // nothing stored left to win.
    expect(jobAgeDays('2017-12-01', at(2026, 7, 29))).toBe(3162);
  });

  it('shows no age for a job with no date, rather than a stale stored one', () => {
    // The deliberate trade made when the fallback went. A job with no
    // first_seen shows nothing at all — expected for a brand-new job the Jobs
    // PDF introduced before the next Jobs-by-Age drop.
    expect(jobAgeDays(null, at(2026, 7, 29))).toBeNull();
    expect(jobAgeDays(undefined, at(2026, 7, 29))).toBeNull();
    expect(jobAgeDays('', at(2026, 7, 29))).toBeNull();
  });

  it('counts a job booked in today as 0, not null', () => {
    // 0 and "unknown" must stay different facts on the card and in the sort.
    expect(jobAgeDays('2026-07-29', at(2026, 7, 29))).toBe(0);
  });

  it('treats its second argument as the clock, not as a stored age', () => {
    // The guard against a half-updated call site. Under the old three-argument
    // signature this call meant "no date, stored age 412" and returned 412.
    // It must now be read as a date and rejected, never as a number of days.
    expect(jobAgeDays(null, 412)).toBeNull();
  });
});
