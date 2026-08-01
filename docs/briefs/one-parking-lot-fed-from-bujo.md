doc_status: live

# Brief — One Parking Lot, fed from the Daily Log

**Status:** ✅ APPROVED by Trevor 2026-08-01 ("yes perfect"), including the recommendation to
retire the markdown list. Next step: Council (protocol step 2). Queued behind **Parts to Order
round 2**, which holds the pending-brief slot — round 1 shipped at `9a925ef`.
**Date:** 2026-08-01.
**Branch:** to be cut from `main` once Parts to Order round 2 has merged.
**Asked for by Trevor 2026-08-01:** *"the i/p to Parking Lot>meetings etc is through Bujo.
I add my idea and tag it #PL it gets written into parking lot."*

## Plain-English summary

Trevor has two parking lots and only one of them ever gets read. He also has no easy way to
get an idea *into* the one he owns — he has to remember to open a separate page.

This brief does three things, in this order:

1. **Stops the Parking Lot save from wiping the table** before it rewrites it.
2. **Merges the two lists into one**, so there is a single place ideas live.
3. **Lets him tag a Daily Log bullet `#PL`**, which files it in the Parking Lot without him
   leaving the page he's already on.

That is all. Nothing here touches job state, the calendar, or scheduling.

Workshop Projects (`#PRJ`) is **deliberately out of scope** — see "Not in scope" below.

## Why now

Corrected on 2026-07-31 (commit `f82efce`): the Sunday board-meeting workflow carried a
comment calling the in-app Parking Lot "an unrelated product-idea feature". It is not — it is
Trevor's own input channel into the meeting. Because of that comment the meeting never read
it, and 8 items sat there unread from June 2026, including one titled *"Sunday board meeting
with Claude + agents"*.

The comment is fixed. The split is not. Until it is, every meeting has to remember to read
two places, and step 3 of this brief would be pouring more traffic into a broken bucket.

## What already exists — verified against the code 2026-08-01, not from memory

- `src/components/ParkingLotPage.jsx` (288 lines) — the page. Loads from Supabase, falls back
  to a hardcoded `INITIAL_ITEMS` seed of the same 8 items when Supabase isn't configured.
- `src/utils/supabase.js:636-696` — `loadParkingLot`, `saveParkingLot`, `clearParkingLot`
  (module-private), `subscribeToParkingLot`. The section header reads
  `// ============ PARKING LOT (other features, if needed) ============` — stale, same wrong
  framing as the workflow comment. Fix it in passing.
- `admin/context/parking-lot.md` — the markdown list. Read by the Sunday workflow at steps 8-9.
  Now carries a warning header pointing at the other list.
- `admin/context/backups/parking_lot-2026-07-31.json` — a backup of all 8 rows, taken because
  of the bug in item 1. This is the only copy that has ever existed.
- `src/hooks/useDailyLog.js` (758 lines) — the Daily Log. Bullets are
  `{ id, text, jobId, meta, done, createdAt, migration, checklist? }`. `addBullet(text, jobId,
  meta)` is the entry point. Writes are per-date-key upserts through `saveDailyLogDays`, gated
  behind `readyRef` — a deliberate guard against the 2026-07-05 whole-store overwrite. Do not
  weaken it.
- `src/components/DailyLogPage.jsx` (1335 lines) — renders `todayLog` only. **There is no way
  to view a past day.** Closed days are locked and kept in full, never deleted, just never
  shown.

## The bug — item 1

**This is a live bug with a live trigger, not a hypothetical.** Two halves, and the fix must
cover both — fixing only the first leaves the data loss in place.

**Half one — the writer.** `saveParkingLot()` at `src/utils/supabase.js:650` calls
`clearParkingLot()` — a `.delete().neq('id','')` across the whole table — then re-inserts the
array it was handed. Its own comment calls this "simple approach; could be optimized later".
This is the exact pattern that wiped `completed_jobs`.

**Half two — the caller that fires it.** `src/components/ParkingLotPage.jsx:51-56`:

```js
loadParkingLot().then(data => {
  if (data.length === 0) {
    // First load — seed with existing parking lot items
    saveParkingLot(INITIAL_ITEMS);
```

`loadParkingLot()` **returns `[]` on any read error** (`src/utils/supabase.js:636-648` — the
catch logs and returns `[]`). So a failed read is indistinguishable from an empty table, and
the page responds by writing the hardcoded June seed over whatever is really there. A network
blip on page load silently reverts the Parking Lot to its June 2026 state. Verified against
the code 2026-08-01.

Note the not-configured path (line 46-50) returns early and does **not** write — it only shows
the seed locally. That one is harmless; line 55 is the dangerous one.

**Fix, both halves:**

1. Replace the clear-and-reinsert with a per-item diff — upsert changed/new rows, delete only
   rows whose ids have genuinely gone. `useDailyLog.js`'s `performSave()` already does exactly
   this for `deferredItems` (`persistedDeferredRef` baseline, compute `upserts` and
   `removeIds`). Follow that pattern rather than inventing a second one. `clearParkingLot()`
   should end up with no callers and be deleted.
2. Make `loadParkingLot()` distinguish "read failed" from "table is empty" — return `null` on
   error, as `loadDailyLogs()` already does for the same reason (`useDailyLog.js` treats
   `null` as "never flip ready / never blank state"). The page must not seed, and must not
   write at all, on a failed read.
3. The seed itself only belongs on a genuinely empty table. Given the table has 8 real rows
   and always will from here, the safest outcome is deleting `INITIAL_ITEMS` and the seeding
   branch entirely — the builder should propose this to Council rather than decide alone.

## The merge — item 2

**Decided by Trevor 2026-08-01. Not Council's to reopen.** The Supabase table is the single
store. `admin/context/parking-lot.md` is **deleted, not mirrored** — a generated mirror is a
second copy that drifts, which is the exact problem this brief exists to fix. The Sunday
workflow reads the table directly. End state: one list, one read, one write path.

The two lists have different shapes, so the migration is a one-off script, not app code:

- Supabase rows: `{ id, content (a JSON string), created_at, updated_at }`, where `content`
  parses to `{ id, date, title, details, status }`.
- Markdown: free-form headed sections, no ids, no status field.

Delete the markdown file only after its items are in the table and readable in the app. Git
keeps it (`git log -- admin/context/parking-lot.md`), so nothing is lost — and leaving it in
place is how the next session ends up reading the wrong list again.

## The `#PL` tag — item 3

Behaviour, settled with Trevor 2026-08-01:

- Typing a bullet containing `#PL` files a Parking Lot item and **leaves the bullet in the
  day**, with a small marker showing it landed.
- It is **not** removed from the log, and **not** given any special treatment at close-day.
  It carries, drops or completes exactly like any other bullet.
- Rationale, in Trevor's words: closing the day clears the board anyway, so the bullet's
  natural lifecycle already handles it. No extra decision at close-day, no nightly nagging.
- The Parking Lot item's title is the bullet text with the tag stripped. Details start empty —
  he fleshes them out on the Parking Lot page or at the meeting.
- Tag matching is case-insensitive and must not fire on `#PLAN`, `#PLASTIC`, etc. Require a
  word boundary.

## Not in scope — say no to these

- **Workshop Projects / `#PRJ`.** Trevor raised it in the same conversation and it is a real
  gap, but it needs its own brief. Two reasons: (a) `ProjectsPage.jsx` already exists and is a
  jobs-by-action age chart, not a project tracker — the name is taken and the collision will
  confuse; (b) nobody has yet defined what a workshop project *is*, what makes one done, or
  what the list should show. Building storage before that conversation is guesswork.
- **A Daily Log history view.** Real gap (closed days are saved but unviewable, and "online
  session journal" is `pk-001` on Trevor's own list) — but it is a separate build.
- **Any change to close-day, carry-forward, or the Catch-Up Interview.** Item 3 is explicitly
  designed to avoid touching them.
- **Any change to `scheduledSlots`, `calendarSlot`, the `jobs[]` shape, or
  `useGoogleCalendar.js`.** Nothing here needs them.

## Blast radius

`src/utils/supabase.js` is on the protocol's blast-radius list, so this runs the **full
agent-team protocol**: brief → council → `ggnz-builder` → `ggnz-verifier` → browser test →
merge. No solo build.

Items 1 and 2 touch the live persistence layer. Item 3 adds a call into `useDailyLog`'s
existing `addBullet` path.

## Verification checklist — for `ggnz-verifier`, not the builder

1. `saveParkingLot()` no longer deletes rows it was not asked to delete. Prove it: save a
   1-item array against a table holding 8 rows, confirm 8 rows remain.
2. `clearParkingLot()` has no remaining callers and is gone.
3. **A failed read never writes.** Simulate a `loadParkingLot()` error and confirm the app
   writes nothing — the 8 rows are untouched and the June seed is not re-applied. This is the
   live bug; a build that fixes only `saveParkingLot()` fails this item.
4. `loadParkingLot()` returns something distinguishable from an empty table on error (`null`,
   per `loadDailyLogs()`), and no caller treats `[]` as "first run, seed it".
5. All 8 backed-up items are present and readable in the app after the merge.
6. `admin/context/parking-lot.md` is **deleted**. A build that leaves it in place as a
   generated mirror does not pass — Trevor rejected mirroring.
7. The Sunday workflow reads the table. Confirm by reading
   `.claude/workflows/sunday-board-meeting.js`, not by assuming.
8. A bullet typed with `#PL` appears in the Parking Lot **and** stays in the day.
9. A bullet typed with `#PLAN` does **not** create a Parking Lot item.
10. Close-day on a day containing a `#PL` bullet behaves identically to one without.
11. `readyRef` write-gate in `useDailyLog.js` is intact and not weakened.
12. Existing tests still pass. Both halves of the wipe bug have their own tests — the diff
    logic in `saveParkingLot`, and the failed-read-writes-nothing path. This is the
    wipe-class bug; it does not ship untested.
