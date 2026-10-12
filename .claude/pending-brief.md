---
doc_status: closed
---
# Record (shipped) — action chips on job cards (DG, GTS, WP)
Shipped PR #105, merge `ff04dca`; tests 954 → 963. Builder calls: no chips on split parts (like 🎯); toast on any replace; prefill cleared on leaving Parts. Item 9 (import) checked by Trevor in browser only.

Trevor, 2026-10-12: wants to set DG on a job card in one tap, like the 🎯 focus button,
"much quicker than the sheet". Extended to GTS and WP. Previous lock (admin marks) shipped PR #104 `c6cfecd`.

## Build

- Three small text chips (DG, GTS, WP) next to 🎯 (`JobCard.jsx` ~125-137), faded off, bright when set.
  On every card: Sidebar, JobShelf, CalendarGrid, DayViewPage, and the day page's mobile card.
- Tap sets that action, replacing any other. One action per job. Tap the lit chip again → action blank.
- Replacing a different action shows a toast naming it ("INC replaced by DG on #1234").
- WP also sets `backlog: false` in the same one-row write. BL and WP never coexist.
- Save: new App-level handler modelled on `handleClearMark` (`App.jsx` ~310): read live job from
  `jobsRef`, one-row `batchWriteJobsState`, `justSavedAt` first, board changes only on ok, `applySheetEdits`.
- Tapping WP then jumps to the parts page with this job prefilled as "needed for job":
  `partsPrefillJob` state in App + one prop seeding `neededForJob` in `PartsToOrderPage.jsx` (~235).
  Skipping = navigate back; WP stays set, no part added.
- Chips copy 🎯's BOTH `onClick` and `onPointerDown` stopPropagation (no open, no drag).
- Remove 'DG' and 'WP' from `CLEARABLE_ACTIONS` in `JobDrawer.jsx:8` and `MobileJobSheet.jsx:9`
  (now duplicates of the chips). CI, INC, RS-C stay.

## Not in scope

- Other actions (INC, CI, RS, RS-C, FB) stay sheet-only.
- No change to the sheet's Action dropdown.
- No change to how WP or DG sort into piles or benches (`jobs.js`, `BenchBoardPage.jsx`).
- `useSupabase.js`, `utils/supabase.js`, `scheduledSlots`, `calendarSlot`, jobs[] shape.

## Verifier checklist

1. Each chip sets its action; card and sheet both show it — on all four card locations.
2. A second chip replaces the first. Never two actions.
3. Replacing a sheet-only action (e.g. INC) shows the toast naming it.
4. Tapping the lit chip clears the action to blank.
5. WP on a Backlog job clears Backlog, in one write.
6. WP jumps to parts page with job number filled in. Saving adds the part; going back adds nothing.
7. Tapping a chip doesn't open or drag the card. (WP cards are then undraggable — expected, blocked.)
8. Drawer and mobile sheet no longer offer DG or WP clear; CI, INC, RS-C still do.
9. After a Multitrack import, the chip-set action is still there.
10. Full suite passes, plus new tests: set, replace (+toast), clear, WP clears Backlog.

## Council changes (2026-10-12)

Both reviewers "not yet" on brief fixes only. Save path corrected to handleClearMark (sheet saves in
batches, not reusable). Prop threading, dual stopPropagation, jump-not-popup added. Trevor chose:
toast on replace, chips everywhere, remove DG+WP from the clear-mark lists.
