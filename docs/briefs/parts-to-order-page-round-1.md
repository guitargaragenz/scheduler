doc_status: closed

# Pending Brief — a Parts to Order page

**Status:** ✅ SHIPPED 2026-08-01 at merge `9a925ef`. Closed. All six protocol steps ran — brief, "yp", council, builder, independent verifier, live browser test on the real table, merge. Trevor approved the builder’s extra "Put back" (un-tick) button at merge time. Test row added during the browser test was deleted from `parts_to_order` afterwards.
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

## Council (step 2, run 2026-08-01) — both reviewers say build. Four answers, one correction.

**Correction to this brief, from both reviewers independently:** the claim above that the
neighbouring functions "have other callers" is **wrong**. Grepped across `src`, `.claude` and
`scripts`: all five `parts_to_order` functions have **zero callers anywhere** outside
`supabase.js` itself. The board meeting writes them from a live chat turn, not from committed
code (`.claude/workflows/sunday-board-meeting.js:11-16`). So Q2 is not a risk question at all
— nothing can break. It is just a consistency choice.

**1. Where the page lives — its own page, via the existing body-swap seam.**
`App.jsx:584-674` already does this four times over: a `showX` boolean, a header button, and a
ternary that swaps the whole content area for one page component (`ProjectsPage` at
`App.jsx:602-603` is the model to copy). Add `showPartsToOrder` the same way.
**Do not reuse the existing "Parts" button** at `App.jsx:547-557` — that opens `PartsDrawer`,
the unrelated PartsBox inventory system. Sharing that label would confuse the two on sight.

**2. The error fix — all four of the `parts_to_order` read/write functions**
(`loadPartsToOrder`, `addPartsToOrderItems`, `removePartsToOrderItem`, `markPartResolved`).
Leave `subscribeToPartsToOrder`'s try/catch alone — it governs subscription setup, not a write.
**Do not touch the `pending_revenue_review` functions** (`supabase.js:882-946`) — they share the
pattern but have a real caller (`usePendingRevenueReview.js`, wired at `App.jsx:136`) and are
out of scope.
A failed write must show as **persistent inline text on the page, not a toast** — a tech
interrupted mid-shop needs to still see it when they come back.

**3. Realtime — no.** Load-on-open. One person edits this list; wiring the subscription buys
nothing and adds cleanup to verify. `subscribeToPartsToOrder` stays unused.

**4. Resolved parts — shown collapsed, not hidden.** `markPartResolved` deliberately updates
in place rather than deleting, and the comment at `supabase.js:1030-1032` says why: the row is
worth keeping for the next meeting's "what got sorted this week" glance. A dimmed, collapsed
section under the active list.

**On `id`:** already solved in the code — `addPartsToOrderItems` at `supabase.js:1002` falls
back to `pto-${Date.now()}-${Math.random()}`. That does not match the two hand-made rows
(`pto-2026-07-31-1705`), and it does not need to: the column is an opaque TEXT key. **Leave the
existing fallback alone; do not invent a format to match two manually-typed rows.**

**Collision between the page and the Sunday meeting: not a real risk.** Different id shapes,
and it is an `INSERT` not an `UPSERT`, so a true collision fails the write — which is now
visible rather than swallowed.

## Found on the way, NOT part of this build

`docs/supabase-schema.sql` has **no RLS policy for `parts_to_order`** — the policy Trevor added
on 31 Jul lives only in the Supabase dashboard, invisible to git. Anyone rebuilding the schema
from that file reproduces the exact silent-write-rejection bug this brief exists to work around.
Recorded here while it is fresh. **Needs its own brief; do not scope it into this build.**

## Before this starts

Writes to a shared Supabase table, so it runs the full agent-team protocol per `CLAUDE.md` —
brief, "yp", council, builder, independent verifier, browser test, merge.
