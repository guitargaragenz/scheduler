---
doc_status: live
---

# Scope lock — the Daily Log drives the Weekly Log

**Council run 2026-08-20; both reviewers' changes folded in.** Replaces "one tick,
one truth" (Trevor's redirect): pick the mark once in the D Log and the W Log gets
it, instead of tapping both. Background (**don't open it to start the build**):
[dl-splits-one-truth.md](../docs/briefs/dl-splits-one-truth.md)

## Build 1 — picking a mark in the D Log writes it to the W Log

1. **Mark control on every D Log row** — jobs, splits and hand-typed tasks alike.
   Marks already in use: `/` worked on today · `×` complete, waiting on the final
   × in W Log · `>` deferred to some other day.
2. Picking a mark on a job or split row writes **that same mark** to the W Log cell
   for **that job, on that day** — under the **top-level job id**, never a split's
   own id, which `weekRows()` never draws. **Never overwrites** a marked cell: say
   so, leave it.
3. **The app never books a day.** No next-day write, no day picker, no popup, no
   toast. Trevor books days by hand; `>` says nothing about which day.
4. A hand-typed **task** has no W Log row — its mark stays in the D Log only.
5. `×` on a split row also sets that split's **`pieceDone`**; any other mark —
   blank, `/`, `>` — clears it. Only `×` means finished.

## Build 2 — the indented layout (after Build 1)
Splits sit **under their job**, indented, each markable on its own; the job's line
carries its own mark, never derived from its splits. The D Log has no job line
today, only part rows — new rows, not a restyle.

## Rules that bind the build

- **Prerequisite:** thread `parentJobId` through the D Log's rows — `handleMarkPieceDone`
  needs it; rows carry `{id, label, auto}` only. No new table or column.
- **`weekMarks.setMark` isn't passed to `DailyLogPanel` today** — new plumbing, and
  it must check `weekMarks.ready` first: `setMark` returns `ok:false` silently on an
  unloaded week, and a silent tap is this project's own past failure.
- **The D Log must not raise the invoice prompt** — omit `onAllPiecesDone`. The
  W Log's closing × stays Trevor's tap, and stays the only thing that invoices.

## Not in scope
- The whole-job `done` flag, `handleMarkDone`, `completed_jobs`, revenue, invoices.
- `calendarSlot`, `scheduledSlots`, `jobs[]` beyond the existing `pieceDone` write,
  and a board tick reaching back into the D Log.

## Protocol

Blast-radius. Council done. Next: `ggnz-builder`, `ggnz-verifier` (include a rendered
mark-pick, week loaded and not), browser test, merge.
