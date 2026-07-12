# Parking Lot

Currently-open items only — grouped by category, not by session date. Completed/dropped history lives in [`session-log.md`](session-log.md). Reviewed every Sunday.

---

## Bugs

- [ ] **Pomodoro timer broken** — alarm doesn't sound at session end, and the timer itself doesn't work right (confirmed by Trevor 2026-07-01, on top of earlier alarm-only reports). Not touched yet.
- [ ] **Mark Done / Daily Log — unresolved, needs verification.** Fixed mark-done job lookup (now matches by `job.job` number) and Daily Log re-seed (replaces stale bullets instead of deduping), but the work went through a revert cycle on 2026-07-01 (initial fix → broke scheduler → reverted → re-fixed) and ended on a diagnostic-alert commit, not a confirmed-working one. Treat as unverified until tested live — check that mark-done doesn't fail silently before trusting it.
- [ ] **Whole app stuck on loading screen on mobile** (Trevor observed 2026-07-01) — app hung completely, nothing accessible, had to quit and reopen the tab. Not reproduced or diagnosed — happened right after Daily Log worked fine on Mac, but no code points to Daily Log specifically causing a mobile-only hang, so likely unrelated (stale cache, network blip, general mobile load issue). Next time it happens: check phone's console via Safari → Mac → Develop menu → iPhone before attempting a fix.
- [ ] **Firebase writes entire jobs array on every change** — fine now, will hit limits as pomoLog accumulates. Watch it.
- [ ] **#1520 (Ampeg SVT 6 Pro, Pete Johanson) and #1582 (Roland Juno 106, Jason Crawford) still need real manual re-split + re-schedule if Trevor wants them worked.** Their false "still scheduled" ghost state (stale from before the 2026-07-04 `sheet_to_csv.command` fix) was cleared 2026-07-10 — confirmed via direct Firestore check that #1520/#1582 had no `scheduledSlots` entry despite `scheduled: true`, patched to `scheduled: false`/`calendarSlot: null`, verified live by Trevor (calendar + sync both clean afterward). **#1704 confirmed by Trevor (2026-07-11) as an already-completed job — remove from this list, no action needed.**
- [ ] **Malformed double-split job id found in live data (2026-07-11): `1626-LU_Luthier_1`.** A manual "+Add bench" split was applied to a job that was already an auto-split child (`1626-LU`), and the split-creation code used that child's id as the base instead of the real parent job's id — producing an id that can never match any real job (`jobs.find(j => j.id === ...)` always fails for it). Confirmed via direct Firestore read of `ggnz/dailyLogs`. Needs a fix in the manual-split creation path (likely `useJobs.js`, the `+ Add bench` handler) to detect/reject splitting an already-split-child job, or resolve to the true top-level parent id first. Root cause not yet fully traced. Its worst symptom (silent "Job complete") is now covered by the fix below, but the underlying id-creation bug itself is still open.
- [x] **UX gap: "Job complete" silently does nothing when the bullet's job can't be found — RESOLVED 2026-07-11.** Shipped in two commits (`95eb262`, `bbc2d1b`): job lookup now also checks `completedJobs` and shows "✓ Already invoiced $X" when the job already finished elsewhere; when there's genuinely no matching job anywhere, it now offers a manual invoice-amount entry (via a new `buildManualInvoiceJob` helper) instead of silently losing the revenue, or lets you just mark it done if there's nothing to invoice. Both independently verified. Also found and fixed a real double-invoice risk (done jobs weren't excluded from the live lookup) before it shipped.
- [ ] **#1621 (Aria Diamond 1202T) shows scheduled on Google Calendar but has zero record in the app** — no `gcalEventId`, no `calendarSlot`, `scheduled: false` in Firestore, confirmed 2026-07-07. Most likely created directly in Google Calendar rather than through the app — the app→GCal sync is one-way (push only), it never pulls GCal-side changes back in. If Trevor wants this job tracked/scheduled in the app itself, it needs to be scheduled there directly, not just in GCal.
- [ ] **Deferred checklist item invisible in desktop `JobShelf` when a job's other splits are all already scheduled** (2026-07-07, bujo-checklist build) — the pre-existing "hide fully-scheduled split parent" rule in `JobShelf.jsx` means the whole job row (and its deferred-item note) never renders if every sibling piece is already on the calendar. Data's intact, mobile's job list still shows it either way — narrow desktop-only visibility gap. Low priority, revisit if it actually bites in practice.
- [ ] **sessionNote/session badge on split bullets — implemented, never live-tested** (2026-07-07, bujo-checklist build). Code review (both the builder session and an independent check) confirms the logic looks correct, but no split job with a session note was actually clicked through live during that session's testing pass. Quick real-world glance next time a split job shows up in the Daily Log.

---

## Features & Ideas

- [ ] **ADHD-overload audit of the app itself** — a dedicated review pass checking the app's own screens for cognitive-load issues, not just a bug hunt: how much is visible on screen at once, whether info is progressively disclosed vs dumped all at once, colour/visual noise, number of simultaneous decisions a screen asks Trevor to make. Ties directly into his existing stated preference for zen/minimal UI (see [[user_adhd_focus]]) but as a proper full-app pass rather than fixing individual "too busy" complaints as they come up (e.g. the JobShelf redesign). Raised 2026-07-10, explicitly parked for its own dedicated session rather than squeezed in at the end of a long one.
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
- [x] **Rename "Runway" to "Projects"** — decided 2026-07-12, shipped 2026-07-12. Header button, page title, component/file names (`RunwayPage.jsx` → `ProjectsPage.jsx`) all updated. Low risk, no logic change, just labels.

---

## Scoped builds (briefs already written — ready to pick up)

- [x] **Session rules audit — RESOLVED 2026-07-11.** The job-complete/split-visibility build skipped the protocol outright (no `pre-job-complete-stable` tag, no `pending-brief.md` entry) — confirmed by checking git tags and the build session's own transcript. The protocol itself wasn't the problem: it worked correctly for the three problems before it (real tags, verifier passes, brief entries all present). Fix: a "Brief-Before-Commit" tripwire added to [[project_agent_team]] — no commit without a `pending-brief.md` entry first, checked at session start.

- [ ] **Firestore health-check script** — turn the manual ghost-slot/stale-scheduled-state diagnostic (read-only Firestore export via `scripts/board_meeting_export.mjs` → cross-check `jobs[]` vs `scheduledSlots` vs `gcalEventId`s) into a real, reusable script under `scripts/`, runnable on demand. This exact manual process has been hand-run at least 5 times (2026-07-01, 07-04, twice on 07-07, and 2026-07-10) as a throwaway one-liner each time — worth having as a real command Trevor doesn't have to remember exists. Park until after the three-fix build (see below); optionally worth a quick informal manual re-run (not the built skill) right before starting Problem 1/3 of that build as a clean-baseline sanity check.
- [ ] **Memory-staleness check** — a lightweight script comparing this project's persisted `project_stable_tag` memory's recorded baseline commit against actual `git log` HEAD, flagging drift automatically. Surfaced 2026-07-10 when that memory was found 18 commits behind reality. Park until after the three-fix build.

- [ ] **NEXT SESSION FIRST ITEM — architecture APPROVED 2026-07-12, needs a dedicated build session.** Split "job master data" (CSV/Sheet-driven) from "live schedule state" (app-driven: scheduled/calendarSlot/gcalEventId/pomoLog/splits) into separate Firestore collections (`jobsMaster`/`jobsState`), each with exactly one writer, each written per-document instead of a blind whole-array overwrite. This is the confirmed root-cause fix for the #1520/#1175 manual-split data-loss bug below — both items now share one approved brief, not two separate entries. Full architecture, required design decisions, migration/cutover plan, and file-by-file scope: `.claude/pending-brief.md` (top entry) and `/Users/admin/.claude/plans/handoff-saved-to-re-fresh-runway-rename-quiet-otter.md` ("PART 2"). Investigation history: [[project_manual_split_data_loss_2026_07_12]]. Not a small follow-up — needs its own dedicated build session (against scratch Firestore/local fixtures, never touching prod) and a separate dedicated cutover session for the live production migration (86 jobs, 33 split children, no backup/PITR).
- [ ] **CSV script and the app's own `saveSchedule()` race condition** — both do full-document-replace writes to the same Firestore doc with no coordination (no transactions, no `{merge:true}`). The 2026-07-04 fix shrank the blast radius but didn't eliminate the race. Flagged by council review as a known residual risk — not urgent.
- [ ] **Fully nest Scheduler under `apps/scheduler/`** — deferred from the 2026-07-06 department-split reorg. Requires reconfiguring Vercel's Root Directory project setting, updating `vercel.json`/`package.json` paths, and re-verifying the live deploy before/after. Real deploy risk — own dedicated session.
- [ ] **Edit a split from within the calendar (add-bench case only).** Trevor's real workflow problem: a job scheduled as one bench (e.g. Setup) turns out mid-repair to need another (e.g. Wiring) too. Today the only way to add that is drag every existing scheduled piece of the job off the calendar, re-split via `JobDrawer`'s "+ Add bench" editor, then drag everything back on — disruptive for something that should be a small edit.

  **Root cause / goal:** No way to reach the split editor for a job that's already scheduled — clicking a scheduled job opens `PomoDrawer` (desktop) / `JobPeekPopover` (mobile), not `JobDrawer`'s split UI.
  **Fix scope (deliberately narrow — ADD only, not remove/resize):** Add an entry point from `PomoDrawer.jsx` / `JobPeekPopover.jsx` / `MobileJobSheet.jsx` into the existing "+ Add bench" split editor for the job's parent, usable even when sibling splits are already scheduled. The new bench becomes a normal new unscheduled child (`parentId` set, `scheduled: false`) — drag it onto the calendar like any split. **Do not touch already-scheduled siblings' `calendarSlot`/`scheduledSlots` at all** — this must be purely additive.
  **Explicitly out of scope for this brief:** removing or resizing an already-scheduled split piece from within the editor — that's a separate, riskier feature (directly freeing/moving real calendar slots from inside a drawer, not via the existing proven drag-to-unschedule flow) and should be its own conversation once the simple add-case has been used for a while.
  **Blast radius:** touches job-splitting/creation logic (`jobs[]` shape via the split-add path) — need to verify `JobDrawer`'s existing "+ Add bench" hours-remaining calculation correctly accounts for hours already committed to *scheduled* siblings, not just unscheduled ones, since that path may never have been exercised with scheduled children present before. Recommend running this through council per [[project_agent_team]] given the `jobs[]` shape trigger.

---

## Cowork / Integrations

- [ ] **Connect trevor@guitargarage.nz to Cowork (IMAP)** — direct connection to cPanel/MXroute email, no Gmail middleman. Solution found: `imap-mcp-server` (open source MCP, built for Claude). Dev friend needs to install it. Repo: https://github.com/nikolausm/imap-mcp-server — install via `npx -y imap-mcp-server`, add MXroute IMAP credentials (host, port 993, trevor@guitargarage.nz), wire into Cowork MCP config.

---

## Housekeeping

- [ ] `DESIGN.md` at repo root is an unrelated client file (Matakana Superfoods design-token extraction, not GGNZ content) — Trevor confirmed it's currently being worked on. Relocate or delete once that work is finished.
- [ ] Two unidentified screenshots on Desktop root (`Screenshot 2026-06-12...png`, `Screenshot 2026-06-13...png`) — not opened/identified. Check if still needed.
- [ ] `SCHEDULER` symlink on Desktop is dangling — points at `/Users/trevorcollings/...` but this machine's local user is `admin`. Pre-existing quirk from syncing across two different local accounts, unrelated to any recent work. Fix if it matters for cross-device workflow.
- [ ] Revoke the `jt-backup-ggnz-35a126beb4ca.json` service-account key in Google Cloud Console — moving it to `archive/job-tracker/` and gitignoring it locally doesn't invalidate the key itself.
- [ ] **`/read-the-manual` (personal skill, `~/.claude/skills/`) isn't reachable from git-worktree-isolated sessions** — confirmed 2026-07-11 when the build session running on `feature/daily-log-carry-forward` (a worktree) couldn't find the command at all. Personal skills are likely local-session-scoped in a way worktree-isolated sessions don't inherit. Not blocking (worktree sessions get their context from the plan/brief directly instead), but worth understanding/fixing if this skill is meant to be usable from any session type, not just a normal one on Micky.

---
