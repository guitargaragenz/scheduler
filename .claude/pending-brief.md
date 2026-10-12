---
doc_status: live
---

# Scope lock — Board day list search finds what the Board week list search finds

Trevor, 2026-10-12 ("yp"): the day and week lists differ in two ways — Planning hiding DG jobs
(handled by resuming the DG brief next) and search. This lock is search only.

## Build — `src/components/JobShelf.jsx`
1. Day list search matches the same fields as `Sidebar.jsx` `matchText` (~124): job number,
   customer, make, model, bench, description, status, action. Case-insensitive, as now.
2. Test in `JobShelf.test.jsx` covering each new field.

## Not in scope
- No visible change: placeholder text, chips, order, search-overrides-chips all stay.
- `Sidebar.jsx`, `jobs.js` and every blast-radius file untouched. Display only.

## Binding rules
- `git add` specific files only. Staging branch `staging/day-search`.
