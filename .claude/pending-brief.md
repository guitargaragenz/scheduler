---
doc_status: closed
---

# Scope lock — Board day view side list shows every part of a split job — shipped at `d82dab0` (PR #92), 2026-10-04

Background only (don't follow unless this page can't answer a question):
[board-split-parts.md](../docs/briefs/board-split-parts.md).

## Why rewritten
The first build (3d78df6) changed `Sidebar.jsx`, which is the list beside the **Week View**
calendar. The list Trevor uses is on the Board in **day view**, drawn by `JobShelf.jsx`.
Browser test showed 1635 there still reading "▶ 8 sub-tasks". Trevor: keep the Sidebar
change too, and build the same thing in `JobShelf.jsx`.

## Build
In `JobShelf.jsx`, a split job's "▶ N sub-tasks" list shows **every part of the job**,
scheduled or not, in shop order via `partsOf`/`orderedParts`/`isSplitRow` from
`BenchWeekPage.jsx`. Copy the look of the `Sidebar.jsx` version in 3d78df6: done part
(`pieceDone`, NOT `done`) = green ✓, name struck through, greyed; not-done = ○; first
not-done = "next" badge. Toggle label e.g. "▶ 8 parts · 1 done". An unscheduled, not-done
part still shows its draggable card under its row, so it can still be booked.
Today the list only holds unscheduled parts (`getSubtasks`), so done/scheduled ones vanish.

## Out of scope
Ticking parts from the Board. Which cards show or hide in the list (the "every part
scheduled hides the parent" rule at `JobShelf.jsx` ~line 105 stays). Undoing the
`Sidebar.jsx` change. Calendar cards, Jobs page, Bench page (`BenchBoardPage.jsx`), any
saved data. `scheduledSlots`, `calendarSlot`, `useGoogleCalendar.js`, `useSupabase.js`,
`utils/supabase.js`, `jobs[]` shape.

## Binding rules
- Read-only: no Supabase call, no write, no `jobs[]` mutation. Not blast-radius.
- Reuse the WL helpers; no second ordering.
- Files: `JobShelf.jsx`, `JobShelf.test.jsx` only.
- Browser test: Board, **day view**, Luthier chip → 1635 shows "8 parts · 1 done";
  opened, Fretwork ticked + struck + greyed, Finishing badged next.
