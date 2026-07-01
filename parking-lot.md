# Parking Lot

Items parked during sessions for weekly review every Sunday.

---

## 2026-06-13 — Session: Setup / Session Cleanup

- [ ] Online session journal — build a journal to log sessions online
- [ ] Sunday board meeting with Claude + agents — weekly planning session with agent "board members" to review projects and plan the week
- [ ] Explore Claude Dispatch (beta) — investigate using Dispatch in sessions

---

## 2026-06-15 — Session: GCal Appointment Conflict / Auto-reschedule

- [ ] **Cascade reschedule toggle (Settings)** — when a job gets bumped by a GCal appointment and lands in a slot occupied by another job, cascade the bump: each displaced job pushes the next one down the queue until everything fits or we run out of week. Make it opt-in via a toggle in Settings (default off) so the schedule doesn't silently reshuffle itself. Agreed not to build it automatically — too unpredictable without user control.

---

## 2026-06-17 — Session: Weekly Planning / Catch-up Sprint

- [ ] **Desktop JobDrawer — schedule section not working** — added day picker + time + Place on Calendar to desktop drawer, pushed but didn't work. Needs investigation.
- [ ] **Pomodoro timer alarm sound not working** — alarm not firing at end of session.
- [ ] **Mobile — remove job from calendar** — added Remove from Calendar button to MobileJobSheet for scheduled jobs (can't DnD back to sidebar on mobile). Pushed but not verified working.
- [ ] **Online session journal / parking lot web page** — web-based editable version of this parking-lot.md. Readable and editable from any device (iPhone too). Can add ideas, add detail to existing items. Pulls live data from Firebase. More details = quicker comms with Claude, less stuck in brain. Replaces need to paste raw notes.
- [ ] **Printable schedule / quick wins view** — live view of current week schedule + quick wins list. Print via Cmd+P → PDF. Could be part of the online journal page.
- [ ] **Google Sheets VB column formula** — SEARCH formula on col L no longer needed (PDF parser already strips VB: and sets flag). No action required — closed.

---

## 2026-06-24 — Session: Full App Audit + Team Build

Full audit by agent team + council. All items prioritised and actionable.

### Architecture (do first — foundation for everything else)
- [ ] **Split App.jsx into specialist roles** — 1,000+ line file does everything at once. Split into job manager, calendar manager, Firebase manager, GCal manager, screen manager. Run through full team protocol. Prevents the regression days.

### Council flags (urgent)
- [ ] **Silent GCal conflict bump** — app quietly moves bumped jobs with no durable record. Could come in Monday to scrambled schedule with no explanation. Fix: durable log + visible notification when job gets bumped.
- [ ] **Firebase writes entire jobs array on every change** — fine now, will hit limits as pomoLog accumulates. Watch it.

### Quick wins
- [ ] Fix desktop "Place on Calendar" button (confirmed broken)
- [ ] Fix Pomodoro alarm sound (confirmed broken)
- [ ] Fix `setChangelog` bug — every drag/sync/upload event silently discarded
- [ ] Remove dead code: `GCalDrawer.jsx`, `autoSchedule()`, `placeJob()`, `canPlace()`, `JobEditDrawer.jsx`
- [ ] "Today" button on week nav
- [ ] Age colour badges on sidebar cards — 60+ day jobs red (Runway has this, sidebar doesn't)
- [ ] Status badge on sidebar cards — GTS/INC/CI/PARTS not visible on card
- [ ] Auto-scroll calendar to current hour on load
- [ ] Undo toast on unschedule — currently destructive with no confirmation
- [ ] Revenue pill in header — data already computed, not surfaced

### Bigger ideas
- [ ] Mobile "Move" action for scheduled jobs — currently remove → find → reschedule
- [ ] Day load indicator on mobile Schedule tab — no visibility into what's booked before placing
- [ ] "What's on today" morning banner — no daily summary anywhere
- [ ] Actual vs estimated hours on job card — data exists, never shown together
- [ ] "Next job" recommendation — nothing tells you what to do next
- [ ] Weekly capacity view — "22h booked, 18h queued, 6h buffer"
- [ ] Pomo timer without scheduling — can't log time on unscheduled jobs
- [ ] Auto-import CSV — pipeline already writes to Firebase, app should react automatically
- [ ] Week-over-week revenue history — no trend view

### UX friction
- [ ] "Mark Done" without job being on calendar
- [ ] Subtask expand affordance too small — needs visible chip
- [ ] No GCal sync indicator on calendar cards
- [ ] Urgent mode toggle too prominent — accidental activation risk
- [ ] Mobile time picker allows non-30min snapping — replace with preset buttons
- [ ] VB badge needs tooltip — "Valued Builder — priority customer"

---

## 2026-07-01 — Session: CSV Fix Merged + Remove from Calendar

- [x] **"Remove from Calendar" button in PomoDrawer (desktop)** — clicking a scheduled job on the calendar opens PomoDrawer (not JobDrawer). Added a "Remove from Calendar" button there (below Job Done section, only shows when idle) so jobs can be unscheduled with one click instead of dragging back to the sidebar. Uses existing `scheduler.unscheduleJob`. Verified working in preview — job disappears from calendar cleanly. Mobile already had this in MobileJobSheet.
- [ ] **Pomodoro timer broken (Trevor confirmed 2026-07-01)** — timer itself not working right, on top of the already-logged alarm sound bug above. Needs a proper look — parked, not touched today.

---
