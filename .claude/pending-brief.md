---
doc_status: live
---
# Scope lock — two Weekly Log regressions

Why each is happening, and how it was pinned down, is in
[docs/briefs/HANDOFF-2026-08-22-wl-regressions.md](../docs/briefs/HANDOFF-2026-08-22-wl-regressions.md)
— **background, don't open it to start the build.**

## Build A — a finished piece stops closing the whole job

- A `×` on a split in the Daily Log writes **nothing** to the Weekly Log —
  unless it is the last split of that job still without a `×`, in which case it
  writes `cross` to that day's cell as it does now.
- Trevor's words: *"any subtasks with x shld show nothing on WL unless it's the
  last subtask of job in which case it marks an x. The job is then closed
  manually by me in WL with second x."*
- The job header row's own mark is unchanged: last pick wins, as now.
- "Last split" is decided by the Daily Log's own marks, NOT by `pieceDone`.
- Comment why the write is suppressed, so a later session doesn't undo it.
- `pieceDone` keeps its existing rule exactly: it moves only as a `×` arrives or
  leaves, and only for a split's child.
- Clearing a `×` off the last split clears the cell it wrote.

## Build B — picking `·` stops wiping the cell

Root cause found 2026-08-22 in `87dad26`, the commit Trevor pointed at.

- Both mark dropdowns render `<option value="">·</option>` and then every
  `MARKS` entry — so the **erase** option and the **dot** option both draw `·`,
  erase first. Picking the wrong one clears the cell instead of setting it.
- A job with no booking that week is held on the page only by its marks
  (`weekRows()` line ~260), so clearing its last mark drops the row for good.
- **The rule applies to both grids, same fix in both:**
  `BenchWeekPage.jsx:832` and `DailyLogPanel.jsx:315`. Blank must not read as
  `·`, and must not sit first in the list.
- `weekRows()`, `trailing()`, `ruleOff()` and the close mark are NOT touched —
  the earlier Build B chased the wrong cause and is dropped.

## Out of scope

Anything else on the Weekly or Daily Log. No new table, no schema change.
Not `git revert 87dad26` — the dropdowns stay.

## Rules that bind this build

- Full protocol: council, builder, verifier, browser test.
- Every test renders the page and changes a real cell. Helper-only tests have
  passed through every failure this page has ever shipped.
- Check facts against the code, not against the handoff.
