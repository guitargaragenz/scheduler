---
doc_status: closed
---

# Closed work — lessons only

The briefs are deleted; `git log -- docs/briefs/` has them in full. One line each, only what still
binds the code or how we work. A record, never a task list.

- **Jobs Sheet search:** filter `visibleRows`, never `rows` — save, discard and the error count read `rows`, so a hidden edit still saves.
- **`#` search:** `#EZ` matches Tag or Action exactly; plain text can't find one-letter tags.
- **No "No bench set":** `useSupabase.js` reads a missing bench as `Admin` on load.
- **Bench from the work:** brand and model never pick a bench. The Electronics keyword list still holds gear types (`synth`, `mixer`, `head`…) — same mistake, still live.
- **Daily Log picker:** `dayJobOptions()` reads the day marks, so a crossed line hides as well as a `pieceDone` one.
- **Done jobs keep their Daily Log lines:** `bookedOnDay()` passes `keepDone`. A day is still not a stored record.
- **Day and Week view are one component** (`CalendarGrid.jsx`). Column alignment is a data property — a misread column writes marks to the wrong day.
- **Daily Log drives Weekly Log:** write under the top-level job id; D Log always wins; the app never books a day; no invoice prompt from the D Log.
- **Auto rows:** removing one stores a `hidden` row, never a delete. Nothing in the D Log clears `hidden`.
- **Not a bug:** a removed job can be put back by re-marking the Weekly Log.
- **Week page:** Trevor picks jobs, the app never schedules. Week marks live in their own table. The calendar 30-second poll is parked, not deleted.
- **Parts arrived:** the banner stays until ✕ and never re-raises a dismissed job.
- **WP disagreement:** the app reports it and never clears the tag — the import can't touch hand-kept columns, on purpose.
- **Parking Lot:** `saveParkingLot()` is a per-item diff; a failed `loadParkingLot()` returns `null`, never `[]`.
- **Settings:** seeded `ON CONFLICT DO NOTHING`, never upsert.
- **Parts to Order:** its functions used to swallow errors. Ticking a part writes no job state. `parts_to_order` still has no RLS in the schema file.
- **Descriptions:** Job List writes at creation, Jobs by Age owns it after.
- **Status string is `Waiting`**, not `Waiting Parts` — the export is master.
- **Invoices PDF import:** cancelled. Don't revive it.
- **Appointments missing from the calendar** was Google Cloud config, not code.
- **Vercel preview uses the live database** — never click-test anything that writes job state.
- **Next bench on the job card** (PR #69, `02a525a`): display only, never writes job state.
- **Ticked part saves** (PR #70, `96cc365`): save outside the `setJobs` updater — React can defer it, so the save never ran.
- **Week page day box** (PR #72, `3182f84`): tap toggles `·`, hold opens the marks list; the lift after a hold is swallowed, same as the end box.
