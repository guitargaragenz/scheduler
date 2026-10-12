# Scope lock — typed admin rows marked on the Weekly Log show on that Daily Log day

Previous lock (sub-bench chips) is in git at `33db93c`.

Trevor, 2026-10-12: "in weekly when adding a written admin job to schedule it doesn't show in daily."
Cause: `bookedOnDay()` in `DailyLogPanel.jsx` (~375) skips any row with no job (`if (!row.job) continue`)
before it reads the day mark, so a typed row never reaches the day.

## Build
1. `bookedOnDay()`: a typed row (no job) with a mark on that day shows as one line, its name as label.
2. Test that fails before the fix and passes after.

## Not in scope
- No change to how typed rows are saved, to the picker (`dayJobOptions`), or to job rows.
- No edits to `useSupabase.js`, `utils/supabase.js`, `useGoogleCalendar.js`, `scheduledSlots`,
  `calendarSlot`, `jobs[]`.

## Binding rules
- `git add` specific files only.
