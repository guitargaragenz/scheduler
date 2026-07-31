doc_status: live

# Pending Brief — a Parts to Order page

**Status:** awaiting Trevor's "yp" (step 1).
**Date:** 2026-08-01.
**Repo state:** `main` @ `2960d05`, clean.
**Asked for by Trevor 2026-08-01:** *"parts to order page next — we had meeting yesterday
there are real parts ready to add to page."*

## Plain-English summary

There is a `parts_to_order` table in Supabase with real parts in it, and **nothing in the app
shows them.** The only way to see or add a part today is the Sunday board meeting workflow.
This brief builds the page: see the list, add a part, tick one off when it lands.

That is all it builds. It is a place to keep the chase list — nothing about it touches job
state.

## What already exists (verified against the code 2026-08-01, not from memory)

- The table is live and takes writes. It was created for Brief D but had **no RLS policy at
  all** until Trevor added one on 2026-07-31, so every insert since it was created had been
  silently rejected. Two real parts from the 31 Jul meeting are in it now
  (`pto-2026-07-31-1705`, `pto-2026-07-31-1679`).
- Columns: `id`, `description`, `category`, `needed_for_job`, `added_at`, `resolved`.
  `needed_for_job` is **deliberately nullable and deliberately not a foreign key** — a part
  can be for a job that no longer exists, or for no job at all (shop stock). Comment
  explaining this sits above the functions at `src/utils/supabase.js:962-967`.
- All five data functions already exist and work: `loadPartsToOrder`,
  `addPartsToOrderItems`, `removePartsToOrderItem`, `markPartResolved`,
  `subscribeToPartsToOrder` (`src/utils/supabase.js:969` onward). **This build should not
  need to write new data functions** — only fix one, below.
- `id` is a TEXT primary key **with no default**. Callers must supply an id. Deliberate,
  matches the rest of the app, easy to trip on.

## The one thing that must be fixed, not inherited

`addPartsToOrderItems()` catches its own error, logs to the console, and **returns normally**
(same pattern as its neighbours). Every failed write since the table existed has looked like
a success to its caller — that is precisely why nobody noticed the board meeting's parts
write had never once worked.

**A page built on top of that will look like it saved and save nothing.** This build makes
the write path report failure to the caller and the page show it. How far that correction
should reach — this one function, or its neighbours too — is a Council question, not a
builder's judgement call, because those neighbours have other callers.

## Scope

1. **A Parts to Order page** listing what is in the table: description, category, the job it
   is for (if any), when it was added. Newest first, which is what `loadPartsToOrder()`
   already returns.
2. **Add a part** from that page — description, optional category, optional job number.
   Typed job numbers are free text by design; do not validate against `jobs`.
3. **Tick one off** when it arrives, via the existing `markPartResolved`. Resolved parts drop
   off the active list.
4. **Failed writes are visible.** No silent success.

## What this does not touch

- **No job state.** Ticking a part off does not unstick a job, does not change status, does
  not write to `jobs` or `scheduledSlots`. Trevor enters the part in Multitrack when it
  arrives anyway, and **Multitrack is what actually unsticks the job** on the next import.
  The tick only clears the chase list.
- **Not the parked brief.** `docs/briefs/parked-parts-as-a-stuck-reason.md` is a different,
  larger job — bujo quick-entry capture at the bench, the part showing as the stuck reason in
  the Waiting pile, and a job-card control. **That stays parked and unapproved.** This page is
  the reader those pieces would eventually feed; building it first is not building them.
- **Not PartsBox.** `PartsDrawer.jsx` / `utils/partsbox.js` is the PartsBox inventory system,
  a different thing entirely despite the name.
- **Not** `admin/context/GGNZ Parts Shopping List.csv`. Confirmed with Trevor 2026-07-27 that
  it is his personal pedalboard build, misfiled. Do not import it, do not read it as shop
  stock, do not use it as a schema reference.

## Open — for Council

1. Where does the page live — its own route, or a panel on an existing page? Trevor abandons
   dense screens, so this wants to be one thing at a time, not a grid bolted into something.
2. How far does the error-swallowing fix reach (see above)? The neighbouring functions have
   other callers.
3. Does the list need realtime (`subscribeToPartsToOrder` exists) or is load-on-open enough
   for a list one person edits?
4. Resolved parts — hidden, or shown collapsed as a record? The `resolved` column keeps them
   either way.

## Before this starts

Writes to a shared Supabase table, so it runs the full agent-team protocol per `CLAUDE.md` —
brief, "yp", council, builder, independent verifier, browser test, merge.
