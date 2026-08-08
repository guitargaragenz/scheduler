---
doc_status: live
---

# Scope lock — revenue: Build 3 (load what's already saved)

**Awaiting Trevor's approval. Then protocol step 2 (council) — this is new scope council has
never seen.** Builds 1 and 2 are shipped and closed; their record is in
[docs/briefs/revenue-data-loss-fix.md](../docs/briefs/revenue-data-loss-fix.md) — **background
only, don't open it to do this build.**

## The problem, verified 2026-08-08

`loadCompletedJobs()` and `subscribeToCompletedJobs()` (`src/utils/supabase.js`) have **zero
callers in the app**. `src/App.jsx:121` starts `completedJobs` as `[]`, and only
`handleMarkDone()` in `src/hooks/useJobs.js` ever fills it, in memory. So after any page
reload the Board's week revenue (`src/App.jsx:492`) reads $0 until jobs are re-ticked.

Second consequence: the in-memory list is also what stops a double-tick
(`useJobs.js` filters `completedJobs` by id). Empty on reload, so re-ticking a job appends,
the database correctly refuses it, and Trevor gets a scary "already recorded" toast for a job
he ticked once.

## In scope

- Load the current week's revenue rows on app start, using the bounded reader shipped in
  Build 2 — `loadCompletedJobs(recentWeekKeys(...))`, never the all-time form.
- Keep it live across devices via `subscribeToCompletedJobs()`, passing the same week keys.
- Make the week total on screen match the database after a reload.

## Out of scope

Any all-time or historical revenue view · invoice number capture · the `To Be Inv` nag · any
edit-a-completed-row UI (ruled out: "one and done, then edit if necessary in DB") ·
`useFirebase.js` (dead code) · changing anything in Builds 1 or 2.

## Rules that still bind

- **The revenue record is never rewritten or deleted by the app.** No `.delete()` against
  `completed_jobs`; `clearCompletedJobs()` / `saveCompletedJobs()` stay gone.
- Week keys come from the same local-Monday logic the writer uses. Never `toISOString()` —
  that rolled NZ Monday back to Sunday and is what reported $0 on 31 July.
- A failed read must not look like an empty week. Loading must never overwrite a real
  in-memory list with `[]` because the read broke.
- Loading must not re-fire `handleMarkDone()` or write any job state.
- Staging branch → `ggnz-verifier` → browser test (reload the page, total survives) → Trevor
  approves the merge.
