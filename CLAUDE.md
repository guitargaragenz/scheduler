# Guitar Garage NZ — Scheduler Project

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

### Work in progress — Runway view
A new page for long-running jobs as a horizontal timeline.
- Branch: `claude/ggnz-scheduler-files-vq0sv8`, PR #1
- Mockup done: `runway-mockup.html`
- Design decisions made:
  - Bars start at intake date (`FirstSeen` / `Days` field), today marker on right
  - Age colours: green <30 days, amber 30–60, red 60+
  - Hatching on bars with no recent calendar activity
  - Action field surfaces as the "blocker" label on each bar (no separate dependency field needed)
  - Sections grouped by Action: Needs Input (CI, Parts) / Needs Thinking (INC, RS, RS-C, DG) / Ready (GTS)
- Next steps: update mockup with Action-based sections, then build into React app

### Claude Code session note
Sessions don't sync across devices — context lives here in CLAUDE.md, not in session history.

---

## Rules

### Always confirm scope before bulk or destructive operations

Before performing any action that affects multiple items at once (archiving sessions, deleting files, resetting data, bulk edits, etc.), explicitly state what will be affected and ask the user to confirm the scope.

Example: if asked to "clean up duplicates", list what counts as a duplicate and confirm before touching anything.

This rule exists because bulk session archiving was done when only duplicate removal was requested (2026-05-23).
