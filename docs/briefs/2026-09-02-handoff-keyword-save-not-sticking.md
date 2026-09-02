# Handoff — the keyword change may not be saving at all

doc_status: live

Written 2026-09-02. Supersedes `2026-09-01-handoff-keyword-work.md`, which is
now closed. **Read this one and stop.**

## The question changed at the end of the session

The whole session was spent on the wrong question — "why does the dialog list
10 jobs that have nothing to do with the edit". In the last few minutes Trevor
said the thing that matters:

> **"1616 hasn't moved at all."**

1616 is the one job that genuinely contains the words he typed. The dialog
offered it. He confirmed. **It did not move.**

If a confirmed change does not stick, that also explains the 10 coming back
identically every single time — nothing was ever written, so every save starts
from the same stale board. **Chase this first. Everything else is downstream.**

Where to look, in order. All of this is read, not guessed:

- `App.jsx:298` `confirmBenchKeywordsChange` → `applyBenchKeywordsChange`
  (`App.jsx:259`). The apply re-infers, collects `reinferred`, then calls
  `saveJob(j.id, pickMasterFields(j))` per job.
- `pickMasterFields()` (`src/data/joinJobs.js:105`) strips `NON_MASTER_FIELDS`.
  `bench` is **not** in that set, and `bench` **is** in the row field list
  (`src/utils/supabase.js:144`), so on the face of it the write should land.
  That is as far as the session got. The bug is not yet found.
- Worth testing directly rather than reading: does `saveJob` actually get
  called, does it return a row, and does the value survive the next load
  (`normalizeJobsFromDb`, which reads the `bench` column verbatim).

## Verified this session — do not re-derive

- **The "and" box works.** Ran `buildAndKeyword('install','pickup')` against
  `inferBench` directly: "install new pickup", "customer supplied pickup,
  install" and "install bridge pickup and rewire" all land on Wiring.
  "install a set of **pups**" does not — it is a literal both-words test.
- **Any keyword save re-infers every job** (`App.jsx:259`), so the dialog
  listing unrelated jobs is by design, not a dialog bug.
- **Admin is not a keyword bench.** `inferBench` returns Admin when
  `blockedPile()` says blocked (`src/data/jobs.js:297`).
- **All ten jobs Trevor read off the board are Admin in one direction or the
  other**: 1736, 1731, 1729, 1676, 875, 1544, 97 → Admin; 1727, 1448, 1604 →
  off Admin. Not one is a bench-to-bench move.
- **Multitrack prints the statuses exactly `On Hold` and `In Transit`** —
  Trevor confirmed off the printout. Which is exactly what `blockedPile()`
  matches on, so the obvious explanation is already ruled out.

## Ruled out — do not spend a round on these again

- **Case mismatch** (`HOLD` vs `On Hold`). Trevor checked the printout.
- **A double space or hidden character in the status.** Invented mid-session
  with no evidence behind it. It may still be true; nothing supports it.
- **The keyword-list "clean-up"** (`2026-09-01-keyword-cleanup.md`). Trevor:
  *"keyword cleanup was a mistake by bad council decision."* Closed.

## The tool that is already there

`scripts/diagnose_bench_disagreements.mjs` — read-only, no `--write`. Prints
every job whose stored bench disagrees with the saved keywords, the stored
status with its character codes, and every distinct status string in the
database. **Needs `.env`, so it only runs on Micky.** It has never been run.

## How this session went wrong — the part worth keeping

Three causes were stated to Trevor with more confidence than the evidence
carried, and two were knocked down by him within a minute each. He called it:
*"you're clutching at straws."* He was right.

The cause: the live job data is not readable from a web session, and that gap
got filled with theories instead of the words "I don't know". A theory offered
as a finding costs him more than silence does — he acts on it.

**So: this brief's open question has no answer yet, and the next session must
not invent one.** Get the data, or say it cannot.
