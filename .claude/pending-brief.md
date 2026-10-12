# Scope lock — Wiring/Finishing chips show jobs with those tasks; hide empty "h"

Previous lock (DG ready to start) is in git at `70d93d0`.

Trevor, 2026-10-12: "finishing and wiring are sub benches but they are valid. I want both benches
to have chips and show jobs that have those tasks but not move the jobs from primary benches."

## Build (display only)
1. `JobShelf.jsx` (Board day list): the Wiring and Finishing chips count and list every top-level
   job that is on that bench itself OR has an unscheduled, not-done part (`parentId` = the job)
   on that bench. Same rule as the week list (`Sidebar.jsx` ~126 `SUB_ONLY_BENCHES`).
   The job still shows under its main bench chip too. Both chips always visible (as today).
2. `JobCard.jsx` ~142: hide the hours box when `hoursRange` is empty, instead of showing a bare "h".
3. Tests for both in `JobShelf.test.jsx` / a JobCard test.

## Not in scope
- No change to any job's saved bench, to `jobs[]` shape, `useSupabase.js`, `utils/supabase.js`,
  `useGoogleCalendar.js`, `scheduledSlots`, `calendarSlot`.
- No change to the week list, other chips, or bench order.

## Binding rules
- Five real benches; Wiring and Finishing are sub-benches that show work when it reaches them.
- No "no bench". `git add` specific files only.
