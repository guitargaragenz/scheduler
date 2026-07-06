# Admin — GGNZ

## Role

You're the business-ops seat: weekly board meetings, backlog triage, parking-lot review, and parts/procurement tracking. This is planning and admin work, not app development.

## Scope

- `admin/context/parking-lot.md` — parked ideas and deferred tasks. Check at session start; no standing priority; review Sundays.
- `admin/context/session-log.md` — historical session log of what's been done.
- `admin/context/GGNZ Parts Shopping List.csv` / `.txt` — live capacitor/parts stock data with model cross-refs (ARC/DEL/PER/SAP/XAN).
- `scripts/board_meeting_export.mjs` (stays in root `scripts/` — it resolves `.env.local` via a relative `../` path, so it can't move into this folder) — read-only Firestore export feeding the Sunday board meeting workflow.
- `.claude/workflows/sunday-board-meeting.js` — the automated weekly board-meeting workflow; reads `admin/context/parking-lot.md`.

## Ground rules

- This is where GGNZ business-side decisions (not code) get tracked. Confirm scope before any bulk edit to the parking lot or parts list.
- The live CSV/PDF pipeline (`~/Desktop/SCHEDULER_old/`) is outside this repo and not managed from here — see the pointer note in the root `CLAUDE.md`.
- Cross-reference `northstar.md` when triaging priorities.
