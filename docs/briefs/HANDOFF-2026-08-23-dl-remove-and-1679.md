---
doc_status: live
---
# Taking a job off a day is permanent — and it shouldn't be

Job 1679 not showing on the Daily Log **was the original report and is now
fine** (Trevor, 2026-08-23). It came right on its own; nothing was changed for
it. The diagnosis notes for it have been deleted rather than left to be acted
on. What stays open is the underlying rule it made us look at.

## The rule the code doesn't follow

> "if I take job off via DL or WL I should be able to put it straight back on
> with no recourse"  — Trevor

Taking a job off a day means "not today", never "never again". Putting it back
should be nothing more than booking it again.

**What actually happens.** When a job appears on the day by itself, deleting it
can't just remove it — it would come back on the next reload, because the day
builds that line from the booking rather than storing it. So the delete leaves a
permanent "keep this off" note against that job and that date. Nothing ever
clears that note. Booking the job onto the day again does not clear it.

Since 1679 has resolved, nobody has actually hit this in anger — so it is a bug
on the stated rule, not a live complaint. Worth fixing, not urgent.

**Likely fix, not agreed:** clear the note whenever the job is booked onto that
day again, so a removal can't outlive the booking that caused it. Alternatives
to put to Trevor: have the removal expire at end of day, or give it a visible
undo.

Code: `DailyLogPanel.jsx` — `handleRemove` (~line 649) writes it, `dayJobs`
(~line 519) obeys it.

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
