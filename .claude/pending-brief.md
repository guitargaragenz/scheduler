---
doc_status: live
---

# Scope lock — one tick, one truth: DL split marks and the board card

**Awaiting council.** Background: [docs/briefs/dl-splits-one-truth.md](../docs/briefs/dl-splits-one-truth.md)
— **background only; don't open it just to start the build.**

## Build

Ticking a split in the Daily Log and ticking its card on the board become the
same fact, in both directions.

1. A `×` on a split row in the D Log sets that split's **`pieceDone`**.
2. Clearing that `×` clears `pieceDone` — a mis-tap is undone by cycling the mark off.
3. A piece ticked on the board shows as `×` on its D Log row for the day it is booked on.
4. Splits sit **under their job** in the D Log, indented, each markable on its own.
   The job's own line carries its own mark and is never worked out from its splits.

## Rules that bind the build

- **`pieceDone` already exists and is already a toggle** (`handleMarkPieceDone`,
  `src/hooks/useJobs.js`). Use it. No new field, no new table, no schema change.
- **The invoice question stays where it is** — the `×` in the Weekly Log's final
  column, Trevor's own manual tick. **Council must rule on this:** today, ticking
  the last piece calls `handleAllPiecesDone`, which opens the invoice prompt. The
  D Log must not raise that prompt.
- **The D Log stays the record of when.** A ticked piece keeps its row, its date
  and its note — it does not vanish from the day it was done on.
- **The other marks stay log-only.** Only `×` maps to `pieceDone`. `·`, `/` and
  `>` mean nothing to the board.
- **The job line still never ticks the Weekly Log.** One master mark, set by hand.
- A completed job never comes back, so nothing needs to handle a re-opened job.

## Not in scope

- The whole-job `done` flag and `handleMarkDone` — untouched.
- Any change to `completed_jobs`, revenue, or the invoice amount.
- Restarting the parked scheduler. `AUTO_BUMP_ENABLED` stays false.
- `calendarSlot`, `scheduledSlots`, and the `jobs[]` shape beyond the existing
  `pieceDone` write.

## Protocol

Blast-radius: writes live job state. **Full protocol** — council, then
`ggnz-builder`, then `ggnz-verifier`, then browser test, then merge.
