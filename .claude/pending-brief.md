---
doc_status: live
---

# Scope lock — Parts to Order categories, managed in Settings

Status: approved by Trevor 2026-09-13. Council skipped on his call (copy of the
working suppliers pattern, no job state). Verifier and browser test still run.

## Build
- New Supabase table `part_categories` (names only), same shape as `suppliers`.
  Add its SQL to `docs/supabase-schema.sql`.
- `src/utils/supabase.js`: load/add/rename/remove for categories, copied from the
  supplier functions.
- New hook `src/hooks/usePartCategories.js`, copied from `useSuppliers.js`.
- Settings: a fourth tab "categories", same chip editor as suppliers.
- Parts to Order page: the Category free-text box becomes a dropdown of the managed
  list, optional, like Supplier.
- Tests mirroring `supabaseSuppliersSettings.test.js`.

## Out of scope
- Saved parts. A part keeps the category NAME copied at save time; renaming or
  removing a category never changes a saved part.
- The "part" fallback when no category is picked stays as it is.
- No colours, ordering or grouping by category.

## Rules
- Blast-radius (touches `utils/supabase.js`): full protocol.
- Nothing in the category code reads or writes `parts_to_order`.
