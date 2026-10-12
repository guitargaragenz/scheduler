---
doc_status: live
---
# Scope lock — week revenue loads for whichever week is on screen

Previous lock (typed rows on Daily Log) is in git at `ff699cf`, merged `e5105cd`.

Trevor, 2026-10-12: "previous weeks show nothing at all" — then: "how about it d/ls on demand?"

Cause: `useJobs.js:131` loads `completed_jobs` for the current week only (`recentWeekKeys(1)`).
The header (`App.jsx:608-609`) filters by the *viewed* week's key, so any other week finds nothing.

## Build (one merge)

- In App, compute the viewed-week key from `weekDays` (state, `App.jsx:96`) **above** the `useJobs`
  call (`App.jsx:446`), and have line 608 reuse it. Don't reference the line-608 const at 446 (crash).
- Pass it to `useJobs` as a new optional argument. Undefined = this week only (keeps
  `useJobsPieceDone.test.jsx:85` passing).
- Final keys = rollover-tracked this-week key + viewed key, deduped, derived (don't put the viewed
  key into the rollover state). Effect depends on a stable string (e.g. `keys.join(',')`).
- Keep the rollover check, `cancelled` flag and `state === null` skip unchanged.
- Extract the key-building as a pure function and unit-test it.
- While an old week loads, this week stays shown; the past week reads $0 until it fills. Accepted.

## Not in scope

- `src/utils/supabase.js` — `loadCompletedJobs(weekKeys)` already takes any key list; don't edit it.
- `useSupabase.js`, `useGoogleCalendar.js`, `scheduledSlots`, `calendarSlot`, `jobs[]` shape.
- Revenue target, breakdown popup styling, colours. Loading more than these two weeks.
- Close Day / Catch Up only see loaded weeks (this + viewed). Not "history is loaded" — say so.

## Verifier checklist

1. Viewing last week shows its total, matching `completed_jobs` rows for that week_key.
2. Breakdown popup on a past week lists that week's records.
3. Back on this week, total is the same as before the change.
4. This week's done jobs stay done while viewing another week.
5. Flipping weeks triggers no write to `completed_jobs`.
6. Rollover check (`useJobs.js:137-152`) still present.
7. Every `completedJobs` reader filters by week or looks up by id (App 609, 1220 via weekRevenue;
   CloseDayModal 235; CatchUpInterview 79; useJobs 412) — nothing sums the whole list.
8. Viewed key is computed before `useJobs` at App 446; no use-before-declare.
9. Browser: flip weeks fast 5×, land on last week — right total, no console channel errors.
10. Browser: after flipping, tick a job — total updates once.
11. No edits to not-in-scope files. Full suite passes; new unit test for key building.

## Background (don't open to start work)

Council record: [docs/briefs/week-revenue-on-demand.md](../docs/briefs/week-revenue-on-demand.md)
