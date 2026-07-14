# Session refresh — fix Scheduler app bugs again

Continuing work in `/Users/admin/Library/Mobile Documents/com~apple~CloudDocs/Desktop/GGNZ SCHEDULER PROJECT` (GGNZ Scheduler). Goal of this session: fix bugs in the Scheduler app.

## Where things stand

Baseline is commit `76bdaf7` on `origin/main`, working tree clean. The last session shipped a real Daily Log data-loss fix + nested per-job checklist feature (merged `79a276f`), then found and cleaned a third round of "ghost scheduledSlots" (dead split-child IDs blocking real drag-drop placement) — that cleanup is done and verified (0 ghosts remain, `jobs[]` untouched).

Two live-data discrepancies were found but not yet resolved by Trevor:
- **#1704** had a real manual split (Wiring + 2 Setup sessions) that's gone from `jobs[]` — needs re-splitting.
- **#1621** shows scheduled on Google Calendar but has zero record in the app (no `gcalEventId`, `scheduled: false`) — likely created directly in GCal, not through the app.

All currently-open bugs/backlog (including both of the above, plus a scoped-and-ready brief for "edit a split from within the calendar") live in one place — read it fresh, don't rely on this summary:

## Next steps

1. Read `admin/context/parking-lot.md` — this is the live, categorized, open-items-only backlog. It already has everything: bugs, features, UX friction, and one fully-scoped ready-to-build brief.
2. Pick what to fix from there with Trevor, or ask what's bugging him most right now.
3. For anything non-trivial (multi-file, touches `scheduledSlots`/`calendarSlot`/`useGoogleCalendar.js`/`useFirebase.js`/`jobs[]` shape), use the full team protocol — see `project_agent_team` memory.

## Files to open (read these, don't re-derive)

- `admin/context/parking-lot.md` — canonical current bug/backlog list, grouped by category
- `admin/context/session-log.md` — narrative history of what's already been fixed, if context on a past fix is needed
- Claude memory `project_stable_tag` — current baseline, confirmed-working list, rollback commands
- Claude memory `project_agent_team` — build protocol (blast-radius trigger, brief format, rollback rules)
- Claude memory `feedback_no_sandbox_prod_firestore` — this app has one Firebase project, no test sandbox; read before running any live verification that writes data

(Root `CLAUDE.md` and the memory index load automatically — no need to open those yourself.)
