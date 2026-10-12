---
doc_status: live
---
# Brief — Jobs Sheet: Enter moves down a row in the Hours column

Previous occupant (week revenue record) is in git at `37f5984`, merged `ff21ce6`.

## The problem, in Trevor's words

*"it's really hard to enter hrs in. It shld be select box, enter hrs, push enter, and it will
drop down to next box like G sheet."* (2026-07-29). Confirmed still wanted 2026-10-12.

## Scope — one merge, one file: `src/components/JobsSheetPage.jsx`

The Hours cell is the only free-text input in a row (`JobsSheetPage.jsx:618`); Tag, Action
and VB/BL/PJ are selects and checkboxes.

- **Enter** in an Hours cell moves focus to the Hours cell one row down, in the order rows
  are on screen (`visibleRows`, so search and sort are respected). Last row: stay put.
- **Shift+Enter** moves up one row. First row: stay put.
- Focusing an Hours cell selects its contents, so typing replaces.
- The newly focused cell scrolls into view clear of the sticky header (`:88`).
- Use a ref map keyed by job id plus `visibleRows` order, not per-row ad-hoc handlers.

## Not in scope

- **No saving on Enter.** Commit stays the only write. Nothing in `jobsSheet.js` changes.
- No 30-minute snapping — Trevor types half hours himself.
- No Escape-to-revert, no change to Tab order, no movement for selects or checkboxes.
- No change to styling, columns, or any file other than `JobsSheetPage.jsx` (plus a test).
- Blast-radius files untouched.

## Checklist for the verifier

1. Only `JobsSheetPage.jsx` and test files changed.
2. Enter in an Hours cell focuses the Hours cell of the next visible row.
3. Shift+Enter focuses the previous visible row's Hours cell.
4. Enter on the last row / Shift+Enter on the first row leaves focus where it is, no error.
5. With a search filter on, Enter skips hidden rows.
6. Focusing an Hours cell selects its text.
7. Pressing Enter writes nothing to the database; Commit still saves the typed hours.
8. Focused cell is visible, not under the sticky header (browser check).
9. Full test suite passes.
