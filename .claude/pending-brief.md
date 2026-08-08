---
doc_status: closed
---

# Scope lock — revenue: Build 2 (the readers)

**Shipped 2026-08-08 at `60ff7bf`. Verified by `ggnz-verifier` (6/6 pass, 604 tests green);
totals unchanged at 20 rows / $3,295.26 ex-GST. Nothing below is work — it is the record.**

**Found during verification, not fixed and not scoped:** the app never wires up
`loadCompletedJobs()` / `subscribeToCompletedJobs()` at all — `completedJobs` starts `[]` in
`src/App.jsx` and is only ever filled in-memory by `src/hooks/useJobs.js`. So the Board's week
revenue reads $0 after a page reload. Pre-existing, outside this build's scope. Needs its own brief.

**Approved by Trevor 2026-08-08. Council done. Resumes at protocol step 3 (builder).**
History, council rulings and the verifier's checklist live in
[docs/briefs/revenue-data-loss-fix.md](../docs/briefs/revenue-data-loss-fix.md) — **don't open it to
do the build.** Everything the builder needs is on this page. Open it only to verify (§6) or to
settle a question this page genuinely doesn't answer.
Build 1 shipped 2026-08-07 (`c9be008`) — the table is no longer wiped, so it now grows forever.

## In scope

Check these twelve readers of `completed_jobs` for unbounded loads, and filter by week key:
`src/App.jsx`, `src/hooks/useJobs.js`, `src/data/jobs.js`, `src/data/joinJobs.js`,
`src/utils/supabase.js`, `src/components/CloseDayModal.jsx`, `src/components/RevenueBreakdown.jsx`,
`src/components/WeeklySummaryModal.jsx`, `src/components/CatchUpInterview.jsx`,
`scripts/board_meeting_export.mjs`, `.claude/workflows/sunday-board-meeting.js`
(+ `src/utils/supabaseParkingLot.test.js`, incidental).

Known worst case: `scripts/board_meeting_export.mjs:93-105` downloads the whole history every
Sunday, then `.claude/workflows/sunday-board-meeting.js:112` throws away all but one week.

## Out of scope

Invoice number capture · the `To Be Inv` nag · any edit-a-completed-row UI (ruled out by Trevor:
"one and done, then edit if necessary in DB") · `useFirebase.js` (dead code) · anything in Build 1.

## Rules that still bind

- **The revenue record is never rewritten or deleted by the app.** No `.delete()` against
  `completed_jobs`; `clearCompletedJobs()` stays gone.
- Weekly totals must not change. Verify against the current 20 rows / $3,295.26 (ex-GST).
- Staging branch → `ggnz-verifier` → browser test → Trevor approves the merge.
