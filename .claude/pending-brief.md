---
doc_status: live
---

# Scope lock — Board side list shows every part of a split job (drafted 2026-10-04, awaits Trevor "yp")

Background only (don't follow unless this page can't answer a question):
[board-split-parts.md](../docs/briefs/board-split-parts.md).

## Build
In the Board's side list (`Sidebar.jsx`), a split job's "▶ N sub-tasks" list shows **every part of
the job**, scheduled or not, in shop order via `partsOf`/`orderedParts`/`isSplitRow` from
`BenchWeekPage.jsx`. Same look as the Weekly Log dropdown: done part (`pieceDone`, NOT `done`) =
green ✓, name struck through, greyed; not-done = ○; first not-done = "next" badge. Toggle label
e.g. "▶ 8 parts · 1 done". Today the list only holds unscheduled parts, so done/scheduled ones vanish.

## Out of scope
Ticking parts from the Board. Which cards show or hide in the list (the "all parts scheduled
hides the parent" rule stays). Calendar cards, Job Shelf, Bench page (`BenchBoardPage.jsx`), any
saved data. `scheduledSlots`, `calendarSlot`, `useGoogleCalendar.js`, `useSupabase.js`,
`utils/supabase.js`, `jobs[]` shape.

## Binding rules
- Read-only: no Supabase call, no write, no `jobs[]` mutation. Not blast-radius.
- Reuse the WL helpers; no second ordering.
- Files: `Sidebar.jsx`, `Sidebar.test.jsx` only.
- Browser test: 1635 in the Board side list shows 8 parts, Fretwork ticked + struck + greyed, a not-done part badged next.
