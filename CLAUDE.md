# Guitar Garage NZ — Scheduler Project

## Starting a New Session

1. **Micky / Moby** — open terminal, `cd` into the scheduler project folder, run `claude`. The repo context is automatic.
2. **iPhone** — go to `claude.ai/code`, start a new session, select `guitargaragenz/scheduler` from the repo list.
3. **All devices** — CLAUDE.md loads automatically. No need to re-explain the project — just pick up where you left off.

---

## Project Context

### Devices
- **Micky** — iMac, primary dev machine. Start all local builds and dev server testing here. Has `.env` with Firebase / Google API keys.
- **Moby** — MacBook
- **iPhone** — on-the-go, Claude Code web sessions only (no local dev server)

### Tech stack
- React + Vite, deployed on Vercel via GitHub
- Firebase Firestore — syncs schedule (jobs + slots) across devices in real time
- Google Calendar integration, PartsBox integration

### CSV pipeline
- **Automated:** Drop Multitrack PDF into `~/Desktop/SCHEDULER_old/DropBox/` → `start_watcher.command` detects it → runs PDF parser → updates `jobs.csv` → runs `sheet_to_csv.command` → pushes to Firebase
- **Sheet poller:** `start_watcher.command` also polls Google Sheet every 2 min — if Sheet is edited directly, auto-syncs without a PDF drop
- **Manual:** Can also run `sheet_to_csv.command` directly to force a sync
- All scripts live in `~/Desktop/SCHEDULER_old/` (iCloud)
- Master scripts are in the GitHub repo at `scripts/` — always download via curl (iCloud serves a plist stub if you drag-drop):
  ```
  curl -L "https://raw.githubusercontent.com/guitargaragenz/scheduler/main/scripts/sheet_to_csv.command" -o ~/Library/Mobile\ Documents/com\~apple\~CloudDocs/Desktop/SCHEDULER_old/sheet_to_csv.command && chmod +x ~/Library/Mobile\ Documents/com\~apple\~CloudDocs/Desktop/SCHEDULER_old/sheet_to_csv.command
  ```
- CSV columns (from PDF): `Job, Customer, Mfr, Model, Status, FirstSeen, Days, Tag, Hours, Action, Desc, VB, BL`
- Manual fields (from Google Sheet, not PDF): `Tag, Hours, Action, VB, BL, PJ`
- `PJ=Y` flags a job as a long-running project → appears on Runway page
- Re-uploading CSV preserves Pomodoro logs

### Shipped — Runway view
Long-running job timeline page, merged to main 2026-06-14.
- Runway button in header toggles the page
- Jobs flagged with `PJ=Y` in Google Sheet appear here — fully working as of 2026-06-14
- Sections: Needs Input (CI, Parts) / Needs Thinking (INC, RS, RS-C, DG) / Ready to Schedule (GTS)
- Age colours: green <30 days, amber 30–60, red 60+

### Shipped — Mobile tap-to-schedule
Bottom sheet for iPhone (any touch/narrow device), merged to main 2026-06-14.
- Tap a job card in the sidebar → sheet slides up
- Schedule tab: pick day + time → Place on Calendar
- Bench & Split tab: change bench, adjust hours, add splits
- Desktop users still get the existing JobDrawer
- **TODO:** UI polish pass (pending user feedback)
### Claude Code session note
Sessions don't sync across devices — context lives here in CLAUDE.md, not in session history.

---

## Rules

### Never push to GitHub from Micky (or any local device)

All git commits and pushes must be done from a Claude Code session (web or CLI), not from Micky's terminal. Micky's local git clone can be out of sync with GitHub, which caused accidental deletion of 35 app files on 2026-06-14.

**If the user needs to add a file from their Mac to the repo:** paste the content here and Claude will commit and push it from the session.

If the user starts to run git commands on Micky, remind them to stop and let Claude handle it instead.

### Always confirm scope before bulk or destructive operations

Before performing any action that affects multiple items at once (archiving sessions, deleting files, resetting data, bulk edits, etc.), explicitly state what will be affected and ask the user to confirm the scope.

Example: if asked to "clean up duplicates", list what counts as a duplicate and confirm before touching anything.

This rule exists because bulk session archiving was done when only duplicate removal was requested (2026-05-23).

---

## Architecture — File Boundaries and Ownership

This section exists so Claude can orient instantly in a new session. Each file has a single clear owner. Do not blur these lines.

### `src/data/jobs.js` — Job data layer (pure, no React)
- **`parseCSV()`** — RFC-4180 parser → produces the canonical job array
- **`inferBench()`** — regex-based bench assignment from desc/status/action/mfr
- **`createSubtasks()`** — splits jobs into sub-cards (Luthier/Setup/Fretwork combos)
- **`BENCH_COLORS`** — single source of truth for bench hex colours: `{ bg, border, text }`
- **`slotsNeeded()` does NOT live here** — it lives in `scheduler.js`
- Job shape: `{ id, job, mfr, model, status, bench, hours, scheduled, calendarSlot, gcalEventId, parentId, subtasks, hasSubtasks, ... }`
- Subtask IDs follow the pattern: `${parentId}-LU`, `-ST`, `-WR`, `-FN`, `-R`, `-LC`

### `src/utils/scheduler.js` — Slot math (pure, no React)
- **`slotsNeeded(job)`** — returns **slot count** (not hours). 1 hr = 2 slots. Hard cap: `MAX_CONTINUOUS_SLOTS = 6` (3 hrs).
- **Critical invariant:** `durationHours = slotsNeeded(job) / 2` — always divide by 2 when converting slots → hours for GCal or display.
- **`findAvailableSlots()`** — finds N free 30-min slots from a given start, respecting lunch, gap hours, weekends, external blocks.
- **`scheduleUrgent()`** — places a job at a specific slot, returns displaced job IDs.

### `src/utils/calendar.js` — Calendar helpers (pure, no React)
- `slotKey(date, hour, minute)` — canonical string key for a 30-min slot. Used everywhere as the scheduledSlots map key.
- `getWorkHours(date)`, `isLunchSlot()`, `isSaturday()`, `isSunday()`, `isGapHour()` — time boundary rules.

### `src/utils/googleCalendar.js` — Google Calendar API wrapper
- **Auth:** `initGoogleApi()`, `requestAuth()`, `isSignedIn()`, `signOut()`
- **Events:** `createEvent()` (insert), `updateEvent()` (PUT), `deleteEvent()`, `listEvents()`
- **Colour:** Uses `BENCH_COLOR_ID` map (colorId strings `'1'`–`'11'`). GCal event API does NOT support custom hex — `colorRgbFormat` is calendar-level only, not event-level. Do not attempt hex again.
- **Duration:** `end.setTime(start.getTime() + Math.min(durationHours, 3) * 60 * 60 * 1000)` — millisecond math handles decimal hours (1.5hr, 0.5hr etc). Never use `setHours()` for this.
- **Insert vs update:** Jobs with `gcalEventId` → `events.update`; new jobs → `events.insert`. The `gcalEventId` is stored back on the job object after first sync.

### `src/hooks/useGoogleCalendar.js` — GCal React hook
- Orchestrates: auth state, 30s polling, conflict bumping, `handleSync()`
- **`handleSync()`** iterates scheduled jobs → calls `updateEvent` or `createEvent` → stores returned `gcalEventId`
- Duration calculation lives here: `const durationHours = slotsNeeded(job) / 2`
- Polling detects external GCal appointments and bumps conflicting scheduled jobs automatically

### `src/utils/firebase.js` — Firebase read/write
- Syncs `scheduledSlots` and job state across devices in real time
- `appendConflictLog()` — writes bump events to Firestore for audit trail

### `src/App.jsx` — Main app shell (needs splitting — see parking-lot.md)
- Holds top-level state: `jobs`, `scheduledSlots`, `weekDays`, settings, pomodoro
- Passes refs (`scheduledSlotsRef`, `jobsRef`) to hooks so callbacks always see current state without stale closures

---

## Key Patterns Claude Uses

### Reading before editing
Always read the actual file before editing — never assume from context. File shape drifts.

### Tracing the call chain
When debugging, trace: `useGoogleCalendar.js` → `googleCalendar.js` → `gapi` → network request. Console interceptors on `gapi.client.calendar.events.update/insert` expose the exact payload sent to the API.

### "My change isn't showing" checklist
1. Hard refresh first: **Cmd + Shift + R** in Arc/Chrome (Vite content-hashes bundles; browser may serve stale).
2. Confirm Vercel deployed (check vercel.com or wait 60s after push).
3. Check if interceptor shows the old or new payload.

### Slot ↔ hours conversion
`slotsNeeded()` = hours × 2, capped at 6. Always divide by 2 before passing to anything that expects hours (GCal duration, display labels, etc.).

### Bench colour source of truth
`BENCH_COLORS` in `src/data/jobs.js` is the single source. GCal colours, card colours, and Runway colours all derive from here. Never define bench colours elsewhere.

### Sub-task identity
Sub-tasks carry the parent's `job` number but a suffixed `id`. They have their own `bench` value (different from parent). When syncing to GCal, sub-tasks must have their `bench` field set — check this if `colorId` falls back to the default.

### Git discipline
All commits and pushes go through Claude — never from Micky's terminal. Always `git add <specific file>`, never `git add -A`. Commit messages explain the why. Never `--no-verify` or `--amend` a pushed commit.
