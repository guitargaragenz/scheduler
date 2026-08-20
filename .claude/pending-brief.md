---
doc_status: live
---

# Scope lock — the Daily Log drives the Weekly Log

**Council run 2026-08-20; both reviewers' changes are folded in below.** Replaces
"one tick, one truth" (Trevor's redirect): the D Log gives the instruction, the W
Log carries it out, so nothing has to stay in sync. Background:
[dl-splits-one-truth.md](../docs/briefs/dl-splits-one-truth.md) — **background
only; don't open it to start the build.**

## Build 1 — carry, and the done tick

1. **Action symbols on every D Log row** — jobs, splits and hand-typed tasks alike.
   The one that matters: **carry this to the next day.**
2. Carrying a job or split writes a **W Log day mark on the next day**, under the
   **top-level job id** — never a split's own id, which `weekRows()` never draws.
3. **A carry never overwrites.** Tomorrow's cell already marked → say so, leave it.
4. Carrying a **task** (no W Log row) copies it to the next day's D Log under a
   fresh `newDayTaskId()`; today's row is untouched.
5. `×` on a split row sets that split's **`pieceDone`**; moving the mark to
   anything else — blank, `·`, `/`, `>` — clears it. Only `×` means finished.

## Build 2 — the indented layout (after Build 1)

Splits sit **under their job**, indented, each markable on its own; the job's line
carries its own mark, never derived from its splits. Today the D Log has no job
line at all, only part rows — new rows, not a restyle.

## Rules that bind the build

- **Prerequisite:** thread `parentJobId` through the D Log's rows — `handleMarkPieceDone`
  needs it, and today's rows carry `{id, label, auto}` only. No new table or column.
- **`weekMarks.setMark` isn't passed to `DailyLogPanel` today** — new plumbing, and
  it must check `weekMarks.ready` first: `setMark` returns `ok:false` silently on an
  unloaded week, and a silent tap is this project's own past failure.
- **The D Log must not raise the invoice prompt** — omit `onAllPiecesDone`.
  Invoicing stays the W Log's final-column `×`, by hand.
- **A carry writes a booking, never a done flag** — and never the W Log master mark.

## Not in scope

- The whole-job `done` flag, `handleMarkDone`, `completed_jobs`, revenue, invoices.
- `calendarSlot`, `scheduledSlots`, `jobs[]` beyond the existing `pieceDone` write.
- A board tick reaching back into the D Log.
## Protocol

Blast-radius. Council done. Next: `ggnz-builder`, `ggnz-verifier` (must include a
rendered click on the carry symbol, week loaded and not), browser test, merge.
