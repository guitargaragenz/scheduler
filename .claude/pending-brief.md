doc_status: live

# Pending Brief — Suppliers, shared settings, and a tidier Settings modal

**Status:** ⏳ AWAITING TREVOR'S APPROVAL. **Supersedes the round 2.5 draft committed at
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
per setting. **Add RLS policies for both new tables in the same migration** — see the
carried-over note at the bottom; the reason `parts_to_order` writes silently failed for
weeks was a missing policy, and repeating that on a table Trevor manages by hand would be
the same bug twice.

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
- **Seed once and mark it seeded.** Two devices must not fight, and a device whose
  `localStorage` is empty must not overwrite a shared list that another device populated.
  Empty-`localStorage` devices seed nothing.
- **A failed settings load must fall back to the built-in defaults and keep the app
  working** — never a blank keyword list, because a blank list changes bench inference.

### 5. Changelog deleted

**Trevor 2026-08-01, asked whether to move it to the Help drawer:** *"just delete it … it's
not important really when read only."* So it goes — not relocated.

Remove the Changelog section from `SettingsModal.jsx:295` **and** the changelog data it
renders from `App.jsx`, plus the prop threading between them. Leave nothing dangling.
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

## Open — for Council

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

## Carried over, still not fixed

`parts_to_order` has **no RLS policy** in `docs/supabase-schema.sql` — the one Trevor added
31 Jul lives only in the dashboard. This build adds a column to that table and creates two
more, so **write all three policies into the schema file and run them in the same sitting.**
That closes the round 1 carry-over rather than passing it on again.

## Before this starts

Adds tables and a column to shared Supabase state and changes where job-classification
input is stored, so it runs the full agent-team protocol per `CLAUDE.md` — brief, "yp",
council, builder, independent verifier, browser test, merge. The browser test needs the
iMac; the rest can run from anywhere.
