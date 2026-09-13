---
doc_status: closed

Shipped 2026-09-11 at `f5b2315` (merge), builds `b3a41e7` + `cf7f6dc`.
---

# Handoff — strip the dead "no bench" leftovers

Background only, not the build order: the "no job ever has no bench" build shipped at
`b10d52f` on 2026-09-11. Every job now gets a bench, and unclassifiable work parks on
Admin. So every "no bench" group in the UI is now permanently empty — dead code that
still reads like a real state.

## What to remove

- `src/components/BenchBoardPage.jsx:168` — the `__none` / "No bench set" column, and
  whatever builds the `none` array feeding it.
- `src/components/BenchWeekPage.jsx:425-457` — two groupers, each appending a
  "No bench set" group (one with `canAdd: false`). Remove the group and the comments
  that explain it.
- `src/components/WeeklySummaryModal.jsx:31` — the `job.bench || 'No Bench'` fallback.
  `job.bench` is never empty now.
- `src/components/BenchShelf`/`JobShelf` — checked 2026-09-11, nothing to do. Leave alone.

## Tests to update in the same change

- `src/components/BenchWeekPage.test.jsx:126` expects `'No bench set'` in the group list.
- `src/components/BenchWeekPage.test.jsx:346` asserts the `canAdd: false` behaviour.

Both assert the dead behaviour, so both change with the code. Suite must stay green
(currently 40 of 40, with 3 files skipped for a missing `jsdom` package — unrelated).

## Out of scope

- Anything touching `inferBench()`, `isBenchUnplaced()`, `benchAuto` or
  `NeedsBenchPopup`. Those are the shipped build and are correct.
- The missing `jsdom` install. Separate housekeeping.

## Rules that bind this

- "There is no such thing as 'no bench'" (CLAUDE.md). A null bench, an empty-string
  bench, or a "No bench set" group all model something that cannot happen.
- Protocol: this touches `jobs[]` shape reads across three screens, so run the full
  agent-team protocol — brief approved in `.claude/pending-brief.md` first, no commit
  without it.

## Council verdict, 2026-09-11 (both reviewers: go)

- Leave `benchColors()` and `NO_BENCH_COLORS` alone. It handles a missing bench
  safely and ~20 other callers rely on it.
- Leave the `canAdd` field in place. Stripping it is a bigger refactor, not this job.
- `buildManualInvoiceJob()` still sets a null bench, but that object never reaches
  the three bench screens. Out of scope; worth knowing.

## Amendment, 2026-09-11 — the Admin fallback at load

The verifier would not sign off because nothing proved a bench-less job can never
reach the three screens. Tracing it showed it can: commit `233ef0a` introduced the
"unplaced work parks on Admin" rule but never backfilled existing Supabase rows, and
`normalizeJobsFromDb` takes the stored bench verbatim and never re-infers on load. So
a legacy null-bench row would load bench-less and, with the "No bench set" buckets
gone, appear on none of the three screens.

Trevor directed the fix directly: `src/hooks/useSupabase.js` now loads `j.bench ||
'Admin'`. `benchAuto` on the line below still reads the raw `j.bench`, so such a job
still reads as unplaced and still reaches the "needs a bench" popup. Three tests added
in `src/hooks/useSupabase.test.js`. Council step was not re-run for this: it is a
one-line change inside the scope council already reviewed, and it closes a hole
council itself did not catch.
