---
doc_status: closed
---
# The Daily Log drives the Weekly Log — full record

**Both builds shipped.** Build 1 `PR #32` (2026-08-20). Build 2 `f589506` (PR #33,
2026-08-22). This was the scope lock at `.claude/pending-brief.md` until it closed;
moved here so a finished lock stops loading itself into every new session.

Raised on the Build 2 preview and **parked, not fixed** — the D Log dropdown offers
splits that are already finished: see
[parked-dl-dropdown-shows-finished-splits.md](parked-dl-dropdown-shows-finished-splits.md).

Build 2 note: the job header row is synthesized in memory from `jobById`, so there is
**no new stored field and no schema change**. A header and a split of the same job
resolve to the **same** W Log cell (both go through `weekCellJobId()` to the top-level
id), so marking both on one day is last-pick-wins — which is Build 1 rule 3, not a
deviation. Verifier passed 6/6 static checks; 683 tests green. The four browser checks
in the Protocol section below were **not** clicked — Trevor called the merge anyway.

---

# Scope lock — the Daily Log drives the Weekly Log
Pick the mark once in the D Log and the W Log gets it, instead of tapping both.
Council record and background (**don't open to start the build**):
[dl-splits-one-truth-council.md](../docs/briefs/dl-splits-one-truth-council.md)
## Build 1 — SHIPPED 2026-08-20 (PR #32, merged)
Picking a mark in the D Log writes it to the W Log. Rules kept below because Build 2
must not break them.
1. **Every D Log row has a mark control.** Marks: `/` worked on today · `×`
   complete, waiting on the W Log's final × · `>` deferred. Store the key
   (`slash`/`cross`/`arrow`), never the symbol.
2. A mark on a job/split row writes **the same mark** to that job's W Log cell that
   day — under the **top-level job id** (`topLevelJob()`), never a split's own id.
3. **The D Log always wins — no refusals.** A pick overwrites whatever the W Log
   cell holds, hand-set or not; clearing the row clears it. Trevor, 2026-08-20:
   "when I select action in DL, WL should reflect that change." Two splits of one
   job marked the same day share one cell — last pick wins.
4. **The app never books a day.** No next-day write, picker, popup or toast. Trevor
   books by hand; `>` says nothing about which day. A hand-typed **task** has no W Log
   row — its mark stays in the D Log only.
5. **`pieceDone` moves only on `×` arriving or leaving.** `/` or `>` on a row that
   wasn't `×` leaves it alone — the board writes `pieceDone` too (`JobCard`,
   `PomoDrawer`, `CloseDayModal`) and a blind clear silently un-ticks it. Skip the
   write when the row isn't a split's child.
## Build 2 — the indented layout (NEXT — this is the live work)
Splits sit **under their job**, indented, each markable on its own; the job's line
carries its own mark, never derived from theirs. No job line today — new rows.
**Spawn `ggnz-builder` with `model: "sonnet"`**, agreed with Trevor 2026-08-20: this
is layout in one file, not a live-data build, so Opus isn't earned. Rerun on Opus if
it comes back messy. The risk to watch is the job line's mark and its splits' marks
crossing wires with the Build 1 rules above — those rules still bind.
## Rules that bind the build
- **No new field:** splits carry `parentId`, the panel builds `jobById`. Rows mix
  split and top-level ids; skip ids not in `jobs` (those are typed tasks).
- **`weekMarks.setMark` returns `ok:false` silently on an unloaded week.** A silent
  tap is this project's own past failure: a refused write must always say so.
- **Two save gates** (`dayMarks.ready`, `weekMarks.ready`) with separate failure
  counters. Check both before writing either half; don't reuse the panel's `ready`.
- **No invoice prompt from the D Log** — raw `handleMarkPieceDone`, never the
  `...WithInvoicing` wrapper. The W Log's closing × stays Trevor's tap and the only
  invoice trigger. (`useJobs.js:695` still toasts "ready to invoice" — a message,
  not the prompt, not a failure.)
## Not in scope
The whole-job `done` flag, `handleMarkDone`, `completed_jobs`, revenue, invoices;
`calendarSlot`, `scheduledSlots`, `jobs[]` beyond the existing `pieceDone` write; a
board tick reaching back into the D Log. Known and left alone: the typed-task Remove
button fails with a toast (pre-existing).
## Protocol
Council done (opus, 2026-08-20) and Build 1 merged. Next: Build 2 via `ggnz-builder`
(sonnet), then `ggnz-verifier` — must click: change a row's mark and watch the W Log
follow; board tick survives a `/` pick; typed task adds no W Log row; week un-ready
gives a visible message.
