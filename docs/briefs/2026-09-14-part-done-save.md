---
doc_status: live
---

# Brief — a ticked part always saves as done

Approved by Trevor 2026-09-14 ("yp"). Blast-radius (writes jobs state) — full protocol.

## What went wrong (reproduced 2026-09-14 from live data)

Trevor ticked parts in the Daily Log while viewing 12–13 Sept. The crosses saved
in the log, but three parts never saved as done on the job:

- 1621 Aria `1621_Fretwork_1` level FB — cross on 09-12, `piece_done` false.
- 1520 Ampeg `_5` and `_6` — crosses on 09-13, `piece_done` false.
- 1708 Eko `_1` — cross on 09-13, saved fine.

## Cause (in the code)

`handleMarkPieceDone` (`src/hooks/useJobs.js` ~711) fills `updatedChild` and
`parentJob` inside the `setJobs` updater, then returns early if they are empty.
React doesn't always run that updater straight away, so sometimes they are
still empty: the screen shows the tick, but nothing is written, and no warning
toast appears. The tick is gone after a reload.

Every tick path uses this function: Daily Log, JobCard, PomoDrawer, CloseDayModal,
Day view, calendar. So all of them can lose a tick.

## Build

- First, add a failing test that reproduces the lost save (tick fired after an
  await). If the part or parent is simply missing from the jobs list instead,
  stop and report — that is a different fix (council B's alternative cause).
- Work out the updated part from a jobs ref kept in sync every render (never the
  stale `jobs` prop), then write to Supabase every time.
- The all-parts-done check reads that same fresh ref, so two quick ticks still
  trigger the invoice prompt (council A).
- If the write fails, keep the existing warning toast.

Council 2026-09-14: both approve with changes, folded in above.

## Out of scope

- Daily Log mark rules (which marks count as done).
- Fixing old lost ticks. Trevor re-ticks those by hand.
- Next-bench card (PR #69).

## Verifier checklist

1. A tick from the Daily Log after an await always calls the save.
2. Two quick ticks in a row both save, and the last one still triggers the invoice prompt.
3. Untick saves false.
4. No changes to scheduledSlots, calendarSlot, or the jobs[] shape.
5. Full test suite passes. A new test fails on the old code and passes on the new.
