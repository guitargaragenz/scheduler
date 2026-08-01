doc_status: live

# Pending Brief — Parts to Order, round 2: grouping, part numbers, stock check

**Status:** ⏳ Awaiting Trevor's "yp" (step 1). Then Council.
**Date:** 2026-08-01.
**Repo state:** `main` @ `fb0b476`, clean. Round 1 shipped the same day at `9a925ef`
(record: [`docs/briefs/parts-to-order-page-round-1.md`](../docs/briefs/parts-to-order-page-round-1.md)).
**Asked for by Trevor 2026-08-01**, straight after seeing round 1 live:

> 1. Some jobs can have multiple parts so grouping might be a good call
> 2. Be able to enter part numbers
> 3. This is the big one: have the PTO check against partsbox inventory. No use in
>    ordering stuff I already have

## Plain-English summary

The page works but it's a flat list. Three changes: put a job's parts together, let a
part carry its part number, and warn when something on the list is already on the shelf.

The three are one build because **item 2 is what makes item 3 reliable.** Matching
"TDA7294 amplifier chip" against PartsBox by text alone is guesswork; matching on a part
number is exact.

## What already exists (verified against the code 2026-08-01, not from memory)

- `src/utils/partsbox.js` (56 lines) already talks to PartsBox through an
  `/api/partsbox` proxy. `getAllParts()` returns the whole inventory in one call, and
  `totalStock(part)` sums a part's quantity across storage locations. **No new API work
  is needed** — this build consumes what's already there.
- A PartsBox part carries `part/name`, `part/description`, **`part/mpn`** (manufacturer
  part number) and `part/tags`. `PartsDrawer.jsx:64-68` already searches across all four.
  **`part/mpn` is the join** between the two systems.
- `parts_to_order` (`docs/supabase-schema.sql:160-167`) has no part-number column.
- Round 1's page is `src/components/PartsToOrderPage.jsx`, with its testable logic split
  out into `src/data/partsToOrder.js` (`partitionParts`, `buildPartPayload`). Grouping
  and match-checking belong in that same file, not in the component.

## Scope

**1. Group by job.** Parts for the same job sit together under one heading —
"Job 1705", "Job 1679", and a "Shop stock" group for parts with no job. Display only;
nothing changes in the database. Groups ordered by their newest part, so the group just
added to comes first. Within a group, newest first as now.

**2. Part number field.** A new optional "part number" on the add form and on each row.
Needs one additive, nullable column:

```sql
ALTER TABLE parts_to_order ADD COLUMN IF NOT EXISTS part_number TEXT;
```

Nullable on purpose — most entries are typed at the bench with no number to hand, and
the page must never refuse a part because a number is missing.

**3. Stock check against PartsBox.** Two places, both advisory:

- **On the list.** When the page opens, load the inventory once and flag any part that
  looks like something already in stock — "PartsBox: 4 in stock" on the row.
- **On the add form.** As a part number or description is typed, show any match *before*
  it is saved: "you may already have this."

**Matching rule, in priority order:** exact `part/mpn` match on the part number →
otherwise a text match of the description against `part/name`, `part/description` and
`part/mpn`, using the same containment test `PartsDrawer.jsx:64-68` already uses. A
part-number match is stated as certain; a text match is stated as a maybe. **Never merge
the two systems, and never present a text match as definite.**

**4. Never block.** The check warns and nothing more. It cannot refuse a save, cannot
remove a part from the list, and cannot tick one off. If PartsBox is unreachable the page
still works fully — the flags simply do not appear, with a quiet note that the stock check
is unavailable. **A failed stock check is not a failed save**, and must not surface in the
same red inline error that round 1 reserved for failed writes.

## What this does not touch

- **No job state.** Same as round 1 — nothing writes to `jobs`, `scheduledSlots` or
  `calendarSlot`. Grouping by job number reads a TEXT field; it does not create a
  relationship.
- **No writes to PartsBox.** Read-only. `addStock`/`removeStock` (`partsbox.js:41-56`)
  stay untouched. Ticking a part off does **not** add it to inventory.
- **`PartsDrawer.jsx` stays as it is.** This build imports from `utils/partsbox.js`; it
  does not modify the drawer or the proxy.
- **Job numbers stay free text.** Still not validated against `jobs`. A group heading for
  a job number that no longer exists is correct behaviour, not a bug.
- **Not** `admin/context/GGNZ Parts Shopping List.csv` — Trevor's personal pedalboard
  list, misfiled. Do not read it.

## Open — for Council

1. **Does the inventory load belong on page open, or behind a button?** One
   `getAllParts()` call on open is simplest and matches how the drawer already behaves,
   but it puts a network call in front of a page whose whole job is to load fast.
2. **How stale can the flag be?** No caching is proposed. If the call is slow enough to
   matter, is a short cache better than a spinner?
3. **Is the text match worth having at all,** or does a maybe-match that is wrong half the
   time train Trevor to ignore the flag entirely — leaving only exact part-number matches
   worth showing?

## Carried over from round 1, still not fixed

`docs/supabase-schema.sql` has **no RLS policy for `parts_to_order`.** The policy Trevor
added 31 Jul lives only in the Supabase dashboard. **This build adds a column to that
table, so the migration and the missing policy want running in the same sitting** — but
the policy itself still needs its own brief, not a quiet fold-in here.

## Before this starts

Adds a column to a shared Supabase table and reaches an external API, so it runs the full
agent-team protocol per `CLAUDE.md` — brief, "yp", council, builder, independent verifier,
browser test, merge.
