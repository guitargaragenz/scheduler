---
doc_status: live
---

# Scope lock — Board cards show every part of a split job (Trevor "yp" 2026-10-04)

Background only (don't follow unless this page can't answer a question):
[board-split-parts.md](../docs/briefs/board-split-parts.md).

## Build
On the Board's "What's stopping it" view, a split job's card gets a toggle listing **every part of
the job** (all benches, not just this column), in shop order via `orderedParts`/`partsOf` from
`BenchWeekPage.jsx`. Done part (`pieceDone`, NOT `done`) = ticked and greyed. First not-done part
= "next" badge. Toggle label like "▶ 8 parts · 1 done". Shows even when only one part sits in
this column, as long as the job has more than one part.

## Out of scope
Ticking parts from the Board. Which column a card lands in. The By bench view. Any saved data.
Job drawer. `scheduledSlots`, `calendarSlot`, `useGoogleCalendar.js`, `useSupabase.js`,
`utils/supabase.js`, `jobs[]` shape.

## Binding rules
- Read-only: no Supabase call, no write, no `jobs[]` mutation. Not blast-radius.
- Reuse `orderedParts` and `partsOf`; no second ordering.
- Files: `BenchBoardPage.jsx`, `BenchBoardPage.test.jsx` only.
- Browser test: 1635 shows 8 parts, Fretwork ticked and greyed, a not-done part badged next.
