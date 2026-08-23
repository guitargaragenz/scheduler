---
doc_status: live
---
# Scope lock — putting a job back on a day

Approved by Trevor 2026-08-24 ("yp"). Background lives in
`docs/briefs/HANDOFF-2026-08-23-dl-remove-and-1679.md` — that is history,
do NOT open it to start this build.

## Build 1 — booking a job onto a day undoes an earlier removal

Today, removing a job from the Daily Log leaves a "keep it off" note against
that date. Booking the job onto the same day on the Weekly Log does not clear
it, so the job stays off for the rest of the day. Tested by Trevor 2026-08-24.

- When a job is booked onto a day it was removed from, that day's hidden note
  for it is cleared and the job appears again.
- The note stays date-keyed. Other days are untouched.

## Build 2 — adding a job to the day puts a dot in the week

Adding a job on the Daily Log currently writes nothing to the Weekly Log.

- `handlePickJob` also writes the `dot` mark to that job's Weekly Log cell for
  that date, via the same path `handleSetMark` uses.
- Only when the week is ready to write. Never overwrite a cell that already
  holds a mark.
- A split follows the existing rule: no split write reaches the Weekly Log.

## Out of scope

- Any change to what a removal does, beyond it being undoable.
- Marks, symbols, dropdowns, the close cross, the invoice prompt.
- `scheduledSlots`, `calendarSlot`, job state, the board's tick.
- The unscoped `loadWeekMarks()` 1000-row cap.

## Rules that bind this

- Trevor's rule: taking a job off a day means "not today", never "never again".
- The Daily Log drives the Weekly Log; a removal clears the week cell.
- Full suite green and production build clean before the verifier sees it.
