---
doc_status: closed
---

# Closed — shipped at `57d9138`. A second × can't undo an invoiced close — cause, rulings, checklist

Scope lock: `.claude/pending-brief.md`.

## Cause

`BenchWeekPage.jsx:297` hides a `done` job unless this week's close mark (`close:<monday>`) is
set. `handleClose` clears that mark on a second tap (`:948-950`) but never un-finishes the job,
so it drops off. Job 1726: `bench_week_marks` holds its day × (`2026-09-28`) but no
`close:2026-09-28` row; its revenue row `cj-1726` has `week_key 2026-09-28`.

## Council rulings (2026-09-29, both reviewers: NOT YET on the first plan)

The first plan showed a done job by matching its revenue `weekKey`. Rejected: `useJobs.js:131`
loads only this week's revenue (`recentWeekKeys(1)`), so it could not cover past weeks; and a
second gate at `:311` would still have hidden the row. Both reviewers proposed this plan instead:
block the second tap, restore 1726's mark once as data. Trevor approved the switch.

## Round 2 rulings (2026-09-29)

Both reviewers: Clear/Close are already inert on a closed row; the real second door is
`handleRemove` (clears the close key). Scan found 11 of 33 jobs finished since August with no
close mark for their week (jobs finished via `App.jsx:136`, not the Week page ×). Trevor chose
to restore all 11, then a Round 3 Opus review (approved by Trevor) showed my scan was wrong for 10 of
them: 8 finished 4-13 Aug before the close column existed; 1632/1740 already have `close:2026-08-31`
(restoring would show them on two weeks). Only 1726 is a lost mark. Scope cut back to 1726.

## Verifier checklist

1. Done job, closed, tap × → mark stays, toast shows, row stays, nothing written.
2. Not-done job, close mark set, tap × → mark clears as before.
3. Remove on a done job → refuses with toast, close mark untouched. Remove on a not-done job works as before.
4. `fix_1726_close_mark.mjs` dry run prints one row and writes nothing; `--apply` adds only
   `(1726, close:2026-09-28, closed)`; a re-run refuses.
5. Week of 2026-09-28 shows 1726 closed, struck through, red line to the ×.
6. No edits to any out-of-scope file; diff is Week page, its test, the script.
7. New unit tests cover 1–3; full suite passes, real numbers reported.
