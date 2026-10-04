---
doc_status: closed
---

# Board cards: show every part of a split job, ticked or not

Shipped at `d82dab0` (PR #92), 2026-10-04. Display only — no job data written, none of the
blast-radius files touched, so the lighter path applies (builder, verifier, browser test, merge).

## Why
The Weekly Log shows a split job's parts in shop order, done ones ticked, next one badged
(shipped `39d3911`). The Board didn't get the same. Its "▶ N sub-tasks" list only holds the
unscheduled parts and doesn't show done or not done. Trevor wants to see at a
glance what's left on a job like 1635.

## Build
In the Board's side list (`Sidebar.jsx`, NOT the Bench page), a split job's sub-tasks list shows **every part of the job**, in the
Weekly Log's shop order (Fretwork, Luthier, Finishing, Wiring, Setup, then others):
- Done part (`pieceDone`, NOT `done`) — ticked and greyed.
- First not-done part — badged "next".
- Green ✓ + struck through for done, like the Weekly Log.
- Reuse `orderedParts` from `BenchWeekPage.jsx`; don't write a second ordering.

## Out of scope
Ticking a part from the Board. Changing which column a card sits in. The by-bench view (it
splits parts on purpose). Any saved data. Job drawer.

## Verifier checklist
1. 1635 card lists all 8 parts in shop order; Fretwork ticked and greyed; first open one "next".
2. Unsplit jobs and single-part jobs unchanged.
3. Parts that sit in a different column still listed.
4. By-bench view unchanged. No job data written. Full tests pass, new tests for done/next/order.
