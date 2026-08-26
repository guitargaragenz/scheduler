# Scope lock — a job closed this week must survive the week

Status: awaiting Trevor's approval.

## Build

`buildPdfImportPlan()` (`src/data/pdfImportPlan.js`) must not depart a job that
carries a `close:<thisMonday>` mark in `bench_week_marks`. It departs on a later
import, once the week has rolled over.

The week marks and the current week's Monday come in as arguments. The function
stays pure.

## Out of scope

- Changing what `departed_at` means, or un-departing existing rows. 1679 stays
  departed.
- `weekRows()`, `bookedOnDay()`, the Daily Log, the Weekly Log.
- Storing the day's automatic rows in `bench_day_marks` (known gap, separate).
- The Weekly Log 1000-row read cap (parked).

## Rules that bind it

- A completed job never comes back — the returning-job path is untouched.
- Count refusal, duplicate refusal and the `canDepart` gate all stay as they
  are. A failed `knownJobIds` read still departs nothing.
- Departures still only ever come from the Multitrack printout.
- No writes to `jobs`, `scheduled_slots` or `calendarSlot` beyond what the
  import already does.
- A held-back job is simply absent from the preview's departing list.

## Background only — do NOT open this to start the build

`docs/briefs/2026-08-26-closed-job-survives-the-week.md` holds the diagnosis and
the verification checklist. Everything needed to build is above.
