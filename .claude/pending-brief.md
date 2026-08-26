# Scope lock — pick a job's task from the job line on the Daily Log

Status: awaiting Trevor's approval.

## Build

On the Daily Log, a job line gets its own task picker so the search box is no
longer the way to add that job's pieces.

- Each job line in the day's Jobs section gets a `Task ▾` control on its right.
- It appears only when that job still has pickable pieces left — the same
  pieces `dayJobOptions()` already offers for that job, and no others.
- Tapping it opens a tick list in place, under the job line. Every remaining
  piece of that job, one per line, with a tickbox.
- Tick any number, confirm once, and all ticked pieces go on the day in one go
  — each through the existing `handlePickJob()` path, so the Weekly Log dot is
  written exactly as it is today.
- Tapping `Task ▾` again closes the list without placing anything.
- The existing search box stays, unchanged, for reaching a job that is not
  already on the day.

## Out of scope

- `dayJobOptions()`, `bookedOnDay()`, `weekRows()`, `matchesSearch()` — what
  counts as a pickable piece does not change.
- The Weekly Log, `scheduledSlots`, `calendarSlot`, the `jobs[]` shape.
- Typed day tasks, notes, the mark boxes, Remove.
- Auto-placing pieces when a job lands (that was Way 3 — rejected).

## Rules that bind it

- A booked, or ticked-off, piece is never offered. Same filter as now.
- Placing a piece must not overwrite a mark already in the week cell.
- No write reaches the Weekly Log through a split — only a job's own line.
- Nothing saves before the day and the week are `ready`.
- Phone first: the list scrolls in its own box and must not push the Tasks
  section off screen.

## Background only — do NOT open this to start the build

The three mockups Trevor chose from are in the session artifact; this is Way 1's
button with Way 2's tick list behind it. Everything needed to build is above.
