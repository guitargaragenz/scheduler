---
doc_status: live
---

# Brief — Search box on the Jobs Sheet

Approved by Trevor ("yp", 2026-09-14). Council: 2 reviewers, both approve;
their changes are folded in below. One box in the Jobs Sheet toolbar that
hides the rows you aren't looking for.

## Build
All in `src/components/JobsSheetPage.jsx`, plus tests.

- A text box in the top bar, next to Key. Placeholder "Search jobs".
- Typing hides every row that doesn't match. Clearing it shows them all again.
- A match is a plain case-insensitive contains, against: job number, customer,
  mfr, model, status, desc, and the row's current Tag and Action (draft value,
  not the saved one — what he sees in the cell is what he searches).
- Multiple words: every word has to match somewhere in the row.
- The existing count line is the one that changes — "12 of 53 jobs · greyed
  columns come from Multitrack". No second counter.
- Escape in the box clears it. A small × in the box does the same.
- No matches: "No jobs match that." A second, separate empty state — the
  existing "No jobs on the board." line stays for an empty board.

## Rules that bind it
- **`rows` stays the full list.** `dirty`, `invalidCount`, `commit` and
  `discard` keep working off `rows`, never off the filtered list. Add a
  separate `visibleRows` used only by `<tbody>`. Getting this wrong means an
  edited job that's hidden by the search doesn't save — silent data loss.
- A hidden changed row is called out: "3 changed (1 hidden)", and that text is
  a button — clicking it clears the search so every changed row is back on
  screen. "Hidden" means changed AND filtered out, never merely filtered out.
- The search box shows on the read-only mobile rendering of this page too
  (`isMobile`). Intended — looking a job up on the phone is the point.
- Commit and Discard always act on every change, hidden or not — never
  narrowed, never disabled, and commit doesn't clear the search.
- Display only: writes nothing, saves nothing, resets to empty every visit.
- Searching mfr is a lookup, not a bench rule — it never feeds bench choice.
- Not blast-radius: no `jobs[]`, `scheduledSlots`, `calendarSlot`, Supabase or
  `useGoogleCalendar` changes. If the build finds it needs one, stop and ask.

## Out of scope
- The mobile sheet (`MobileJobSheet.jsx`). This is the desktop page only.
- Search anywhere else in the app — bench board, week page, parking lot.
- Sorting, column filters, saved searches, fuzzy matching, highlighting.
- The parked Sheet items (Enter-to-move-down, 30-min snap): separate work.

## Background, not the next step
`docs/briefs/parked-jobs-sheet-usability-changes.md` — other parked Sheet
items. History, not this build.