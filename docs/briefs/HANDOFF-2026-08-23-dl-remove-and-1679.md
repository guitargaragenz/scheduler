---
doc_status: live
---
# Job 1679 will not come back onto the Daily Log — start here

Reported by Trevor 2026-08-22, at the end of the session that shipped `98692b3`.
Not yet diagnosed against live data. **Nothing is scoped — this is the next
piece of work, not an approved build.**

## What Trevor sees

Job 1679 does not appear on the Daily Log by itself when it is booked on the
Weekly Log. Every other job does.

Ruled out by him in his own words:

- **Not finished.** 1679 is not marked done, so `weekRows()` dropping done jobs
  is not it.
- **Booked and worked the day before.** So it is on the week, and it did appear
  at least once.

## The rule he wants, which the code does not follow

> "if I take job off via DL or WL I should be able to put it straight back on
> with no recourse"

Removing a job is "not today", never "never again". Putting it back must be
nothing more than booking it again.

**What the code actually does** (`DailyLogPanel.jsx`, `handleRemove`): a row
that appears by itself cannot simply be deleted — it would come straight back on
the next reload, because it is generated from the booking rather than stored. So
Remove writes a `hidden` day-item under that job's id for that date, and
`dayJobs` skips any id in `hidden` for good. Nothing ever clears it. Rebooking
does not clear it.

**That is the prime suspect for 1679**, and it is a real bug on Trevor's rule
regardless of whether it turns out to be 1679's cause.

## Check this first, against live data

1. Does `bench_day_marks` hold a `hidden` item for 1679 on the day in question?
   That confirms it in one query.
2. If not, walk `bookedOnDay()` (`DailyLogPanel.jsx:241`) for 1679: it needs
   1679 to be in `weekRows()` for the week on screen, AND either a part whose
   `calendarSlot` date matches the day, or a Weekly Log mark on that day.
3. Check the job's shape. `partsOf()` only finds a job's pieces when the job has
   `isSplit` or `hasSubtasks` set. A job whose pieces are not linked that way
   behaves differently from every other job — which would fit "only 1679".

## Likely fix, not yet agreed

Clear the `hidden` item whenever the job is booked onto that day again, so a
removal cannot outlive the booking that caused it. Decide with Trevor whether
Remove should instead expire at the end of the day, or get a visible undo.

## What shipped 2026-08-22 that touches this area

At `98692b3` (PR #39):

- No mark on a split reaches the Weekly Log any more — not `·`, `/`, `>` or `×`.
  The one exception is the `×` on the last uncrossed piece of a job. A job's own
  **header line** in the Daily Log is now the only DL row that drives the week.
- The erase option in both mark dropdowns no longer draws `·` and no longer sits
  first. **This was the cause of the vanishing Weekly Log rows** — it drew the
  identical `·` directly above the real dot mark, so picking one line too high
  wiped the cell, and a job held on the week only by its marks lost its row for
  good.
- The Daily Log has no erase option at all now, and an unmarked box rests on `·`.
- Taking a job off a day clears its Weekly Log cell, once its last line leaves
  that day.

## Facts worth keeping

- **The rows that already vanished are gone.** Those marks were really deleted
  from `bench_week_marks`. The fix stops it recurring; it cannot restore them.
- **`Sidebar.jsx:20` hides sub-tasks that are `scheduled`, NOT `pieceDone`.**
  Assuming the opposite has now cost two build rounds.
- **The Daily Log's job header line has no Remove button** — only the piece lines
  do. That is why the week cell clears on the last piece leaving, not on the
  header.

## Still open, unscoped

`loadWeekMarks()` (`utils/supabase.js`) does `select('*')` with no limit, so it
takes PostgREST's default 1000-row cap. `bench_week_marks` grows a row per job
per marked day and nothing prunes old weeks, so it will silently start losing
its oldest marks. Needs its own brief before it bites.

## How to work it

Ask Trevor before assuming which day and which screen he means. Check every
claim in this file against the live code and live data before building —
documents describe the past.
