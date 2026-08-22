---
doc_status: parked
---
# Daily Log dropdown offers splits that are already finished

Found by Trevor on the PR #33 preview, 2026-08-22. **Not caused by that build** —
`dayJobOptions()` is untouched by it. Pre-existing since the Daily Log shipped
(`7779ee5`).

## What he saw

Hofner **1632**: the job card shows **4** unfinished splits, the Daily Log's
"+ Put a job…" dropdown offers **7**. Trevor confirmed the other three aren't
shown on the card at all — the card omits finished splits, as normal.

## Cause

`dayJobOptions()` (`src/components/DailyLogPanel.jsx:108`) walks
`partsOf(row.job, all, byId)` and pushes **every** part. There is no `pieceDone`
filter. `partsOf()` (`BenchWeekPage.jsx:186`) returns all children by design —
it's the caller's job to filter, and this caller doesn't.

`bookedOnDay()` (same file, line 143) walks parts the same way. Check whether it
has the same problem before scoping — it may be correct, since a booked split is
booked whether or not it's ticked.

## Why it matters

Offering a piece of work that's already done is noise, and it's how the wrong row
gets picked into the day.

## Status

**Parked on Trevor's call, 2026-08-22: "come back to me before we fix."**
Not scoped, not approved. Do not start it without talking to him first.

Verify the 1632 data against the live database before building — the count
mismatch is his observation, not something confirmed against the rows.
