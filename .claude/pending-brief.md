---
doc_status: live
---

# Scope lock — clear a mark from the job card (REVISION 2 after council round 1; approved "yp" 2026-10-04)

Background only (don't follow unless this page can't answer a question):
[parked-tick-off-from-job-card.md](../docs/briefs/parked-tick-off-from-job-card.md). Council round 1
(two reviewers, both "not yet") found the four fixes folded in below. Why Trevor wants it: quicker
than going to the Jobs Sheet.

## Build
In the job drawer (desktop) and job sheet (phone), a **"Marks on this job"** block lists the marks
the job carries, each with a **Clear** button:
- Action values **WP, CI, INC, RS-C, DG** — Clear writes `action = null` (not blank text).
- **VB** and **BL** — Clear sets that flag false.

INC, RS-C, DG, VB, BL move a job between piles; CI changes the "awaiting" state; WP is label-only.
Clearing one mark never touches another. After a clear, the pile re-derives at once
(`applySheetEdits` + `statusFlagsFor`) and the Parts Arrived banner drops when WP is cleared.

## Four council fixes (binding)
1. **Card refreshes.** In `App.jsx` pass the live job (`jobs.find` by id, fall back to
   `editingJob`) to both `JobDrawer` and `MobileJobSheet`, and to the drawer's `onSave`, so a later
   split can't copy a stale mark onto new pieces.
2. **Sparse write.** One changed column plus `job` (NOT NULL), through `batchWriteJobsState` like
   `buildSheetWrites`. Never `jobsStateFieldsFor`. Set `justSavedAt` *before* the write; update
   `jobs[]` in memory only if `res.ok`. On failure leave the card alone and show a toast.
3. **Top-level jobs only.** Show the block only when `isTopLevelJob` (`pdfImportPlan.js:17`) is
   true. Don't hand-roll a new check.
4. **Files:** `JobDrawer.jsx`, `MobileJobSheet.jsx`, `App.jsx`, `jobsSheet.js` (reuse), and
   `useJobs.js` if the handler lives there — builder says which owns it.

## Out of scope
GTS, RS, FB, PJ; *setting* any mark from the card. Tag, hours. Any Sheet change. PDF import.
Bulk clearing. Changing what a mark means. Calendar and `scheduledSlots` (untouched).

## Binding rules
- Existing `batchWriteJobsState` only — **no new write path**.
- A job is never Backlog and Waiting Parts at once; clearing only removes marks.
- Blast-radius (`jobs[]` fields, Supabase save) → full agent-team protocol.
- Builder first runs a read-only count of live jobs carrying these marks, and reports it.
- Browser test must include: clear a mark, **wait 6 seconds**, still cleared; clear then Save the
  drawer, still cleared; clear while the Jobs Sheet page has unsaved edits in another tab.

## Decided
Trevor chose the card block and reconfirmed "yp" 2026-10-04. Council round 2 (both "not yet" for
wording only, all asks folded in above). Next: Trevor approves the final wording, then builder.
