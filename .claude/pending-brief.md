# GGNZ Pending Brief

_This file is written by the Mac session when a fix brief is ready for Trevor's approval._
_Open claude.ai/code on iPhone → select guitargaragenz/scheduler → read this file → reply "yp" to proceed or "no" to cancel._

---

## Status: AWAITING APPROVAL

**Issued:** 2026-07-04
**Expires:** 4 hours from issue if no reply
**Supersedes:** the 2026-07-01 ghost-slot-cleanup brief below this line (expired, unresolved, no longer current — left for reference only)

## Root cause / goal
`scripts/sheet_to_csv.command` (the automated 2-minute Google Sheet poller / PDF-drop pipeline) rebuilds the entire `jobs` array from the CSV on every run and hardcodes `'scheduled': False` for every job ([sheet_to_csv.command:337](scripts/sheet_to_csv.command:337)), while omitting `calendarSlot`, `gcalEventId`, `gcalEventIds`, `pomoLog`, and `done` entirely from the per-job object it builds. It then PATCHes this straight to Firestore's `ggnz/schedule` doc with no `updateMask` ([sheet_to_csv.command:233-236](scripts/sheet_to_csv.command:233)) — per Firestore's REST API, a PATCH with no update mask replaces the *whole document*, so every automated sync silently wipes scheduling/GCal-link/pomo-log data for every job, not just the two Trevor noticed (#1520 Ampeg SVT 6 Pro, #1582 Roland Juno 106).

Confirmed live against production Firestore (read-only check, no writes): both jobs currently show `scheduled: false`, no `calendarSlot`, and zero entries in `scheduledSlots`. Checked `ggnz/conflictLog` — zero events for either job, which rules out the GCal-poll bump-conflict mechanism as the cause. This is an ongoing, silent, recurring bug — every automated sync (every 2 minutes while the watcher runs) can wipe any job scheduled since the last successful sync.

Goal: stop the automated sync from destroying live scheduling/GCal/pomo data on every run.

## Fix scope (exactly what will change, nothing else)
In `scripts/sheet_to_csv.command`, when building each job record (around line 316-338):
1. Extend the existing Firestore fetch (currently only pulling `scheduledSlots`, lines 346-366) to also read the existing `jobs` array from that same response.
2. For each new job row, if a job with the same ID already exists in the fetched Firestore data, preserve its `scheduled`, `calendarSlot`, `gcalEventId`, `gcalEventIds`, `pomoLog`, and `done` fields onto the freshly-parsed CSV record instead of defaulting/omitting them.
3. No changes to the React app itself (`src/`) — this fix is entirely inside the Python script.
4. No changes to `scheduledSlots` handling — that part already works correctly and is untouched.

## Blast radius
Not one of the 5 flagged React files/state items by name, but writes directly into the same `scheduledSlots` / `jobs[]` data those rules exist to protect, via a path outside the app's own drift-safety checks (the app's in-app CSV upload button already has protections here — this automated script bypasses them entirely).

**Council required: yes** — active production data loss, not a "small enough to skip" case.

## Immediate mitigation (do this now, before any code fix)
Pause `start_watcher.command` on Micky so the 2-minute poller stops overwriting Firestore while the fix is built and verified. Re-enable only after the fix is confirmed working.

## Rollback
This is a script fix, not an app deploy — nothing on Vercel to roll back. If the fixed script misbehaves:
```
git checkout pre-csv-sync-fix-stable -- scripts/sheet_to_csv.command
```
(tag `pre-csv-sync-fix-stable` set and pushed at commit `6e174a0`, 2026-07-04, before this fix)

## Test plan / checklist
- [ ] Manually run the fixed script once against a job that's currently scheduled — confirm `scheduled`, `calendarSlot`, `gcalEventId`, `pomoLog` all survive in Firestore afterward
- [ ] Run it again against a job that is NOT scheduled — confirm it still correctly stays unscheduled (no false-positive preservation)
- [ ] Confirm a genuinely new job (not previously in Firestore) still gets created correctly with `scheduled: false` as the sane default
- [ ] Hard refresh the app, confirm no regressions in job list / calendar rendering
- [ ] Re-enable the watcher, observe one full auto-sync cycle, re-check Firestore that scheduled jobs are untouched

Reply "yp" to proceed or "no" to cancel.

---

# [SUPERSEDED — 2026-07-01 ghost-slot-cleanup brief, expired/unresolved]

## Root cause / goal
Live inspection of production Firebase data found `scheduledSlots` currently contains entries pointing at job IDs that no longer exist in the `jobs` array — e.g. `1520_Electronics_0` through `_6` (6 slot entries, job #1520's old manual splits) have no matching job record anymore. These are "ghost slots" — they show as busy on the calendar but render nothing, from a manual split that vanished at some point before today's CSV-drop fix existed. This is very likely most of what the "34 scheduled slots would be wiped" CSV safety-guard warning has been detecting — not new damage, old orphaned entries.

Goal: one-time cleanup — remove `scheduledSlots` entries whose job ID has no matching record in the current `jobs` array. Purely additive safety: only removes slots that already point at nothing.

## Fix scope (exactly what will change, nothing else) — REVISED after council review
Both independent council reviewers caught the same critical flaw in the original plan: auto-split children (e.g. `1520-LU`) are **never stored in raw Firestore** — they're regenerated fresh every load via `createSubtasks()`/`withSplitsExpanded()`. Checking scheduledSlots against the *raw* stored `jobs` array would have wrongly flagged every currently-valid auto-split job's slot as "orphaned" and deleted real, working schedule data. Revised plan:

1. **Report-only pass first.** Compute the valid-ID set using the app's actual expansion logic (same as `withSplitsExpanded` in `useFirebase.js` — parent + auto-split IDs + stored manual-split IDs), not the raw array. List every `scheduledSlots` key that has no match in that expanded set, with its date/time + dead job ID. Show this list to Trevor for visual confirmation against the calendar. **No deletion in this step.**
2. **Snapshot backup** — save the full current `scheduledSlots` locally before any write, as the real undo path (this is a data change, not a code change — no git rollback applies to it).
3. **Only after Trevor confirms the reported list** — write `scheduledSlots` with just those confirmed keys removed.
4. **Durable log, not just a toast** — record the removed `{key, deadJobId}` pairs via `appendConflictLog()` (existing pattern in `firebase.js`), so it's auditable later, not just a transient message.
5. **Timing** — run the write with no other device actively editing the schedule, to avoid racing the 1500ms debounced autosave in `useFirebase.js`. Re-verify `scheduledSlots` immediately after writing.
6. No changes to any component, hook, or the CSV upload logic itself (today's fix in `fix/csv-manual-split-drift` is untouched by this).

## Blast radius
- `scheduledSlots` — YES (this is the entire point of the cleanup)
- `calendarSlot` — NO (not touched — this only touches the slot-key map, not individual job records)
- `useGoogleCalendar.js` — NO
- `useFirebase.js` — NO (uses existing `loadSchedule`/`saveSchedule`, no logic changes)
- `jobs[]` shape/identity — NO (jobs array itself is not modified, only read to check which IDs are valid)

**Council required: YES** (blast radius flagged — mandatory, no skip)

## Rollback
```
git reset --hard pre-ghost-slot-cleanup-stable && git push origin main --force
```
(tag set at commit `main`/`70def16`, 2026-07-01, before this cleanup started — note: this is a Firebase *data* cleanup, not primarily a code change, so the real rollback is restoring the previous `scheduledSlots` snapshot in Firebase, which will be captured and saved before any write)

## Test plan / checklist
- [ ] Snapshot current `scheduledSlots` from Firebase and save it locally before making any change (so exact pre-cleanup state is recoverable)
- [ ] Confirm every removed key genuinely has no matching job in the current `jobs` array (no false positives)
- [ ] Confirm every slot for a job that DOES still exist is left untouched
- [ ] After cleanup, re-check the CSV drift count — expect it to drop substantially
- [ ] Hard refresh, confirm calendar renders correctly with no missing real jobs
