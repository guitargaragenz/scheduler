---
doc_status: live
---

# Scope lock — DL auto-appear + day marks (approved 2026-08-19, revised 2026-08-20)

## Build

1. **Auto-appear.** A job booked on a day shows on that day by itself, read from
   each split's `calendarSlot`. Nothing stored to make it appear.
2. **The parts list shows bench splits.** A job split across benches is one line
   per split, with that split's own note under it.
3. **A removed job stays removed.** Remove on an auto row writes a `hidden` row
   in `bench_day_marks`; deleting the row can't work, because for an auto row an
   absent row is what makes it appear.
4. **One mark box down the left.** A single symbol per job row, in a column on
   the left — not a strip of boxes per row. Picked from a **dropdown**, never
   tap-cycled: clicking through symbols is tedious.
5. **`o` = event** joins the shared marks (`·` `/` `>` `×` `o`). It shows in the
   Weekly Log legend too. It does NOT join the WL tap cycle.
6. **Editable notes under a job**, like sub-tasks. Stored as extra rows in
   `bench_day_marks` (`note:<id>:<n>`, text in the existing `label`). No schema
   change.

## Out of scope

- **No editing of benches, splits or hours here** — "it's already there in day
  view and we don't need duplication".
- **No time or schedule picker.** The DL has no times and is not getting any.
- **No writes to `jobs[]`, `scheduledSlots` or `calendarSlot`.** Read only.
- **No card look.** Rows keep their plain styling — the cards were too big.

## Rules that bind this build

- Job state is read-only. The only things written are `week_marks` (the mark) and
  `bench_day_marks` (day rows and notes).
- The DL mark is its OWN mark, not the WL's. A DL row is usually a split or a
  task, not the whole job, so ticking it must never tick the job off the WL.
  The WL keeps the one master mark.
- Marks are keyed by the top-level job id, the same key the WL writes.
- Splits are shared, not per-day.
- Check every fact against the live code before acting on it.

## Protocol

Not blast-radius — no writes to job state — so this runs as a supervised direct
build on branch `dl-auto-appear`. Verify with the test suite plus a Vercel
preview click-through.

Background only, don't open it to start the build:
[docs/briefs/dl-booked-jobs-appear.md](../docs/briefs/dl-booked-jobs-appear.md)
