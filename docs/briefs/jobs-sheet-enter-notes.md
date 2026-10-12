---
doc_status: live
---

# Jobs Sheet Enter + date sort — background to the scope lock

Previous scope-lock occupant (week revenue record): `37f5984`, merged `ff21ce6`.

## Council (2026-10-12) — both go-with-changes

Dropped "sort" (none existed then); added scroll-margin, click-select, IME, unmount, mobile/Tag cuts.

Date sort added by Trevor after council, 2026-10-12. Not re-reviewed: it only changes `rows`
order, which Enter-to-move follows via `visibleRows`.

Why Hours only: The Hours cell is the only free-text input in a row (`JobsSheetPage.jsx:618`); Tag, Action
and VB/BL/PJ are selects and checkboxes.
