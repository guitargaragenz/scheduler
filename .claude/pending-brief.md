---
doc_status: live
---
# Scope lock — the Daily Log must keep its own day

## Build

Finishing a job wipes its lines off the Daily Log. The Daily Log gets its
automatic rows from the Weekly Log's `weekRows()`, which drops finished jobs
(`BenchWeekPage.jsx:245`) — correct for the week, wrong for a day, which is a
record of what happened.

Stop the Daily Log inheriting that filter. Nothing that was ever on a day leaves
it. Two shapes for council to pick between — derive the day without `weekRows()`,
or store automatic rows in `bench_day_marks` — the brief sets both out.

No data has been lost: marks, notes and hand-added rows are all still in
`bench_day_marks`.

## Rules that bind it

- The Weekly Log's behaviour must not change. A finished job still drops off the
  week. `weekRows()` is shared.
- Never delete from `bench_day_marks`. No clear-and-reinsert, no wipe.
- No writes to `jobs`, `scheduled_slots` or `calendarSlot`. Closing a job stays
  at the invoice prompt.

## Out of scope

- The Weekly Log 1000-row cap (parked).
- Any change to how or where a job is marked done.
- Pruning old day marks.

---

Background only, do not open to start the build:
`docs/briefs/2026-08-26-daily-log-keeps-its-day.md` carries the diagnosis, the
two build shapes and the verification checklist.
