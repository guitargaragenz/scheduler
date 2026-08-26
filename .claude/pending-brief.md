# Record — day columns line up at any width (SHIPPED, not pending)

doc_status: closed

**Nothing is pending. This is a record, not a task list.** Shipped 2026-08-26 at
`509507e` (PR #53). Do not build from this file.

The full record — the false alarm it came out of, the cause in both grids, and
the two things found but not fixed — is in
`docs/briefs/2026-08-26-day-columns-line-up.md`, `doc_status: closed`.

## What shipped

`flexShrink: 0` on every fixed-width Weekly Log column; `minWidth: 0` on every
proportional calendar column and its heading. Display only. 764 tests green.

## Worth carrying forward

- **Column alignment is a data correctness property, not a cosmetic one.** A
  heading drifting off its column made Trevor book job 1730 onto Wednesday
  believing it was Thursday. The app did what he asked; the screen lied about
  what he was asking, and the result looked fine afterwards. It then presented
  as a phantom Daily Log bug and cost most of a session.
- **Day view and Week view are ONE component.** `CalendarGrid.jsx` fed `weekDays`
  — one day or seven (`App.jsx:952`). A fix to one is a fix to both.
- A heading and its cell are separate flex items in separate rows. They stay
  lined up only while they shrink at the same rate — never give one a shrink
  floor the other lacks.
