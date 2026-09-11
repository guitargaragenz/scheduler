---
doc_status: live
---

# Scope lock — the vanishing job
Approved by Trevor 2026-09-11. Council done, both approve. Step 3 — builder.

A job still on the board but flagged done stays hidden from the Jobs page even
after it reappears on the next Multitrack printout. Job 1740 was put back by
hand. A number on a printout is live work, so nothing named by an import should
stay done.

## The defect (verified in code 2026-09-11)

In `src/data/pdfImportPlan.js` only the "returning" path clears the flag, and a
row reaches it only when its id is in `departedIds`. A job still on the board
takes the plain `updates` path, which writes `data: pdfFieldsOf(p)` and never
touches `done`. So: on the board + done + never departed = stays hidden. The
Jobs page filters `!j.done`; the Jobs Sheet does not.

## Build this — two files

1. `src/data/pdfImportPlan.js`: the plain update path clears a stale `done`,
   the same way the returning path does. Set `done: false` **only** when the
   known job's `done` is actually true — never unconditionally, or every
   ordinary row starts carrying an extra column.
2. `src/utils/supabase.js`: allow `done` on a plain update in
   `writePdfImportBatch`. Without this the stray-field guard throws and refuses
   the whole import batch. Leave every other refusal exactly as it is.

Keep the departure logic exactly as it is.

Tests: a done, non-departed board job comes back after an import names it; a job
the import does not name is untouched; a plain update for a not-done job carries
no `done` key; the writer accepts a plain update carrying `done`.

Suite must finish green. The 3 files erroring on missing `jsdom` are
pre-existing and stay.

## Out of scope
- The departure logic and the week-key delay.
- The Jobs Sheet's lack of a `done` filter.
- Anything in the Parked table, the Projects planner, the screen names.

## Rules that bind this
- "A completed job never comes back" — a returning number is live work.
- Full protocol: touches `jobs[]` shape and the write path.

Background, do not open to start the build:
`docs/briefs/2026-09-11-session-handoff.md`.
