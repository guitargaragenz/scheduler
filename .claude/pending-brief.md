doc_status: live

# Pending Brief — The board follows the printout (departed jobs)

**Status: awaiting Trevor's approval ("yp"). Not yet at council.**

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

3. **Split cards leave with their parent.** When a parent departs, its derived/child cards
   go too — including the four already orphaned. Existing `deleteChildJobs()`
   (`src/utils/supabase.js:159`) is the starting point; derived cards are regenerated from
   the parent, so they need no archiving.

4. **Scheduled work must be handled, not ignored.** If a departing job holds a
   `calendarSlot` or Google Calendar event ids, decide and implement one behaviour — do not
   leave a slot pointing at a job that no longer renders. **Council must rule** on whether
   the GCal event is deleted, left in place, or surfaced to Trevor.

5. **The preview screen tells the truth.** `MissingBlock` currently reads "On the board but
   not on this printout" — passive. It must say these jobs will be removed on import, with
   the count, so Trevor sees the consequence before he presses Import. The existing
   count-mismatch refusal (Refusal 1, `pdfImportPlan.js:134-146`) already blocks a partial
   read from reaching this path; verify that guard still holds, because it is now the only
   thing standing between a misread PDF and jobs disappearing.

6. **Clear the existing 16 + 4 orphans** as part of the build, using the same code path the
   import will use — not a one-off script. If the mechanism can't clear the current backlog,
   it isn't the right mechanism.

7. **Jobs-by-Age import does not depart anything.** That PDF is a different population; its
   `missing[]` means "no date available", not "job finished". Leave it alone.

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
8. Scheduled slots and GCal events resolve per council's ruling on item 4 — no slot left
   pointing at a non-rendering job.
9. Existing test suite passes; new tests cover items 5, 6 and 7 specifically.

## Protocol

Blast-radius: `jobs[]` shape, `calendarSlot`, `scheduledSlots`, `useGoogleCalendar.js`,
`useSupabase.js`, `src/utils/supabase.js`. Full protocol required —
brief → two `ggnz-council` reviewers → `ggnz-builder` on a staging branch →
`ggnz-verifier` → browser test on the Vercel preview → Trevor's "yp" → merge.
