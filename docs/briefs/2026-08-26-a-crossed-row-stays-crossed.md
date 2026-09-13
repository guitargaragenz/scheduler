---
doc_status: closed
---

# A row crossed off on the Daily Log must stop being offered

**Shipped 2026-08-26 at `dd64990` (PR #49). 758 tests green.** Browser-tested
on the preview by Trevor. This is a record, not a task list.

Found 2026-08-26, browser-testing the `Task ▾` picker. Trevor crossed the
Hofner's level/crown/polish off on Monday 24/8. It was still being offered on
Wednesday. Then the Aria ("remove frets and make neck shim") did the same.
His words: "it's happening to all Jobs."

## What actually happens

`dayJobOptions()` (`DailyLogPanel.jsx:174`) drops a pickable line when it is
booked, or when it carries `pieceDone`:

```js
if (part.scheduled || part.calendarSlot || part.pieceDone) continue;
```

`pieceDone` is the only "this is finished" signal it reads, and `handleSetMark()`
(`DailyLogPanel.jsx:827`) only ever writes it for a SPLIT:

```js
const rowJob = jobById.get(String(row.id));
if (rowJob?.parentId && onMarkPieceDone) { ... }
```

An unsplit job has no `parentId`. `partsOf()` returns `[job]` for it, so it is
offered as one pickable line — and crossing that line writes nothing anywhere
that the picker reads. The job is not marked `done` either, and correctly so:
one day's work finishing is not the guitar finishing.

So **every unsplit job on the board comes back in the picker forever, however
many times it is crossed off.** That is the "all jobs" Trevor saw. It is not
new — the search box has always done this; the `Task ▾` picker just made it
obvious by putting the same stale list on the job's own line.

## The fix

The Daily Log's own × is the record. The picker must read it.

`latestDayMarks(dayItems)` already exists (`DailyLogPanel.jsx:93`) and already
returns the latest mark every row has been given across every day, keyed by row
id. `dayJobOptions()` takes that map and drops any part whose latest mark is
`'cross'`, alongside the checks it already makes.

This works for a split and an unsplit job alike, so `pieceDone` stays as a
second, independent signal rather than being replaced: a piece ticked off on the
board (JobCard, PomoDrawer, CloseDayModal) still drops out even if it was never
crossed here.

Fixing it in `dayJobOptions()` fixes the search box in the same change — both
read the same list, by construction.

## Out of scope

- `handleSetMark()`, and what a mark writes. A × still writes exactly what it
  writes today. This build only changes what the PICKER offers.
- The Weekly Log, `scheduledSlots`, `calendarSlot`, the `jobs[]` shape.
- `bookedOnDay()`. It deliberately does not filter — a booked row belongs on
  its day whether or not it is finished, and hiding it there would erase the
  day's record of the work. Unchanged.
- Making an unsplit job's × mean the job is `done`. It does not, and must not.
- Un-crossing anything already crossed, or backfilling `pieceDone`.

## Rules that bind it

- **A cross is not the job closing.** Trevor closes a job by hand in the
  Weekly Log. Nothing here may set `done` or write to the week.
- **Taking the × off must put the row back.** `latestDayMarks()` is read live,
  so clearing a mark restores the line to the picker with no reload. This is
  the undo, and it must work.
- A `/` (part done) or `>` (deferred) row is still offered. Only `×`.
- Same list for both routes: whatever `Task ▾` hides, the search box hides.

## Verification checklist

1. An unsplit job crossed off on any day → gone from the search box and from
   `Task ▾`, on every day.
2. That same job's × removed → offered again, no reload.
3. A split piece crossed off → gone, as before.
4. A row marked `/` → still offered.
5. A row marked `>` → still offered.
6. A piece with `pieceDone` set but never crossed here → still hidden.
7. A booked row still appears on its own day via `bookedOnDay()`, crossed or
   not.
8. Nothing new is written on a mark: no `done`, no week cell, no `pieceDone`
   beyond what ships today.
