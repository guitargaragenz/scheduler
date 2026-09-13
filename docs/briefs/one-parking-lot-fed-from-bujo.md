doc_status: closed

> **Finished 2026-08-03. Merge A shipped at `05b11cc`, Merge B at `dc86976`.** Nothing in this
> file is work any more. It is kept for the reasoning, not the task list.
>
> **Merge B — the `#PL` tag — as built:** a Daily Log bullet containing `#PL` files a Parking
> Lot item and stays in the day, marked with a small `⇢ PL` badge. `#PLAN` and `#PLASTIC` do
> not fire; `#pl` does. Close-day is untouched. The matcher, title-stripper and write live in
> `src/utils/parkingLotTag.js`; `addBullet` (`useDailyLog.js`) calls it un-awaited, outside
> `updateState`. Amendment F is enforced by four tests that parse the source and fail if the
> call is ever moved into the save path — that guard is the part worth knowing about.
> It writes one item with no baseline, so `saveParkingLot` can only add a row, never delete
> one. 427 tests pass. Verified by `ggnz-verifier`, then live: Trevor's `#pl` bullet appeared
> in the Parking Lot while `#PLAN` and `#plastic` filed nothing.
>
> Left undone, deliberately: `ParkingLotPage.jsx` and `parkingLotTag.js` each have their own
> copy of the `pk-` id generator. Tidy-up, not a bug.

> **Merge A shipped 2026-08-01 at `05b11cc`.** Items 1 and 2 are done — the wipe is fixed,
> the two lists are one, `admin/context/parking-lot.md` is deleted, and the Sunday export
> reads the table. Full protocol run: two council reviewers, `ggnz-builder` on
> `staging/one-parking-lot`, `ggnz-verifier` (344 tests, run independently), browser test on
> live data (add / edit / delete each touched only their own row, all 8 original items intact).
>
> **This brief stays `live` for Merge B only — item 3, the `#PL` tag.** Nothing else in it is
> work. Merge B is deliberately held until Merge A has had a real day of use, so a bad `#PL`
> can be reverted without re-opening the wipe fix. It resumes at protocol step 3 (builder);
> council already reviewed it — see amendment F, which is binding: the parking-lot write must
> be fire-and-forget, outside `updateState`/`performSave`/`readyRef`.
>
> Trevor's call 2026-08-01: the two migrated items describing this build stay ticked off.

# Brief — One Parking Lot, fed from the Daily Log

**Status:** ✅ APPROVED by Trevor 2026-08-01 ("yes perfect"), including the recommendation to
retire the markdown list. **Council done 2026-08-01 — both reviewers "ship with changes"; their
amendments are in the "Council amendments" section below and override the body where they
disagree.** Next step: builder, Merge A only (protocol step 3). Parts to Order round 2 shipped
at `a702e6b`, so nothing is queued ahead.
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

## Council amendments — 2026-08-01, two independent reviewers, both verdicts "ship with changes"

These override the corresponding paragraphs above where they disagree.

**A. Two merges, not one.** Merge A = items 1 + 2 (wipe fix, migration, markdown deleted).
Merge B = item 3 (`#PL`), cut only after A has been live for a real day. Reason: if `#PL` has a
bug and the whole thing is reverted, the revert re-opens the live wipe bug. Nothing is gained by
shipping them together.

**B. Order inside Merge A is fixed, and it is not the brief's order.**
1. `loadParkingLot()` returns `null` on error, and `ParkingLotPage.jsx:52-61` treats `null` as
   "touch nothing". Cheapest and purely defensive — it goes first.
2. Then `saveParkingLot()` → per-item diff, `clearParkingLot()` deleted. Not before step 1,
   because until step 1 lands, testing step 2 can still trigger the seed overwrite.
3. Then the markdown migration. One-way door; run it against a table already proven safe to
   write to. **Run the script and confirm the items render in the app before deleting
   `admin/context/parking-lot.md`** — separate step, not the same commit.
4. `INITIAL_ITEMS` and the seeding branch deleted last. **Council recommends deleting them —
   both reviewers.** The JSON backup is the recovery path; a stale June seed is a worse one.

**C. The diff must handle edits, not just adds and removes.** `performSave()`'s `deferredItems`
logic (`useDailyLog.js:213-225`) computes upserts as "id not already persisted". Ported
literally, an edited parking lot item — `updateTitle`/`updateDetails`/`toggleStatus` at
`ParkingLotPage.jsx:74-84` — would never be written. The rule is: upsert when the id is new
**or** its `content` has changed.

**D. Check what is actually in the `content` column before writing the diff.**
`supabase.js:656` does `content: item.content || item`, and the page never sets `item.content`
— so the real stored shape may not be the JSON string the brief describes. Read a live row
first.

**E. The Sunday meeting change is bigger than the brief implies — verified 2026-08-01.**
Nothing anywhere reads the `parking_lot` table for the meeting. `board_meeting_export.mjs:29-33`
explicitly dropped `parkingLotItems`, and `sunday-board-meeting.js:14-36` is comment text
telling the live chat to read the markdown file. So deleting the markdown file with no other
change leaves the meeting with **no parking lot at all**. Both must change:
- `scripts/board_meeting_export.mjs` — pull the `parking_lot` table and return it in its JSON.
- `.claude/workflows/sunday-board-meeting.js:14-38` — rewrite the comment block; the
  two-parking-lots explanation is history once this ships.

**F. `#PL` must be fire-and-forget, outside the Daily Log's save path.** Trigger it from
`addBullet` (`useDailyLog.js:269-296`) but call the parking-lot write directly — never inside
`updateState`, `scheduleSave` or `performSave`, and never behind `readyRef`. Two reasons: a
parking-lot failure must not be able to block or corrupt the daily-log save that was hardened
after the 2026-07-05 overwrite, and a write inside the state updater can double-file when React
re-runs it. Hook it in `addBullet` only — not `upsertScheduledBullet`.

**G. Realtime can clobber typing — pre-existing, fix it while in here.**
`subscribeToParkingLot` (`supabase.js:680-699`) reloads on every change and
`ParkingLotPage.jsx:62` does a raw `setItems(data)`. An echo landing mid-edit overwrites what
Trevor is typing. There is no "keep local while a save is pending" guard like `useDailyLog.js`
has (`touchedLogKeysRef`, `applyServer`, lines 137-156). Add one, or ignore echoes during an
in-flight save.

**H. RLS — checked, no action.** `docs/supabase-schema.sql:61-66` gives `parking_lot` no RLS,
matching every table except `parts_to_order`. This is deliberate and correct here.

**Checklist corrections.** Item 3 means a unit test mocking the client, not manual throttling —
it must be automatable. Item 5 must also count the **migrated markdown items**, not just the 8
existing rows, or the migration can lose content and still pass. Item 7 must read
`scripts/board_meeting_export.mjs` as well; the workflow file alone cannot prove it.

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
