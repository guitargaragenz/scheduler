# Scope lock — pick a job's task from the job line on the Daily Log

Status: approved by Trevor 2026-08-26. Council passed, two reviewers.

## Build

On the Daily Log, a job line gets its own task picker, so the search box is no
longer the way to add that job's pieces.

- A `Task ▾` control on the job's own line — the group header where a job has
  splits, never on the indented split rows. Shown only while that job still
  has pickable pieces.
- Its pieces are found by top-level job id (`weekCellJobId(o.id, jobs)`), NOT
  by matching the `group` display string. Two jobs can read the same.
- Tapping it opens a tick list in place: that job's remaining pieces, one per
  line, from the same `dayJobOptions()` set the search box uses.
- Tick any number, confirm once. Each placement goes through the existing
  `handlePickJob()`, unchanged. It stops a piece before the Weekly Log write
  (`if (optJob?.parentId) return`), so placing pieces never touches the week.
  Only a job's own line does that, and this picker does not place jobs.
- Only one job's list is open at a time; opening another closes it.
- Tapping `Task ▾` again closes it without placing anything.
- The search box stays, unchanged, for reaching a job not already on the day.

## Out of scope

- `dayJobOptions()`, `bookedOnDay()`, `weekRows()`, `matchesSearch()` — what
  counts as a pickable piece does not change.
- The Weekly Log, `scheduledSlots`, `calendarSlot`, the `jobs[]` shape.
- Typed day tasks, notes, the mark boxes, Remove.
- Auto-placing pieces when a job lands (rejected).

## Rules that bind it

- A booked, or ticked-off, piece is never offered. Same filter as now.
- Placing a piece must not overwrite a mark already in the week cell.
- No write reaches the Weekly Log through a split.
- Nothing saves before the day and the week are `ready`.
- Phone first: the tick list scrolls in its own capped box and must not push
  the Tasks section off screen.

## Background only — do NOT open this to start the build

Council notes and the three mockups Trevor chose from are in the session
record. Everything needed to build is above.
