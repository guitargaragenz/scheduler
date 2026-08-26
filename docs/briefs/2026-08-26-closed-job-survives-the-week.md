---
doc_status: live
---

# A job closed this week must survive the week

Found 2026-08-26, chasing job 1679: closed on Monday 24/8, then gone from the
Weekly Log by Wednesday, and showing on the Daily Log as a bare header with no
lines under it.

## What actually happens

1. Trevor closes 1679 in the Weekly Log. `handleClose()` writes a
   `close:2026-08-24` mark into `bench_week_marks` and marks the job `done`.
   That mark exists for exactly one reason: a job closed this week stays on the
   page, struck through, until the week rolls over.
2. A finished job drops off the next Multitrack printout.
3. The next PDF import sees 1679 is not in the printout, so it **departs** it —
   `departed_at` is stamped on the row (`writeDepartureBatch`).
4. `normalizeJobsFromDb()` filters every departed row out of `jobs[]`.
5. `weekRows()` builds its rows by walking `jobs[]`. No job, no row. The
   `close:` mark is still sitting in the table; nothing reads it, because the
   job it belongs to no longer exists as far as any screen is concerned.

Nothing is lost — the job row, the close mark and the revenue record are all
intact. The job just leaves the week early.

**The rule this breaks:** a completed job stays visible to the end of the WEEK,
not the end of the day. Confirmed by Trevor 2026-08-26; it has come up before.

## The fix

One change, in the plan builder, not in the writer:

`buildPdfImportPlan()` must not put a job in `departures[]` if that job carries
a close mark for the **current week**. It departs on a later import, once the
week has rolled over and the mark no longer refers to this week.

This means `buildPdfImportPlan()` needs the week marks and the current week's
Monday. It is a pure function and stays one — they come in as arguments, the
same way `knownJobIds` does.

Why here and not in `weekRows()`: making the Weekly Log draw rows for departed
jobs would mean reading jobs the whole app has agreed are invisible, on every
screen that shares that row builder. Holding the departure back for a few days
is smaller, reversible, and matches what the close mark already means.

## Out of scope

- Anything that changes what `departed_at` means, or un-departs existing rows.
  1679 stays departed; this fix stops the NEXT one going early.
- Making `bench_day_marks` store the day's automatic rows (the known gap from
  the 2026-08-26 Daily Log brief). Still separate, still not this.
- The Weekly Log 1000-row read cap. Still parked.
- Any change to `weekRows()`, `bookedOnDay()` or the Daily Log.

## Rules that bind this build

- **A completed job never comes back.** A job number reappearing on a printout
  is live work, and the existing returning-job path already handles that. This
  fix must not touch it.
- The import's count refusal, duplicate refusal and `canDepart` gate all stay
  exactly as they are. A failed `knownJobIds` read still departs nothing.
- Departures still only ever come from the Multitrack printout
  (`writeDepartureBatch` refuses any other source). Unchanged.
- No writes to `jobs`, `scheduled_slots` or `calendarSlot` beyond what the
  import already does.
- The preview screen must show the truth: a job held back is simply not in the
  "no longer in this drop" list Trevor approves.

## Verification checklist

1. A job on the board, not in the printout, with **no** close mark → departs,
   exactly as today.
2. A job not in the printout, with a close mark for the **current** week → is
   NOT in `departures[]`, and not in the preview's departing list.
3. The same job, once the week has rolled over (close mark is for a previous
   Monday) → departs normally.
4. A job not in the printout carrying a close mark for a **different** week
   → departs normally.
5. `canDepart` false (null `knownJobIds`) → still departs nothing, close marks
   or not.
6. A returning job number still clears `departed_at` and `done`, unchanged.
7. Count refusal and duplicate refusal unchanged.
8. Full suite green.
