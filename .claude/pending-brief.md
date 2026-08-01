doc_status: live

# Pending Brief — Suppliers, shared settings, and a tidier Settings modal

**Status:** ✅ APPROVED by Trevor 2026-08-01 ("yp"). Council reviewed 2026-08-01 — both
reviewers APPROVE WITH CHANGES; their required changes are folded into the scope below and
collected in **Council amendments** near the bottom. **Now at protocol step 3 — builder.**
**Supersedes the round 2.5 draft committed at
`1e00250`** — that draft had supplier as free text with a browser-only settings pattern.
Trevor then asked for a managed dropdown, and the device question changed the storage
answer for settings generally.

**Date:** 2026-08-01. **Repo state:** `main` @ `1e00250`, clean. Parts to Order round 2
shipped the same day at `a702e6b`
(record: [`docs/briefs/parts-to-order-round-2.md`](../docs/briefs/parts-to-order-round-2.md)).

**Asked for by Trevor 2026-08-01**, in three steps across one conversation:
> *"before we do this I'd like to add Supplier name to PTO"* → chose **group by supplier**
> over just recording it → *"Supplier names can go in settings, then I can create, edit,
> delete etc"* → *"yes and keywords too is poss. Changelog is pretty useless as it is so
> that can be moved out too"*

**"Before we do this"** means before the Parking Lot build
([`one-parking-lot-fed-from-bujo.md`](../docs/briefs/one-parking-lot-fed-from-bujo.md)),
which stays next in the queue and is untouched by this.

## Plain-English summary

Three things, one build, because they all land in the same two screens.

1. **Suppliers.** Each part gets a supplier, picked from a dropdown you manage in Settings.
   The Parts to Order page gets a switch: view the list **by job** (as now) or **by
   supplier**, so an ordering session shows everything from one place in one lump.
2. **Settings that follow you between devices.** Today anything you change in Settings is
   saved to that browser only. The supplier list can't work that way — it would start empty
   on every device — and bench keywords have the same problem, hidden by the fact that the
   built-in list looks identical everywhere.
3. **The Changelog goes.** Deleted, not relocated.

## The fact that drives this — verified against the code 2026-08-01

Everything in Settings persists to `localStorage` in `App.jsx`: `benchKeywords` (`:49`,
`:812`), `weeklyTarget` (`:110`), `hourlyRate` (`:111`), `benchHours` (`:113`).

**Trevor said he can see his keywords on the phone. He can — but not his edits.**
`SettingsModal.jsx:15` falls back to `defaultKeywords[bench]` when nothing is stored, and
those defaults are `DEFAULT_BENCH_KEYWORDS` in `src/data/jobs.js:1`, compiled into the app.
So every device shows the same built-in list and nothing looks broken, while any keyword he
added on the iMac is missing everywhere else. **This is the bug this build fixes, not a
preference.** Do not "fix" it by copying the defaults around.

`docs/supabase-schema.sql` has **no settings table and no suppliers table** — the eleven
tables are listed at `:5`–`:228`. `parts_to_order` (`:160`) gained `part_number TEXT` in
round 2 and still has **no supplier column** and **no RLS policy**.

There is already a working add/remove-chips editor to copy: `KeywordEditor`
(`SettingsModal.jsx:12-33`) — type a word, it becomes a chip, × removes it, with a reset to
defaults. **The supplier editor is that component with a different label. Do not design a
new one.**

## Scope

### 1. Two new tables

```sql
CREATE TABLE IF NOT EXISTS suppliers (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

ALTER TABLE parts_to_order ADD COLUMN IF NOT EXISTS supplier TEXT;
```

`app_settings` is a plain key/value store so the remaining settings move without a column
per setting.

**No RLS on either new table.** ⚡ *Overrules this brief's original instruction, and the
"Carried over" note at the bottom. Trevor's call 2026-08-01 after council raised the
contradiction.* `docs/supabase-schema.sql:200-205` records a deliberate project-wide
decision: no RLS on any table, anon key only, because a single RLS'd table in an open
schema buys no real security and risks silently blocking reads. `parts_to_order` is the
**exception, not the pattern** — and the round-1 silent-failure was RLS *enabled with no
policy*, which is precisely what extending RLS to hand-managed tables risks repeating.

So: create `suppliers` and `app_settings` with no RLS, like every other table. Do **not**
write RLS policies into the schema file. **Do** add a comment above `parts_to_order`
recording that a permissive policy was added by hand in the Supabase dashboard on 31 Jul
and is *not* in this file, so a rebuild from this file doesn't resurrect the silent-write
bug. Locking the schema down as a whole stays a separate question for its own brief.

### 2. Suppliers, managed in Settings

- A **Suppliers** section in Settings: add a name, rename, remove. The `KeywordEditor`
  chip pattern, backed by the `suppliers` table.
- **Removing a supplier does not touch parts already tagged with it.** The part keeps the
  name it was saved with; it simply stops being offered for new ones. A part tagged with a
  removed supplier still groups under that name. **Never rewrite saved part rows when the
  supplier list changes.**
- On the Parts to Order add form, supplier is a **dropdown of the managed list, plus a
  blank "not decided yet"**, which is the default. Optional, exactly as `part_number` is —
  **the page must never refuse a part because the supplier is blank.**
- Supplier shows on each row, same shape as the part number.

### 3. Group-by switch on Parts to Order

- **By job** (default, unchanged) or **By supplier**, chosen with a small toggle above the
  To Order list.
- By supplier: heading per supplier, ordered by newest part. Parts with no supplier fall
  into a **"Supplier not decided"** group pinned **last**, regardless of recency — it is a
  to-do pile, not an order.
- Within a group, newest first, as now.
- The chosen view persists (it is a per-device view preference, so `localStorage` is right
  here — it does not go in `app_settings`).
- Inside a supplier group each row shows **which job it's for**. Round 2 suppressed the job
  on rows inside job groups because the heading said it; that suppression is **per-view**
  and must not leak. Mirrored: inside a supplier group the supplier is not repeated.
- **Generalise `groupPartsByJob`, don't fork it** — one grouping function taking the key,
  the empty-key label, and whether the empty group sorts by recency (job: yes, "Shop
  stock") or is pinned last (supplier: yes, "Supplier not decided"). Round 2's lesson was
  the drawer's duplicated matcher.

### 4. Settings move to `app_settings`

`benchKeywords`, `weeklyTarget`, `hourlyRate`, `benchHours` read and write the shared
store instead of `localStorage`.

**The migration is the risky part, and it is about job classification, not settings.**
`benchKeywords` feeds `inferBench()` (`src/data/jobs.js:19`), which decides which bench a
job lands on. Getting this wrong silently re-benches jobs.

- **On first load, if the shared store has no entry for a key, seed it from that browser's
  `localStorage` value, then use the shared store from then on.** Trevor's real keyword
  edits live on the iMac; they must survive.
- ⚡ **The seed write is `INSERT … ON CONFLICT (key) DO NOTHING`. Never an upsert.**
  *(Council, both reviewers.)* A client-side "already seeded" flag cannot arbitrate between
  three devices — only the database can. With a plain upsert, whichever device seeds *last*
  wins, so the MacBook or iPhone with empty `localStorage` can silently wipe the iMac's real
  keywords. First writer wins permanently; every later seed attempt is a no-op.
- **There is no per-device seeded flag.** `DO NOTHING` is the mechanism. If a sentinel is
  wanted at all it lives server-side in `app_settings`, never in `localStorage`.
  Empty-`localStorage` devices still seed nothing.
- **A failed settings load must fall back to the built-in defaults and keep the app
  working** — never a blank keyword list, because a blank list changes bench inference.
- ⚡ **"Never blank" includes a single bench emptied to `[]`, not just a missing key.**
  *(Council B.)* `src/data/jobs.js:30` merges `{ ...DEFAULT_BENCH_KEYWORDS, ...keywords }`
  at the **bench** level, so `{ Fretwork: [] }` survives the merge and produces
  `new RegExp('')` — which matches **every job**, sending the whole board to one bench. This
  hazard exists in today's code; the migration makes it reachable in more ways (partial
  load, failed fetch, cross-device write). Treat an empty array for a bench as "no entry"
  and fall back to that bench's defaults.

### 4b. ⚡ `benchHours` is not just a setting — it feeds job splitting

*(Council A. This is the finding that changes the build.)*

`benchHours` is passed into `useSupabase.js` (`src/App.jsx:112-114`,
`src/hooks/useSupabase.js:137-150`) as `benchHoursRef.current`, and
`normalizeJobsFromDb` / `expandAutoSplits` / `createSubtasks` (`src/data/jobs.js:189-263`)
use it to compute the fixed hours on Luthier/Setup/Fretwork/Wiring split cards.

Today that value is **synchronously** available from `localStorage` on first render. Moving
it to an async `app_settings` fetch means the first normalize pass would run against
default/empty bench hours and silently mis-size split cards on every load.

- **Gate the first `normalizeJobsFromDb` pass on settings having loaded** — or otherwise
  guarantee the split maths never runs against a placeholder `benchHours`.
- `src/hooks/useSupabase.js` is a **named blast-radius file in `CLAUDE.md`** and this build
  touches it. The original brief did not say so. It does now.

### 5. Changelog deleted

**Trevor 2026-08-01, asked whether to move it to the Help drawer:** *"just delete it … it's
not important really when read only."* So it goes — not relocated.

⚡ **Amended after council + a call-site count 2026-08-01. The original instruction — "remove
the changelog data from `App.jsx`, leave nothing dangling" — underestimated the footprint
and would have dragged this build into blast-radius files for a cosmetic cleanup.**

`addChangelog` has **20+ call sites**, and they are not in Settings: `useScheduler.js`
(`:194, :250, :254, :350, :410, :414, :434, :478, :484`), **`useGoogleCalendar.js`**
(`:165, :172, :205, :447` — a named blast-radius file), and job cancellation at
`App.jsx:302`. Most are save-failure and "DB half-updated" messages.

**Delete the screen, not the plumbing:**

- **Delete:** the `changelog` tab from the tab list (`SettingsModal.jsx:148`), the tab body
  (`SettingsModal.jsx:293-305`), the `changelog` prop (`SettingsModal.jsx:106`), the
  `changelog` prop pass at `App.jsx:802`, and the `changelog` state at `App.jsx:63`.
- **Keep `addChangelog` as a no-op** in `App.jsx:138` with a one-line comment saying the
  Changelog UI was removed 2026-08-01 and these calls are retained deliberately so the
  scheduling and calendar hooks are not edited for a UI deletion.
- **Do not edit `useScheduler.js`, `useGoogleCalendar.js`, or any call site.** Not one.

Stripping the call sites is real housekeeping, but it is its own job in its own brief —
`useGoogleCalendar.js` is blast-radius and does not get opened for this.
Git keeps the entries permanently, so nothing is lost.

**Do not touch any other Settings tab while in there.**

## What this does not touch

- **No job state.** Nothing writes to `jobs`, `scheduledSlots` or `calendarSlot`. Supplier
  is a TEXT field on the parts list; the keyword migration changes where keywords are
  *stored*, never what `inferBench()` does with them.
- **No writes to PartsBox**, and no change to the stock check, the matcher, or
  `PartsDrawer.jsx`. Round 2's flag behaviour is finished.
- **No supplier on the already-sorted section.** That list stays flat and ungrouped.
- **No supplier detail fields.** Names only — Trevor was explicit: *"I don't need account
  numbers etc, I have everything saved to browser."* No account numbers, lead times, links
  or contacts. If those are ever wanted, that is a different build.
- **Google Calendar settings stay where they are.** Only the four listed settings move.

## Council verdict — 2026-08-01

Two independent reviewers, both **APPROVE WITH CHANGES**. Nothing cut from scope. Their
required changes are folded into the scope above, marked ⚡. In summary:

| # | Change | Where it landed |
|---|--------|-----------------|
| 1 | `benchHours` feeds job splitting via `useSupabase.js`; async load would mis-size split cards. Gate the first normalize pass. **Build touches a blast-radius file.** | §4b |
| 2 | Seed write must be `INSERT … ON CONFLICT DO NOTHING`, never upsert — closes the three-device wipe race. | §4 |
| 3 | "Never blank keywords" must cover a bench emptied to `[]`, which becomes a match-everything regex. | §4 |
| 4 | Changelog footprint is 20+ call sites incl. blast-radius files — delete the screen, keep `addChangelog` as a no-op. | §5 |
| 5 | RLS: schema-wide no-RLS is deliberate; don't extend it. Trevor's call — no RLS on the new tables, comment the hand-added `parts_to_order` policy instead. | §1 |

Both reviewers independently confirmed the brief's stated facts against live code and found
**no stale claims**. Both confirmed `KeywordEditor` is reusable as-is, that
`groupPartsByJob` (`src/data/partsToOrder.js:79-100`) generalises cleanly with the three
knobs proposed, that the per-view job-label suppression lives in `PartsToOrderPage.jsx` not
the grouping function, and that the current `parts_to_order` write functions
(`src/utils/supabase.js:1010-1060`) correctly `throw` rather than swallow — the new
suppliers/settings writes must follow that same throw pattern.

Both answered the four open questions below the same way: **1** one key/value table, yes;
**2** pile the undecided last, don't hide them; **3** never rewrite saved rows on rename,
confirmed; **4** the migration only holds with the `DO NOTHING` write above.

## Open — answered by Council, kept for the reasoning

1. **Is `app_settings` as one key/value table right**, or is it a bag that will fill with
   junk? The alternative is a column per setting, which is honest but means a migration for
   every new setting.
2. **Should the supplier view hide parts with no supplier**, rather than pile them at the
   bottom? For: when ordering, an undecided pile is noise. Against: it silently hides work,
   and this page is a chase list.
3. **What happens on rename?** If "Rockshop" becomes "Rock Shop", parts saved with the old
   name keep it and group separately. Is that acceptable, or does rename need to offer to
   update matching parts? Scope above says never rewrite rows — confirm or overrule.
4. **Does the seed-once-then-shared migration hold with three devices** (iMac, MacBook,
   iPhone) where only the iMac has real edits? Attack this specifically.

## Carried over — resolved 2026-08-01, differently than proposed

~~`parts_to_order` has no RLS policy in the schema file, so write all three policies in.~~
**Overruled.** Council surfaced `docs/supabase-schema.sql:200-205`: no RLS anywhere is a
deliberate project decision, and `parts_to_order` is the exception. Extending RLS to two
hand-managed tables risks re-creating the round-1 silent-write bug rather than closing it.

**Trevor's call:** keep the new tables unlocked like everything else, and record the
hand-added `parts_to_order` dashboard policy as a schema-file comment so a rebuild doesn't
resurrect the bug. See §1. Locking the schema down as a whole is a separate brief.

## Before this starts

Adds tables and a column to shared Supabase state and changes where job-classification
input is stored, so it runs the full agent-team protocol per `CLAUDE.md` — brief, "yp",
council, builder, independent verifier, browser test, merge. The browser test needs the
iMac; the rest can run from anywhere.
