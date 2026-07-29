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
 * The age to show for a job: computed from its first_seen date when we have
 * one, otherwise whatever number was last stored in the `days` column.
 *
 * The fallback is what makes this safe to ship before a single JBA file has
 * been dropped. Every job keeps the age it shows today, and each one switches
 * over to the live, self-ticking figure the moment its date arrives. A job with
 * neither — a brand-new job introduced by the Jobs PDF before the next JBA drop
 * — returns null and shows no age at all. That is today's behaviour for such a
 * job, unchanged by this build, and it is not a bug to go and fix.
 *
 * The stored `days` column and preserveKnownDays() both stay until every job
 * has a first_seen; removing them is Build 2.
 */
export function jobAgeDays(firstSeen, storedDays, now = new Date()) {
  const computed = daysSinceDateKey(firstSeen, now);
  if (computed != null) return computed;
  return storedDays == null ? null : Number(storedDays);
}
