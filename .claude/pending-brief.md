# Pending Brief C — Finish the migration: move the Daily Log (bujo) off Firestore onto Supabase

**Status:** APPROVED ("yp" 2026-07-24) — Council in progress
**Date:** 2026-07-24
**Repo state:** `main` @ `b61c509` (Brief B — poller-save + phantom-bullet — SHIPPED & merged)
**Root-cause fix, not a patch.** Trevor's call (2026-07-24): retire Firestore, don't band-aid it.

---

## Plain-English summary

The whole app was meant to be on Supabase. Jobs, calendar slots, parking lot, revenue — all
moved. **One thing never got migrated: the Daily Log (the bujo).** It's the last piece still living
on the old Firestore database.

That leftover split is exactly what caused the bug you found: when you drop a job on today, the
**calendar slot** saves to Supabase and sticks, but the **bujo line** saves to Firestore on a
separate path that isn't landing — so a refresh keeps the calendar job but loses the bujo line.

Patching the Firestore write would fix the symptom while keeping a database we're trying to delete.
Instead: **move the Daily Log onto Supabase like everything else, carry over the existing history,
and retire Firestore entirely.** Kills this whole class of "one DB saved, the other didn't" bug.

---

## Scope — locked

**In scope:**

1. **New Supabase home for the Daily Log** — a table (or tables) holding what Firestore holds today:
   per-day logs (bullets + closedAt + locked), keyed by local date, plus the global `deferredItems`
   list. Model decided WITH the council (see decision below).
2. **`load / save / subscribe` functions in `supabase.js`** matching the existing house pattern
   (`loadParkingLot`/`saveParkingLot`/`subscribeToParkingLot` etc.), BUT per-day-key upserts — NOT
   the parking-lot "clear-and-re-insert," which would risk wiping log history.
3. **Rewire `useDailyLog.js`** to read/write Supabase instead of Firestore, preserving every safety
   property it currently has: the `readyRef` load-gate (no writing before first load — the 2026-07-05
   data-loss guard), per-date-key merge writes (two devices touching different days don't clobber),
   the eager flush on tab-hide/refresh, and `deferredItems` written only when actually changed.
4. **One-time backfill** of the existing Firestore `ggnz/dailyLogs` document (all historical days +
   deferredItems — the "16 unfinished days" and everything before) into the new Supabase table.
   Supervised, verified count-match before and after.
5. **Retire Firestore** — once the Daily Log is confirmed on Supabase and history matches, remove the
   Firebase/Firestore code path (`firebase.js`, the imports in `useDailyLog.js`). Confirm nothing else
   imports it (grep already shows `useDailyLog.js` is the ONLY remaining Firestore consumer).

**Out of scope:** any change to bujo *behaviour/UI* (bullets, checklists, catch-up interview,
carry-forward logic all stay exactly as-is — this is a storage swap, not a redesign). No touching the
already-migrated stores. No Brief B code.

---

## What the code actually does today

**Firestore, one document: `ggnz/dailyLogs`** (`useDailyLog.js:31`), shape:
```
{ logs: { "2026-07-24": { bullets: [...], closedAt, locked }, ... }, deferredItems: [...] }
```
- **Read:** `onSnapshot(DAILY_LOGS_DOC())` real-time listener (`:137`), ignores own pending writes.
- **Write:** debounced 300ms `performSave()` (`:157`) → `setDoc(..., patch, { merge: true })` with a
  **per-date-key** `logs` patch + `deferredItems` only when touched. Merge-safe by design.
- **Guards:** `readyRef` (no write before first load), eager flush on `visibilitychange`/`pagehide`.
- Gated by `if (!isSupabaseConfigured()) return;` — so it runs Firestore *even in Supabase mode*.

The ONLY remaining Firestore imports in the whole app are `firebase.js` (the plumbing) and
`useDailyLog.js` (the one consumer). Everything else is Supabase.

---

## The real design decisions (for the Council)

1. **Table shape.** Two candidates:
   - **(A) One row per day** — `daily_logs(date_key PK, bullets JSONB, closed_at, locked, updated_at)`
     + a separate singleton/table for `deferredItems`. Maps cleanly onto the existing per-date-key
     merge writes and keeps multi-device safety. Recommended — mirrors how the current code already
     thinks.
   - **(B) One JSONB blob row** mirroring the Firestore document exactly (one row holding the whole
     `{logs, deferredItems}`). Least code change, but re-introduces whole-document writes — the exact
     clobber risk the per-key merge was built to avoid. Not recommended.
   Council confirms A vs B and the exact columns/keys before the builder commits.

2. **Realtime vs echo.** The Supabase subscribe pattern here re-loads the whole table on any change
   (see `subscribeToParkingLot`). Council should confirm this won't fight the local optimistic state /
   cause a save-echo loop for the Daily Log the way the handoff flagged for `scheduled_slots`.

3. **Backfill mechanics.** How the one-time Firestore→Supabase copy runs (a throwaway script vs a
   one-shot in-app path), and how we prove no day is dropped (row-count + spot-check specific dates).

## Risks to watch
- **This is real historical data.** Months of daily logs live in that Firestore doc. Backfill must be
  verified count-matched; Firestore code is not deleted until Supabase is confirmed to hold everything.
- One production Supabase DB, no sandbox — every write is real (per handoff). Backfill needs a stated
  recovery plan (Firestore doc stays untouched as the fallback copy until sign-off).
- Must not regress the 2026-07-05 data-loss guards (load-gate, no blind whole-doc writes).

---

## Method — agent-team protocol

- **Council** — two independent agents. Primary questions: table shape (A vs B), echo/realtime safety,
  and backfill+verification approach.
- **Builder** — staging branch, supervised. Adds the Supabase table + functions, rewires
  `useDailyLog.js`, writes the backfill, does NOT delete Firestore until history is verified.
- **Independent verifier** — separate agent: confirms a today-drop bujo line now survives a refresh,
  historical days still load, multi-device per-key writes don't clobber, and the load-gate still holds.
- **Live test** — Trevor at the keyboard: drop a job on today → refresh → bujo line stays. Open an old
  day → history intact. Then, only after that passes, Firestore removal.
- **Merge** — Trevor's "yp".

---

## Approve?

Reply **"yp"** to approve this scope. First step after approval is the Council on the table-shape /
backfill questions. Nothing built or written before you say so.
