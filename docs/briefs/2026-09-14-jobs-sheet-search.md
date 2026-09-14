---
doc_status: closed
---

# Record (closed) — Search box on the Jobs Sheet

Shipped at `09f12df` (PR #67), 2026-09-14. 802/802 tests, 41 files; 7 of those
tests are new. Council: 2 reviewers, both approve. Verifier: 10/10 checks pass.
Browser-tested live by Trevor on the Vercel preview: "it all works perfectly
and looks great."

Approved by Trevor ("yp", 2026-09-14), merged on his second "yp" the same day.

## What shipped
All in `src/components/JobsSheetPage.jsx` and `src/data/jobsSheet.js`, plus
tests in `src/data/jobsSheet.test.js`.

- A search box in the Sheet toolbar, left of Key. Typing hides every row that
  doesn't match; clearing it brings them all back.
- A match is a case-insensitive substring over job number, customer, mfr,
  model, status, desc, and the row's Tag and Action. Multiple words all have
  to land somewhere in the row; order doesn't matter.
- Tag and Action come off the **draft**, not the saved job — a WP picked but
  not yet committed still answers a search for WP.
- The existing count line reads "12 of 53 jobs" while searching.
- Escape and a × in the box both clear it.
- "No jobs match that." is a second empty state, separate from the existing
  "No jobs on the board."
- The matcher (`rowSearchText`, `matchesSearch`) is pure and lives in
  `jobsSheet.js` so it can be tested on its own.

## The thing it was built around
`dirty`, `invalidCount`, `commit` and `discard` all iterate `rows`. Filtering
`rows` itself would mean a job Trevor edited and then searched away from
silently never saves. So `rows` stays the full list and a separate
`visibleRows` is used only by `<tbody>`.

On top of that, a changed row the search is hiding is named in the toolbar:
"3 changed (1 hidden)", and the "(1 hidden)" text is a button that clears the
search. Council reviewer 2 asked for this — a count he can't act on is worse
than no count. "Hidden" means changed AND filtered out, never merely filtered.

## Decisions the brief didn't cover
- The matcher went in `jobsSheet.js` rather than the page, for testability.
  The brief said "all in JobsSheetPage.jsx".
- While searching the count line says "1 of 12 jobs", not "1 of 12 job". Left
  as is; it reads better than the singular.
- The read-only mobile rendering of this page gets the box too. Intended.

## Follow-on
Trevor asked, straight after the browser test, for a dropdown to pick a tag
rather than typing it. Briefed separately.
