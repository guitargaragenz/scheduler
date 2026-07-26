# Pending Brief D — Rebuild the Sunday Board Meeting as a live Supabase-backed ritual

**Status:** **SHIPPED & MERGED to `main` 2026-07-25** — Trevor approved the merge; all 10 staging
commits fast-forwarded onto `main` at `da1d9af`, pushed, production build clean. Items 5 and 6 were
independently re-verified (all PASS). Supabase SQL migration RUN and confirmed working. Item 7
(focus-list auto-wipe) fixed, independently verified (items 1–4, 6, 8 PASS; item 7 flagged, then
re-fixed in `a0133e3`), build clean. **Live Test PASSED 2026-07-25** at runtime, not by code
reading — a blocked `loadFocusList()` read logged the read-only warning, attempted **zero** writes
to `focus_list`, and left all 10 rows intact; a negative control with the `ready` gate removed
attempted `DELETE` + restore `POST`, proving the gate is what prevents the wipe. One protocol step
was deliberately skipped and disclosed: no Vercel preview click-through — testing ran on the dev
server against the real Supabase database instead, which is the harder test. **Remaining:** Trevor
runs the rebuilt Sunday board meeting live (Sunday 26 July 2026) — now off `main`.
**Date:** 2026-07-25
**Repo state:** `main` @ `da1d9af` (was `46a10ab` pre-merge; Brief C shipped earlier at `5cee3db`)
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

**Live Test result, 2026-07-25 (the one thing item 7 still needed).** Proven at runtime, with
Trevor at the keyboard, that a *failed read* refuses to arm the auto-save — previously only
verified by reading the code. Method: a temporary `index.html` fetch shim rejected only
`loadFocusList()`'s request (the one carrying `order=created_at`), leaving `saveFocusList()`'s
own select/delete/insert fully live, so a broken gate would really have wiped the table.

- **Fix in place:** the expected `Focus list failed to load — auto-save disabled this session…`
  error logged, **zero** write requests to `focus_list` were attempted, and the table still held
  all 10 rows.
- **Negative control** (gate deliberately removed to re-create the pre-fix bug, writes blocked at
  the shim so live data was never at risk): the app attempted `DELETE /focus_list?id=neq.` — the
  wipe — followed by the restore `POST …on_conflict=id`, three times, then correctly stopped at
  the 3-consecutive-failure cap. This proves the `ready` gate is what prevents the wipe, so the
  clean run's "no writes" is a real pass and not a vacuous one. It also exercised the restore
  path and confirmed it uses `upsert`.
- Clean reload afterwards: pill back to "🎯 Focus (10)", zero console errors, table untouched at
  10 rows. Both temporary edits reverted; `git status` clean apart from pre-existing untracked
  handoff notes.

**Pill-count decision — Trevor, 2026-07-25:** the pill should count **only the jobs it actually
shows**, so the label always matches what appears when you click it. The focus list itself still
stores all 10. **BUILT 2026-07-25** at Trevor's explicit go-ahead, in all three call sites — each
already computes a `focusSet`, so the count now comes from that filtered list instead of
`focusList.length`:

- `src/components/JobShelf.jsx` — counts against `topLevel` (drops done + scheduled) → reads **7**
- `src/components/Sidebar.jsx` — counts against `unscheduled` → reads **7**. Named
  `focusPillCount`, because `focusCount` was already taken further down the file for the
  focus-mode split count.
- `src/components/DailyLogPage.jsx` — counts against `availableJobs` → reads **7** (see the
  app-wide rule below; `availableJobs` now drops done + scheduled)

Each gate (`focusList.length > 0`) was switched to the new count too, so a pill never renders with
nothing behind it.

**Follow-on fix — Trevor, 2026-07-25:** Trevor spotted that Week View's number was still 10 and
called it: the sidebar was counting completed jobs. Root cause was not the pill — `unscheduled` in
`src/components/Sidebar.jsx` filtered `!j.scheduled && !j.parentId` with **no `!j.done`**, so
finished jobs were padding *every* section of the drag-onto-the-calendar list, not just the focus
filter. The Job Shelf had always dropped them; the sidebar was the odd one out. Added `&& !j.done`.

Verified live 2026-07-25: shelf pill reads "🎯 Focus (7)" and clicking it reveals exactly those 7
(#1520, #1582, #1505, #1703, #1621, #1632, #1679); Week View sidebar pill now reads **7** and
reveals the same 7; with the focus filter off the sidebar lists 44, matching the shelf's
"44 JOBS WAITING" (it used to be padded with the done ones). Zero console errors,
`npm run build` clean.

**App-wide rule — Trevor, 2026-07-25:** *"A job completed is a job completed everywhere. Nothing
should be tracking a completed job."* This supersedes the per-view reasoning above (I had argued the
counts could legitimately differ per list, and that the phone Daily Log could keep done jobs because
you might log against a just-finished job — Trevor rejected both). The pill now reads the same
number on every device because every list starts from the same pool rule: **no done jobs, no
scheduled jobs, no subtask children.**

Swept every job-derived list in `src/` (`grep` for `jobs.filter` / `.done`) and fixed the four that
were tracking finished work:

- `src/components/JobShelf.jsx` — already correct (`!j.done` since it was written)
- `src/components/Sidebar.jsx:62` — added `&& !j.done` (the root cause of the wrong Week View count)
- `src/components/DailyLogPage.jsx:804` — `availableJobs` now `!j.done && !j.scheduled`
- `src/components/JobsPage.jsx:17` — `topLevel` now `!j.parentId && !j.done`
- `src/components/ProjectsPage.jsx:133` — `projects` now `!j.done`. No done project jobs exist right
  now, so nothing visibly changed — this one is preventative.

Deliberately left as-is, with reasons:

- `src/components/CalendarGrid.jsx:29` (`isDone`) — renders the "✓ done" badge on work already on the
  calendar. That's a *record* of what happened, not a list tracking outstanding work.
- `src/hooks/useFirebase.js:22` and `src/hooks/useSupabase.js:25` — `!j.done` inside
  deletion-detection guards. Blast-radius, untouched.
- `src/App.jsx:789`, `src/hooks/useDailyLog.js`, `src/components/CatchUpInterview.jsx` — these are
  `bullet.done` (log lines), a different thing from `job.done`.
- `src/hooks/useGoogleCalendar.js:298` — filters scheduled jobs for calendar sync, same
  record-not-list reasoning as CalendarGrid.
- Everything else the grep turned up is a lookup by `id` / `parentId` (subtask expansion, deep
  links, pomodoro), not a tracking list.

Verified live 2026-07-25 against the database (4 done jobs: #1702, #1698, #1626, #1671):

- Job Shelf (desktop): "🎯 Focus (7)", 44 jobs waiting
- Week View sidebar: "🎯 Focus (7)", same 7, total 44 with focus off
- Daily Log (phone, 375×812): "🎯 Focus (7)", tapping it reveals exactly those 7
- Jobs register (phone): lists **45** — matching the 45 live top-level jobs in the DB, and none of
  the four done ones. It listed 49 before.
- Projects: 4 jobs, matching the 4 live top-level project jobs in the DB
- Zero console errors, `npm run build` clean (672.56 kB / 1.67s)

## Scope item 8 — focus-list write path, 2026-07-26

**Gap found (by grep, not assumed):** the focus list was fully readable and safely persisted
(items 7 above), but nothing in the UI could set it. `useFocusList()` returned `setFocusList`
with zero callers outside the hook, and `App.jsx:194` destructured only `focusList`, dropping the
setter. `Sidebar.jsx`, `JobShelf.jsx`, `DailyLogPage.jsx` all read the list; `CatchUpInterview.jsx`
had no focus handling at all. So the 10 IDs in the table were the placeholder written manually
during recovery (item 7) — nothing in the app could change them.

**Fix — Phase 1 (the smallest thing that makes Sunday's meeting picks stick):**
- `App.jsx` now destructures `setFocusList` and adds `toggleFocusJob(jobId)` — a pure add/remove
  of one ID in the array (string-compared, ID stored in whatever type it already is, matching
  `saveFocusList`'s raw `job_id` storage and the `.map(String)` comparisons already used by
  `Sidebar`/`JobShelf`). Everything else — debounce, persistence, failure recovery — is unchanged,
  already covered by item 7's fix.
- A 🎯 toggle button was added to both job detail views — `JobDrawer.jsx` (desktop) and
  `MobileJobSheet.jsx` (phone) — next to the close button, since every `JobCard` click already
  opens one of these two, giving one write path that reaches every job from every list. Not added
  directly on `JobCard` because the whole card carries drag-and-drop listeners; a nested button
  there would fight the drag handlers.
- Not blast-radius work — `useFocusList.js`, `supabase.js`'s focus functions, `scheduledSlots`,
  `calendarSlot`, `useGoogleCalendar.js`, `useFirebase.js`, and `jobs[]` shape are all untouched.
  Built directly, no Council/Verifier cycle.

`npm run build` clean. Only `src/App.jsx`, `src/components/JobDrawer.jsx`,
`src/components/MobileJobSheet.jsx` touched.

**Live Test — pending.** Trevor to confirm: toggle in reload persists, toggle out reload clears,
Supabase `focus_list` table matches, and the network-cut check (auto-save disables itself on a
failed read, table keeps all rows) — the last one only ever verified by reading the code until now.

## Scope item 9 — two small UI fixes, 2026-07-26

Both reported by Trevor after seeing item 8 live. Neither is blast-radius work; built directly.

- **Day-view resize handle was inverted.** `DailyLogPage.jsx`'s `resizeShelf` did
  `prev.shelf + dx`, so dragging the handle left (negative `dx`) *shrank* the Jobs column instead
  of widening it. The handle sits to the *left* of the Jobs column, so moving it left must grow
  that column: changed to `prev.shelf - dx`. `resizeSchedule` was already correct — its handle
  sits to the left of the Schedule column and already used `- dx`.
- **Focus toggle moved onto the card itself.** Item 8 put the 🎯 only in the job detail views, so
  setting focus cost a tap to open the drawer first. A 🎯 button now renders in the header row of
  every non-compact `JobCard` (dim when off, solid when on), using the same
  `e.stopPropagation()` pattern the existing `onMarkPieceDone` button already proves safe inside a
  draggable card — plus `onPointerDown` stopPropagation so a tap never starts a drag. The
  drawer/sheet toggles stay as they are.
  - Keyed on `String(job.job)`, matching the `focusSet` comparisons already in `Sidebar.jsx` and
    `JobShelf.jsx` — *not* `job.id`, which is suffixed on split-piece children and would miss.
  - Only rendered on top-level cards. Sub-task/split-piece cards share their parent's job number,
    so a toggle there would be a duplicate control for the same list entry.
  - `toggleFocusJob` now threads `App.jsx` → `Sidebar` and `App.jsx` → `DailyLogPage` → `JobShelf`;
    previously those got `focusList` read-only.

`npm run build` clean. Touched `src/App.jsx`, `src/components/DailyLogPage.jsx`,
`src/components/JobCard.jsx`, `src/components/JobShelf.jsx`, `src/components/Sidebar.jsx`.

Self-verified in the browser: on-card 🎯 took the Focus pill 7 → 8 and back to 7 without opening
the drawer; a left-drag of the day-view handle grew the Jobs column from 280px to 380px.

**Phase 2 — not started.** A "Plan the coming week" step in `CatchUpInterview.jsx` that presents
candidates at the end of the ritual and writes through the same `setFocusList`/`toggleFocusJob`
path. Deliberately held until Trevor has seen Phase 1 working.

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
