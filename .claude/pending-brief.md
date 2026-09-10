# Scope lock

## Approved 2026-09-11 — no job ever has "no bench"

Trevor's ruling, first recorded 2026-09-02, never built:
**"there is no such thing as no bench and should never be."**
Council reviewed 2026-09-11; changes below are post-council, Trevor approved.

### Build

1. `inferBench()` in `src/data/jobs.js`: final fallthrough (line 79) returns
   `'Admin'`, not `null`. Its return shape does NOT change.
2. New exported `isBenchUnplaced(...)` in the same file, same inputs, true only
   when the job hits that fallthrough. Derived every time, never stored.
3. Set `benchAuto` from it at all three points a job gets a bench:
   `App.jsx:279`, `pdfImportPlan.js:96`, and `normalizeJobsFromDb` in
   `src/hooks/useSupabase.js` (~line 101) so the flag survives a reload.
4. `JobDrawer` save guard switches from "bench is empty" to `benchAuto`.
   The `NEEDS_BENCH = ''` sentinel goes or gets rewired; it is dead otherwise.
5. Popup instead of a card marker, and NOT tied to the bench board — Trevor
   works out of week and day view. Render it from `App.jsx` so it appears on
   whatever page is open. Fires when a PDF import commits (`useJobs.js`) ONLY —
   Trevor decided 2026-09-11 to drop the on-load fire, so a bench he chose
   himself never nags. Built code still has it: remove before merge.
   Lists those jobs; each row opens that job's drawer. Dismissable.
6. Both rules into `CLAUDE.md` under "Workshop rules the code must respect":
   no manufacturer filtering, and no such thing as no bench.
7. Update `src/data/jobs.test.js:229-234`. `BenchWeekPage.test.jsx` does NOT
   need updating — council checked, those tests hand-set bench and never call
   `inferBench`.

### Out of scope

- Stripping the "No bench set" groups from `BenchBoardPage`, `BenchWeekPage`,
  `WeeklySummaryModal`, `JobShelf`. They go quietly empty. Separate build.
- Backfilling stored benches. **Re-check live Supabase for a null bench
  immediately before merge** — `App.jsx:279` writes re-inferred benches to the
  DB, so a null-bench row would silently become Admin on any keyword save.
- `scheduledSlots`, `calendarSlot`, Google Calendar.

### Binding rules

- Full protocol. `useSupabase.js` is blast-radius; builder is `ggnz-builder`.
- `git add <file>` only, never `-A`.
