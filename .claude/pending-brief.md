---
doc_status: live
---

# Scope lock — the vanishing job
Approved by Trevor 2026-09-11 ('yp'). Protocol step 2 — council.

A job still on the board but flagged done stays hidden from the Jobs page even
after it reappears on the next Multitrack printout. Job 1740 was put back by
hand. A number on a printout is live work, so nothing named by an import should
stay done.

## The defect (verified in code 2026-09-11)

`src/data/pdfImportPlan.js` sorts each parsed row into three paths. Only the
"returning" path clears the flag:

- returning path writes `{ ...pdfFieldsOf(p), departedAt: null, done: false }`,
  but a row only reaches it when its id is in `departedIds`, built from
  `knownJobIds` filtered on `k.departedAt`.
- a job still on the board takes the plain `updates` path, which writes
  `data: pdfFieldsOf(p)` and never touches `done`.

So: on the board + done + never departed = stays hidden. The Jobs page filters
`!j.done`; the Jobs Sheet does not, which is why it looks like a vanishing job.

## Build this

Make the plain update path clear a stale `done` the same way the returning path
does. Keep the existing refusals and the departure logic exactly as they are.

Cover it with tests: a done, non-departed board job comes back after an import
names it; a job the import does not name is untouched.

The suite must finish green. The 3 files erroring on a missing `jsdom` package
are unrelated, pre-existing, and stay.

## Out of scope
- The departure logic and the week-key delay.
- The Jobs Sheet's lack of a `done` filter.
- Anything in the Parked table, the Projects planner, the screen names.

## Rules that bind this

- "A completed job never comes back" (CLAUDE.md) — a returning number is live work.
- Full agent-team protocol: this touches the `jobs[]` shape. Council before
  builder. No commit without this brief approved.

Background, do not open to start the build:
`docs/briefs/2026-09-11-session-handoff.md`.
