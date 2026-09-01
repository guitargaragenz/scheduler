# Record — Finishing becomes a bench you can land on (SHIPPED, not pending)

doc_status: closed

**Nothing is pending. This is a record, not a task list.** Shipped 2026-09-01,
PR #55. Do not build from this file.

The full record — why "Finish Work" became "make Finishing work", what job 1728
actually was, and the two things found but not fixed — is in
`docs/briefs/2026-09-01-finishing-bench.md`, `doc_status: closed`. Background
only; do not open it to start work.

## What shipped

`Finishing` keywords in `DEFAULT_BENCH_KEYWORDS`; an `inferBench` test for them
placed after Luthier so refinish jobs keep their split; a Settings → Keywords
row; a job-drawer option on desktop and mobile; and Finishing added to the
`BENCH_ORDER` list on all four pages that filter strictly against it. 768 tests
green.

## Worth carrying forward

- **A bench is six things, not one** — colour, keywords, an `inferBench` test, a
  Settings row, a drawer option, and a place in every page's `BENCH_ORDER`.
  Finishing had the colour and nothing else, which reads to Trevor as a bug.
- **`Wiring` still has this bug.** Its Settings keyword box is read by nothing.
- **Bench names are duplicated across eight files** in eight different orders.
  Miss one and jobs on that bench go invisible there, silently.
