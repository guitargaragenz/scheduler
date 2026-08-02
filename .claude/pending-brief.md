doc_status: closed

# Pending Brief — The board follows the printout (departed jobs)

**Status: council complete (two `ggnz-council` reviewers, 2026-08-02). Amended per their
rulings — see "Council rulings and amendments" below. Awaiting Trevor's approval ("yp") of
the amended brief before `ggnz-builder` starts.**

> Previous occupant of this file — "One Parking Lot, fed from the Daily Log (Merge A)" —
> shipped 2026-08-01 at `05b11cc`; its record is in git history. Its unbuilt follow-up,
> **Merge B (the `#PL` tag)**, is still open and still approved:
> [docs/briefs/one-parking-lot-fed-from-bujo.md](../docs/briefs/one-parking-lot-fed-from-bujo.md).
> Council amendment F remains binding — the parking-lot write must be fire-and-forget from
> `addBullet`, never inside `updateState`/`performSave`/`readyRef`.

## The problem, in Trevor's words

He uploaded both PDFs on 2026-08-02 and the Jobs Sheet "hasn't updated at all", with the
Matchless job (1619) still sitting there weeks after it finished.

Both halves checked against live Supabase and against the printout he supplied
(`Jobs 2:8.pdf`, "39 Jobs found"):

- **The import works.** All 39 printout jobs are on the board, correct, and were rewritten
  at 08:36 that morning. Nothing on the printout is missing. The sheet looked unchanged
  because the 39 came back with identical field values.
- **The board holds 55 top-level jobs.** The extra 16 are jobs Multitrack has dropped —
  finished or invoiced — that the app has never let go of:

  1619, 1620, 1626, 1671, 1682, 1683, 1684, 1685, 1686, 1687, 1688, 1689, 1690, 1698,
  1702, 1710

  (1619 Matchless DC30 and 1620 Marshall Plexi — Sheep as Chips; 1682–1690 the Papamoa
  College uke/keys batch, mostly "To Be Invoiced"; the rest finished over the prior fortnight.)
- **Four orphaned split cards** are still on benches under departed parents:
  `1620_Electronics_0`, `1620_Electronics_1`, `1689_Luthier_0`, `1689_Luthier_1`.
- Statuses on all 16 are frozen at whatever the last printout said. "Active" on 1619 is
  weeks stale and means nothing.

## Root cause

`buildPdfImportPlan()` (`src/data/pdfImportPlan.js:174-181`) computes `missing[]` — jobs on
the board that are not on the printout — and the preview modal displays it
(`PdfImportPreviewModal.jsx:24`, `MissingBlock`). Nothing ever acts on it. The code comment
is explicit that this was deliberate for Build 1a: *"Reported, never acted on… 'usually' is
not good enough to delete live job data on, so this build only tells Trevor."*

That was a reasonable first cut. It was never finished. The consequence is that the board
only grows, and 29% of it is now dead.

**Trevor's verdict, and this brief agrees:** the sheet is supposed to mirror Multitrack.
If it needs manual pruning, or a script run by Claude, it is built wrong. Upload the
printout, and the board becomes the printout — automatically, no button for him to press.

## Scope — what to build

1. **Departure is automatic on Multitrack import.** No confirmation step, no checkbox list.
   Jobs in `plan.missing` come off the board as part of committing the import.

2. **Nothing is hard-deleted.** A departed job keeps every app-owned field — tag, action,
   hours, bench, VB/BL/PJ, pomo log, bump history, session notes — and is recoverable if
   Multitrack ever drops a job by mistake.

   **Recommended mechanism: soft delete via a new `jobs.departed_at TIMESTAMPTZ` column.**
   The row stays; `normalizeJobsFromDb()` filters out anything with `departed_at` set; a
   returning job number simply has it cleared. Additive, nullable, safe on existing rows.

   **⚠ Do NOT archive into `completed_jobs`.** That table is cleared and re-inserted
   wholesale on every save (`saveCompletedJobs()` → `clearCompletedJobs()`,
   `src/utils/supabase.js:1422-1460`). It is the weekly-revenue ledger driven by the app's
   own "done" flow, not a general archive — anything the import wrote there would be wiped
   by the next completed-jobs save. Council should confirm the soft-delete choice or propose
   a dedicated table, but this route is closed.

   **✅ Council confirmed the soft-delete choice (both reviewers, independently).** Both also
   re-checked the `completed_jobs` claim above against the live code and confirmed it. No
   dedicated table.

   **⚠ Amendment 1 (blocking) — the return path does not work as designed.**
   `buildPdfImportPlan()` decides "already on board vs new" from the in-memory `jobs[]`
   (`src/data/pdfImportPlan.js:162-163`), which `normalizeJobsFromDb()` will already have
   filtered departed jobs out of. A returning job number therefore falls to
   `newJobs.push(buildNewJob(...))` (`pdfImportPlan.js:171`), and `writePdfImportBatch()`
   writes only the `PDF_NEW_JOB_FIELDS` allow-list (`src/utils/supabase.js:230-232`), which
   does not include `departed_at` — so the upsert never clears it. The job stays invisible
   forever with its hours and notes stranded, and checklist item 5 fails silently.

   The importer must resolve incoming job numbers against an **unfiltered** read of the
   `jobs` table, not against the filtered in-memory `jobs[]`, and must explicitly write
   `departed_at: null` when a departed job number returns.

3. **Split cards leave with their parent.** When a parent departs, its derived/child cards
   go too — including the four already orphaned.

   **⚠ Amendment 2 (correction) — the `deleteChildJobs()` reference below was wrong; do not
   follow it for the four named cards.** ~~Existing `deleteChildJobs()`
   (`src/utils/supabase.js:159`) is the starting point~~ — that function issues a hard
   `DELETE ... WHERE parent_id = ...` against real `jobs` rows (manually created subtasks).
   The four orphans (`1620_Electronics_0/1`, `1689_Luthier_0/1`) are **auto-split bench
   cards**: `isDerived: true`, never written to the `jobs` table, regenerated on every load
   by `expandAutoSplits()` (`src/data/joinJobs.js`). Once the parent is filtered out by
   `departed_at` they simply stop being generated. Nothing to delete.

   `deleteChildJobs()` still applies to genuine child rows in the `jobs` table, if a
   departing parent has any. Builder must distinguish the two cases rather than treating all
   split cards alike.

4. **Scheduled work must be handled, not ignored.** If a departing job holds a
   `calendarSlot` or Google Calendar event ids, decide and implement one behaviour — do not
   leave a slot pointing at a job that no longer renders. ~~**Council must rule** on whether
   the GCal event is deleted, left in place, or surfaced to Trevor.~~

   **✅ Amendment 3 (council ruling — the two reviewers split; ruling made in the main
   session).** Two separable things, handled differently:

   **(a) The app's own `scheduledSlots` entries: delete immediately, on departure, always.**
   Not optional and not conditional on (b). Both reviewers required this and the brief as
   written omitted it. `App.jsx:338-342` builds `scheduledJobObjects` with
   `jobs.find(j => j.id === jobId)` and only renders when found, so an orphaned slot looks
   like an *empty* cell — but `scheduledSlots[key]` still holds the stale id, and
   `useScheduler.js:59` treats any truthy entry as occupied. Result: a slot that appears free
   but silently refuses a booking or triggers a phantom displacement, with nothing on screen
   explaining why. Delete the rows, and clear `calendarSlot` / `gcalEventId` / `gcalEventIds`
   on the departing job.

   **(b) The Google Calendar event: propose it for deletion through the existing sync
   confirm step. Do not delete it automatically on import.**

   Reviewer B is right that `unscheduleJob()` (`src/hooks/useScheduler.js:419-475`) already
   deletes GCal events, and its ordering is the correct pattern to reuse — DB write persists
   first, `deleteEvent()` only after, because a deleted event cannot be restored. Reviewer A
   is right about what differs: `unscheduleJob()` runs because Trevor dragged a job off the
   schedule and knows a booking is about to die. Departure runs unattended off a PDF upload.

   Deciding factor: Refusal 1 (`pdfImportPlan.js:134-146`) catches a *misread* PDF, not a
   *wrong* PDF. A filtered subset, a stale export, or the wrong Multitrack report can be
   internally consistent — stated count equals parsed rows — and pass cleanly, at which point
   everything outside it departs. A departed job is recoverable by design; a deleted customer
   booking is not. The two must not carry the same risk.

   So: departing jobs holding GCal event ids are flagged into the next `previewSync()` plan
   as proposed deletions and removed only on Trevor's confirm (`confirmSync()`,
   `useGoogleCalendar.js:468`) — the approval step every other calendar write in this app
   already goes through. Reuse `unscheduleJob()`'s write-then-delete ordering when he
   confirms.

4b. **⚠ Amendment 4 (blocking) — departures must not trigger the pending-revenue review.**
   Both reviewers found this independently. `detectDisappearedJobs()`
   (`src/hooks/useSupabase.js:21-28`) diffs the previous normalized job list against the new
   one on every realtime update and reports anything missing via `onJobsDisappeared`, wired
   to `usePendingRevenueReview`'s `addDisappearedJobs()` (`src/App.jsx:144-151`). The instant
   `normalizeJobsFromDb()` starts filtering `departed_at`, every legitimate departure looks
   like a silent CSV-drift disappearance and gets queued for Trevor's "did this get
   invoiced?" review — 16 false prompts on the very import meant to fix the problem, and a
   direct contradiction of this brief's own out-of-scope line on revenue.

   The disappearance diff must distinguish a deliberate departure from a true drift
   disappearance and suppress the former. A true CSV-drift disappearance must still be
   reported as it is today — do not disable the detector.

5. **The preview screen tells the truth.** `MissingBlock` currently reads "On the board but
   not on this printout" — passive. It must say these jobs will be removed on import, with
   the count, so Trevor sees the consequence before he presses Import. The existing
   count-mismatch refusal (Refusal 1, `pdfImportPlan.js:134-146`) already blocks a partial
   read from reaching this path; verify that guard still holds, because it is now the only
   thing standing between a misread PDF and jobs disappearing.

   **Amendment 5 (scope note).** Council confirmed Refusal 1 is real and line-accurate, but
   it only catches a *count* mismatch. A wrong-population PDF — a filtered subset, a stale
   export, the wrong Multitrack report — can have stated count equal to parsed rows and pass
   cleanly. This preview screen is therefore the actual last line of defence, not a courtesy,
   which raises the bar on the copy: state the count **and list the job numbers being
   removed**, so a wrong report is obvious on sight. Do not treat Refusal 1 as sufficient on
   its own.

6. **Clear the existing 16 + 4 orphans** as part of the build, using the same code path the
   import will use — not a one-off script. If the mechanism can't clear the current backlog,
   it isn't the right mechanism.

   **Amendment 7 (Trevor, 2026-08-02) — preview before live.** The clear runs on the Vercel
   preview first, against a copy, so Trevor can see the board at 39 before anything touches
   live data. Only after he's looked at it does the same path run against the real board.
   The builder stops at the preview clear and hands back — it does not run this live.

7. **Jobs-by-Age import does not depart anything.** That PDF is a different population; its
   `missing[]` means "no date available", not "job finished". Leave it alone.

   **⚠ Amendment 6 (blocking) — this must be enforced structurally, not intended.** Council
   found nothing in `pdfImportPlan.js` that distinguishes import type; today the separation
   is convention only. Departure logic must live behind an explicit code-level gate — a
   separate function, or a required parameter that JBA's path cannot satisfy — so that no
   future edit can make the Jobs-by-Age path write `departed_at`. A comment is not a guard.
   Builder must demonstrate this, not assert it.

## Out of scope

- Any UI for browsing or restoring departed jobs. Recovery is possible at the data layer;
  a page for it is a separate build.
- Revenue/invoicing behaviour. A departed job is not the same event as a completed job and
  must not start feeding the weekly revenue numbers.
- The Jobs-by-Age importer, beyond item 7.
- Job 1714 — booked in the afternoon of 2026-08-02, on the Multitrack printout but not yet
  in Jobs-by-Age, so it shows no age. Correct behaviour, self-resolving on the next JBA
  export. Nothing to fix.

## Verification checklist (for `ggnz-verifier`, never the builder)

1. Importing `Jobs 2:8.pdf` against the current board leaves exactly 39 top-level jobs.
2. All 16 listed job numbers are gone from the Jobs Sheet, the Sidebar, the Jobs page and
   the Projects page.
3. The 4 orphaned split cards are gone from their benches.
4. Every departed row still exists in Supabase with its tag, action, hours and bench intact.
5. A departed job number reappearing on a later printout comes back onto the board with
   those fields still attached — not as a blank new job.
6. A PDF whose stated count doesn't match its parsed rows still refuses outright and
   departs nothing.
7. No job that IS on the printout is departed. (Regression guard: this failure mode is
   silent and destructive.)
8. Scheduled slots and GCal events resolve per the ruling in item 4 — no slot left
   pointing at a non-rendering job.
9. Existing test suite passes; new tests cover items 5, 6 and 7 specifically.

Added by council:

10. **No phantom-occupied slots.** After a scheduled job departs, its `scheduledSlots`
    entries are gone from the DB — verified by booking another job into that exact slot and
    confirming it accepts cleanly, with no displacement prompt and no silent refusal.
    (`useScheduler.js:59` treats any truthy entry as occupied, so an empty-looking cell is
    not proof.)
11. **No GCal event deleted without confirmation.** Importing a printout that departs a
    scheduled job deletes nothing in Google Calendar at import time; the event appears as a
    proposed deletion in the next sync preview and is removed only after `confirmSync()`.
12. **No false revenue prompts.** Departing all 16 jobs raises zero pending-revenue-review
    entries. Separately confirm the detector still fires for a genuine CSV-drift
    disappearance — item 12 must not be satisfied by breaking `detectDisappearedJobs()`.
13. **Jobs-by-Age cannot depart.** Verified at code level (the gate from item 7), not just
    by running a JBA import once and observing nothing happened.
14. **Return-path integrity end-to-end.** Depart a job, confirm it is off the board, then
    re-import a printout containing it and confirm it returns with tag, action, hours,
    bench and notes intact and `departed_at` cleared in the row. This is checklist item 5
    proven against the live path, not a unit test.

## Council rulings and amendments (2026-08-02)

Two `ggnz-council` reviewers, run independently. Both verified the brief's factual claims
against live code rather than taking them as given.

**Agreed without qualification:**
- Soft delete via `jobs.departed_at` is the right mechanism. No dedicated table.
- The `completed_jobs` warning in item 2 is accurate — that table is genuinely cleared and
  re-inserted wholesale, so it cannot serve as an archive.
- `normalizeJobsFromDb()` is the single read-side choke point; filtering there does reach
  every screen (Jobs Sheet, Sidebar, Jobs page, Projects page).

**Verdict: approved in principle, not buildable as originally written.** Six amendments,
four of them blocking:

| # | Amendment | Blocking | Found by |
|---|---|---|---|
| 1 | Return path is broken — resolve job numbers against an unfiltered read and write `departed_at: null` | ✅ | A |
| 2 | `deleteChildJobs()` is the wrong tool for the four orphans (they are never persisted) | — | B |
| 3 | Calendar: clear `scheduledSlots` immediately; route the GCal event through sync confirm | ✅ | both (split) |
| 4 | Suppress `detectDisappearedJobs()` for deliberate departures | ✅ | both |
| 5 | Preview screen must list the job numbers, not just the count | — | B |
| 6 | Jobs-by-Age exclusion needs a code-level gate, not a comment | ✅ | B |

**Where the reviewers split:** item 4, the Google Calendar event. A ruled "surface to
Trevor, never auto-delete" (no calendar write in this app has ever skipped his confirm). B
ruled "delete it, reusing `unscheduleJob()`" (the precedent already exists). Resolved in the
main session in A's favour on the substance, with B's write-then-delete ordering adopted —
reasoning recorded inline at item 4(b). The deciding argument is that Refusal 1 guards
against a misread PDF but not a wrong one, and a deleted customer booking is not
recoverable while a departed job is.

## Protocol

Blast-radius: `jobs[]` shape, `calendarSlot`, `scheduledSlots`, `useGoogleCalendar.js`,
`useSupabase.js`, `src/utils/supabase.js`. Full protocol required —
brief → two `ggnz-council` reviewers → `ggnz-builder` on a staging branch →
`ggnz-verifier` → browser test on the Vercel preview → Trevor's "yp" → merge.
