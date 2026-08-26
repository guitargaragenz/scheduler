# Scope lock — a job closed this week must survive the week

Approved by Trevor 2026-08-26. Council done; the amendments below are part of
the lock.

## Build

`buildPdfImportPlan()` (`src/data/pdfImportPlan.js`) must not depart a job that
carries a `close:<thisMonday>` mark in `bench_week_marks`. It departs on a later
import, once the week has rolled over.

The week marks and the current week's Monday come in as arguments. The function
stays pure.

Threading them there is part of this build: `App.jsx` and `useJobs.js` both
change. `useJobs.js` is blast-radius — hence the full protocol.

## Council amendments — binding

1. Thread `weekMarks.marks` from `App.jsx` through `useJobs()`. Do NOT call
   `loadWeekMarks()` again at import time.
2. Inline `` `close:${monday}` ``. Do not import `weekCloseKey` from
   `BenchWeekPage.jsx` — data must not import from a page component.
3. Monday comes from `getWeekDays()` with NO argument, never from `weekDays` /
   `schedulerWeekDays` (the calendar's navigated week).
4. `null`, `undefined` and `{}` marks all mean "no close mark → depart
   normally". Do NOT copy the `knownJobIds` null-blocks-everything pattern.
5. A held-back job leaves BOTH `departures[]` and `missing[]`.

## Out of scope

- Changing what `departed_at` means, or un-departing existing rows. 1679 stays
  departed.
- `weekRows()`, `bookedOnDay()`, the Daily Log, the Weekly Log.
- Storing the day's automatic rows in `bench_day_marks` (known gap, separate).
- The Weekly Log 1000-row read cap (parked).
- Any new UI. A held-back job is simply absent from the preview's list.

## Rules that bind it

- A completed job never comes back — the returning-job path is untouched.
- Count refusal, duplicate refusal and the `canDepart` gate all stay as they
  are. A failed `knownJobIds` read still departs nothing.
- Departures still only ever come from the Multitrack printout.
- No writes to `jobs`, `scheduled_slots` or `calendarSlot` beyond what the
  import already does.

## Background only — do NOT open this to start the build

`docs/briefs/2026-08-26-closed-job-survives-the-week.md` — diagnosis, council
rulings in full, checklist items 1-12. Everything needed to build is above.
