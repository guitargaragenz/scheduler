---
doc_status: closed

Shipped 2026-09-11 at `f5b2315` (merge), builds `b3a41e7` + `cf7f6dc`.
---

# Scope lock — strip the dead "no bench" leftovers
Approved by Trevor 2026-09-11 ('yp').

Every job now gets a bench, and work nothing can classify parks on Admin. So the
"No bench set" groups left in the UI can never hold anything. They still read like
a real state, which is exactly what the rule says must not exist.

## Build this

Remove the empty "No bench set" grouping from three screens:

- `src/components/BenchBoardPage.jsx:168` — the `__none` column and the array feeding it.
- `src/components/BenchWeekPage.jsx:432` and `:457` — two groupers, each appending a
  "No bench set" group, plus the comments explaining them.
- `src/components/WeeklySummaryModal.jsx` — the `job.bench || 'No Bench'` fallback, the
  `'No Bench'` entry in `BENCH_ORDER`, and the `=== 'No Bench'` colour branch.

Update the two tests that assert the dead behaviour, in the same change:
`src/components/BenchWeekPage.test.jsx:126` and `:346`. Rewrite them, don't delete
them: each should now assert that a bench-less row produces no group at all.

The suite must finish green. The 3 files erroring on a missing `jsdom` package are
unrelated, pre-existing, and stay.

## Out of scope

- `inferBench()`, `isBenchUnplaced()`, `benchAuto`, `NeedsBenchPopup`. That is the
  shipped build and it is correct.
- Installing `jsdom`. Separate housekeeping.
- The `'Wiring'` entry in `BENCH_ORDER`. Wiring is a task type, not a bench, but that
  is a different argument and not this job.

## Also in this change (amendment, 2026-09-11)

`src/hooks/useSupabase.js` now loads a falsy bench as `'Admin'`, because legacy rows
predate the Admin rule and would otherwise show on none of the three screens. Tests
added. Council verdict and full reasoning: background doc below.

## Rules that bind this

- "There is no such thing as 'no bench'" (CLAUDE.md).
- Full agent-team protocol: this reads the `jobs[]` shape across three screens.
  Council before builder. No commit without this brief approved.

Background, do not open to start the build:
`docs/briefs/no-bench-cleanup-handoff.md`.
