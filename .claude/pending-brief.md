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
2. Moving that mark to **anything else** — blank, `·`, `/`, `>` — clears `pieceDone`.
   Only `×` means finished, so the log and the job can never disagree.
3. The `×` sits on the day it was ticked, and **no other day is rewritten** —
   every other day that piece is booked on keeps its own mark. Trevor does not
   book one job on consecutive days, so this is rare in practice; a tick made
   from the calendar, which names no day, lands on the last booked day.
4. "The board" means the piece-done tick in a split's drawer on the drag-and-drop
   calendar. The Weekly Log's closing `×` is a different thing and stays as it is.
5. Splits sit **under their job** in the D Log, indented, each markable on its own.
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
- **Only `×` maps to `pieceDone`.** `·`, `/` and `>` mean nothing to the board.
- **The job line still never ticks the Weekly Log.** One master mark, set by hand.

## Not in scope

- The whole-job `done` flag and `handleMarkDone` — untouched.
- Any change to `completed_jobs`, revenue, or the invoice amount.
- `calendarSlot`, `scheduledSlots`, and the `jobs[]` shape beyond the existing
  `pieceDone` write.

## Protocol

Blast-radius: writes live job state. **Full protocol** — council, then
`ggnz-builder`, then `ggnz-verifier`, then browser test, then merge.
