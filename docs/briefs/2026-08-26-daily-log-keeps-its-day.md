---
doc_status: closed
---
# The Daily Log must keep its own day

**Closed 2026-08-26 — shipped at `e749456` (PR #45).**

Written 2026-08-26, after Trevor reported that finishing a job makes its lines
disappear off the Daily Log.

## What is wrong

The Daily Log does not hold its own list of what was on a day. For automatic
rows it asks the Weekly Log's row builder, `weekRows()` in
`BenchWeekPage.jsx:229`, and draws that day's lines out of the answer.

`weekRows()` drops finished jobs on purpose (`BenchWeekPage.jsx:245`):

    if (job.done && !closedThisWeek) continue;

Correct for the Weekly Log — a closed job should not clog next week's page.
Wrong for the Daily Log, which inherits the drop through `bookedOnDay()`
(`DailyLogPanel.jsx:241`) and loses the day's record with it.

Two ways it shows up:

1. **Ticked done anywhere but the Weekly Log** — Daily Log ×, job card, Pomo
   drawer, close-day modal. The `closedThisWeek` grace only exists for a job
   closed by hand in the Weekly Log; that is the only place writing the close
   mark (`BenchWeekPage.jsx:625`). Everything else makes the row vanish at once.
2. **Any past day.** Worked Monday, finished a fortnight later — Monday's page
   loses the line for good, because the close mark belongs to the week the job
   was closed in, not the week it was worked.

The code already says this must not happen. `DailyLogPanel.jsx:171` states
plainly that `bookedOnDay()` deliberately does not filter, because hiding a
finished piece "would erase the day's record of the work". The filter one level
up does it anyway.

## What is NOT wrong — no data has been lost

`bench_day_marks` (date_key, item_id, kind, label) holds every mark, note and
hand-added row. Hand-added rows are drawn straight from those entries
(`DailyLogPanel.jsx:526`) and survive the job finishing. Only automatic rows
vanish, because they were never stored as rows — they are recomputed on every
open. Their marks and notes stay in the table, orphaned but intact, and would
redraw if the row came back.

So this is a display bug with a full record still underneath it.

## The fix

A day is a record of what happened. Nothing that was ever on a day should leave
it. Stop the Daily Log inheriting the Weekly Log's done-filter.

`bookedOnDay()` must find its rows without being subject to `weekRows()`'s
`job.done` drop — either its own row walk, or a flag through `weekRows()` that
keeps done jobs for this caller only. Council picks which; both are the same
change in effect and neither alters what the Weekly Log draws.

A finished job's line stays on the day, struck through, exactly as a job closed
in the Weekly Log already stays on that week.

### Deliberately NOT part of this build

Trevor's call, 2026-08-26: fix the disappearing, nothing else.

Storing automatic rows in `bench_day_marks` was the other candidate. It would
make the day a real stored record, which matters because the table today holds
almost nothing readable — a mark row is `mark:1714-ST` with an `x`, so it says
that something was ticked but not what the work was. That is a real gap and it
stays open. It is not this build.

## Rules that bind this build

- **The Weekly Log's behaviour must not change.** A finished job still drops off
  the week. `weekRows()` is shared; whatever is done must not change what the
  Weekly Log draws.
- **Never delete from `bench_day_marks`.** No clear-and-reinsert, no wipe.
- No writes to `jobs`, `scheduled_slots` or `calendarSlot`. Closing a job stays
  where it is — the invoice prompt. The Daily Log has no second route into job
  state (`supabase.js` day-marks section says so).
- A completed job never comes back under the same number, so nothing here needs
  to handle a finished job resuming.

## Out of scope

- Storing the day's automatic rows (see above) — the record stays as thin as it
  is today.
- The Weekly Log's 1000-row cap (parked, `PARKED-2026-08-23-week-marks-row-cap.md`).
- Any change to how or where a job is marked done.
- Pruning old day marks.

## Verification checklist

1. Tick a job done from the Daily Log — its line stays on the day, struck through.
2. Same from the job card, the Pomo drawer and the close-day modal.
3. A job worked in an earlier week and finished later — the earlier day still
   shows the line.
4. Marks and notes on a finished job's line still show, and still save.
5. The Weekly Log still drops finished jobs from next week's page.
6. A job closed by hand in the Weekly Log still stays on that week, struck through.
7. Hand-added rows and typed tasks unchanged.
8. Full test suite green.
