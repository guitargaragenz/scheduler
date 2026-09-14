---
doc_status: live
---

# Scope lock — Week page day box: tap for ·, hold for the list

Approved by Trevor ("go", 2026-09-14). Paused occupant: job card shows the next
bench (approved, back in here once this ships).

Trevor: "default click in WL days columns to be . - same functionality as >
column. 1 click = . then long click for DD"

## Build
- Tap a blank day box → `·` (booked).
- Tap a `·` box → blank.
- Tap a `/`, `>` or `×` box → nothing.
- Hold (same long press as the end box) → the list of marks + clear, as the
  dropdown offers today. The tap after a hold never also fires.
- `src/components/BenchWeekPage.jsx` only. Saves through the existing setMark.

## Rules that bind it
- No change to what marks mean or how they're stored.
- Booking back onto a day still undoes that day's removal (onBookedOnDay).

## Out of scope
- The end box. Daily Log. Export.

## Verifier checklist
1. Tap blank → ·; tap · → blank; tap / > × → unchanged.
2. Hold opens the list; picking sets that mark; tap after hold does nothing.
3. Full test suite passes.
