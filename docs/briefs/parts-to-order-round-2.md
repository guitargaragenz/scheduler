doc_status: closed

# Parts to Order, round 2: grouping, part numbers, stock check — SHIPPED

**Shipped 2026-08-01 at `a702e6b`** (builds `119e238`, `d085e0a`). Full protocol run in one
session: brief approved → two councillors → builder → independent verifier (14/14 pass,
298 tests) → browser test against live PartsBox inventory → merged with Trevor's approval.
The `part_number` column was applied to the live database by Trevor before merge and
confirmed present.

**This is a record, not a task list.** Everything below describes what was agreed and built.

**What the browser test actually showed**, since it is the only proof the matching is any
good in real use: typing "500k audio pot" flagged `P500KA-18` (5 in stock) before saving;
**Check stock** opened the drawer pre-searched, 3 of 848 parts; the zero-stock
`P500KA-15 copy` was correctly ignored; and the drawer's own bin search (`"L Bin 2"`,
18 parts) still worked — the regression Council specifically warned about.

**Known rough edge, deliberately left:** the Check stock button searches the drawer with
the whole typed phrase, and the drawer requires every word to match. Short entries are
fine; a long sentence can come back empty. Widen only if real use proves it annoying.

**Still not fixed, and still wants its own brief:** `parts_to_order` has no RLS policy in
`docs/supabase-schema.sql`. Carried over from round 1, out of scope here per Council.

Round 3 (push arrivals back into PartsBox) is sketched at the bottom — **not approved, not
scoped**.

---

**Original brief, as approved, below.**

**Two things already established this session — do not re-derive them:**
- **`PartsDrawer.jsx:44-82` already implements the keyword search this build needs** —
  `parseTerms` (:44-57) then `matchesTerm` (:62-72): multi-word AND matching with `-word`
  exclusion, across `part/name`, `part/description`, `part/mpn`, `part/tags` (:64-67) and
  the storage-location name (:68-70). **Reuse this logic; do not write a second matcher
  from scratch.** Two notes that go together:
  - Lifting it into `src/data/partsToOrder.js` so the drawer and the page share one copy
    is the sensible move. **That makes two edits to the drawer, not one** — the search prop
    plus swapping its local matcher for the shared import. Both are permitted; nothing else
    in the drawer moves. Council may instead say leave the drawer alone entirely and copy
    the logic into `partsToOrder.js` — that is a legitimate call, but it must be a decision,
    not a drift.
  - **The page searches four fields, not five.** Drop the storage-location match. A part
    should not flag as in-stock because a shelf happens to be named "amp parts".
- **PartsBox has no search endpoint.** Their own app pulls `part/all` and filters in the
  browser. Client-side filtering is not a workaround here; it is how PartsBox works.

**Correction, so it does not get repeated:** during scoping I told Trevor the PartsBox API
cannot create parts. **It can** — `part/create` exists and requires only `part/type` and
`part/name` ([API docs](https://partsbox.com/api.html)). Our `utils/partsbox.js` simply
does not expose it. This does not change round 2's scope (still read-only), but it does
mean the round-3 write-back is smaller than it looked: the hard part is not creating the
part, it is that `stock/add` needs a storage location, so something must say which drawer
the part went into.
**Date:** 2026-08-01.
**Repo state:** `main` @ `b110dc4`, clean. Round 1 shipped the same day at `9a925ef`
(record: [`docs/briefs/parts-to-order-page-round-1.md`](../docs/briefs/parts-to-order-page-round-1.md)).
**Asked for by Trevor 2026-08-01**, straight after seeing round 1 live:

> 1. Some jobs can have multiple parts so grouping might be a good call
> 2. Be able to enter part numbers
> 3. This is the big one: have the PTO check against partsbox inventory. No use in
>    ordering stuff I already have

## Plain-English summary

The page works but it's a flat list. Three changes: put a job's parts together, let a
part carry its part number, and warn when something on the list is already on the shelf.

The three are one build because they share one screen and one check. **The keyword match
is the everyday path** — most parts are typed at the bench with no number to hand — and it
is stated as a maybe. **The part number, when there is one, turns that maybe into a
certainty.** Do not build the keyword path as a fallback; build it as the main road, with
the part number as the upgrade.

## What already exists (verified against the code 2026-08-01, not from memory)

- `src/utils/partsbox.js` (56 lines) already talks to PartsBox through an
  `/api/partsbox` proxy. `getAllParts()` returns the whole inventory in one call, and
  `totalStock(part)` sums a part's quantity across storage locations. **No new API work
  is needed** — this build consumes what's already there.
- A PartsBox part carries `part/name`, `part/description`, **`part/mpn`** (manufacturer
  part number) and `part/tags`. `PartsDrawer.jsx:64-67` already searches across all four.
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
  it is saved: "you may already have this — **check stock**."

**The flag is a door, not just a notice** (Trevor, 2026-08-01: *"or check stock"*). Both
the row flag and the add-form flag carry a **"check stock"** control that opens the
existing PartsBox drawer with that part's text already searched, so the actual shelf
quantity and location are one click away instead of a hunt. Seeing "you might already
have this" and then having to go find it by hand is the version that gets ignored.

**This needs one small change to `PartsDrawer.jsx`** — it currently takes only `onClose`
(`PartsDrawer.jsx:10`) and holds its own `search` state (`:15`). It needs an optional
opening search term. **That is the single permitted edit to the drawer**: an optional prop
with an unchanged default. No other change to the drawer, its layout, or its stock
add/remove behaviour.

**Matching rule, in priority order:** exact `part/mpn` match on the part number →
otherwise a **keyword search** of what was typed against `part/name`, `part/description`,
`part/mpn` and `part/tags` (the four fields at `PartsDrawer.jsx:64-67` — **not** the
storage-location match at `:68-70`), matching on individual words rather than the whole
string. A part-number match is stated as certain; a keyword match is stated as a maybe.
**Never merge the two systems, and never present a keyword match as definite.** The
keyword path is the everyday one, per the summary above — see Council question 3 for what
is still open about it.

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
- **`PartsDrawer.jsx` gets exactly one change** — an optional opening search term, per the
  "check stock" control above. Nothing else in the drawer moves, and `/api/partsbox` and
  the proxy are untouched.
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
3. ~~**Is the text match worth having at all?**~~ **Answered by Trevor 2026-08-01 — keep
   it, and treat it as the everyday path.** His words: *"not always having part numbers at
   hand a keyword or sim search might be good too."* The rule this settled is stated once,
   in the Scope section above; it is not restated here.
   **What is still open, and is the actual question for Council:** how forgiving the word
   match should be — plain word matching, or something that tolerates a typo or a plural —
   and whether a weak match should be shown at all or filtered out.

## Council verdict — 2026-08-01, two independent reviewers, both approve

Both reviewers landed the same way on all three questions.

1. **Inventory loads on page open**, not behind a button. `PartsDrawer.jsx:24` already
   loads on mount; a button makes the page inconsistent with the drawer for no gain.
2. **No cache.** The page has no cache layer to hook into, and a stale "in stock" is worse
   than a short wait. Revisit only if `getAllParts()` proves slow in real use.
3. **Plain substring word matching only** — no typo or plural tolerance. Weak matches are
   **shown, visually softened, never filtered out and never stated as certain**. Fuzzy
   matching risks the exact failure this page exists to prevent: a tech not ordering a part
   they don't actually have.
4. **Lift `parseTerms`/`matchesTerm` into `src/data/partsToOrder.js`** rather than copying.

**Three build constraints Council added — these are binding:**

- **The drawer keeps its own five-field matcher, including the storage-location match at
  `PartsDrawer.jsx:68-70`.** The shared four-field version in `partsToOrder.js` is a
  *separate export* used only by the stock-check flag. Swapping the drawer's matcher for
  the shared import outright would silently kill bin/shelf search in the drawer — that is
  a regression, not a permitted edit. Verification must include: drawer search on a
  storage-location name still works.
- **The PartsBox failure needs its own third state variable** (e.g. `stockCheckError`),
  separate from `loadError` and `writeError`, with its own quiet non-red styling.
  `PartsToOrderPage.jsx:144-145` renders both existing errors through the same `Notice`;
  reusing either would put a stock-check failure in the red box that means "your save
  failed". The brief states the behaviour; this states the mechanism.
- **Normalise the group key defensively** — `.trim()` at grouping time, not just relying on
  `buildPartPayload`'s write-time trim (`partsToOrder.js:48`). Rows written before that
  trim, or edited directly in the database, would otherwise split one job into two
  headings that look like a duplicate.

Both reviewers confirmed the blast-radius check is clean (no `scheduledSlots`,
`calendarSlot`, `useGoogleCalendar.js`, `useSupabase.js` core logic, or `jobs[]` shape) and
that the missing RLS policy does **not** block this build — the exposure is pre-existing
and this column adds nothing sensitive.

## Carried over from round 1, still not fixed

`docs/supabase-schema.sql` has **no RLS policy for `parts_to_order`.** The policy Trevor
added 31 Jul lives only in the Supabase dashboard. **This build adds a column to that
table, so the migration and the missing policy want running in the same sitting** — but
the policy itself still needs its own brief, not a quiet fold-in here.

## Round 3, if it happens — not approved, not scoped

Push arrivals back into PartsBox: tick "Got it", stock goes up. Trevor asked about this
2026-08-01 and the answer was **not in this build** — write to a live inventory off a
fuzzy keyword match and stock counts go wrong. Ship read-only, use it for a couple of
weeks, and let real use say whether the matching is trustworthy enough. Recorded here so
round 3 starts from what is already known, not from scratch.

## Before this starts

Adds a column to a shared Supabase table and reaches an external API, so it runs the full
agent-team protocol per `CLAUDE.md` — brief, "yp", council, builder, independent verifier,
browser test, merge.
