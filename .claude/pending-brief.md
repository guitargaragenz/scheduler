doc_status: closed

# Pending Brief — One Parking Lot, fed from the Daily Log (Merge A)

**✅ SHIPPED 2026-08-01 at `05b11cc`.** Full protocol: brief approved → two council reviewers
→ `ggnz-builder` on `staging/one-parking-lot` → `ggnz-verifier` (344 tests across 22 files,
run independently, not taken on trust) → browser test on live data → merged on Trevor's "yp".

Browser test confirmed on the real table: add, edit and delete each touched only their own
row and survived a reload; all 8 original June items intact throughout; no console errors.
The list reads 18 open / 5 done in one place.

Everything below is the record of what was agreed, not a task list.

## What shipped

1. `saveParkingLot()` no longer deletes the whole table before re-inserting it. It diffs
   per item — upsert when the id is new **or its content changed** (the edit case council
   flagged; the `deferredItems` pattern the brief pointed at would have dropped edits),
   delete only ids that have genuinely gone. `clearParkingLot()` is deleted, no callers left.
2. `loadParkingLot()` returns `null` on a read error instead of `[]`, so a network blip is no
   longer indistinguishable from an empty table. The page treats `null` as "touch nothing,
   write nothing". `INITIAL_ITEMS` and the seeding branch are deleted outright — the JSON
   backup is the recovery path, not a stale June snapshot.
3. The two Parking Lots are one. 14 markdown items migrated in via a one-off script,
   `admin/context/parking-lot.md` deleted in a separate commit after the items were confirmed
   rendering. `scripts/board_meeting_export.mjs` now pulls the table into its JSON — without
   that change, deleting the markdown would have left the Sunday meeting with no parking lot
   at all, which the brief did not spot and council did.
4. Realtime echoes no longer clobber in-progress typing (`pendingSavesRef` in
   `ParkingLotPage.jsx`). Pre-existing bug, fixed while in there.

## Kept for three things

- **The wipe-class bug now has its own tests** — `src/utils/supabaseParkingLot.test.js`, 17 of
  them, including one that fails on sight if anyone reintroduces the delete-everything
  pattern, and one that proves an *edited* item is upserted.
- **`ParkingLotPage.jsx` still has no component test.** The two most safety-critical page-level
  behaviours — failed-read-writes-nothing, and the keep-local-while-saving guard — are verified
  by code reading only. A future regression there would not be caught automatically.
- **Trevor's call 2026-08-01:** two migrated items that described this very build came across
  ticked off rather than open. The migration script decides this itself
  (`scripts/migrate_parking_lot_markdown.mjs`, the `isAboutThisMerge` branch) — worth knowing
  if that script is ever re-run against other content.

## Not built — Merge B

Item 3, the `#PL` tag, is still open and still approved. See
[docs/briefs/one-parking-lot-fed-from-bujo.md](../docs/briefs/one-parking-lot-fed-from-bujo.md).
Council amendment F is binding: the parking-lot write must be fire-and-forget from `addBullet`,
never inside `updateState`/`performSave`/`readyRef`.
