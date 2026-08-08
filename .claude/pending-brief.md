---
doc_status: live
---

# Scope lock — revenue Build 3: load what's already saved

**Council complete (2026-08-08), both reviewers, changes folded in below. Awaiting Trevor's
approval, then protocol step 3 (builder).** Council's full reasoning is in
[docs/briefs/revenue-build-3-council.md](../docs/briefs/revenue-build-3-council.md) —
**background only, don't open it to start the build.** Builds 1–2 are shipped and closed.

## The problem, verified against the code

`loadCompletedJobs()` and `subscribeToCompletedJobs()` have **zero callers in the app**.
`completedJobs` starts `[]` in `src/App.jsx:121` and only `handleMarkDone()` ever fills it,
in memory. So after a reload the Board's week revenue (`src/App.jsx:492`) reads $0, and a job
ticked before that reload raises a false "already recorded" toast.

## In scope

- Load the current week's rows on app start via `loadCompletedJobs(recentWeekKeys(...))` —
  bounded, never the all-time form — and keep it live with `subscribeToCompletedJobs()` on
  the same keys, cleaned up on unmount.
- The load belongs in `src/hooks/useJobs.js`, which already owns this state. Not `App.jsx`.
- **Carve-out from "don't change Builds 1–2", required:** `loadCompletedJobs()` returns
  `{records: [], doneJobIds: []}` on *error*, identical to an empty week
  (`src/utils/supabase.js:1982`). Give it an error signal so the caller skips the update
  instead of zeroing the total. Without this the last rule below cannot be met.
- Map `doneJobIds` to `String(d.job_id)` (`:1981`) — `handleMarkDone` compares string ids.
- Recompute the week keys as the week turns; a tab open past Sunday midnight must not keep
  reading last week. If that can't be done cleanly, say so — a stated limit, never a silent one.

## Out of scope

Any all-time or historical revenue view · invoice number capture · the `To Be Inv` nag ·
any edit-a-completed-row UI · `useFirebase.js` (dead code) · anything else in Builds 1–2.

## Rules that bind

- **The revenue record is never rewritten or deleted by the app.** No `.delete()` on
  `completed_jobs`; `clearCompletedJobs()` / `saveCompletedJobs()` stay gone.
- Week keys use the same local-Monday logic as the writer. Never `toISOString()` — that
  rolled NZ Monday back to Sunday and is what reported $0 on 31 July.
- **A failed read must never overwrite a real list with `[]`.**
- Loading must not re-fire `handleMarkDone()` or write any job state.
- Staging branch → `ggnz-verifier` → browser test → Trevor approves the merge. The browser
  test must also check **CloseDayModal and CatchUpInterview** — a real `completedJobs` list
  changes what they find, beyond just the total.
