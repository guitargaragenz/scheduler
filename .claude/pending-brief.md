---
doc_status: live
---

# Brief — Search box on the Jobs Sheet

**Not approved yet.** Waiting on Trevor's "yp".

One box in the Jobs Sheet toolbar that hides the rows you aren't looking for.
53 jobs on one page and finding one means scrolling.

## Build
All in `src/components/JobsSheetPage.jsx`, plus tests.

- A text box in the top bar, next to Key. Placeholder "Search jobs".
- Typing hides every row that doesn't match. Clearing it shows them all again.
- A match is a plain case-insensitive contains, against: job number, customer,
  mfr, model, status, desc, and the row's current Tag and Action (draft value,
  not the saved one — what he sees in the cell is what he searches).
- Multiple words: every word has to match somewhere in the row.
- Row count line reads "12 of 53 jobs" while searching.
- Escape in the box clears it. A small × in the box does the same.
- No matches: "No jobs match that." Not the "No jobs on the board" line.

## Rules that bind it
- **`rows` stays the full list.** `dirty`, `invalidCount`, `commit` and
  `discard` keep working off `rows`, never off the filtered list. Add a
  separate `visibleRows` used only by `<tbody>`. Getting this wrong means an
  edited job that's hidden by the search doesn't save — silent data loss.
- If a changed row is hidden, the counter says so: "3 changed (1 hidden)".
- Commit and Discard always act on every change, hidden or not. Don't disable
  them, don't narrow them, don't clear the search on commit.
- Search is display only. It writes nothing, saves nothing to localStorage,
  and resets to empty on every visit.
- Searching mfr is a lookup, not a bench rule. Nothing about the search may
  feed bench choice anywhere.
- Not blast-radius: no `jobs[]`, `scheduledSlots`, `calendarSlot`, Supabase or
  `useGoogleCalendar` changes. If the build finds it needs one, stop and ask.

## Out of scope
- The mobile sheet (`MobileJobSheet.jsx`). This is the desktop page only.
- Search anywhere else in the app — bench board, week page, parking lot.
- Sorting, column filters, saved searches, fuzzy matching, highlighting.
- The three parked Sheet items (Enter-to-move-down, 30-min snap): separate work.

## Background, not the next step
`docs/briefs/parked-jobs-sheet-usability-changes.md` is the parked list of other
Sheet changes. It is history — do not build from it. Its gate (CSV pipeline
retired) has since been met, but those items are still unapproved.
