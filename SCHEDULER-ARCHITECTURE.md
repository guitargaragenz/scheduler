# Scheduler — Technical Architecture & Reference

Deep code/data reference for the Scheduler app. Split out of root `CLAUDE.md` on 2026-07-16 so
that file stays pure session-protocol and this loads only when actually working on Scheduler code
(admin/marketing sessions no longer pull this in for free).

---

## Tech stack
- React + Vite, deployed on Vercel via GitHub
- Supabase — syncs schedule (jobs + slots) across devices in real time
- Google Calendar integration, PartsBox integration

## Commands

```bash
npm install
npm run dev          # Vite dev server, --host so the iPhone can hit it on the LAN
npm run build        # production build (what Vercel runs)
npm run preview      # serve the built bundle locally
npm test             # vitest run — whole suite, single pass
npx vitest run src/data/joinJobs.test.js          # one file
npx vitest run -t "keeps the manual Tag"          # one test by name
npx vitest                                        # watch mode
```

There is no lint or typecheck step — plain JS, no ESLint config. `npm test` is the only
gate before a commit. Tests are colocated (`src/**/*.test.js[x]`), jsdom + Testing Library
for components, plain vitest for `src/data` and `src/utils`.

## PDF drop
- Trevor drops a Multitrack PDF into the app in the browser, sees a preview, presses Import. Jobs
  land straight in Supabase — no Terminal window, no Mac-side watcher.
- A second PDF (Jobs by Age) fills in each job's booked-in date (`first_seen`); the app works out
  age fresh from that every day rather than storing a number that goes stale.
- Manual fields (owned by the app, not any external source): `Tag, Hours, Action, VB, BL, PJ`
- `PJ=Y` flags a job as a long-running project → appears on Projects page
- The old Google Sheet → CSV pipeline (`sheet_to_csv.command`, `start_watcher.command`) and the
  in-app Upload CSV buttons are retired (Brief H, Builds 2a–2c). Git history has them if anyone
  ever needs to see how they worked.

## Trevor's shorthand — the codes on every job

Written down here 2026-08-04, because they weren't. Working out what `VB` meant took a dig
through one help article and a board-meeting note from a week earlier, and `DG` was defined
nowhere at all despite being a valid option, colour-coded on the Daily Log and grouped under
"Needs Thinking" on the Projects page. If a code is added or its meaning shifts, change it here.

**Action codes** — the next required step on a job. One per job, set on the Jobs Sheet.

| Code | Means | Notes |
|---|---|---|
| `GTS` | Good To Start | Nothing in the way. The only action that means "workable". |
| `DG` | To be Diagnosed | Fault not established yet. Batches well — a diagnosing day. |
| `INC` | Incubating | Still turning over in Trevor's head. Nowhere near quoting. |
| `RS` | Research | Same still-figuring-it-out phase as INC. |
| `RS-C` | Research with Claude | As RS, done in a session here. |
| `CI` | Customer Involved | Waiting on the customer. Chase them, not the job. |
| `WP` | Waiting Parts | Trevor's own marker — Multitrack's "Waiting Parts" status is flattened to plain `Waiting` on import, so the app cannot tell a parts hold from a customer hold on status alone. |
| `FB` | Fabrication | A jig or fixture must be made first. Book the jig as a manual split on the **Admin** bench — jig time is real hours but never charged out. |

`INC`, `RS`, `RS-C` and `DG` all mean the same thing to the scheduler: not ready to plan.

**Flags** — checkboxes on the Jobs Sheet, independent of the action code.

| Flag | Means | Notes |
|---|---|---|
| `VB` | Virtual Booking | The customer keeps the instrument until near bench time. **The guitar is not in the shop**, so a VB job cannot be worked whatever else it says. |
| `BL` | Backlog | Old work still on the books. |
| `PJ` | Project | Long-running work. Drives the Projects page. |

**Difficulty tags** — set one and it fills in the matching hours, which are then Trevor's to
override. The hours are the bottom of the next band up, so the number offered is the honest
worst case rather than a midpoint that under-books the day.

| Tag | Fills in | Band |
|---|---|---|
| `EZ` | 1.5h | ≤ 1.5h |
| `M` | 3h | ≤ 3h |
| `T` | 5.5h | ≤ 5.5h |
| `H` | 6h | > 5.5h |

A tag fills the Hours box once and never touches it again, so most jobs' hours deliberately
differ from their tag's default — 29 of 36 on 2026-08-04. **A tag/hours mismatch is normal and
is not a bug**; do not build anything that flags it.

## Shipped features

### Projects view
Long-running job timeline page, merged to main 2026-06-14. (Renamed from "Runway" to "Projects" 2026-07-12 — UI label only, no logic change.)
- Projects button in header toggles the page
- Jobs flagged with `PJ=Y` in the app appear here — fully working as of 2026-06-14
- Sections: Needs Input (CI, Parts) / Needs Thinking (INC, RS, RS-C, DG) / Ready to Schedule (GTS)
- Age colours: green <30 days, amber 30–60, red 60+

### Mobile tap-to-schedule
Bottom sheet for iPhone (any touch/narrow device), merged to main 2026-06-14.
- Tap a job card in the sidebar → sheet slides up
- Schedule tab: pick day + time → Place on Calendar
- Bench & Split tab: change bench, adjust hours, add splits
- Desktop users still get the existing JobDrawer

### Daily Log (bullet journal tracker)
Merged to main 2026-06-29.
- Daily Log button in header → full-page bullet journal for today
- Add job bullets (tap job in Today section → opens MobileJobSheet/JobDrawer)
- Add free-text notes
- Swipe left on a bullet → remove (send back to bench); swipe right → mark done
- Scheduled time badge shown in job sheet header (📅 Mon 30 Jun · 9 AM)
- `formatSlotDisplay` has type guard for non-string calendarSlot values (Firebase safety)

### Mobile Jobs page
Merged to main 2026-06-29.
- Jobs button in header (mobile only) → full-screen job list
- Bench filter chips: Fretwork → Luthier → Setup → Wiring → Electronics → Admin
- Shows top-level jobs only; split parent rows have a ▶ N sub-tasks toggle (tap to expand/collapse)
- Expanded: indented subtask cards with their own bench colour stripe, each tappable → MobileJobSheet
- Tap parent row → MobileJobSheet for parent; tap subtask → MobileJobSheet for subtask
- Schedulable jobs on top; Waiting/On Hold section below (dimmed)

### Bench classification fixes (merged 2026-06-29)
- `setup + pot` → Setup bench (then auto-splits into Setup + Wiring), not Electronics
- `scratchy` added to Electronics keywords
- Priority rule in `inferBench`: setup/stp/restring keywords short-circuit before Electronics check

### Mobile-only components (merged to main 2026-06-29)
- `isMobile` is computed in `App.jsx` as `window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768`
- Mobile gets: Jobs page button in header, Daily Log button in header, MobileJobSheet (bottom sheet) instead of JobDrawer
- `src/components/JobsPage.jsx` — full-screen job list (mobile only); rendered when `showJobs` state is true in App.jsx
- `src/components/DailyLog.jsx` — bullet journal page; rendered when `showDailyLog` state is true
- `src/components/MobileJobSheet.jsx` — bottom sheet for scheduling/editing jobs on touch devices
- Desktop still uses `src/components/JobDrawer.jsx` and `src/components/Sidebar.jsx`

## Key data structure notes
- `job.hasSubtasks` — auto-split parent (Fretwork refret, Luthier+setup, etc.)
- `job.isSplit` — manually-split parent (user edited via drawer)
- `job.parentId` — subtask child (both auto and manual); children inherit `hasSubtasks: true` via spread in `withSplitsExpanded` — don't filter on `!hasSubtasks` to find children, use `!parentId` for parents
- `job.calendarSlot` — string `"YYYY-MM-DD-H-M"` or null; guard with `typeof slot === 'string'`
- **Critical gotcha**: `withSplitsExpanded` (in `useFirebase.js`) regenerates auto-split children via `{ ...parentJob, id: 'X-R', bench: 'Fretwork', parentId: job.id }`. Because it spreads the parent, every auto-split child INHERITS `hasSubtasks: true`. Never use `!job.hasSubtasks` to identify top-level jobs — use `!job.parentId` instead.
- To get subtasks for a job: auto-splits → `jobs.filter(j => job.subtasks.includes(j.id))`; manual splits → `jobs.filter(j => j.parentId === job.id)`

---

## Architecture — File Boundaries and Ownership

This section exists so Claude can orient instantly in a new session. Each file has a single clear owner. Do not blur these lines.

### `src/data/jobs.js` — Job data layer (pure, no React)
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

### `src/App.jsx` — Main app shell (needs splitting — parked item, now in the Parking Lot page/table)
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
`BENCH_COLORS` in `src/data/jobs.js` is the single source. GCal colours, card colours, and Projects page colours all derive from here. Never define bench colours elsewhere.

### Sub-task identity
Sub-tasks carry the parent's `job` number but a suffixed `id`. They have their own `bench` value (different from parent). When syncing to GCal, sub-tasks must have their `bench` field set — check this if `colorId` falls back to the default.
