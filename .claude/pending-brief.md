---
doc_status: closed
---

# Record — Weekly Log shows a split job's parts in a dropdown

Shipped at `39d3911` (PR 79), 2026-09-30. Nothing live — next session starts with `/next`.

Tests: 46 files, 898 tests, all passing. Verifier: 7/7 by code and tests; browser check done by
Trevor on the preview.

What shipped: tapping a split job's name in the Weekly Log drops down its parts in shop order
(Fretwork, Luthier, Finishing, Wiring, Setup), done ones ticked, "next" on the first open one,
each with its session note. Split jobs file under the Board's `nextBenchOf` rule; the saved
week file matches the page.

Decisions the brief didn't cover: ▾ arrow on split names; a part with no bench lists as Admin;
collected jobs get the dropdown too (display only). Session notes added after the preview
(Trevor: bench and note only, no hours or day).

Not met as written: "a job with no bench files on Admin" — the Weekly Log never did that and a
picker test depends on it, so no-bench jobs still get no heading. Needs its own conversation.

Background: [docs/briefs/wl-split-dropdown.md](../docs/briefs/wl-split-dropdown.md).
