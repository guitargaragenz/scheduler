# Scope lock — a row crossed off stops being offered

Status: awaiting Trevor's approval, 2026-08-26.

## Build

The Daily Log picker keeps offering work that has been crossed off. It only
hides a line carrying `pieceDone`, and `pieceDone` is only ever written for a
split — so every UNSPLIT job comes back forever, however often it is crossed.

- `dayJobOptions()` also takes the day marks, and drops any part whose latest
  mark across all days is `'cross'`.
- `latestDayMarks(dayItems)` already returns exactly that map, keyed by row id.
  Use it; do not build a second one.
- `pieceDone` stays as an independent check alongside it, not replaced — a
  piece ticked on the board still drops out.
- One change, so `Task ▾` and the search box hide the same lines.

## Out of scope

- `handleSetMark()` and what a mark writes. A × writes what it writes today.
- `bookedOnDay()` — a booked row belongs on its day, crossed or not.
- The Weekly Log, `scheduledSlots`, `calendarSlot`, the `jobs[]` shape.
- Making an unsplit job's × mean the job is `done`. It does not.
- Backfilling or un-crossing anything already in the data.

## Rules that bind it

- A cross is not the job closing. Nothing here sets `done` or writes to the
  week. Trevor closes a job by hand in the Weekly Log.
- Taking the × off puts the row back, live, with no reload. That is the undo.
- `/` and `>` rows are still offered. Only `×` hides a row.

## Background only — do NOT open this to start the build

The diagnosis, the exact line numbers and the 8-item checklist are in
`docs/briefs/2026-08-26-a-crossed-row-stays-crossed.md`. Everything needed to
build is above.
