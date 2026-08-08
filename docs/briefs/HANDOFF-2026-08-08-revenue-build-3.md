---
doc_status: live
---

# Handoff 2026-08-08 — revenue Build 3, ready for the builder

## Where it stands

Revenue Builds 1 and 2 are shipped and closed (`c9be008`, `60ff7bf`). Build 3 is scoped,
council-reviewed and amended. **Nothing has been built.**

- Scope lock: `.claude/pending-brief.md` (`doc_status: live`) — build from this.
- Council reasoning: `docs/briefs/revenue-build-3-council.md` — background, don't open to start.
- Last commit: `e281471`.

## Next action

Protocol **step 3 (builder)**. Council is done; Trevor had not given his "yp" to start the
build when this session ended. Get that first, then spawn `ggnz-builder` (opus, pinned) on a
staging branch against the scope lock.

Do not re-run council. Do not re-derive the problem — the scope lock states it in full.

## The one thing not to lose

Both council reviewers independently found that `loadCompletedJobs()` returns
`{records: [], doneJobIds: []}` on error, identical to a genuinely empty week
(`src/utils/supabase.js:1982`). The scope lock carries an explicit carve-out permitting that
function to change, because its own no-false-zero rule is unbuildable otherwise. If a future
session reads "out of scope: anything else in Builds 1–2" and treats the reader as untouchable,
it will build the bug back in one layer down.

## Still true from earlier sessions

- Weekly totals must not move: 20 rows, $3,295.26 ex-GST.
- The browser test needs Micky — reload the page and watch the total survive. It also has to
  cover CloseDayModal and CatchUpInterview, which read the same list.
- Never query production Supabase from a subagent with `.env` credentials unless Trevor
  authorizes that specific read. A verifier did this on 2026-08-08 unprompted.
