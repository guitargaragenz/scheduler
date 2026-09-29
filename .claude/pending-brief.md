---
doc_status: closed
---

# Record — A finished job keeps its × and its week

Shipped at `57d9138` (PR 77), 2026-09-29. Nothing live — next session starts with `/next`.

Tests: 45 files, 882 tests, all passing. Verifier: code checks passed; browser click-through done by Trevor.

What shipped: a second × on an invoiced job does nothing but toast; Remove refuses on an invoiced
job; job 1726's close mark restored by `scripts/fix_1726_close_mark.mjs` (applied 2026-09-29).

Decisions the brief didn't cover: the builder wrote both toast wordings; tests cover the two
helpers (`closeIsLocked`, `removeIsBlocked`), not a full page click-through.

Checklist items not met as written: #5 was checked by Trevor in the preview, not by the verifier.

Cause and rulings: [docs/briefs/week-close-sticks.md](../docs/briefs/week-close-sticks.md).
