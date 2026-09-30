---
doc_status: live
---

# Scope lock — Weekly Log shows a split job's parts in a dropdown

Trevor, 2026-09-30: "in WL I can't see the splits". Job 1635 sat under Luthier with
Finishing, Wiring and Setup still waiting, and nothing on the row said so.
Previous occupant: week-close-sticks record, shipped `57d9138`.

## Build (`src/components/BenchWeekPage.jsx`)

1. Tapping a split job's number/name (job with more than one part via `partsOf`) drops down
   its parts. Tap again or tap away closes. Always closed on page open; nothing remembered.
   Tap area ≥32px tall. The tap-away layer must not swallow taps on day cells or end box.
2. Dropdown lists parts in Trevor's shop order: Fretwork, Luthier, Finishing, Wiring, Setup,
   then any other bench alphabetically.
3. A part is done when `pieceDone` is true (not `done`, which is the whole job). Done parts
   are crossed off with a tick; the first not-done part in that order gets a "next" badge.
4. Row filing uses the EXISTING Board rule `nextBenchOf` in `src/utils/nextBench.js`
   (Luthier → Fretwork → Setup, Electronics stays put). Do not change that file's order.
   Trevor ruled 2026-09-30: Board order stays; Electronics jobs never move along.
5. The page headings AND "Save week as a file" (`buildWeekExport`) both use the new filing,
   so the file matches the screen (Trevor, 2026-09-30).
6. Add-a-job picker (`addableJobs`) must not offer a job already on the week under a
   different heading. Check, don't assume.
7. Remove the uncommitted "· Wiring / · Finishing" grey tag near line 1223.

## Out of scope

- No change to jobs, splits, `calendarSlot`, `scheduledSlots` or how parts are marked done.
- Daily Log, Board, Bench page: unchanged. `nextBench.js` unchanged.
- No new benches or headings. Wiring and Finishing stay sub-benches.

## Binding rules

- Read-only on job data. Display and filing only.
- No "no bench" state: a job with no bench still files on Admin.

Background (don't open to start work): [docs/briefs/wl-split-dropdown.md](../docs/briefs/wl-split-dropdown.md).
