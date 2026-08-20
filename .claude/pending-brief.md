---
doc_status: live
---

# Scope lock — the Daily Log drives the Weekly Log

**Awaiting council.** Background: [docs/briefs/dl-splits-one-truth.md](../docs/briefs/dl-splits-one-truth.md)
— **background only; don't open it just to start the build.**

Replaces the earlier "one tick, one truth" scope (2026-08-20, Trevor's call). That
build tried to keep a D Log tick and a board tick agreeing with each other. This one
removes the need: the D Log gives the instruction, the W Log carries it out.

## Build

1. **Action symbols on every D Log row** — job lines, split lines and hand-typed
   tasks alike. The one that matters: **carry this to the next day.**
2. Carrying a **job or split** writes that job onto the next day in the **Weekly
   Log**, the same write tapping that day cell already makes. Nothing else moves.
3. Carrying a **task** (no job, so no W Log row) puts the same task on the next
   day's D Log.
4. `×` on a split row still sets that split's **`pieceDone`**, and moving that mark
   to anything else — blank, `·`, `/`, `>` — clears it. Only `×` means finished.
5. Splits sit **under their job**, indented, each markable on its own. The job's
   own line carries its own mark and is never worked out from its splits.

## Rules that bind the build

- **The D Log is where he is standing.** An action must be one tap, on the row, at
  the moment he knows — never a trip to another screen to finish the thought.
- **`pieceDone` already exists and is already a toggle** (`handleMarkPieceDone`,
  `src/hooks/useJobs.js`). Use it. No new field, no new table, no schema change.
- **The D Log must not raise the invoice prompt.** `handleMarkPieceDone` only opens
  it when handed an `onAllPiecesDone` callback — the D Log omits it. Invoicing stays
  the W Log's own final-column `×`, by hand.
- **A carry writes a booking, never a done flag.** Marks and bookings stay separate
  facts; carrying tomorrow says nothing about today's row, which keeps its mark.
- **The job line still never ticks the Weekly Log.** One master mark, set by hand.
- **The other way round is out.** A board tick does not reach back into the D Log.

## Not in scope

- The whole-job `done` flag and `handleMarkDone` — untouched.
- Any change to `completed_jobs`, revenue, or the invoice amount.
- `calendarSlot`, `scheduledSlots`, and the `jobs[]` shape beyond `pieceDone`.

## Protocol

Blast-radius: writes live job state. **Full protocol** — council, then
`ggnz-builder`, then `ggnz-verifier`, then browser test, then merge.
