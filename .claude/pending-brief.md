---
doc_status: closed
---
# Record (shipped) — Finishing bench in the split editor

Trevor, 2026-10-13: "in day when pushing job card to edit splits theres no finishing bench there".
He approved this brief and the ship in the same message ("yp, brief and ship it").

## Build

- Add 'Finishing' to `ALL_BENCHES` in `JobDrawer.jsx` and `MobileJobSheet.jsx`, after Wiring and
  before Admin. It isn't put first, so the dropdown still shows Luthier when nothing is picked.

## Not in scope

- No change to the jobs[] shape. Auto-splits already write `bench: 'Finishing'` (`data/jobs.js`).
- No change to `scheduledSlots`, `calendarSlot`, Supabase or Google Calendar code.
- No change to the bench lists on other pages.

## Check

- Full suite passes (970).
