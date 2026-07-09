# Session Log

---

## 2026-06-13 — Session Cleanup

**Done:** Deleted the sync script and LaunchAgent plist that was auto-renaming and corrupting sessions. Broke the iCloud symlink and copied all 156 .jsonl files to local storage. Renamed all 36 sessions with clean date-based names (Scheduler v1–v8, Tube Buy Sheet, Job Tracker, Pomodoro, Partsbox CRM, Landing Page, Setup). Wrote ADHD Focus Protocol into CLAUDE.md.

**Parked:**
- [ ] Online session journal
- [ ] Sunday board meeting with Claude + agents (weekly planning)
- [ ] Set up rsync + path-rewrite to bring Moby sessions to Micky (optional)

**Next:** Quit and reopen Claude Desktop to see renamed sessions in sidebar. Start fresh session for whatever the original task was that never got reached today.

---

## 2026-06-13 — Final Close Out

**Done:** Deleted sync script and LaunchAgent permanently. Fixed iCloud symlink issue. Renamed all 36 sessions with clean date-based names. Wrote ADHD Focus Protocol into CLAUDE.md with session contract, tangent detection, two work modes, 10-minute chunks, parking lot, and Sunday review rules.

**Parked:**
- [ ] Online session journal
- [ ] Sunday board meeting with Claude + agents
- [ ] Explore Claude Dispatch (beta)

**Next:** Restart Claude Desktop to see renamed sessions. Start fresh session with the new protocol — state the goal first.

---

## 2026-06-23 — Pipeline & Splits Overhaul

**Stable baseline:** `stable-baseline-8` = `a4180ce`

**Fixes shipped:**

- **Calendar wipe (critical)** — watcher polling wiped all bookings if Firebase GET failed. Script now `sys.exit(1)` on fetch error instead of writing empty slots.
- **Google OAuth auto-reauth** — `sheet_to_csv` now catches `RefreshError` inline, opens browser, saves token, retries. No separate reauth step needed.
- **PDF parser dropping 22/58 jobs** — page 2 of Multitrack PDF uses 6-column layout, parser used fixed index from page 1. Fix: `row[-1]` fallback (job numbers always rightmost).
- **Scheduled jobs not hiding from sidebar** — jobs placed on calendar stayed visible. All sub-tasks scheduled → parent hides.
- **Calendar cards** — now show Mfr + Model primary, `sessionNote` amber italic secondary, job # small tag.
- **Rates not persisting** — `hourlyRate` had no state in App.jsx; `weeklyTarget` was reading but never writing localStorage. Both fixed.
- **Changelog** — populated with all shipped features; fixed `entry.ts/msg` → `entry.date/note` field mismatch.
- **createSubtasks rebuilt (additive)** — old hard-coded paths replaced. Each card added independently by keyword: refret → Refret+LCP pair; Luthier keywords → Luthier card; Setup keywords → Setup card. Refret+Luthier+Setup = 4 cards. Fully extensible.

**Parked for next session:**
- [ ] Pomodoro — show full job card info (Mfr, Model, customer, bench, hours, desc, note) as reference panel inside timer
- [ ] Pomodoro alarm not sounding at end of session

---

## 2026-06-24 — Full App Audit + Team Build

**Done:** Ran a full app audit via agent team + council; triaged the entire backlog into Council flags / Quick wins / Bigger ideas / UX friction, all made actionable. (Items carried forward into the categorized backlog in `parking-lot.md`.)

---

## 2026-07-01 — CSV Fix Merged + Remove from Calendar

**Done:**
- **"Remove from Calendar" button in PomoDrawer (desktop)** — clicking a scheduled job on the calendar opens PomoDrawer (not JobDrawer). Added a "Remove from Calendar" button there (below Job Done section, only shows when idle) so jobs can be unscheduled with one click instead of dragging back to the sidebar. Uses existing `scheduler.unscheduleJob`. Verified working in preview — job disappears from calendar cleanly. Mobile already had this in MobileJobSheet.
- **CSV upload silently dropping manually-split jobs** — fixed and merged. Also broadened the safety warning to fire on any dropped calendar slot during CSV upload, not just when >50% are dropped. Added a drift report panel (on-screen, lists missing job IDs, shows job count) with a force-upload override, plus diagnostic console logging. Closes out the CSV-drift risk flagged in the 2026-06-24 audit.

**Parked:** Desktop "Place on Calendar" drawer bug (originally reported 2026-06-17) — root-caused and fixed next session, see the 2026-07-02 entry below (`schedulerWeekDays` day-index mismatch).

---

## 2026-07-02 — Daily Log redesign — default view, day-swipe, JobShelf zen redesign

**Done:**
- **Daily Log is now the default landing view** — old week `CalendarGrid` + `Sidebar` moved behind a new "Week View" header button (was "Daily Log" toggle). Verified working both directions.
- **Single-day calendar column added to Daily Log** (3rd column, resizable) — reuses the real `CalendarGrid` component scoped to one day, trackpad swipe (wheel deltaX) changes day with direction-lock + cooldown, non-today days rest at top instead of auto-scrolling to "now". Verified live.
- **JobShelf redesigned** — calm-by-default (count + bench pills only, nothing listed until you pick a bench or search), collapsible split sub-tasks with gold italic note matching JobCard's style, Admin bench pill added.
- **Resizable columns** — drag dividers between bujo/shelf/schedule columns, remembered via localStorage.
- **Fixed: drag-and-drop within the single-day view was dropping jobs onto Monday** — root cause: the drop handler (`useScheduler.js`) resolved `dayIdx` against the full Monday–Sunday week array regardless of which day was actually displayed, while the single-day `CalendarGrid` always reports `dayIdx=0` for its one column. Fixed by lifting `displayedDate` to `App.jsx` and binding the scheduler's `weekDays` to `[displayedDate]` when the day view (not week view) is showing, so `dayIdx=0` resolves consistently on both sides. Confirmed via live trackpad test later the same night (see below).
- **JobShelf: remember last-picked bench + wiring pill + full bench colors on all pills** — built and verified. Last-picked bench now persists via `localStorage` (`jobShelfBench`), survives reload. All 6 bench pills always render (including Wiring, even at 0 count) with their real bench colour at all times — active pill full opacity + coloured border, inactive pills dimmed (0.5 opacity) rather than flat grey.
- **Day-view job click → lighter popover instead of full PomoDrawer** — built and verified. Clicking a scheduled job in the single-day column shows a compact peek popover (job name, customer, bench, description snippet) with "Start Pomo" / "Full details →" buttons, both of which open the real `PomoDrawer` (no separate timer logic duplicated). Main week view is untouched — still opens `PomoDrawer` directly on click, popover is day-view-only.
- **JobShelf reaches Sidebar parity — drag-and-drop + manual splits** — built. Job Shelf now renders real draggable `JobCard`s (was plain non-draggable rows), with hours filter, urgent/regular drag-mode toggle, and CSV upload appearing once a bench is picked/searched (calm-by-default shell unchanged). Clicking a card opens the real `JobDrawer` — same place manual splits ("+ Add bench") happen on the main week view, so that capability now exists here too. `HOURS_BUCKETS` hoisted from `Sidebar.jsx` into `src/data/jobs.js` so both components share one source. Pull button removed per Trevor's request mid-build — drag replaced it; `handlePull` still exists for mobile's separate `LogJobCard` "+ pull to today" flow, untouched.
- **Scheduled-job → bullet chronological sync** — built AND fully verified end-to-end, including via direct Firestore inspection: a job scheduled at 13:30 today produced a bullet with `scheduledMinutes: 810` correctly keyed under today's (now-fixed local) date, visible with a `13:30` prefix on both desktop and mobile.
- **"Place on Calendar" button in JobDrawer — root cause found and fixed.** It was never fundamentally broken — it was two things: (1) a real bug introduced by today's earlier `schedulerWeekDays` split — `JobDrawer`/`MobileJobSheet` were still given the full 7-day `weekDays` array for their day-picker, so selecting a day produced an index that didn't match what the scheduler (bound to `[displayedDate]` in day view) expected, silently failing; fixed by passing `schedulerWeekDays` into both. (2) A follow-on cosmetic bug this surfaced: the day-picker's weekday label (`DAYS_SHORT[i]`) assumed array position = day-of-week offset from Monday, so a single-day array showed "Mon" for whatever day was actually selected — fixed by deriving the label from the real date (`day.toLocaleDateString('en-NZ', {weekday:'short'})`) in both `JobDrawer.jsx` and `MobileJobSheet.jsx`, matching `CalendarGrid`'s existing convention. Verified via direct Firestore check: scheduling a job through the drawer now correctly persists to `scheduledSlots`. Closes out the original 2026-06-17 report (same class of bug, or already fixed elsewhere — no evidence of a remaining issue).
- **Today's daily log was locked by mistake — unlocked directly via Firestore**, with Trevor's explicit permission. Found the actual document key was `2026-07-01`, not `2026-07-02` — caused by the timezone bug below.
- **Timezone bug in `useDailyLog.js` — fixed.** Added `localDateKey(date)` to `src/utils/calendar.js` (builds the key from `getFullYear()`/`getMonth()`/`getDate()`, not `toISOString()`), used it in `useDailyLog.js`'s `todayKey()`/`tomorrowKey()` and in `TodaySchedulePanel.jsx` (same bug, dead-code component — also removed its now-stale import from `DailyLogPage.jsx` since it was never actually rendered after being superseded by the real `CalendarGrid` integration). Verified: today's log now correctly keys under `2026-07-02` (local), not `2026-07-01` (UTC). Note: other `toISOString().slice(0,10)` date-key usages exist elsewhere (`App.jsx`'s `currentWeekKey`, `useJobs.js`'s `weekKey`, `ParkingLotPage.jsx`, `PomoDrawer.jsx`'s manual date) — left untouched since their downstream Firestore key implications weren't investigated; worth a look if similar day-boundary weirdness shows up there.
- **Drag-and-drop in the day view — confirmed working by Trevor live**, closing out the "needs live trackpad confirmation" caveat from earlier the same day.
- **Day-view drag polish: scheduled job now disappears from Job Shelf after scheduling — fixed.** `JobShelf.jsx`'s `topLevel` filter now excludes `!j.scheduled && !j.isSplit`, matching `Sidebar.jsx` exactly. Verified: job count dropped 51→47 on reload (already-scheduled jobs excluded) and 47→46 immediately after scheduling one live in the browser.
- **CSV upload icon invisible in Day view — fixed.** The 📂 icon in `JobShelf.jsx`'s control strip was being squeezed to ~11×14px by the two `flex:1` Regular/Urgent buttons in the narrow column, despite `flexShrink: 0`. Fixed with an explicit `minWidth: 28` + `boxSizing: border-box`. Verified rendering at the intended 30×26px.
- **LAN access for iPhone testing — enabled.** `npm run dev` only bound to `localhost`, unreachable from other devices on the same wifi. Added `--host` to the `dev` script in `package.json` (now `vite --host`); Vite now also serves on the LAN IP (e.g. `http://192.168.0.188:5173`). Note: Google Calendar connect will NOT work over the LAN IP — Google's OAuth only allows registered origins (`localhost`), so GCal connect/testing must happen from `localhost:5173` on Micky directly. The LAN IP can also change on wifi reconnect/DHCP renewal.
- **Half-screen/split-view layout bug — properly fixed.** First attempt (horizontal scroll via `overflow: hidden auto` + `minWidth: 260` on the bujo column) was correct in principle but a bad fix in practice — macOS hides scrollbars by default until actively scrolling, so it was invisible/undiscoverable. Trevor caught this and asked for real proportional auto-resize instead. Final fix: all three columns now use `flex` shorthand with sensible `minWidth: 180` floors — bujo is `flex: '1 1 260px'` (grows to fill space), Job Shelf and Calendar are `flex: '0 1 {colWidths}px'` (shrink from their user-set/resized width, don't grow past it). Manual drag-resize (the `ResizeHandle` dividers) still works unchanged since it just adjusts `colWidths` state, which still drives each column's flex-basis. Verified at 1400px (full), 900px (all three columns visibly shrink together, no scroll needed) — confirmed working live by Trevor in an actual half-screen macOS window. Note: below the existing `768px` mobile breakpoint (`isMobile` check in `DailyLogPage.jsx`), it correctly switches to the mobile bujo-only layout instead — intentional, but worth knowing some smaller MacBook screens in split view could land under 768px and see the mobile layout unexpectedly.
- **Mobile Day View scheduling — built and fully verified.** Root cause was `DailyLogPage.jsx`'s mobile branch still calling the old `handlePull`/`LogJobCard` "pull to today" architecture (bullet-only, no scheduling), never upgraded when desktop's `JobShelf` got real scheduling today. Fix: `LogJobCard` now opens `MobileJobSheet` (via the existing `onBulletJobClick` → `setEditingJob` path, same one bullets already use) when you tap the card body, while the "+ pull to today" button still adds a plain bullet independently (`e.stopPropagation()` added so the two don't both fire). Verified end-to-end via direct Firestore checks: tapping a job → opening the sheet → "Place on Calendar" correctly persists to `scheduledSlots`, AND the scheduled-job bullet sync fires correctly for mobile too (`scheduledMinutes: 660` = 11:00 AM, correct chronological position in the bujo). Bonus: the job card's "in today's log" pulled-indicator now also correctly lights up for jobs added via scheduling, not just via pull, since both paths add a bullet with the same `jobId`. Pull button independently re-tested — still works, doesn't trigger the sheet.
- **`crypto.randomUUID is not a function` crash on mobile — fixed.** `crypto.randomUUID()` only exists in secure browser contexts (HTTPS or `localhost`) — Safari disables it entirely over plain `http://` on a LAN IP, which broke adding any bullet (quick note, pull, or scheduled-job sync) on iPhone once LAN access was enabled earlier today. Added a `genId()` fallback in `useDailyLog.js` (uses `crypto.randomUUID()` when available, otherwise a manual `Date.now()` + random-string ID) — used at all 3 bullet-ID call sites. Production (Vercel, HTTPS) was never affected; this was purely a LAN-testing artifact. Confirmed fixed by Trevor live on iPhone.
- **Quick-note input hard to find at the bottom of a tall bullet list — fixed.** Not a true bug (input was always in the DOM, just below the fold on a long list in a normal-height window) but a real usability miss Trevor caught. Moved the input inside the scrollable bullet-list container with `position: sticky; bottom: 0`, so it now floats at the bottom of the visible list instead of requiring a scroll past every bullet. Confirmed working live by Trevor on Micky.

**Parked:** "Extend hours to 2am" per-day toggle for triage days — deferred, own follow-up needed (see `parking-lot.md`, Scoped Builds / Features).

**Note:** 11 bugs found and fixed this session, all verified end-to-end on desktop, mobile, and LAN. As of end of session nothing was committed to git yet — all changes were local on top of `2c321b9` at the time.

---

## 2026-07-04 — Mobile day-view calendar, ad-hoc tasks, and a 3-week-old data-loss bug

**Done:**
- **Mobile Daily Log gets a real day-view calendar (`5a43f4e`)** — mobile's Jobs list showed every job by default instead of the calm-by-default bench/search gating Mac already had, and there was no day-view calendar at all on mobile. Added a Log/Day tab toggle, gated the mobile Jobs list to match desktop's `JobShelf`, added a single-day `CalendarGrid` with swipe + tap-the-edges day navigation (touch equivalent of the existing trackpad swipe). Also fixed `CalendarGrid`'s hardcoded `minWidth: 700` (the overflow bug flagged on 2026-06-24 and not fixed on 2026-07-02) — now only applies to the 7-day week view, so single-day views render at their real container width on both mobile and desktop's narrow day column.
- **Ad-hoc maintenance task scheduling from Daily Log notes (`6e174a0`)** — type a note, tap 📅, pick day/time/duration, it lands on the calendar without being a real CSV job. Stored in its own Firestore doc (`ggnz/adHocTasks`), deliberately isolated from `jobs[]`/`scheduledSlots` so it can never trip the CSV-drift safety check. Conflict-checked against real jobs and other ad-hoc tasks but never auto-bumps (same manual-resolution philosophy as the rest of the app). Renders as a small non-draggable card with a ✕ remove control.
- **Major find: `scripts/sheet_to_csv.command` has been silently wiping scheduled jobs since 2026-06-14 (`859fc07`)** — Trevor noticed two jobs scheduled the previous night (#1520, #1582) had vanished from the app's calendar despite still showing on Google Calendar. Traced via direct live-Firestore reads to the automated CSV/Sheet-sync script: it rebuilds the whole `jobs` array from the CSV on every run, hardcodes `scheduled: False` on every job, omits `calendarSlot`/`gcalEventId`/`gcalEventIds`/`pomoLog`/`done` entirely, then PATCHes Firestore with no `updateMask` — which replaces the whole document. Confirmed via git blame this existed since the script's first commit, not a recent regression. Would also have silently deleted all 33 manually-split job records live in Firestore on every sync. Fixed properly through the full team protocol (two independent council reviews, a Builder agent in an isolated worktree, an Independent Verifier reviewing the diff, then a live production test run with Trevor's go-ahead) — confirmed live that a real scheduled job and all 33 split children survive a real sync now. #1520 and #1582 themselves are still unscheduled (their state was lost before the fix existed) — need to be re-booked manually; the fix stops new damage, doesn't restore old.
- **Restart `start_watcher.command` on Micky** — done, confirmed by Trevor.
- **Ghost-slot cleanup #2 (evening)** — the missing-manual-split-preservation bug (fixed same day) had regenerated a fresh batch of ghost `scheduledSlots` after the 2026-07-01 cleanup removed the first batch. Surfaced when Trevor's in-app CSV upload correctly warned "would clear 25 scheduled slots" and safely aborted (the >50%-drop safety guard worked as designed — nothing was actually lost by that upload). Confirmed via full cross-reference: 25 of 27 `scheduledSlots` entries were ghosts (`1520_Electronics_0/1/2`, `1582_Electronics_0/1/2`, `1647`, `1681`, `1699` — none matched any current job). Same careful process as 2026-07-01 (snapshot backup saved to scratchpad → confirm → write → log via `appendConflictLog`) → cleaned 27→2 slots, verified live, `jobs[]` untouched (85 jobs, unchanged). Parent-job check before cleanup: #1520 (Ampeg SVT 6 Pro, Pete Johanson) and #1582 (Roland Juno 106, Jason Crawford) still have real, active job data. #1647/#1681/#1699 confirmed already completed + invoiced in `completedJobs` — nothing lost there, just naturally aged out.
- **Third-party plugin risk lesson** — Trevor installed a Google-Calendar-delete skill via a marketplace called "MCPmarket" to help with the GCal cleanup above. Investigated before use: the skill's actual delete logic isn't local at all — it delegates to a remote command hosted entirely on MCPmarket's own backend (`link.mcpmarket.com`), with a bearer token stored in plaintext locally, and the installed plugin also phones home (session-start sync + telemetry on every skill invocation, any skill, not just this one) via background hooks. Nothing overtly malicious found in the locally-inspectable code, but the actual Google Calendar access is a complete black box — declined to use it for a real customer calendar and uninstalled it fully at Trevor's request (deregistered from `installed_plugins.json` + `known_marketplaces.json`, deleted all cache/data directories). See [[feedback_verify_third_party_plugins]].
- **Firecrawl plugin installed and working** — legitimate official plugin from Firecrawl (github.com/firecrawl/firecrawl-claude-plugin, their own announced integration) — verified clean before install (no MCP server, no background telemetry hooks, unlike the MCPmarket one above). `firecrawl-cli` installed globally via npx, authenticated with Trevor's API key, 31 skills now available (search, scrape, crawl, map, monitor, interact, download, parse, plus outcome-workflow skills like SEO audit, lead gen, competitive intel, deep research). See [[reference_firecrawl_setup]].

**Parked:** job-master-data/live-schedule-state Firestore split (priority bumped to next-session-first-item), CSV/`saveSchedule()` race condition (not urgent), CRM/text-messaging follow-up (stalled on cost), stale GCal event blocks for the ghost jobs above — all carried into `parking-lot.md`.

---

## 2026-07-06 — Department-split reorg ("Claude Code Operating System")

**Done:**
- **Repo split into Apps / Marketing / Admin departments** — `landing/` → `marketing/`, `Job Tracker Files/` → `apps/job-tracker/context/`, `parking-lot.md`/`session-log.md`/Desktop's `GGNZ Parts Shopping List.csv`+`.txt` → `admin/context/`, `runway-mockup.html` → root `context/`. Each department got its own `claude.md`; added root `northstar.md` placeholder. Updated all path references that pointed at the old locations (`sunday-board-meeting.js`, `helpArticles.js`, root `CLAUDE.md`, `useAdHocTasks.js` comment).
- **`jt-backup-ggnz-35a126beb4ca.json` credential — resolved.** Confirmed it belongs to `jt-backup-ggnz`, a different (old, unused) Firebase project from the live Scheduler's `ggnz-scheduler` — leftover from the standalone Job Tracker tool, which Trevor confirmed he no longer uses. Added `.gitignore` rules (`*.json.key`, `jt-backup-*.json`) and moved the file into `archive/job-tracker/`. Still needed: Trevor to revoke this service-account key in Google Cloud Console — moving/gitignoring it locally doesn't invalidate the key itself.
- **Job Tracker fully decommissioned**, not just nested under `apps/` as the reorg first did. Trevor confirmed he'd asked for this in an earlier session and it didn't happen. Superseded entirely by this app's Jobs page/Sidebar (same filtering, plus real scheduling + sync) — no functional loss. Removed: the live `/job-tracker` route (`vercel.json` rewrite deleted, `public/job-tracker.html` moved), the 3 in-app help articles, the `SECTION_COLORS['Job Tracker']` entry in `HelpDrawer.jsx`, and the stale `SKP` help-text reference. Everything moved to `archive/job-tracker/` (not deleted) in case the old HTML is ever wanted for reference.

**Parked:** fully nest Scheduler under `apps/scheduler/` (deferred, real deploy risk), `DESIGN.md` at root (unrelated client file), two unidentified Desktop screenshots, dangling `SCHEDULER` symlink — all carried into `parking-lot.md`.

---

## 2026-07-06 — Manual-splits data-loss fix + parking-lot cleanup

**Done:**
- **Root cause of "manual splits still being erased" found and fixed.** The 2026-07-04 fix to `sheet_to_csv.command` (preserving `calendarSlot`/`gcalEventId`/`pomoLog`/manual splits) only ever landed in the GitHub repo — the actual script running unattended every 2 minutes on Micky (`~/Desktop/SCHEDULER_old/sheet_to_csv.command`) was never re-curled from GitHub after the fix, so it kept running the old broken version the whole time. Re-deployed the correct script, confirmed byte-identical to the repo copy.
- **Related bug also fixed:** `useScheduler.js` was writing `calendarSlot` as a raw `{dayIdx,hour,minute}` object instead of the canonical `slotKey()` date-string, in both the regular-drop and urgent-drop paths. Didn't cause data loss itself, but violated the documented format. See `3b573e8`.
- **Switch bounce on hrs in day job view (making splits)** — confirmed gone after the `calendarSlot`/split-fixes above, no separate cause found or needed.
- **Focus toggle added to mobile's job list.** Turned out mobile's job list lives under the "Log" tab, not "Day" (Day tab is calendar-only) — wired `focusList` into `DailyLogPage.jsx`'s mobile branch the same way as `Sidebar.jsx`/`JobShelf.jsx`, with a matching pill next to the bench filters. See `3c05515`.
- **Parking-lot cleanup** — audited every open item against the actual code (not just taking old entries at face value). Removed 11 items confirmed already done: split App.jsx into hooks, revenue pill, GCal conflict log, dead-code removal, "Today" button, `setChangelog` fix, mobile remove-from-calendar, status badges, auto-scroll-to-hour, auto-import CSV reactivity, and the already-stale Google Sheets VB formula note. Also removed "What's on today" morning banner — superseded by the Daily Log page itself.

**Parked:** edit-split-from-calendar (add-bench case) — full brief written this session, carried into `parking-lot.md` under Scoped Builds. Standing "Day load indicator on mobile" and "Sunday board meeting" ideas also carried forward — see [[project_sunday_board_meeting]] for why the latter needs a real conversation, not a checkbox.

---

## 2026-07-08/09 — Full audit + data-loss fixes, live bench resync, split-editor bug

**Done:**
- **Full 5-agent audit of split lifecycle, Daily Log, GCal sync, data pipeline, and UI state** — requested by Trevor to explain why splits kept dropping and Daily Log kept refreshing despite earlier fixes, plus an honest continue-vs-scrap verdict. Verdict: continue — every symptom traced to identified root causes, not a design dead end. Findings ranked and phased; Phase 0 (data-loss) approved and shipped same session.
- **Phase 0 shipped:** bench-keyword edit in Settings re-parsing a stub CSV and wiping all jobs (`App.jsx`), split re-save appending duplicate children instead of replacing them, un-split being a no-op that left orphans double-booking hours, and CSV re-upload's collision branch silently dropping manual splits despite its own toast claiming otherwise. Commits `c71629d` + 4 supporting fixes.
- **Follow-up pass (this session, after auditing what Phase 0 left out):** Daily Log's actual reported refresh bug (30s GCal poll setting a fresh array reference every tick regardless of change, plus a 3-second timing-guess echo guard) — fixed properly using an event signature check and Firestore's real `hasPendingWrites` flag (`b3a10b4`). GCal events orphaned forever when a split child was deleted via un-split/re-split — fixed by wiring `deleteEvent()` into both deletion paths in `useJobs.js` (`80f4de9`). Bench-classification keywords unified between the app (`src/data/jobs.js`) and the CSV pipeline (`scripts/sheet_to_csv.command`), which had silently drifted — including a `\bkeys?\b` addition so "broken keys" (keyboard) classifies as Electronics, not Admin (`286ae32`).
- **Live production resync run** — pushed the keyword-unification fix, re-curled the script onto Micky, ran the real pipeline after taking a Firestore rollback snapshot. All 6 predicted bench reclassifications landed correctly (#321, #1609, #1619, #1690 → Electronics; #1684, #1688 → Setup), zero scheduled slots or jobs lost (22/22, 92/92 before/after).
- **#1586 (Yamaha Dynamic 040) split-editor bug found and fixed.** Trevor reported an auto-split Fretwork job "only shows 4 splits" and wouldn't let him extend the Luthier component. Root cause: `initRows()` in both `JobDrawer.jsx` and `MobileJobSheet.jsx` only hydrated the editor from existing children when `isSplit` was set — but that flag only exists on manual splits; auto-split jobs never get it, so opening one showed a single stale pre-split row instead of the real cards. Fixed to match children by `parentId` alone (same pattern `useJobs.js`'s save path already used correctly). Verified live in preview against #1586's real data without writing to it. `98820d8`.
- **Sync-error niggle investigated, partially fixed.** Trevor described Sync occasionally showing an error that clears itself a few seconds later with no retry click. Found and fixed a real race in `ensureCalendarApi()` (plain boolean guard, unlike `initGoogleApi()`'s cached-promise pattern) that could silently fail the first job in a sync pass — `0123f26`. Trevor confirmed afterward the symptom still recurs, so this wasn't the whole story (or wasn't the actual cause firing here) — parked for a live-console diagnosis next session.
- **`re-fresh` skill installed** from a user-provided zip, symlinked into `~/.claude/skills/`. Initially appeared not to show in slash-command autocomplete (parked), but confirmed working in a later session start — resolved, no further action needed.

**Parked:** sync-error niggle needs live browser console during an actual sync to find the real cause (see `parking-lot.md`). Phase 2 structural work (job-master-data/live-schedule-state Firestore split) still deliberately deferred — this session's keyword fix was the quick-win version, not the full migration.

---
