---
doc_status: parked
---
# The Weekly Log only reads its first 1000 marks

Parked by Trevor 2026-08-23 for a month. **Not scoped, not approved — this is a
note to pick up, not a build.**

## What is wrong

`loadWeekMarks()` in `src/utils/supabase.js` reads `bench_week_marks` with
`.select('*')` and no limit and no order, so it takes PostgREST's default cap of
1000 rows.

The table gains a row per job per marked day, and rows only ever leave when a
cell is cleared by hand (`clearWeekMarks`, via `clearJobKeys`). Nothing prunes
old weeks, so it grows for as long as the workshop runs. The number of jobs on
the bench does not bound it — 90 jobs at once is fine; it is the weeks adding up
that fills it.

## What happens when it fills

No data is deleted. The database keeps every row; the app simply stops fetching
past the first thousand, and the marks it does not fetch draw as empty cells.

Because the read names no order, WHICH thousand come back is the database's
choice. In practice that tends to be the oldest, which means the newest marks
are the ones that disappear — current weeks going blank, not old ones. The risk
is Trevor looking at a week that is silently wrong and marking it again over the
top.

## Rough timing

The table started 2026-08-13. At something like 50 rows a week it reaches 1000
around January 2027. That is an estimate off an assumed marking rate, not a
measurement — **one count query against the live table turns it into a real
date, and that is the first thing to do when this comes off the park.**

## The fix, agreed in principle 2026-08-23, not designed

Fetch only the weeks on screen, the way `loadCompletedJobs(weekKeys)` already
does for the revenue records — same file, same shape, no new table.

The catch, and the reason this is not a two-line change: the app reads the marks
once and holds them. Fetching per week means it must also re-fetch when Trevor
pages back to an older week, without the empty-vs-not-loaded confusion that
`loadWeekMarks()` returning `null` versus `{}` already guards against.

## How it has to be built

`src/utils/supabase.js` is a blast-radius file. Full agent-team protocol —
brief, council, builder, verifier, browser test — on a session where this is the
whole job, not tacked onto the end of something else.
