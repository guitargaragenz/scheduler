---
doc_status: live
---

# Brief — the revenue record stops being deletable

**Status: awaiting Trevor's approval. No build has started.**

Audited 2026-08-07 against the live code and the live database. Source material:
[source-revenue-data-loss-interview.md](source-revenue-data-loss-interview.md) (now superseded by
this file). Parking lot item `pk-md-04`, still `open`.

This is the **fourth** attempt at revenue in this app. The first three all failed the same way.
Section 2 says how, and that is the thing this build exists to not repeat.

---

## 1. What is broken

Every time a job is marked done, the app **deletes the entire revenue table** and re-inserts the
list the browser tab happens to be holding. If the tab's list is short — which it is after any
reload, before the load finishes — everything not in memory is destroyed.

Confirmed in code, 2026-08-07:

- `saveCompletedJobs()` — `src/utils/supabase.js:1830` — calls `clearCompletedJobs()` at `:1833`.
- `clearCompletedJobs()` — `src/utils/supabase.js:1857` — runs `.delete().neq('id','')`. Every row.
- `handleMarkDone()` — `src/hooks/useJobs.js:251` — builds `newRecords = [...completedJobs, record]`
  from React state at `:263` and passes it to `saveCompletedJobs()` at `:269`.

**Additional finding, not in the source material:** `saveCompletedJobs()` catches its own errors and
only `console.error`s them (`:1852-1854`). The delete is awaited and the insert is not guarded. So a
network blip *between* the delete and the insert wipes the table and the app reports nothing. This
makes the bug worse than "loses rows on reload" — it can lose everything on a good day.

### Live database, checked 2026-08-07

| Fact | Value |
|---|---|
| Rows in `completed_jobs` | **1** |
| That row | job_id `1712`, Jules Lovell, $204.45, `completed_at` 2026-08-07T03:16Z |
| Its `job_number` | **null** |
| Jobs with `done = true` | **6** |
| Revenue rows that should exist but don't | **5** |
| Job 1687 (`jobs` table) | still present, `done = false`, departed 2026-08-02 |
| Departed but not done ("To Be Inv"-shaped) | 14 |

The six done jobs are 1620, 1626, 1671, 1698, 1702, 1712. Only 1712 has a revenue row. Everything in
Part 2 of the source document held up exactly; nothing has been ticked since, so no further loss.

### Why the reconfirm flow is the usual trigger

`buildManualInvoiceJob()` — `src/data/jobs.js:359` — returns `job: null` (plus null bench and hours),
rebuilding customer and make from the text of a Daily Log bullet. The surviving 1712 row has
`job_number` null and `job_id` "1712", which is exactly that function's fingerprint. **So the row
that did the deleting came through the reconfirm path, as suspected.**

That path is reached when a job has already vanished from the board — i.e. after a reload, which is
precisely when memory is empty. The recovery flow is the most likely trigger of the next loss.

Four callers all land on the same `handleMarkDone`, confirmed in `src/App.jsx`: the ordinary tick
(`:983`), the revenue-review banner (`:939` → `handleRevenueReviewDone` at `:375`), `CloseDayModal`
(`:1007`), and `CatchUpInterview` (`:1022`). There is no separate safe path.

---

## 2. The three previous attempts, and what they had in common

Read from `git log`, as `pk-md-04` required.

1. **`3a32e20`, 2026-06-18** — "Add revenue tracking". Firestore. `saveCompletedJobs()` was a
   `setDoc()` of the whole `records` array to one document — a full overwrite from memory.
2. **`8e6d79d` + `70d20c8`, 2026-07-11/15** — the revenue-review banner and "unify revenue sources".
   These patched the *symptoms* of rows disappearing. Neither changed the whole-table write.
3. **`e259499`, 2026-07-25** — Supabase era. Added `invoice_amount` and `week_key` columns to the
   table. Kept clear-then-reinsert.

**The common fault: all three treated the revenue history as state the app can rebuild from
memory.** Firestore `setDoc` and Supabase `DELETE`-then-`INSERT` are the same idea in two
databases. Attempt 2 didn't even touch it — it added a UI to notice the damage.

That assumption is correct for the job board, because the Multitrack printout is the truth and a
re-import restores it. **There is no printout for money.** Once a revenue line is gone, nothing in
the app can reconstruct it.

### The design principle this build is judged against

> **The job board can be rebuilt. The revenue record cannot.**
> One job finished → one row written → that row is never rewritten and never deleted by the app.

### This app has already solved this exact problem once

`saveParkingLot()` — `src/utils/supabase.js:983` — had the identical clear-and-reinsert bug
(`pk-md-02`). It was fixed on 2026-08-01 in commit `64fa5d1`, with a documented three-rule
baseline-diff pattern and 226 lines of tests in `src/utils/supabaseParkingLot.test.js`. The comment
at `src/utils/supabase.js:965-980` explicitly names `completed_jobs` as having the same bug.

**Follow that precedent.** It is proven in this codebase, by this app, against this database.
Revenue is simpler still — it only ever appends, so it needs one of the three rules, not all three.

---

## 3. Trevor's answers — authoritative, not up for redesign

From the 2026-08-06 interview. A council reviewer **cannot** overrule these.

- **One invoice can cover many jobs** (schools prefer it — the 29 July Papamoa College invoice was
  $575 across nine job numbers, 1682–1690).
- **He enters each job's own share in the app.** One row per job. **There is no aggregation problem
  to solve.** A design modelling one invoice across many jobs is solving a problem he doesn't have.
- **"Done" means "already invoiced."** Multitrack's `To Be Inv` means finished but not yet billed.
- **No confirm step, no in-app editing of a completed row. One and done.** Corrections happen in the
  database, by Trevor or by Claude. His words: *"given its temperamental history probably best to
  leave it to one and done, then edit if necessary in DB."* **Do not "improve" this with an edit
  screen.** It is a deliberate choice made knowing the history.
- **Capture the invoice number** — yes. Multitrack stores invoice numbers, not job numbers, so today
  nothing reconciles between the two.
- **Nag about `To Be Inv` jobs** — yes, probably. Six were sitting unbilled at the 2026-08-04 board
  meeting.
- **Recovery:** nothing is permanently lost. Multitrack has every invoiced job; matching back is by
  customer and date. **Fix first, backfill after** — Trevor re-enters by hand once it is safe.

---

## 4. Scope

### In scope — Build 1: stop the bleeding

1. **`clearCompletedJobs()` is deleted outright.** Not guarded, not conditional — removed, so no
   future edit can call it. The app gets no ability to delete a revenue row.
2. **`saveCompletedJobs(records, doneJobIds)` is replaced by a single-row append** —
   `appendCompletedJob(record)` — that inserts one row and touches nothing else.
3. **Stable row identity.** `id` is currently `cj-${Date.now()}-${idx}`, regenerated on every save,
   so nothing is stable. Use the job id as the key and insert with `ON CONFLICT DO NOTHING`, so
   ticking the same job twice cannot duplicate it. This is safe because of the standing workshop
   rule: *a completed job never comes back — returning work is rebooked under a new job number.*
   Split pieces must be checked for distinct ids before this is relied on (see Open Questions).
4. **Failures are never silent.** A failed append must surface a toast, in the same shape as the
   existing `'⚠ Mark-done did not save — reload and re-check this job'` at `useJobs.js:272`.
5. **The reconfirm path stops throwing the job number away.** `buildManualInvoiceJob()` returns
   `job: null`; it must carry the job number through when the bullet has one.
6. **Callers updated:** the four `handleMarkDone` entry points in `src/App.jsx` (`:983`, `:939`/`:375`,
   `:1007`, `:1022`) all keep working unchanged — the change is below them, in `useJobs.js` and
   `supabase.js`.

### In scope — Build 2: the readers

The table stops being wiped, so it now **grows without limit**. Twelve files read it and each
currently assumes the whole list is in memory:

`src/App.jsx`, `src/hooks/useJobs.js`, `src/data/jobs.js`, `src/data/joinJobs.js`,
`src/utils/supabase.js`, `src/components/CloseDayModal.jsx`, `src/components/RevenueBreakdown.jsx`,
`src/components/WeeklySummaryModal.jsx`, `src/components/CatchUpInterview.jsx`,
`scripts/board_meeting_export.mjs`, `.claude/workflows/sunday-board-meeting.js`
(plus `src/utils/supabaseParkingLot.test.js`, incidental).

Each needs checking for unbounded loads and week-key filtering. **This is the bulk of the work, not
the fix itself.** Build 2 does not block Build 1 and should ship second.

### Explicitly OUT of scope

- **Invoice number capture** — Trevor said yes, but it is a schema change plus a UI field and it is
  not what is losing money today. Separate brief.
- **The `To Be Inv` nag** — same. Separate brief. (14 departed-not-done jobs are sitting there now.)
- **Backfilling the 5 missing rows** — happens *after* the fix ships, by Trevor, by hand.
- **Any edit-a-completed-row UI.** Ruled out by Trevor. See section 3.
- **`useFirebase.js`** — dead code, unrelated, do not touch it in this build.

---

## 5. Open questions for council

1. **Split jobs.** `handleMarkDone` is called per job with `job.id`. If split pieces can share an id
   with their parent, keying on job id would swallow a legitimate second row. Verify against
   `getJobSplits()` in `src/data/jobs.js` before committing to the key.
2. **The 1712 row has `job_number` null.** Repair it as part of this build, or leave it for Trevor's
   manual backfill? (Recommendation: repair it — the `jobs` row for 1712 has the number.)
3. **`doneJobIds`** is currently written alongside the records. Where does it live once the save is
   append-only, and does it have the same wipe problem?

---

## 6. Verification checklist (for `ggnz-verifier`, not the builder)

1. `grep -rn "clearCompletedJobs" src/` returns **nothing**. The function is gone, not just unused.
2. No `.delete()` anywhere against `completed_jobs`.
3. Mark a job done → the row count goes **up by one**. Existing rows unchanged (compare ids before
   and after).
4. **Hard-refresh, then immediately mark a job done before the page finishes loading** → the row
   count still goes up by one and nothing is lost. This is the exact reproduction from `pk-md-04`.
5. Mark the same job done twice → still one row, not two.
6. Reconfirm a job through `CatchUpInterview` → new row has a non-null `job_number`.
7. Simulate an insert failure → a warning toast appears; nothing is deleted.
8. Unit tests in the shape of `src/utils/supabaseParkingLot.test.js`, covering 3–5 above.

**Snapshot `completed_jobs` before any build work starts** — it holds one row, and that row is real
money.

---

## 7. Standing advice until this ships

**Do not mark jobs done in the app.** Every tick can wipe the previous line. Keep finished jobs on
paper or in the Daily Log and enter them once it is safe.

---

## 8. Protocol

Blast-radius: `src/hooks/useJobs.js` and `src/utils/supabase.js`, both named in CLAUDE.md. Three
prior failures. **Full agent-team protocol**, no shortcuts.

1. Trevor approves this brief ("yp")
2. Two `ggnz-council` reviewers — with section 5's open questions put to them explicitly
3. `ggnz-builder` on a staging branch, Build 1 only
4. `ggnz-verifier` runs section 6
5. Browser test on the Vercel preview, including check 4
6. Trevor approves the merge
7. Then Build 2, then Trevor's backfill

---

## Audit record

Audited 2026-08-07 against live code at `56b9834` and live Supabase.

- **Part 3 claims 1–5 of the source document: all five confirmed.** Line numbers had drifted in
  every case (e.g. `saveCompletedJobs` 1795 → 1830, `buildManualInvoiceJob` 326 → 359); the
  behaviour had not. `pk-md-04`'s cited `supabase.js:1163` is stale by ~670 lines.
- **Claim 4 understated it** — four callers reach `handleMarkDone`, not two.
- **Claim 5 understated it** — twelve files read the table, not eight.
- **Part 2's numbers: all confirmed live and unchanged.**
- **New, not in the source:** the silent error swallow (§1), the 5 missing rows against 6 done jobs
  (§1), the unstable `cj-<timestamp>` row id (§4.3), and the parking-lot fix as a working precedent
  in this codebase (§2). That last one is the most useful thing the audit turned up.
- Nothing in the source document was found to be wrong. Nothing was discarded.
