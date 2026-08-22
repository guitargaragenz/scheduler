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
- The job header row's own mark is unchanged.
- `pieceDone` keeps its existing rule exactly: it moves only as a `×` arrives or
  leaves, and only for a split's child.
- Clearing a `×` off the last split clears the cell it wrote.

## Build B — a closed job stops disappearing off the week

- A done job stays on the week it was completed, read from its `completed_jobs`
  record. The `close:<monday>` mark stops being what keeps it there.
- No second copy of "this job finished this week" anywhere.
- The trailing column keeps its current behaviour and stays the only place a job
  is closed and an invoice asked for.
- A done job with no completion record still drops off, as it does now.

## Out of scope

Anything else on the Weekly or Daily Log. No new table, no schema change.
Not `git revert 87dad26` — the dropdowns stay.

## Rules that bind this build

- Full protocol: council, builder, verifier, browser test.
- Every test renders the page and changes a real cell. Helper-only tests have
  passed through every failure this page has ever shipped.
- Check facts against the code, not against the handoff.
