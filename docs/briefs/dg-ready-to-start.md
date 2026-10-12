---
doc_status: closed
---

# DG jobs are ready to start — background

Scope lock: [.claude/pending-brief.md](../../.claude/pending-brief.md). This page is background only.

## Trevor, 2026-10-12

> "DG means to be diagnosed and if they aren't at their benches then I won't know they are free.
> This has been the reason I have been missing jobs recently."

> "I want jobs to still have the DG tag when they are on the benches."

> "how about adding a pill for that tag so I can see at a glance in Board whats there?"

Rule agreed in chat: **the diagnosis is the work.** A DG job is workable, sits on its real bench,
can be dragged onto the calendar, and keeps its DG tag until Trevor changes it in the Jobs Sheet.
INC, RS and RS-C stay in the Planning pile — unchanged.

## How DG is read today (checked against code 2026-10-12)

- `blockedPile()` in `src/data/jobs.js` (~line 178) returns `'planning'` for INC/RS/RS-C/DG.
  `blockedReason()` (~line 213) does the same. DG was added 2026-08-05 to match ProjectsPage.
- Everything downstream reads `blockedPile()`, so one change moves every screen:
  - `inferBench()` (~line 43) sends blocked work to Admin.
  - `isBenchUnplaced()` (~line 98) says blocked work is never "needs a bench".
  - `partsMayHaveArrived()` (~line 239) — WP only, unaffected.
  - `useSupabase.js` (~line 96) folds it into `schedulable` on load. **Blast-radius file —
    behaviour changes through it, no edit to it needed.**
  - `pdfImportPlan.js` `statusFlagsFor()` (~line 76) — same.
  - `JobShelf.jsx` bench chips exclude blocked jobs; Planning pile chip lists them.
  - `JobCard.jsx` (~line 14) disables drag on blocked jobs.
  - `BenchBoardPage.jsx` `columnFor()` puts planning in "Still working it out".
- `ProjectsPage.jsx` line 7 hard-codes DG in "Needs Thinking", line 9 "Ready to Schedule" is GTS · FB.
- The stored `bench` is only re-inferred on PDF import of a NEW job (action is always '' there)
  and when bench keywords change in Settings (`App.jsx` ~line 343). Setting DG in the Jobs Sheet
  does not re-infer. So a DG job's stored bench is whatever it was given earlier — some may be
  Admin from a keyword re-infer while DG was blocked, some may be a real bench already.
  **The live list was not checked** — the read-only query was not run. The builder's dry run is
  where that list first appears.

## The chip

Model it on 🔧 Parts Arrived in `JobShelf.jsx` (~lines 29, 78, 129, 151, 318–340): its own
`filter:` value (not `pile:`), hidden at zero, counted in addition to the bench chips, clicking
lists the jobs. Restore-from-storage check at line 78 must accept the new value.

## Live check, 2026-10-12 — merge 2 dropped
Read-only select: 21 live DG rows (jobs 1520 and its parts, 875, 97, 1513, 1505, 1544, 1705, 1345,
1718, 1713). All on Electronics, none on Admin, none 0/null hours. 875 and 97 are BL=Y and 1713 is
Waiting, so those stay blocked. The rules below are kept only as a record — no script is built.

## Merge 2 script rules (council 1, 2026-10-12) — not built

- **Split parents are skipped.** They are top-level (no `parent_id`) but the app never re-infers
  them (`App.jsx` ~329–342): a bench change drifts derived child IDs and orphans scheduled slots.
- **Scheduled rows are skipped** (`scheduled` true or `calendar_slot` set) — they sit on the
  calendar by bench.
- **Blocked-by-status rows are skipped** — inferBench would just return Admin for them anyway.
- **Saved keywords, not defaults.** Read `app_settings` key `benchKeywords` (`supabase.js`
  ~1726–1736), sanitize inline the same way as `useAppSettings.js` ~68 (don't import that file —
  it pulls in React). **If the fetch fails, abort.** Never fall back to defaults silently.
- **Moves to Luthier, Setup or Fretwork can create derived sub-cards** (`createSubtasks`,
  `jobs.js` ~296–368). The script runs `createSubtasks` on the would-be new bench and flags any
  non-null result.
- **"Admin" includes jobs deliberately filed on Admin.** The dry-run list is where Trevor catches them.
- **Zero hours.** Jobs blocked at import got 0 hours (`pdfImportPlan.js` ~106). Dropping a 0-hour job
  on the calendar throws (`scheduler.js` ~43 gives 0 slots, `useScheduler.js` ~171–178 then reads
  `slots[0]`). Dry run lists 0/null-hour rows as "set hours first".
- **Before merge 2 is built:** run the read-only count of live DG jobs. Zero rows → drop merge 2.

## Other notes from council 1
- `schedulable` readers not named above also move: Week View `Sidebar.jsx` ~94–101 and `JobsPage.jsx`
  ~36. A DG job leaves "On hold" there and joins Active/Backlog. Intended; add to browser test.
- `ProjectsPage.jsx` "Ready to Schedule" is line 10, not 9.

## Visible side effects (councils, 2026-10-12) — put in the browser test
- A DG job on Admin with no keyword match now opens in the drawer as "Needs a bench" and Save
  wants a bench (`useSupabase.js` ~124, `JobDrawer.jsx` ~94). Intended: diagnosing is when he picks it.
- Changing bench keywords in Settings now re-infers DG jobs too (`App.jsx` ~343).
- Week View Sidebar: DG jobs appear in Active/Backlog. No chip there — deliberately out of scope.

## Verifier checklist
1. `blockedPile({status:'Active', action:'DG'})` is null; same for `Booked In`.
2. DG + On Hold → 'hold'; DG + Waiting → 'waiting'; DG + VB → 'waiting'; DG + BL → 'hold'.
3. INC, RS, RS-C still return 'planning'.
4. `inferBench()` on an Active DG job returns its keyword bench, not Admin.
5. Board "What's stopping it": Active DG job sits in "Ready to start", not "Still working it out".
6. JobCard: Active DG job is draggable and still shows "⚠ DG".
7. 🔍 To Diagnose chip shows the right count, lists those jobs, hides at zero, survives reload.
8. ProjectsPage: DG under "Ready to Schedule".
9. No diff in any not-in-scope file. Full test suite passes.
10. (dropped — no script)
11. (dropped — no script)
12. Chip divider: a lone To Diagnose chip still starts its own row (condition near `JobShelf.jsx` 281–297).
13. To Diagnose chip lists a DG job whose bench is Admin as well as ones on real benches.
14. To Diagnose chip cards show hours; verifier reports how many live DG jobs have 0/null hours.

Closed 2026-10-12. Shipped at `70d93d0` (PR #95). Chip shows a count only — hours dropped (Trevor: only needed back when the calendar was used).
