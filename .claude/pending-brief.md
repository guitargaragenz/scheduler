# GGNZ Pending Brief

_This file is written by the Mac session when a fix brief is ready for Trevor's approval._
_Open claude.ai/code on iPhone → select guitargaragenz/scheduler → read this file → reply "yp" to proceed or "no" to cancel._

---

## Status: AWAITING APPROVAL

**Issued:** 2026-07-01
**Expires:** 4 hours from issue if no reply

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

Reply "yp" to proceed or "no" to cancel.
