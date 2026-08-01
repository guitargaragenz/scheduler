doc_status: live

# Brief — One Parking Lot, fed from the Daily Log

**Status:** ✅ APPROVED by Trevor 2026-08-01 ("yes perfect"), including the recommendation to
retire the markdown list. Next step: Council (protocol step 2). Build waits until
`build-parts-to-order-page` has landed and the pending-brief slot is free.
**Date:** 2026-08-01.
**Branch:** to be cut from `main` once `build-parts-to-order-page` lands.
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

`saveParkingLot()` at `src/utils/supabase.js:650` calls `clearParkingLot()` — a
`.delete().neq('id','')` across the whole table — and then re-inserts the array it was handed.
Its own comment calls this "simple approach; could be optimized later".

This is the exact pattern that wiped `completed_jobs`. If the caller ever passes a short or
empty array — a failed load, a race between two devices, a mid-write refresh — the real rows
are gone and the backup above is the only copy.

**Fix:** replace with a per-item diff — upsert changed/new rows, delete only rows whose ids
have genuinely gone. `useDailyLog.js`'s `performSave()` already does exactly this for
`deferredItems` (`persistedDeferredRef` baseline, compute `upserts` and `removeIds`). Follow
that pattern rather than inventing a second one. `clearParkingLot()` should end up with no
callers and be deleted.

## The merge — item 2

**Decision required from Trevor before council** (see "Open question" below): the two lists
have different shapes.

- Supabase rows: `{ id, content (a JSON string), created_at, updated_at }`, where `content`
  parses to `{ id, date, title, details, status }`.
- Markdown: free-form headed sections, no ids, no status field.

Proposed: the **Supabase table is the single store**; the markdown file becomes a generated
read-only mirror, or is retired entirely and the Sunday workflow reads the table directly.
Migrating markdown items in is a one-off script, not app code.

Whichever way it goes, the end state is **one list, one read, one write path** — that is the
non-negotiable part.

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
3. All 8 backed-up items are present and readable in the app after the merge.
4. The markdown list and the table no longer disagree — one is authoritative, the other is
   generated or gone.
5. The Sunday workflow reads the merged list. Confirm by reading
   `.claude/workflows/sunday-board-meeting.js`, not by assuming.
6. A bullet typed with `#PL` appears in the Parking Lot **and** stays in the day.
7. A bullet typed with `#PLAN` does **not** create a Parking Lot item.
8. Close-day on a day containing a `#PL` bullet behaves identically to one without.
9. `readyRef` write-gate in `useDailyLog.js` is intact and not weakened.
10. Existing tests still pass. `saveParkingLot`'s new diff logic has its own test — this is
    the wipe-class bug, it does not ship untested.

## Settled — was the open question, answered by Trevor 2026-08-01

**The markdown Parking Lot is retired, not mirrored.** The Supabase table is the single store,
and the Sunday workflow reads it directly. A mirror would be a second copy that drifts, which
is the exact problem this brief exists to fix.

`admin/context/parking-lot.md` is deleted as part of item 2, after its contents migrate in.
Git keeps it (`git log -- admin/context/parking-lot.md`), so nothing is lost — and leaving it
in place is how the next session ends up reading the wrong list again.
