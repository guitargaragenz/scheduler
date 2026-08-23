---
doc_status: closed
---
# Taking a job off a day is permanent — FIXED

Shipped 2026-08-23 on PR #42. Trevor tested all three cases on the preview and
confirmed they work. This document is history now; nothing in it is a task.

Job 1679 not showing on the Daily Log was the original report and came right on
its own, with no change made for it.

## What was wrong, and what fixed it

> "if I take job off via DL or WL I should be able to put it straight back on
> with no recourse"  — Trevor

Removing a job from the Daily Log left a "keep it off" note against that date,
and booking the job back onto the same day did not clear it. Scope was narrower
than first written: the note is keyed to the DATE, not the job, so it only ever
affected the day it was made on — the next day was always clean.

Fixed both directions:

- Booking a job onto a day now clears that day's note, so a removal cannot
  outlive the booking that follows it. Only `hidden` items are cleared; a job
  put on the day by hand is left alone.
- Putting a job on the Daily Log now writes a dot to its Weekly Log cell, so
  the two logs agree whichever one the job is booked on. Splits still write
  nothing to the week, and a cell that already holds a mark is left as it is.

Code: `BenchWeekPage.setCell` → `onBookedOnDay`, wired in `App.jsx`; and
`handlePickJob` in `DailyLogPanel.jsx`.

## Facts worth keeping

- **The vanished Weekly Log rows are partly recoverable.** The deletion only hit
  the Weekly Log's own marks. The Daily Log's marks and the revenue records were
  never touched and still hold the same days, so most cells could be rebuilt.
  Genuinely gone: a mark made only on the Weekly Log, by hand, on a job with no
  Daily Log entry and no invoice. Nobody has queried the live tables yet, so the
  size of that slice is unknown.
- **`Sidebar.jsx:20` hides sub-tasks that are `scheduled`, NOT `pieceDone`.**
  Assuming the opposite has cost two build rounds.
- **The Daily Log's job header line has no Remove button** — only the piece lines
  do. That's why the week cell clears when the last piece leaves the day, not on
  the header.

## What shipped 2026-08-22 (`98692b3`, PR #39)

- No mark on a split reaches the Weekly Log any more. The one exception is the
  `×` on the last uncrossed piece of a job. A job's own header line in the Daily
  Log is the only line that drives the week.
- The erase option in the mark dropdowns no longer draws `·` and no longer sits
  first. **That was the cause of the vanishing Weekly Log rows** — it drew the
  same `·` directly above the real dot, so picking one line too high wiped the
  cell.
- The Daily Log has no erase option at all; an unmarked box rests on `·`.
- Taking a job off a day clears its Weekly Log cell once its last line leaves.

## Still open, unscoped

`loadWeekMarks()` (`utils/supabase.js`) reads with no row limit, so it takes the
database's default cap of 1000 rows. That table grows a row per job per marked
day and nothing prunes old weeks, so it will quietly start losing its oldest
marks. Needs its own brief before it bites.

## How to work it

Check every claim here against the live code and live data before building —
documents describe the past.
