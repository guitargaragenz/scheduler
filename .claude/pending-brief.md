# Scope lock — day columns line up at any width

doc_status: live

Built and tested, awaiting Trevor's "yp" to commit. Display only.

Background only — do NOT open this to start work:
`docs/briefs/2026-08-26-day-columns-line-up.md`.

## Why this is not cosmetic

Trevor booked job 1730 onto Wednesday believing it was Thursday, because at
half-screen the day headings had drifted off the columns under them. A misread
column writes a mark to the wrong day, and nothing about the result looks wrong
afterwards. It cost a session chasing a phantom bug in the Daily Log.

## What changed

A heading and the cell under it stay lined up only while they shrink at the same
rate. Each grid gave one of them a shrink floor the other did not have.

- `BenchWeekPage.jsx` (Weekly Log, fixed-width columns) — `flexShrink: 0` on
  every `cellW`-wide element, so the container scrolls instead of compressing.
- `CalendarGrid.jsx` (Day view AND Week view — one component) — `minWidth: 0` on
  every `flex: 1` column and on the day heading, so the floors match.

No logic, no state, no data. `src/components/dayColumnAlignment.test.js` pins
both rules at source level and was confirmed to fail on the unfixed code.
764 tests green, build clean.

## Out of scope

No renaming, though the names do collide (Day view / Week view / Weekly Log /
Daily Log) — raised in the brief, not scoped. No Daily Log changes. Nothing
written to `jobs[]`, `scheduledSlots`, `calendarSlot` or `useSupabase.js`.

## Protocol

No blast-radius file touched — display only, two components. Council not run.
