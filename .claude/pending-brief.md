# Pending Brief D — Rebuild the Sunday Board Meeting as a live Supabase-backed ritual

**Status:** Items 5 and 6 independently re-verified (all PASS). Supabase SQL migration RUN and confirmed working. Item 7 (focus-list auto-wipe) fixed, build clean, not yet independently verified — ready for Live Test
**Date:** 2026-07-25
**Repo state:** `main` @ `5cee3db` (Brief C — Firestore fully retired — SHIPPED & merged)
**Supersedes:** Brief C's slot in this file (Brief C is done; this file was just left stale pointing at it)

---

## Plain-English summary

The Sunday Board Meeting used to be a manual interview Trevor ran with an old Google
Sheet column. That died when the Sheet was replaced by Supabase — nothing writes a
Focus list anymore, there's no parts-to-order tracking, and the one attempt at
automating the meeting (`.claude/workflows/sunday-board-meeting.js`) still reads from
Firestore, which no longer exists in this app. It would fail on its first step if run
today.

This Brief rebuilds it as a **live conversational ritual, run in a chat session
(Claude Code) against real Supabase data** — not a coded UI screen, not an embedded
AI chat panel in the app. Trevor talks it through with whichever agent is running the
session; at the end, three things get written into the app so the coming week is
already set up and all that's left is doing the work, the books in MT, and workshop
cleanup.

This was arrived at through direct back-and-forth with Trevor (this chat, 2026-07-25),
correcting an earlier one-sided/report-only design and an earlier idea to build a
dedicated UI walkthrough screen — both rejected in favor of this live format.

---

## Scope — locked

**In scope:**

1. **Rewire the data source off Firestore onto Supabase.** Replace
   `scripts/board_meeting_export.mjs` (Firestore-only, now dead) with a Supabase read
   using the existing house pattern in `src/utils/supabase.js` (jobs, `parking_lot`,
   `pending_revenue_review`, completed-jobs data — whatever the live app already
   tracks there). No new read-side tables needed for this step.

2. **Restructure `.claude/workflows/sunday-board-meeting.js` into the validated
   10-step shape.** Per Council consensus on the pause-mechanism question: the
   `Workflow` tool call only owns steps 1, 2, and the auto-reportable pieces of
   Reports (Ops, Finance, quick-wins, Admin's scan-side candidate lists) — it
   returns one structured report object and stops. **Steps 3 through 10 — including
   Triage (8), Parking-lot review (9), and the final writes (10) — are NOT inside
   any Workflow call.** They run as ordinary turns in this live chat session, using
   the returned report object as input. This is also the fix for the Triage-seat
   bug below, since step 8 was never going to work as a scripted `agent()` call.
   1. Quick wins (short/easy schedulable jobs, smallest-hours-first) — unchanged from
      today's file
   2. Completed this week — auto-reported, unchanged
   3. Not completed (and why) — agent lists candidates, **Trevor gives the reason
      live in the session** (not auto-inferred)
   4. Coming up — agent lists candidates, **Trevor flags which have real deadlines**
      live (no `due:`-marker parsing — rejected earlier as overbuilding)
   5. Admin — parts to chase / tools to fix or buy / customers needing a call.
      **Both sourced ways, per Trevor's answer:** scan job data for signals (parts-
      blocked status, customer-waiting flags — this already exists in the current
      Admin seat prompt) AND Trevor adds anything live that isn't captured anywhere
   6. Challenges from the past week — live, agent may ask follow-ups
   7. Lessons to learn — live
   8. Triage — urgent pass on the **real job backlog** (not the app/dev parking
      lot) — what moves, what's dead weight, what's an emergency. This is a
      correction to the current file, whose "Triage seat" does the wrong thing
      (it currently triages `admin/context/parking-lot.md`, the app/dev backlog)
   9. Parking lot review — the app/dev backlog (`admin/context/parking-lot.md`),
      kept as its own separate step so it doesn't dilute #8
   10. Plan for the coming week — once Trevor decides, the agent writes:
       - the week's schedule into `scheduledSlots`/`calendarSlot`
       - the picked jobs into the existing `focus_list` table (via the existing
         `saveFocusList`/`useFocusList` pattern — no schema change, just a caller)
       - the Admin seat's parts-to-chase items into a **new** `parts_to_order` table

3. **New table: `parts_to_order`.** Columns: `id`, `description` (text), `category`
   (text: `'part' | 'tool' | 'other'`, default `'part'`), `needed_for_job` (plain
   nullable TEXT — not a foreign key, so removing/completing a job never cascades
   into deleting a still-open item), `added_at`, `resolved` (bool, default false —
   renamed from `ordered` since "fix this tool" isn't an "order"). Load/save/subscribe
   functions in `supabase.js` matching the house pattern (closest precedent:
   `pending_revenue_review`'s per-item CRUD, not the parking-lot clear-and-reinsert —
   items should persist individually across weeks until checked off, not get wiped
   each run). Needs one new function beyond the `pending_revenue_review` precedent:
   `markPartResolved(id, resolved)` (in-place update — no existing table does this).

4. **Fix two pre-existing Supabase bugs, found independently by both Council
   reviewers, that would otherwise make the rebuilt meeting non-functional:**
   - **`backlog` never actually saves.** `upsertJobsBatch()` (`src/utils/supabase.js`)
     and `src/utils/migrate.js` write `job.VB`/`job.BL`/`job.PJ` (uppercase), but the
     app's job objects only ever have `job.vb`/`job.backlog`/`job.project` (lowercase
     — set in `src/data/jobs.js` from the sheet's `BL` column). Confirmed by Trevor:
     backlog is determined in the Google Sheet column, so this is purely a
     write-path field-name bug, not a data problem. Since `backlog` is the base
     filter almost every report step derives from (quick-wins, schedulable,
     parts-blocked, stuck30/60), this must be fixed or the meeting reports near-empty
     on real data. Fix: rename the write-path fields to match (`job.vb`/`job.backlog`/
     `job.project`).
   - **`completed_jobs` drops invoice data.** The table has no `invoice_amount`/
     `week_key` columns, and `saveCompletedJobs()` never writes them even though
     `handleMarkDone()` (`src/hooks/useJobs.js`) computes both locally. Add the two
     columns and map them in `saveCompletedJobs()`/`loadCompletedJobs()`, or the
     Finance seat's `invoicedTotal` always reports $0.
   - **`days` (job age) has no Supabase equivalent** — no column stores it, and
     Supabase's `created_at` is row-creation time, not job-intake date. Rather than
     silently reporting wrong "stuck N days" numbers, the Builder should either add
     a real intake-date column sourced from the CSV import, or explicitly disable
     stuck30/60-style age reporting and say so plainly in the report text. Trevor's
     call at Live Test if not obvious — not a silent guess.

**Out of scope:**
- No new UI screen for the meeting itself (no `BoardMeetingPage`, no walkthrough
  cards) — an earlier direction in this design process, explicitly superseded.
- No embedded in-app AI chat panel — explicitly ruled out; the "interaction" is this
  chat session itself, not a new app feature.
- No changes to CSV import, PDF-drop, or any other parked idea from the original
  handoff file.
- No behavior change to the existing Focus-list read-side UI (Sidebar/JobShelf/
  DailyLog already highlight focus jobs correctly).
- Deciding the fate of `scripts/seed_focus_list.mjs` (stale one-off script) — separate
  call, not bundled here.

---

## Why this touches blast-radius files

Step 10 writes `scheduledSlots`/`calendarSlot` directly — on the blast-radius list in
`CLAUDE.md`. Full Agent-Team Protocol applies: Council → Builder (staging branch) →
Independent Verifier → Live Test → Merge on Trevor's "yp". The `focus_list` write is
a new caller on an existing, already-safe table (no schema risk). The
`parts_to_order` table is new but additive and isolated — nothing else in the app
reads or writes it yet, so its risk is contained to "does the new table/functions
work," not "did we break something existing."

## Risks to watch

- One production Supabase DB, no sandbox — the three end-of-meeting writes are real
  writes on first live run. Verifier should confirm each write path individually
  before the first real Sunday run.
- **Naming collision:** the Supabase `parking_lot` table (`loadParkingLot`/
  `saveParkingLot` in `supabase.js`, backs the in-app `ParkingLotPage.jsx` —
  app/product feature ideas) is unrelated to `admin/context/parking-lot.md` (the
  file steps 8/9 actually need). Builder must not wire step 9 to the Supabase
  table by mistake — it's the markdown file.
- `days`/stuck-N-days reporting has no data source post-Firestore (see scope
  item 4) — Builder must either add a real column or explicitly degrade this
  report, never guess silently.

## Scope item 5 — Verifier finding, folded in via "yp" 2026-07-25

**`normalizeJobsFromDb()` in `src/hooks/useSupabase.js` builds job objects with
uppercase `VB`/`BL`/`PJ` property names, but the rest of the app has always read
lowercase `job.vb`/`job.backlog`/`job.project`** (set in `src/data/jobs.js` at
CSV-parse time — confirmed by Trevor: the *column* names have always been
uppercase `VB`/`BL`/`PJ`, that's not new; what's wrong is this one function's
output shape doesn't match what `JobCard.jsx`, `Sidebar.jsx`, and
`ProjectsPage.jsx` actually read). Every job loaded from Supabase currently gets
`job.vb`/`job.backlog`/`job.project` = `undefined` — the VB badge, the Sidebar
active/backlog split, and the Projects page all silently see nothing, on every
load, in the live app (not just the export script).

Also confirmed by Verifier: `normalizeJobsFromDb()` never sets `schedulable`/
`readyToStart`/`awaiting`/`inTransit` at all — these are the flags
`deriveJobStatusFlags()` (added in commit `79b7f47`) computes, but nothing calls
it from the Supabase read path.

**Fix:** in `normalizeJobsFromDb()`, map `j.vb`/`j.bl`/`j.pj` to lowercase
`vb`/`backlog`/`project` (matching `jobs.js`'s shape), and call
`deriveJobStatusFlags(status, action, backlog)` per row to set `schedulable`/
`readyToStart`/`awaiting`/`inTransit`, the same way `jobs.js` already does.
Pre-existing bug, outside Brief D's original scope, folded in because it
directly affects whether the board meeting's Supabase reads are accurate in the
live app UI, not just in the export script.

Fixed in commit `1cc0e43`. **Independently re-verified — all 5 checks PASS.**

## Scope item 6 — found while cleaning up after item 5, 2026-07-25

**`toJobRow()` / `JOB_COLUMN_MAP` in `src/utils/supabase.js` had the same
uppercase-vs-lowercase mismatch, on the *write* side.** `JOB_COLUMN_MAP` still
carried stale `VB`/`BL`/`PJ` keys, which never match a real app-shape job (always
lowercase `vb`/`backlog`/`project` per `src/data/jobs.js:214-216`). So every
partial write going through `toJobRow()` silently dropped those three fields
instead of writing them to the `vb`/`bl`/`pj` columns.

Found while investigating whether the Verifier's "harmless dead code" call on
`toJobRow()` was safe to clean up. **The Verifier's dead-code claim was wrong** —
`toJobRow()` is live, called from `saveJob()` (`supabase.js:58`) and
`batchWriteJobsState()` (`supabase.js:1093`), with a real caller chain through
`App.jsx:767` → `pickMasterFields()` → `saveJob()` → `toJobRow()`. Not
destructive (columns omitted from a Supabase upsert aren't nulled, just left
untouched), but real functionality loss on every partial save.

**Fix:** added `JOB_BOOLEAN_YN_COLUMN_MAP` (`vb`→`vb`, `backlog`→`bl`,
`project`→`pj`) with a boolean→`'Y'`/`'N'` transform in `toJobRow()`, checked
before the `JOB_COLUMN_MAP` lookup — matching the `'Y'`/`'N'` convention
`upsertJobsBatch()` already uses on the CSV-import write path
(`supabase.js:196-198`), and what `normalizeJobsFromDb()` reads back
(`useSupabase.js:35,60,62`). Committed as `978940f`.

**Independently re-verified 2026-07-25 — all 7 checks PASS, verdict READY TO
MERGE.** Verifier confirmed: the bug was real, the Y/N convention matches both
the existing write path and the read path end-to-end, the caller chain is live
(not dead code), full writes don't regress, and a partial write that omits `vb`
entirely does *not* get coerced to `'N'` (`Object.keys(fields).forEach` only
touches keys actually present). `npm run build` clean; only
`src/utils/supabase.js` touched.

## Scope item 7 — focus-list auto-wipe, found 2026-07-25, approved ("yp to all")

**Context:** Trevor noticed the Focus list had disappeared. Investigation showed
the *historical* cause was the Firestore→Supabase migration in Brief C: the list
lived at Firestore `ggnz/focusList`, only the Daily Log was migrated, no
focus-list migration script was ever written, and the Supabase `focus_list`
table has been empty since it was created. Trevor called this correctly ("it was
there with firestore so must have dropped out when we scrapped firestore"); my
initial lean toward the bug below as the cause was wrong. Recovered read-only
from Firestore: 15 job IDs, `updatedAt` 2026-07-22 — **10 still map to live jobs,
5 no longer exist.** Nothing has been written to Supabase; restoring them is a
separate open decision for Trevor.

**Separate real bug found during that investigation** (a *future* risk, not the
historical cause, but it directly threatens this Brief's final step of writing
picked jobs to `focus_list`): a single failed read on startup permanently
deleted the entire focus list 500ms later.

- `loadFocusList()` returned `[]` on error — indistinguishable from a genuinely
  empty list.
- `useFocusList.js` set `ready = true` regardless, arming the debounced
  auto-save.
- `saveFocusList()` clears the whole table before inserting, so that auto-save
  wrote the bogus empty list over the real rows. Non-recoverable.
- `clearFocusList()` swallowed its own errors, and a failed insert *after* a
  successful clear left the table empty with no restore.

**Fix** (`src/utils/supabase.js`, `src/hooks/useFocusList.js`):
1. `loadFocusList()` returns `null` on genuine failure, `[]` only for a real
   empty list.
2. `useFocusList` only sets `ready` after a successful read — a failed read
   leaves the session read-only (logged) rather than arming a destructive write.
   A reload retries.
3. `subscribeToFocusList()` drops realtime events whose re-read failed instead
   of handing `null` to the caller.
4. `saveFocusList()` snapshots existing rows, restores them if the insert fails,
   refuses a non-array argument, and returns a success boolean.
5. `clearFocusList()` now throws instead of swallowing, so a failed clear aborts
   the save rather than inserting on top of rows it assumed were gone.
6. `useFocusList` tracks the last-persisted value and skips the redundant
   write-back that previously fired immediately after every load.

Fixed directly rather than via subagent, same as item 6: contained to two
functions plus one hook, and none of the blast-radius files (`scheduledSlots`,
`calendarSlot`, `useGoogleCalendar.js`, `useFirebase.js`, `jobs[]` shape) are
touched. `npm run build` clean; `git status --short` shows only the two intended
files.

**Independently verified 2026-07-25 — items 1, 2, 3, 4, 6, 8 PASS; item 7 FAIL;
verdict NEEDS WORK.** The original destructive wipe is genuinely fixed, but the
Verifier found a real lost-update introduced by the `persistedRef` skip: with
persisted = X, a save of Y in flight, and the user reverting to X mid-flight,
the effect saw `next === persistedRef` and skipped, then the resolving save set
`persistedRef = Y` — leaving local X, DB Y, nothing scheduled, and the realtime
echo suppressed by the 3000ms `justSavedAt` window. It also flagged that the
restore path used `insert`, which is guaranteed to collide on the primary key
when the *clear* was what failed (rows still present).

**Follow-up fix (commit below):**
- `saveTick` state bumped after every completed save, added to the effect deps,
  so the save effect re-diffs against current state once a save resolves —
  closing the lost-update window.
- `failedSavesRef` caps consecutive failed saves at 3, so the new retry-on-tick
  behaviour can't hammer a failing database every 500ms.
- Restore path switched from `insert` to `upsert(..., { onConflict: 'id' })`,
  so it works whether the rows were deleted or are still present.

Verifier's remaining open notes, accepted and NOT fixed here: (B) a failed save
is console-only with no UI signal, and (C) a realtime event resolving before the
initial load can pin stale data until reload. Both are low severity, and per
`App.jsx:194` only `focusList` is consumed — `setFocusList` has no UI caller
today, so neither can fire until this Brief wires board-meeting picks in. Worth
revisiting when that lands.

**Focus list restored 2026-07-25:** the 10 recovered IDs that still map to live
jobs were written to `focus_list` at Trevor's request, to confirm the pill works
end to end ahead of Sunday. Verified in-app: pill reads "🎯 Focus (10)" and
filters correctly. The shelf lists 7 of them, not 10 — #1626, #1698 and #1702
are done and already on the calendar, so the shelf (jobs *waiting*) excludes
them by design. These 10 are a placeholder; Sunday's meeting replaces them.

## Council findings (resolved into scope above)

Both independent Council reviewers reached the same conclusions on all three
questions — see scope items 2, 3, and 4 above for the resolutions. Full reviewer
output available in this session's transcript if a rationale needs re-checking.

---

## Method — agent-team protocol

- **Council — DONE.** Two independent agents reviewed. Findings folded into scope
  above (items 2, 3, 4).
- **Builder — starting now.** Staging branch. Rewires the export, restructures the
  workflow file per the Workflow/chat split, adds the `parts_to_order` table +
  functions, fixes the `bl`/`vb`/`pj` write-path bug and the `completed_jobs`
  invoice/week columns, resolves the `days` gap, wires the three end-of-meeting
  writes.
- **Independent verifier** — separate agent: confirms the Supabase read returns
  equivalent data to the old Firestore export for every field the Reports/Schedule
  phases use, confirms the Triage seat now targets the real job backlog (not
  parking-lot.md), confirms all three end-of-meeting writes land correctly and don't
  collide with existing tables/hooks.
- **Live test** — Trevor runs the rebuilt meeting live, this Sunday if ready: quick
  wins/completed/admin auto-report correctly, live-input steps genuinely pause for
  his input, and after Plan for the coming week, the schedule/focus list/parts list
  all show up correctly in the actual app.
- **Merge** — Trevor's "yp".

---

## Approved

Scope amendment approved via "yp" (2026-07-25, in response to the two bug findings).
Builder starts on a staging branch next.
