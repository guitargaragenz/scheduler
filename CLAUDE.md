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

### Shipped — Daily Log (bullet journal tracker)
Branch: `claude/bullet-journal-tracker-split-3vwxi0` — PR #2 open, not yet merged to main.
- Daily Log button in header → full-page bullet journal for today
- Add job bullets (tap job in Today section → opens MobileJobSheet/JobDrawer)
- Add free-text notes
- Swipe left on a bullet → remove (send back to bench); swipe right → mark done
- Scheduled time badge shown in job sheet header (📅 Mon 30 Jun · 9 AM)
- `formatSlotDisplay` has type guard for non-string calendarSlot values (Firebase safety)

### Shipped — Mobile Jobs page
Branch: `claude/bullet-journal-tracker-split-3vwxi0` — PR #2.
- Jobs button in header (mobile only) → full-screen job list
- Bench filter chips: Fretwork → Luthier → Setup → Wiring → Electronics → Admin
- Shows top-level jobs only (same as sidebar — split jobs show "N splits" badge)
- Tap any schedulable job → opens MobileJobSheet
- Schedulable jobs on top; Waiting/On Hold section below (dimmed)

### TODO — Jobs page: expand splits like the sidebar
**Next session priority.** Currently split jobs just show a "2 splits" badge. The user wants it to work exactly like the Sidebar:
- Parent job row shows with a "▶ 2 sub-tasks" toggle (tap to expand/collapse)
- Expanded: indented subtask cards appear below the parent, each with its own bench colour
- Tapping the PARENT row opens MobileJobSheet for the parent job
- Tapping a SUBTASK row opens MobileJobSheet for that subtask
- See `Sidebar.jsx` `renderJob()` function for the exact expand/collapse pattern to replicate on mobile

### Bench classification fixes (in PR #2)
- `setup + pot` → Setup bench (then auto-splits into Setup + Wiring), not Electronics
- `scratchy` added to Electronics keywords
- Priority rule in `inferBench`: setup/stp/restring keywords short-circuit before Electronics check

### Key data structure notes
- `job.hasSubtasks` — auto-split parent (Fretwork refret, Luthier+setup, etc.)
- `job.isSplit` — manually-split parent (user edited via drawer)
- `job.parentId` — subtask child (both auto and manual); children inherit `hasSubtasks: true` via spread in `withSplitsExpanded` — don't filter on `!hasSubtasks` to find children, use `!parentId` for parents
- `job.calendarSlot` — string `"YYYY-MM-DD-H-M"` or null; guard with `typeof slot === 'string'`

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
