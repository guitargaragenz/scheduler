# Session refresh — Continue with fixes for scheduler app

Continuing work in `/Users/admin/Library/Mobile Documents/com~apple~CloudDocs/Desktop/GGNZ SCHEDULER PROJECT` (GGNZ Scheduler). Goal of this session: continue with fixes for scheduler app.

## Where things stand

- **Full 5-agent audit + Phase 0 data-loss fixes shipped and live** — split re-save duplicating children, un-split being a no-op, CSV re-upload silently dropping manual splits, bench-keyword edit wiping all jobs. All fixed and merged.
- **Follow-up pass also shipped**: Daily Log's actual reported refresh bug (30s poll re-render + 3s echo guard), GCal events orphaned on split delete/collapse, bench-classification keywords unified between the app and the CSV pipeline (quick-win version, not the full migration). Ran the live production resync afterward — verified clean (6 predicted bench reclassifications landed correctly, zero jobs/slots lost).
- **#1586 split-editor bug found and fixed** — `initRows()` in both `JobDrawer.jsx` and `MobileJobSheet.jsx` only hydrated the split editor from existing children when `isSplit` was set, but that flag only exists on manual splits. Auto-split jobs showed a stale single pre-split row instead of the real cards. Fixed to match by `parentId` alone. Verified live against #1586's real data.
- **Sync-error niggle — partially fixed, NOT resolved.** Found and fixed a real race in `ensureCalendarApi()` (commit `0123f26`) that could silently fail the first job in a sync pass. Trevor confirmed afterward the transient "error then self-clears" symptom still happens. The race fix was real and worth keeping, but isn't the (or isn't the whole) cause of what Trevor's actually seeing. **This is the most concrete open thread** — see Next steps.
- **GCal ghost event blocks** (#1520/#1582/#1647/#1681/#1699/#1704) — Trevor manually cleaned these up in Google Calendar directly. Closed out, removed from parking lot.
- **Live-tested the Phase 2 "shared box" architectural risk** using a throwaway job (#99999). Trigger 1 (editing a bench keyword) passed cleanly — confirmed via direct Firestore read that all real jobs/slots survived untouched. Trigger 2 (CSV upload) was a flawed test on my part, not a new bug: I uploaded a CSV containing *only* the test job, and the app correctly replaced the entire `jobs[]` array with just that file's contents (its only safety guard protects the scheduled-slots mapping, not the job records themselves) — this briefly wiped all 51 real jobs from production Firestore. Caught within ~1 minute, fully restored from a pre-test snapshot, verified clean (51 real jobs, 31 scheduled slots matching Trevor's real count), orphaned Daily Log bullets also cleaned up. Confirmed back to normal by Trevor.
- **`/re-fresh` skill installed and confirmed working** in a fresh session (the "not showing in autocomplete" niggle was just mid-session-install lag, not a real bug — closed out).
- Parking lot and session log both fully updated and pushed to reflect all of the above.

## Next steps

1. **Diagnose the sync-error niggle live.** Open the app on Micky with browser DevTools console visible, confirm Google Calendar is connected, schedule 2-3 jobs if none are currently scheduled, click Sync, and capture whatever prints in the console the moment the sync pill shows an error. This is the missing piece — no live Google auth was available in past sessions to observe the actual error.
2. **Decide on Phase 2** (splitting job master data from live schedule state into separate Firestore docs) — flagged by Trevor on 2026-07-04 as priority-bumped due to breakage risk, still not started. Tonight's CSV-upload incident is a real-world demonstration of exactly the risk class Phase 2 would eliminate structurally. Needs its own dedicated session + council review per the project's blast-radius protocol before touching production data.
3. **Work through the rest of the open parking-lot bugs** — Pomodoro timer broken, Mark Done/Daily Log fix unverified, mobile app-hang not reproduced, #1520/#1582/#1704 need manual re-split + re-schedule, #1621 has no app record despite showing on GCal, deferred-checklist-invisible-in-desktop-JobShelf, sessionNote/session badge never live-tested.

## Files to open (read these, don't re-derive)

- `admin/context/parking-lot.md` — single source of truth for every open item, read fresh at session start
- `admin/context/session-log.md` — most recent entry (2026-07-08/09) covers the full audit, fixes, live resync, and the test incident in detail
- `src/hooks/useGoogleCalendar.js` — `ensureCalendarApi()` and `handleSync()`, where the sync-error fix landed and where the remaining diagnosis needs to happen
- `src/hooks/useJobs.js` — `handleCsvUpload()` (replace-semantics — see Avoid repeating) and `handleSaveDrawer()`
- `src/components/JobDrawer.jsx` / `src/components/MobileJobSheet.jsx` — `initRows()`, just fixed for the #1586 hydration bug, useful reference for the "match children by parentId, not isSplit" pattern

## Avoid repeating

- **Never upload a partial/subset CSV through the app's real "Upload CSV" control against production**, even for a "quick test." `handleCsvUpload` replaces the entire `jobs[]` array with exactly what's in the uploaded file — its only safety guard protects the scheduled-slots mapping, not the job records. A CSV missing existing jobs will wipe them. Always snapshot Firestore first before any live write test (see the `curl` GET pattern used throughout tonight's session), and either use a full representative CSV or test against a non-production target.
- **Don't conflate "total entries in Firestore's `jobs[]` array" with "number of real jobs" when talking to Trevor.** The array includes every split child as its own entry (tonight: 100 total = 52 top-level + 48 children, of which 51 top-level were real and 1 was the test job). Always say "top-level jobs" specifically, or filter on `!parentId` before reporting a count.
