// Job age, computed rather than stored. Brief G, Build 1c.
//
// Age used to be a number Multitrack told us once and the database kept
// forever. A number does not tick: the database said job 97 was 3159 days old
// while Multitrack's own printout said 3162, and with the CSV sync gone it
// would have stayed at 3159 permanently. A DATE ticks on its own, so the age is
// worked out fresh on every load from the day the job came in the door.
//
// Its own file rather than a few lines in useSupabase.js, because this is date
// arithmetic in a timezone that breaks the obvious implementation, and it needs
// to be testable without a database.

import { localDateKey } from './calendar.js';

const MS_PER_DAY = 86400000;
const DATE_KEY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Whole days between a YYYY-MM-DD date and today, in NZ local terms.
 * Returns null for anything unparseable, never 0 or NaN — an unknown age and a
 * job booked in this morning are different facts and must stay different.
 *
 * Two deliberate choices, both of which are wrong in the obvious version:
 *
 * 1. TODAY comes from localDateKey(), NOT toISOString().slice(0,10). NZ runs
 *    UTC+12/+13, so for roughly half of every day the UTC date is already
 *    tomorrow and the naive version reports every job in the workshop as a day
 *    older than it is. src/utils/calendar.js:1-2 carries the same warning; this
 *    reuses that helper rather than repeating the mistake in a new place.
 *
 * 2. The subtraction runs in UTC on the two LOCAL calendar dates, via Date.UTC.
 *    Local midnights are 23 or 25 hours apart across a daylight-saving
 *    boundary, so subtracting two local Date objects and dividing by 86400000
 *    lands a day out twice a year. Pinning both endpoints to UTC noon-free
 *    midnights makes every day exactly 24 hours long, which is what "how many
 *    days ago" actually means to a service tech.
 */
export function daysSinceDateKey(dateKey, now = new Date()) {
  const start = DATE_KEY_RE.exec(String(dateKey ?? '').slice(0, 10));
  if (!start) return null;
  const end = DATE_KEY_RE.exec(localDateKey(now));
  if (!end) return null;

  const startUtc = Date.UTC(Number(start[1]), Number(start[2]) - 1, Number(start[3]));
  const endUtc = Date.UTC(Number(end[1]), Number(end[2]) - 1, Number(end[3]));
  return Math.round((endUtc - startUtc) / MS_PER_DAY);
}

/**
 * The age to show for a job: computed from its first_seen date, and from
 * nothing else.
 *
 * Build 1c shipped this with a second arm that fell back to whatever number
 * was last stored in the `days` column, so the app kept every job's existing
 * age before a single Jobs-by-Age file had been dropped. Brief H, Build 2b
 * removed that arm: checked against the live table first, every row with a
 * stored age also had a date, so no job on the board lost an age.
 *
 * The `days` COLUMN still exists in the database and is deliberately left
 * there holding stale values nobody updates — a dead column costs nothing and
 * a dropped one cannot be un-dropped. The app simply no longer reads or writes
 * it. `job.days` in app shape is now always this computed figure.
 *
 * A job with no first_seen returns null and shows no age at all. With no
 * fallback left that is now the only behaviour, and it is the accepted trade,
 * not a bug to go and fix: a job that loses its date shows nothing rather than
 * something quietly wrong.
 */
export function jobAgeDays(firstSeen, now = new Date()) {
  return daysSinceDateKey(firstSeen, now);
}
