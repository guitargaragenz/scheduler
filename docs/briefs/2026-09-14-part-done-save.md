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

Council round 2 (2026-09-14): both approve with changes, folded in here.

- Pull the maths into a pure function in `useJobs.js`:
  `planPieceDone(jobs, parentJobId, childJobId, pieceDone)` returns
  `{ updatedChild, parentJob, children, allChildrenDone }`. Tick and untick both
  go through it (untick has the same lost-save bug).
- `jobsRef = useRef(jobs)` lives in `useJobs`, and is set to `jobs` on every
  render. In the handler: plan from `jobsRef.current`, then set
  `jobsRef.current` to the planned array **straight away**, so a second quick
  tick sees the first before React re-renders.
- `setJobs(prev => …)` still applies only `pieceDone` to that one child
  (functional, so it doesn't overwrite other edits). No side effects inside it.
- Write to Supabase from the planned child every call, outside the updater.
  Two quick calls give two writes; the last one wins, which is fine.
- If the child or parent isn't in the ref, stop and report. That's a different
  cause (missing from the list), not this bug.
- The failing test comes first. Unit-test `planPieceDone`, plus a hook test where
  `setJobs` defers its updater: on the old code the save isn't called, on the
  new code it is.
- Keep the failure toast. `justSavedAt` behaviour stays as it is (deferred).

## Out of scope

- Daily Log mark rules (which marks count as done).
- Fixing old lost ticks. Trevor re-ticks those by hand.
- Next-bench card (PR #69).

## Verifier checklist

1. A tick from the Daily Log after an await always calls the save.
2. Two quick ticks in a row both call the save (two writes), and the last one still triggers the invoice prompt.
3. Untick saves false.
4. No changes to scheduledSlots, calendarSlot, or the jobs[] shape.
5. Full test suite passes. A new test fails on the old code and passes on the new.

## Handoff — 2026-09-14, end of session (start the next session here)

Browser test (step 5) done:
- Save test passed. The 1520 Electronics part stayed crossed after a reload, and the database saved it as done.
- A mis-click on 1621 Fretwork did no harm. That part is back to not done in the database.

Still to do, in order:
1. Clear the 1520 cross on the Daily Log.
2. Check the database shows that part as not done again.
3. Remove the 1520 row from today's log.
4. Fix PR #70's clash with main (only docs files clash). Note: main's `.claude/pending-brief.md` still holds the shipped next-bench-card scope lock, and main's briefs README says nothing is live. This branch's versions are the right ones.
5. Merge only after Trevor says "yp". Then close this brief's docs.
