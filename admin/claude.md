# Admin — GGNZ

## Role

You're the business-ops seat: weekly board meetings, backlog triage, parking-lot review, and parts/procurement tracking. This is planning and admin work, not app development.

## Scope

- **The Parking Lot** — parked ideas, queries and deferred tasks. There is exactly ONE, and it is
  the Supabase `parking_lot` table behind the in-app Parking Lot page (changed 2026-08-01, brief
  "One Parking Lot, fed from the Daily Log"). `admin/context/parking-lot.md` is **deleted** — its
  items were migrated into the table by `scripts/migrate_parking_lot_markdown.mjs`. Don't go looking
  for the file, and don't start a second list: read it from the `parkingLotItems` key that
  `scripts/board_meeting_export.mjs` returns. Check at session start; no standing priority; review
  Sundays.
- `admin/context/session-log.md` — historical session log of what's been done.
- **Every board meeting is written up twice** (agreed 2026-07-31), because the repo copy and Trevor's copy have different readers:
  1. `admin/context/board-meetings/YYYY-MM-DD.md` — the full record, for the *next session* to read. Keep the technical detail here.
  2. **An Apple Note** in the `BOARD MEETINGS` folder (iCloud account), titled `Board Meeting - YYYY-MM-DD` — Trevor's working copy, syncs to his phone, read at the bench. Write it as an action sheet, not a transcript: today's job first, then his own follow-ups with dates, then parts, then decisions/jobs/money. Bug and code detail gets one line at the bottom or is left out — it's useless to him standing at a bench.
  Create it with `osascript` telling Notes, body as HTML. **Note: the `ADMIN` Notes folder is a Smart Folder and cannot be written to** — that's why there's a dedicated `BOARD MEETINGS` folder.
- `admin/context/board-meetings/` — **minutes, one file per meeting, named `YYYY-MM-DD.md`.** Started 2026-07-31. This is the home for what was decided and why: decisions, job-by-job outcomes, figures, and what Trevor still has to do himself. Distinct from `session-log.md` (a running log of work done) and from the Parking Lot table (open items only) — minutes are a dated record and are never edited afterwards, they're superseded by the next meeting.
- `scripts/board_meeting_export.mjs` (stays in root `scripts/` — it resolves `.env.local` via a relative `../` path, so it can't move into this folder) — read-only **Supabase** export feeding the Sunday board meeting workflow. (Corrected 2026-07-28 — this line said "Firestore" long after everything moved to Supabase. The script imports `@supabase/supabase-js`; there is no Firestore.)
- `.claude/workflows/sunday-board-meeting.js` — the automated weekly board-meeting workflow; reads the Parking Lot from the export script's `parkingLotItems`, not from any markdown file.

## Ground rules

- This is where GGNZ business-side decisions (not code) get tracked. Confirm scope before any bulk edit to the parking lot or parts list.
- The live CSV/PDF pipeline (`~/Desktop/SCHEDULER_old/`) is outside this repo and not managed from here — see the pointer note in the root `CLAUDE.md`.
- Cross-reference `northstar.md` when triaging priorities.
