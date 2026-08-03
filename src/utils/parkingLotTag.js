// The `#PL` tag — Merge B of docs/briefs/one-parking-lot-fed-from-bujo.md.
//
// Trevor types an idea into the Daily Log with `#PL` on it and it gets filed
// into the Parking Lot without him leaving the page. The bullet STAYS in the
// day and behaves like any other bullet — carries, drops, completes normally.
//
// Council amendment F is binding and is the reason this file exists as a
// standalone unit: the parking-lot write must be fire-and-forget, called
// directly from addBullet and never from inside updateState / scheduleSave /
// performSave, and never gated behind readyRef. A parking-lot failure must not
// be able to block or corrupt the daily-log save that was hardened after the
// 2026-07-05 whole-store overwrite. Everything exported below is therefore
// written to swallow its own failures — fileBulletToParkingLot() never throws
// and never returns a rejected promise, whatever the writer does.

import {
  isSupabaseConfigured as defaultIsSupabaseConfigured,
  saveParkingLot as defaultSaveParkingLot,
} from './supabase.js';
import { localDateKey } from './calendar.js';

// Word boundary AFTER the tag is the whole point: `#PLAN` and `#PLASTIC` must
// not file anything. `\b` between `L` and `A` does not exist (both are word
// characters), so those cases simply do not match. `#PL`, `#pl`, `#PL.`,
// `#PL ` and `#PL` at end-of-string all do.
//
// Two separate literals rather than one shared regex: a /g/ regex carries
// lastIndex between calls, so sharing it between test() and replace() would
// make matching depend on call order.
const PARKING_LOT_TAG = /#PL\b/i;
const PARKING_LOT_TAG_ALL = /#PL\b/gi;

export function hasParkingLotTag(text) {
  if (typeof text !== 'string') return false;
  return PARKING_LOT_TAG.test(text);
}

// The Parking Lot item's title is the bullet text with the tag removed and
// whitespace tidied. The bullet itself keeps its text exactly as typed.
export function stripParkingLotTag(text) {
  if (typeof text !== 'string') return '';
  return text.replace(PARKING_LOT_TAG_ALL, ' ').replace(/\s+/g, ' ').trim();
}

// Same id scheme as ParkingLotPage.jsx uses for items added on the page, so
// items filed from the Daily Log are indistinguishable from hand-added ones.
export function newParkingLotId() {
  return 'pk-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// Matches serializeParkingLotItem()'s stored shape (src/utils/supabase.js).
// Details start empty — Trevor fleshes them out on the Parking Lot page or at
// the meeting.
export function buildParkingLotItemFromBullet(text, deps = {}) {
  const { dateKey = localDateKey(), makeId = newParkingLotId } = deps;
  return {
    id: makeId(),
    date: dateKey,
    title: stripParkingLotTag(text),
    details: '',
    status: 'open',
  };
}

// Fire-and-forget. Returns a promise purely so tests can await it; callers in
// the app deliberately do NOT await, and it is written so that awaiting it can
// never surface an error either.
//
// saveParkingLot([item]) with the default empty baseline deletes nothing and
// upserts exactly this one row — the baseline argument is intentionally
// omitted, not forgotten.
export function fileBulletToParkingLot(text, deps = {}) {
  const {
    save = defaultSaveParkingLot,
    isConfigured = defaultIsSupabaseConfigured,
    onError = e => console.error('Parking Lot filing failed (daily log unaffected):', e),
  } = deps;

  try {
    if (!isConfigured()) return Promise.resolve(null);
    const item = buildParkingLotItemFromBullet(text, deps);
    // An empty title would file a blank Parking Lot row — a bullet that is
    // nothing but the tag is not an idea.
    if (!item.title) return Promise.resolve(null);
    return Promise.resolve()
      .then(() => save([item]))
      .then(() => item)
      .catch(e => {
        onError(e);
        return null;
      });
  } catch (e) {
    // Covers a synchronous throw from isConfigured() or from building the item.
    onError(e);
    return Promise.resolve(null);
  }
}
