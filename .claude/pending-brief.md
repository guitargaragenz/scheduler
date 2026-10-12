---
doc_status: live
---
# Brief — Jobs Sheet: Enter moves down in Hours; rows sorted by JBA date

Background (don't follow unless stuck): [council notes](../docs/briefs/jobs-sheet-enter-notes.md).

## The problem, in Trevor's words

*"it's really hard to enter hrs in. It shld be select box, enter hrs, push enter, and it will
drop down to next box like G sheet."* (2026-07-29). Confirmed still wanted 2026-10-12.

## Scope — one merge, one file: `src/components/JobsSheetPage.jsx`

- **Sort** (Trevor 2026-10-12: *"by date (from JBA) not by job number with most recent on top"*):
  `rows` (`:221-225`) sorts by `firstSeen` newest first; ties and no-date jobs by id desc, no-date last.
  Any no-date jobs: a note above the grid, e.g. "2 jobs have no JBA date — at the bottom".

The Hours cell is the only free-text input in a row (`JobsSheetPage.jsx:618`); Tag, Action
and VB/BL/PJ are selects and checkboxes.

- **Enter** in an Hours cell moves focus to the Hours cell one row down, in the order rows
  are on screen (`visibleRows`, so search is respected; there is no sort control). Last row: stay put.
- **Shift+Enter** moves up one row. First row: stay put.
- Focusing an Hours cell selects its contents, by Enter and by click (guard against mouseup clearing it).
- `preventDefault` only when a move happens; ignore ctrl/meta; skip when `isComposing`.
- The newly focused cell clears the sticky header (`:88`): `scroll-margin-top` on `.gcell`.
- Use a ref map keyed by job id plus `visibleRows` order, not per-row ad-hoc handlers. Callback ref deletes on unmount; missing entry = no-op.

## Not in scope

- **No saving on Enter.** Commit stays the only write. Nothing in `jobsSheet.js` changes.
- Mobile: Hours isn't editable there (`editable = !isMobile`, `:375`).
- Enter after picking a Tag (focus is on the select) — deferred.
- No 30-minute snapping — Trevor types half hours himself.
- No Escape-to-revert, no change to Tab order, no movement for selects or checkboxes.
- No visual change (scroll-margin, no-date note aside), no column changes, or any file other than `JobsSheetPage.jsx` (plus a test).
- Blast-radius files untouched.

## Checklist for the verifier

1. Only `JobsSheetPage.jsx` and test files changed.
2. Enter in an Hours cell focuses the Hours cell of the next visible row.
3. Shift+Enter focuses the previous visible row's Hours cell.
4. Enter on the last row / Shift+Enter on the first row leaves focus where it is, no error.
5. With a search filter on, Enter skips hidden rows.
6. Focusing an Hours cell selects its text, by Enter and by mouse click.
7. A test proves Enter makes zero write calls; Commit still saves the typed hours.
8. Focused cell is visible, not under the sticky header (browser check).
9. Rows run newest `firstSeen` first; no-date jobs sit at the bottom with the note shown.
10. Full test suite passes.
