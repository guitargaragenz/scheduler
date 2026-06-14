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
- Multitrack PDF → `pdf_jobs_to_csv.command` script (Micky desktop) → `jobs.csv` → upload via sidebar in app
- CSV columns: `Job, Customer, Mfr, Model, Status, FirstSeen, Days, Tag, Hours, Action, Desc, VB, BL`
- Re-uploading CSV preserves Pomodoro logs and manual fields

### Action codes (from CSV — what a job is waiting on / next step)
| Code | Meaning |
|---|---|
| `GTS` | Good To Start — ready to schedule |
| `INC` | Incubating — letting it sit, subconscious processing |
| `CI` | Customer In — waiting for customer input |
| `RS-C` | Research via Claude |
| `RS` | Research |
| `Parts` | Waiting on parts |
| `DG` | Diagnose |

### Job types
- **Quick jobs** — 1–8 hrs, live in weekly calendar scheduler
- **Long-running jobs** — weeks/months, can get lost when deprioritised (fires, mental blocks)

### Shipped — Runway view
Long-running job timeline page, merged to main 2026-06-14.
- Runway button in header toggles the page
- Jobs flagged with `PJ=Y` in Google Sheet / CSV appear here
- Sections: Needs Input (CI, Parts) / Needs Thinking (INC, RS, RS-C, DG) / Ready to Schedule (GTS)
- Age colours: green <30 days, amber 30–60, red 60+
- **TODO (Micky):** Add `PJ` column to Google Sheet, replace `sheet_to_csv.command` with updated version, run it

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

### Always confirm scope before bulk or destructive operations

Before performing any action that affects multiple items at once (archiving sessions, deleting files, resetting data, bulk edits, etc.), explicitly state what will be affected and ask the user to confirm the scope.

Example: if asked to "clean up duplicates", list what counts as a duplicate and confirm before touching anything.

This rule exists because bulk session archiving was done when only duplicate removal was requested (2026-05-23).
