---
doc_status: live
---

# Scope lock — DG jobs are ready to start, on their benches, with a 🔍 To Diagnose chip

Previous lock (Board split parts) is in git at `0bb5cc5`. Background only (don't follow unless
this page can't answer a question): [dg-ready-to-start.md](../docs/briefs/dg-ready-to-start.md).

Trevor: "DG means to be diagnosed and if they aren't at their benches then I won't know they are
free. This has been the reason I have been missing jobs recently." Rule: **the diagnosis is the work.**

## Build (code only)
1. `blockedPile()` and `blockedReason()` in `src/data/jobs.js`: DG no longer returns `'planning'`.
   It falls through to the normal status/VB/BL rules like any other action. INC, RS, RS-C unchanged.
2. Update the comments in `jobs.js` that say DG is planning, so they don't contradict the code.
3. `ProjectsPage.jsx`: DG moves from "Needs Thinking" to "Ready to Schedule" (sub-labels to match).
4. `JobShelf.jsx` (Board day view side list): a **🔍 To Diagnose** chip beside 🔧 Parts Arrived,
   built the same way — own `filter:` value, hidden at zero, divider condition (~281–297) too, shows hours, lists every live unscheduled
   top-level DG job that is not blocked, survives reload. Jobs still show under their bench chip too.
5. Tests: update the DG cases in `jobs.test.js` / `BenchBoardPage.test.jsx`; add tests for the
   chip and for DG + On Hold / Waiting / BL / VB still being blocked by those.

## Merge 2 — dropped
Live check 2026-10-12: all 21 live DG rows already carry Electronics, none on Admin, none 0 hours.
No data script. No 0-hour fix.

## Not in scope
- No edits to `useSupabase.js`, `utils/supabase.js`, `useGoogleCalendar.js`, `scheduledSlots`,
  `calendarSlot` or the `jobs[]` shape. (Behaviour changes through `blockedPile()`; code doesn't.)
- No change to INC / RS / RS-C, to the DG tag itself, or to how the card shows the tag.
- No auto-clearing of DG. Trevor changes it in the Jobs Sheet when diagnosed.
- No change to `inferBench()` keywords or bench order.

## Binding rules
- A job is never BL and WP at once; no "no bench"; bench picked from the work, never the brand.
- `git add` specific files only. Staging branch `staging/dg-ready`.

## Verifier checklist
In the background doc, section "Verifier checklist" — the verifier reads it there.
