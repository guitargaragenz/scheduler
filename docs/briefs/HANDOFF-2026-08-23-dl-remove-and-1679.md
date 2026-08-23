---
doc_status: live
---
# Taking a job off a day is permanent — and it shouldn't be

Job 1679 not showing on the Daily Log **was the original report and is now
fine** (Trevor, 2026-08-23). It came right on its own; nothing was changed for
it. The diagnosis notes for it have been deleted rather than left to be acted
on. What stays open is the underlying rule it made us look at.

## The rule the code doesn't follow — narrower than first written

> "if I take job off via DL or WL I should be able to put it straight back on
> with no recourse"  — Trevor

**Corrected 2026-08-24 against the code.** The "keep this off" note the delete
leaves behind is stored **against that one date**, not against the job. So it
only ever affects the day you removed it on. The next day is clean, and the job
appears there normally.

So the bug is: *take a job off today, and you cannot put it back on today.*
Not "gone forever". Everything below that read as permanent was wrong.

That is a small, one-day annoyance rather than data loss, and it explains why
nobody has been bitten by it.

**Likely fix, not agreed:** clear that day's note when the job is booked onto
the same day again. Alternatives to put to Trevor: let it expire at end of day
(it effectively already does), or give the removal a visible undo.

Code: `DailyLogPanel.jsx` — `handleRemove` (~line 649) writes it keyed by
`dateKey`, `hidden` (~line 508) reads only that day's items.

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
