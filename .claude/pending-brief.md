---
doc_status: live
---
# Scope lock — the Daily Log drives the Weekly Log
**Council 2026-08-20 (second run, opus); findings folded in.** Pick the mark once in
the D Log and the W Log gets it, instead of tapping both. Background (**don't open to
start the build**): [dl-splits-one-truth.md](../docs/briefs/dl-splits-one-truth.md)
## Build 1 — picking a mark in the D Log writes it to the W Log
1. **Mark control on every D Log row.** Job/split rows have one already
   (`DailyLogPanel.jsx:467`); only hand-typed tasks lack it. Marks: `/` worked on
   today · `×` complete, waiting on the W Log's final × · `>` deferred. Store the
   key (`slash`/`cross`/`arrow`), never the symbol.
2. Picking a mark on a job or split row writes **that same mark** to the W Log cell
   for **that job, on that day** — under the **top-level job id** (use the existing
   `topLevelJob()`), never a split's own id, which `weekRows()` never draws.
3. **Correcting your own mark follows through.** A row may overwrite or clear the
   mark it last wrote; refuse **only** a cell it didn't write — hand-set, or another
   split's that day — and say so. Test the **stored** mark, not `cellMark()`'s
   drawing.
4. **The app never books a day.** No next-day write, picker, popup or toast. Trevor
   books by hand; `>` says nothing about which day. A hand-typed **task** has no W Log
   row — its mark stays in the D Log only.
5. **`pieceDone` moves only on `×` arriving or leaving.** Changing a row away from
   `×` clears it; `/` or `>` on a row that wasn't `×` leaves it alone — the board
   writes `pieceDone` too (`JobCard`, `PomoDrawer`, `CloseDayModal`) and a blind
   clear silently un-ticks it. Skip the write when the row isn't a split's child.
## Build 2 — the indented layout (after Build 1)
Splits sit **under their job**, indented, each markable on its own; the job's line
carries its own, never derived from theirs. No job line today — new rows.
## Rules that bind the build
- **No new field:** splits carry `parentId` and the panel builds `jobById` — look the
  parent up. Rows mix split and top-level ids; skip ids not in `jobs` (typed tasks).
- **`weekMarks.setMark` isn't passed to `DailyLogPanel` today** — new plumbing. It
  returns `ok:false` silently on an unloaded week, and a silent tap is this project's
  own past failure: a refused write must always say so on screen.
- **Two save gates** (`dayMarks.ready`, `weekMarks.ready`) with separate failure
  counters. Check both before writing either half; don't reuse the panel's `ready`.
- **No invoice prompt from the D Log** — pass raw `handleMarkPieceDone`, not
  `handleMarkPieceDoneWithInvoicing`. The W Log's closing × stays Trevor's tap and the
  only invoice trigger. (`useJobs.js:695` still toasts "ready to invoice" — a message,
  not the prompt, not a failure.)
## Not in scope
The whole-job `done` flag, `handleMarkDone`, `completed_jobs`, revenue, invoices;
`calendarSlot`, `scheduledSlots`, `jobs[]` beyond the existing `pieceDone` write; a
board tick reaching back into the D Log.
## Protocol
Blast-radius. Council done (opus, 2026-08-20). Next: `ggnz-builder`, `ggnz-verifier`
— must click: change a row's mark and watch the W Log follow; board tick survives a
`/` pick; typed task adds no W Log row; week un-ready gives a visible message.
