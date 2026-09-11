---
doc_status: live
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
