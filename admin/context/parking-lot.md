# Parking Lot

Currently-open items only — grouped by category, not by session date. Completed/dropped history lives in [`session-log.md`](session-log.md). Reviewed every Sunday.

---

## Bugs

- [ ] **Pomodoro timer broken** — alarm doesn't sound at session end, and the timer itself doesn't work right (confirmed by Trevor 2026-07-01, on top of earlier alarm-only reports). Not touched yet.
- [ ] **Mark Done / Daily Log — unresolved, needs verification.** Fixed mark-done job lookup (now matches by `job.job` number) and Daily Log re-seed (replaces stale bullets instead of deduping), but the work went through a revert cycle on 2026-07-01 (initial fix → broke scheduler → reverted → re-fixed) and ended on a diagnostic-alert commit, not a confirmed-working one. Treat as unverified until tested live — check that mark-done doesn't fail silently before trusting it.
- [ ] **Whole app stuck on loading screen on mobile** (Trevor observed 2026-07-01) — app hung completely, nothing accessible, had to quit and reopen the tab. Not reproduced or diagnosed — happened right after Daily Log worked fine on Mac, but no code points to Daily Log specifically causing a mobile-only hang, so likely unrelated (stale cache, network blip, general mobile load issue). Next time it happens: check phone's console via Safari → Mac → Develop menu → iPhone before attempting a fix.
- [ ] **Firebase writes entire jobs array on every change** — fine now, will hit limits as pomoLog accumulates. Watch it.
- [ ] **Google Calendar still shows stale event blocks for ghost jobs** #1520/#1582/#1647/#1681/#1699/**#1704** (now including the 2026-07-07 ghost-slot cleanup #3) — cleaning Firestore's `scheduledSlots` doesn't touch GCal, since that cleanup bypasses `unscheduleJob()`'s own `deleteEvent()` call. The split-child job records with their `gcalEventId`s are already gone from `jobs[]`, so there's no way to programmatically identify which GCal events to delete anymore. Trevor needs to manually delete these blocks directly in Google Calendar.
- [ ] **#1520 (Ampeg SVT 6 Pro, Pete Johanson), #1582 (Roland Juno 106, Jason Crawford), and #1704 (Gretsch G5420T) need manual re-split + re-schedule** — #1520/#1582's scheduled state was lost before the 2026-07-04 `sheet_to_csv.command` fix existed. #1704 had a real manual split (Wiring + 2 Setup sessions) that's gone from `jobs[]` as of the 2026-07-07 ghost-slot cleanup #3 — only ghost slot references survived, not the split records themselves. All three jobs are intact and re-splittable, just need the split redone.
- [ ] **#1621 (Aria Diamond 1202T) shows scheduled on Google Calendar but has zero record in the app** — no `gcalEventId`, no `calendarSlot`, `scheduled: false` in Firestore, confirmed 2026-07-07. Most likely created directly in Google Calendar rather than through the app — the app→GCal sync is one-way (push only), it never pulls GCal-side changes back in. If Trevor wants this job tracked/scheduled in the app itself, it needs to be scheduled there directly, not just in GCal.
- [ ] **Deferred checklist item invisible in desktop `JobShelf` when a job's other splits are all already scheduled** (2026-07-07, bujo-checklist build) — the pre-existing "hide fully-scheduled split parent" rule in `JobShelf.jsx` means the whole job row (and its deferred-item note) never renders if every sibling piece is already on the calendar. Data's intact, mobile's job list still shows it either way — narrow desktop-only visibility gap. Low priority, revisit if it actually bites in practice.
- [ ] **sessionNote/session badge on split bullets — implemented, never live-tested** (2026-07-07, bujo-checklist build). Code review (both the builder session and an independent check) confirms the logic looks correct, but no split job with a session note was actually clicked through live during that session's testing pass. Quick real-world glance next time a split job shows up in the Daily Log.
- [ ] **Sync still shows a transient error, self-clearing after a few seconds — fix didn't fully resolve it (2026-07-09).** Confirmed root cause was a real race in `ensureCalendarApi()` (`src/utils/googleCalendar.js`) — fixed with a cached promise matching `initGoogleApi()`'s pattern, commit `0123f26`. Trevor confirmed the symptom persists after that fix. Either there's a second cause not yet found, or the fix addressed a real bug that wasn't the one actually firing here — needs a fresh look with the browser console open during a live sync to catch the actual error being thrown, rather than reasoning from code alone (no live Google auth was available in the session that shipped the first fix, so it was never directly observed).

---

## Features & Ideas

- [ ] **Cascade reschedule toggle (Settings)** — when a job gets bumped by a GCal appointment and lands in a slot occupied by another job, cascade the bump: each displaced job pushes the next one down the queue until everything fits or the week runs out. Opt-in via a Settings toggle (default off) — agreed not to build it automatic, too unpredictable without user control.
- [ ] **Online session journal / parking-lot web page** — web-based editable version of the parking lot, readable/editable from any device (iPhone too), pulling live data from Firebase. More detail = quicker comms with Claude, less stuck in Trevor's brain. Replaces pasting raw notes into sessions.
- [ ] **Printable schedule / quick wins view** — live view of current week schedule + quick wins list, printable via Cmd+P → PDF. Could be part of the online journal page above.
- [ ] **Age colour badges on sidebar cards** — 60+ day jobs red. Runway already has this, Sidebar doesn't.
- [ ] **Undo toast on unschedule** — currently destructive with no confirmation.
- [ ] **Mobile "Move" action for scheduled jobs** — currently remove → find → reschedule.
- [ ] **Day load indicator on mobile Schedule tab** — no visibility into what's booked before placing.
- [ ] **Actual vs estimated hours on job card** — data exists, never shown together.
- [ ] **"Next job" recommendation** — nothing tells you what to do next.
- [ ] **Weekly capacity view** — "22h booked, 18h queued, 6h buffer".
- [ ] **Pomo timer without scheduling** — can't log time on unscheduled jobs.
- [ ] **Week-over-week revenue history** — no trend view.
- [ ] **"Extend hours to 2am" per-day toggle for triage days** — Trevor wants a per-day toggle to view/schedule into very late hours on heavy backlog days. Crosses midnight, which touches `slotKey`/`findAvailableSlots`/day-boundary logic across the scheduler — every slot is currently date-bound (a 1am slot belongs to the *next* calendar date), so this isn't a display-only tweak. Its own dedicated session, not a quick addition. Current work-hours ceiling is 11pm (`WORK_HOURS.weekday.end = 23` in `src/utils/calendar.js`) — extending display to 11:30pm within the existing single-day boundary would be the safe/cheap partial step if wanted first.
- [ ] **Sunday board meeting with Claude + agents** — weekly planning session with agent "board members" to review projects and plan the week. See [[project_sunday_board_meeting]] — needs a real conversation about meeting format, not just a checkbox.
- [ ] **Explore Claude Dispatch (beta)** — investigate using Dispatch in sessions.
- [ ] **CRM / customer follow-up + text messaging system — stalled, not abandoned.** `build_history.command`/`lookup_history.command` (in `SCHEDULER_old/`, outside this repo) were built as the data layer for a customer-follow-up CRM — texts and follow-up emails after a job closes. The effort stalled specifically on exorbitant SMS/messaging costs, not the idea itself. `history.db` (the closed-job archive) already exists and works standalone regardless. Revisit if a cheaper messaging option turns up (e.g. email-only follow-ups, a cheaper SMS provider). See [[reference_closed_job_history_archive]].

---

## UX friction

- [ ] "Mark Done" without job being on calendar
- [ ] Subtask expand affordance too small — needs a visible chip
- [ ] No GCal sync indicator on calendar cards
- [ ] Urgent mode toggle too prominent — accidental activation risk
- [ ] Mobile time picker allows non-30min snapping — replace with preset buttons
- [ ] VB badge needs tooltip — "Valued Builder — priority customer"

---

## Scoped builds (briefs already written — ready to pick up)

- [ ] **NEXT SESSION FIRST ITEM (priority bumped 2026-07-04 — Trevor: "if there is any chance of this breaking anything I think it should be addressed").** Split "job master data" (CSV/Sheet-driven) from "live schedule state" (app-driven: scheduled/calendarSlot/gcalEventId/pomoLog) into separate Firestore documents/fields, so this whole class of data-loss bug becomes structurally impossible instead of just carefully avoided via field-preservation logic in one script. Root cause was Firestore storing both in one shared array field with no partial-update support — the 2026-07-04 fix patches the one known writer (`sheet_to_csv.command`), but any future script/feature that writes to `ggnz/schedule` would need to independently know to preserve those fields, or the same bug class returns. Real migration, not a small follow-up: touches `utils/firebase.js` + `useFirebase.js` (React) AND `scripts/sheet_to_csv.command` (Python), plus migrating live production data (86 jobs, 33 split children, the `scheduledSlots` map) without a window where one side reads the old shape while the other writes the new one. Needs its own dedicated brief + council review per [[project_agent_team]].
- [ ] **CSV script and the app's own `saveSchedule()` race condition** — both do full-document-replace writes to the same Firestore doc with no coordination (no transactions, no `{merge:true}`). The 2026-07-04 fix shrank the blast radius but didn't eliminate the race. Flagged by council review as a known residual risk — not urgent.
- [ ] **Fully nest Scheduler under `apps/scheduler/`** — deferred from the 2026-07-06 department-split reorg. Requires reconfiguring Vercel's Root Directory project setting, updating `vercel.json`/`package.json` paths, and re-verifying the live deploy before/after. Real deploy risk — own dedicated session.
- [ ] **Edit a split from within the calendar (add-bench case only).** Trevor's real workflow problem: a job scheduled as one bench (e.g. Setup) turns out mid-repair to need another (e.g. Wiring) too. Today the only way to add that is drag every existing scheduled piece of the job off the calendar, re-split via `JobDrawer`'s "+ Add bench" editor, then drag everything back on — disruptive for something that should be a small edit.

  **Root cause / goal:** No way to reach the split editor for a job that's already scheduled — clicking a scheduled job opens `PomoDrawer` (desktop) / `JobPeekPopover` (mobile), not `JobDrawer`'s split UI.
  **Fix scope (deliberately narrow — ADD only, not remove/resize):** Add an entry point from `PomoDrawer.jsx` / `JobPeekPopover.jsx` / `MobileJobSheet.jsx` into the existing "+ Add bench" split editor for the job's parent, usable even when sibling splits are already scheduled. The new bench becomes a normal new unscheduled child (`parentId` set, `scheduled: false`) — drag it onto the calendar like any split. **Do not touch already-scheduled siblings' `calendarSlot`/`scheduledSlots` at all** — this must be purely additive.
  **Explicitly out of scope for this brief:** removing or resizing an already-scheduled split piece from within the editor — that's a separate, riskier feature (directly freeing/moving real calendar slots from inside a drawer, not via the existing proven drag-to-unschedule flow) and should be its own conversation once the simple add-case has been used for a while.
  **Blast radius:** touches job-splitting/creation logic (`jobs[]` shape via the split-add path) — need to verify `JobDrawer`'s existing "+ Add bench" hours-remaining calculation correctly accounts for hours already committed to *scheduled* siblings, not just unscheduled ones, since that path may never have been exercised with scheduled children present before. Recommend running this through council per [[project_agent_team]] given the `jobs[]` shape trigger.

---

## Housekeeping

- [ ] `DESIGN.md` at repo root is an unrelated client file (Matakana Superfoods design-token extraction, not GGNZ content) — Trevor confirmed it's currently being worked on. Relocate or delete once that work is finished.
- [ ] Two unidentified screenshots on Desktop root (`Screenshot 2026-06-12...png`, `Screenshot 2026-06-13...png`) — not opened/identified. Check if still needed.
- [ ] `SCHEDULER` symlink on Desktop is dangling — points at `/Users/trevorcollings/...` but this machine's local user is `admin`. Pre-existing quirk from syncing across two different local accounts, unrelated to any recent work. Fix if it matters for cross-device workflow.
- [ ] Revoke the `jt-backup-ggnz-35a126beb4ca.json` service-account key in Google Cloud Console — moving it to `archive/job-tracker/` and gitignoring it locally doesn't invalidate the key itself.

---
