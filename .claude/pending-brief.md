doc_status: live

# Pending Brief — Parts to Order, round 2.5: supplier name and a group-by switch

**Status:** ⏳ AWAITING TREVOR'S APPROVAL. Asked for 2026-08-01, straight after round 2
merged: *"before we do this I'd like to add Supplier name to PTO pls"* — and, when asked
what the supplier was for, he picked **group by supplier too**, not just record it.

**Date:** 2026-08-01. **Repo state:** `main` @ `8be77f4`, clean. Round 2 shipped the same
day at `a702e6b` (record: [`docs/briefs/parts-to-order-round-2.md`](../docs/briefs/parts-to-order-round-2.md)).

**"Before we do this"** means before the Parking Lot build
([`one-parking-lot-fed-from-bujo.md`](../docs/briefs/one-parking-lot-fed-from-bujo.md)),
which stays next in the queue and is untouched by this.

## Plain-English summary

Each part gets an optional supplier name, and the page gets a switch: look at the list
**by job** (as now) or **by supplier**. The point of the second view is the ordering
session — everything you need from one place, in one lump, instead of hunting for it
across job headings.

## What already exists (verify against the code before building — this was written
straight after the round 2 merge, so check it still reads true)

- `src/data/partsToOrder.js` holds the testable logic: `partitionParts`,
  `buildPartPayload`, `groupPartsByJob`, `parseTerms`, `matchesPart`, `findStockMatch`.
  `groupPartsByJob` groups on a trimmed `neededForJob`, orders groups by newest part, and
  labels the empty key `'Shop stock'`.
- `src/components/PartsToOrderPage.jsx` renders the add form, the groups, the stock flag
  and three separate error/notice states (`loadError`, `writeError`, `stockCheckError`).
- `src/utils/supabase.js` maps `parts_to_order` rows both ways; round 2 added
  `part_number`/`partNumber` there in four lines.
- `parts_to_order` in `docs/supabase-schema.sql` now has `part_number TEXT`. It has **no
  supplier column**, and still **no RLS policy**.

## Scope

**1. Supplier field.** A new optional "supplier" on the add form and on each row, exactly
the shape `part_number` already has. One additive, nullable column:

```sql
ALTER TABLE parts_to_order ADD COLUMN IF NOT EXISTS supplier TEXT;
```

Nullable on purpose. Most parts are typed at the bench and the supplier isn't decided yet;
**the page must never refuse a part because the supplier is blank.**

**2. Group-by switch.** Two buttons or a small toggle at the top of the To Order list:
**By job** (the default, unchanged from round 2) and **By supplier**.

- By supplier: heading per supplier, ordered by newest part, same as job grouping. Parts
  with no supplier fall into a **"Supplier not decided"** group, which sorts **last**
  regardless of recency — it is a to-do pile, not an order.
- Within a group, newest first, as now.
- The chosen view **persists** — flipping to By supplier and coming back later should
  still be By supplier. `localStorage` is enough; this is not worth a database column.
- Inside a supplier group, each row shows **which job it's for** (round 2 suppressed the
  job on the row inside job groups because the heading said it — that suppression is
  per-view, and must not leak into the supplier view). Same rule mirrored: inside a
  supplier group, the supplier is not repeated on the row.

**3. Generalise the grouping, don't fork it.** `groupPartsByJob` becomes one grouping
function taking the key to group by, with the empty-key label and the empty-key sort
position passed in — because job's empty group ("Shop stock") sorts by recency like any
other, while supplier's ("Supplier not decided") is pinned last. **Do not write a second
near-copy of the grouping function.** Round 2's lesson was the drawer's duplicated matcher.

## What this does not touch

- **No job state.** Nothing writes to `jobs`, `scheduledSlots` or `calendarSlot`. Supplier
  is a plain TEXT field on the parts list.
- **No writes to PartsBox**, and no change to the stock check, the matcher, or
  `PartsDrawer.jsx`. Round 2's flag behaviour is finished and stays as it is.
- **Supplier is free text.** Not a dropdown, not a supplier table, not validated. Trevor
  was offered a pick-list and chose grouping instead — a pick-list needs somewhere to keep
  the list and a way to add to it, and that is a separate, bigger job.
- **No supplier on the already-sorted section.** That list stays flat and ungrouped.
- **Not the RLS policy.** Still missing, still wants its own brief. This build adds a
  column to that table, so run the migration by hand in the same sitting as round 2's.

## Open — for Council

1. **Is a toggle right, or should the supplier view be its own thing?** A switch keeps one
   page, but it means two layouts to keep working. Is there a reason to prefer a single
   list that always shows both headings?
2. **Should the supplier view hide parts with no supplier entirely**, rather than pile them
   at the bottom? Argument for hiding: when you are ordering, an undecided pile is noise.
   Argument against: it silently hides work, and this page is a chase list.
3. **Does the stock flag still make sense in the supplier view?** It was designed against a
   job-grouped list. Probably yes, unchanged — but say so deliberately rather than by
   default.

## Before this starts

Adds a column to a shared Supabase table, so it runs the full agent-team protocol per
`CLAUDE.md` — brief, "yp", council, builder, independent verifier, browser test, merge.
The browser test needs the iMac; the rest can run from anywhere.
