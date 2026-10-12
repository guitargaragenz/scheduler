---
doc_status: live
---
# Lock — Daily Log marks on admin tasks reach the Weekly Log

Trevor, 2026-10-12: "admin typed jobs in daily : adding action marks doesn't change in weekly". Approved "yp".

Cause: `handleSetMark` (`DailyLogPanel.jsx`) finds the week cell via `weekCellJobId`, which only knows
jobs[]. A typed admin row has no job, so it answers null and the week write is skipped.

## Build

- New pure helper `typedWeekCellId(rowId, weekKeys, marks)`: returns the id when it is a typed row
  that this week's Weekly Log carries (its week key decodes via `decodeTypedRow`), else null.
- `handleSetMark` uses `weekCellJobId(...) ?? typedWeekCellId(...)`. Typed rows pass straight to
  `setWeekMark` like a job's own row (last pick wins, clearing clears).
- Unit test the helper.

## Not in scope

- Typed tasks made on the Daily Log only (no week row) — unchanged, day mark only.
- Removing a line, notes, pieceDone, splits. `useSupabase.js`, `utils/supabase.js`, jobs[] shape.
