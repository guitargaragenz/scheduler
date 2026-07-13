# Session refresh — Build three tracking fixes (revenue, carry-forward, bump reasons)

Continuing work in `/Users/admin/Library/Mobile Documents/com~apple~CloudDocs/Desktop/GGNZ SCHEDULER PROJECT`
(GGNZ Scheduler, React/Vite + Firebase). Goal of this session: build the three fixes planned last session —
make the revenue number in the header actually work, make unfinished daily log items carry over to the next
day automatically, and add a quick popup asking why a job got moved when it's dragged to a different day.

## Where things stand

A full plan was already researched, designed, and approved-in-substance by Trevor last session (approval
just wasn't finalized via ExitPlanMode because he wanted to hand off to a fresh session first — that's this
one). The plan file is final; re-run through the normal brief → "yp" → build → verify → merge gate cycle from
this repo's agent-team protocol (in memory, `project_agent_team`) rather than re-designing from scratch.

**The three problems, in one line each:**
1. Revenue pill in the header reads $0 because it only updates when a job is marked done *inside the app*,
   but Trevor actually finishes/invoices jobs in Multitrack — the in-app step never fires.
2. Daily Log unresolved items don't carry forward — the migration logic exists but only runs if Trevor clicks
   a small, easy-to-miss "Close day" button he usually doesn't.
3. No reason gets captured when a scheduled job doesn't get finished and gets bumped to another day.

**Key decisions already locked in (don't re-litigate):**
- Revenue banner needs exactly two outcomes — "Done + invoiced" (amount input) or "Cancelled" (free-text
  note) — not three. Postponed jobs never actually disappear from the CSV in Trevor's real workflow (they
  go to Hold status and keep reappearing), so no separate Postponed handling is needed.
- Daily Log auto-carry pulls from the single most recent unresolved-and-unlocked prior day, silently, no
  button. If MORE than one stale day is found, don't dump everything — trigger a "Catch-Up Interview"
  instead, modeled on the existing Sunday board-meeting interview pattern (speak-up/ask/skip).
- Bump-reason prompt: presets (Interrupted / Ran out of time / Waiting on parts / Other-with-notepad),
  dismissible/skippable (never a hard block), triggers on manual day-to-day moves AND on Problem 2's
  auto-carry (inline, next to the "carried from" badge, no separate modal there).
- Confirmed via code check: desktop drag-and-drop and mobile's "Place on Calendar" already funnel through
  the exact same function (`handleRegularDrop` in `useScheduler.js`) — hooking the bump-reason logic there
  covers both platforms with one change, no separate mobile build needed.
- Dragging a job back to the sidebar (fully unscheduling) does NOT get a reason prompt — Trevor explicitly
  called this "unwanted noise."
- Build order: Problem 1 (fully independent) → Problem 2 (must land and be stable before Problem 3, since
  Problem 3's auto-carry trigger depends on Problem 2's `autoCarryForward()`/badge existing) → Problem 3.
  Three separate PRs, not one mega-PR.

## Next steps
1. Read the full plan file (below) — it has the complete design per problem, exact functions/files to touch,
   and reuse patterns to follow (don't invent new patterns where an existing one already fits).
2. Confirm the plan is still current with Trevor (one quick "still good, go ahead?" — no need to re-derive
   the design, just confirm nothing's changed since last session).
3. Follow this repo's agent-team protocol for the build (brief → "yp" → build → independent verify → merge
   gate → "yp") — Problems 1 and 3 touch blast-radius files (`jobs[]` shape, `calendarSlot`/`scheduledSlots`
   writers) so council review is mandatory for those per the protocol; Problem 2 is lower-risk.
4. Build in the stated order. Tag `pre-<feature>-stable` before starting each blast-radius-touching problem.
5. No sandbox Firebase exists — verify via code review and narrow synthetic test records, not broad live
   click-throughs against real production jobs/customers.

## Files to open (read these, don't re-derive)
- `/Users/admin/.claude/plans/yp-use-whatever-agents-cozy-conway.md` — the final approved plan. Read this
  first, in full. Has per-problem design, file lists, and verification steps.
- `/Users/admin/.claude/plans/yp-use-whatever-agents-cozy-conway-agent-a7c224782ef299772.md` — the
  underlying detailed technical research (exact line numbers, function names, mechanics) the plan above was
  built from. Reference this for implementation-level specifics; the plan file above is the source of truth
  for scope/decisions if the two ever disagree (line numbers in this file may have drifted since research).
- `src/hooks/useJobs.js` — Problem 1's `handleCsvUpload` diff logic goes here.
- `src/hooks/useDailyLog.js` — Problem 2's `closeDay()`/shared-resolver-extraction/`autoCarryForward()` work.
- `src/hooks/useScheduler.js` — Problem 3's `handleRegularDrop`/`handleUrgentDrop` bump detection.
- `src/utils/firebase.js` — new Firestore doc helpers (Problem 1) and `appendConflictLog` extension
  (Problem 3), follow the existing `focusList`/`adHocTasks` isolated-doc pattern already in this file.
- `src/components/CloseDayModal.jsx` — the existing Defer-reason UI pattern to reuse/match visually for the
  new `BumpReasonModal` and `CatchUpInterview` components.
- `src/components/DailyLogPage.jsx` — where the "carried from" badge and inline bump-reason picker render.
- `admin/context/parking-lot.md` — check at session start per usual; may have unrelated items worth a look
  before diving in.

Root `CLAUDE.md` (architecture/file-boundary conventions) and this project's persisted memory load
automatically in the fresh session — no need to re-read or re-point to them.

## Avoid repeating
- Don't add a "Postponed" outcome to the revenue banner — confirmed unnecessary, Hold jobs don't disappear
  from the CSV.
- Don't add a bump-reason prompt to `unscheduleJob` (drag-to-sidebar) — explicitly rejected as noise.
- Don't make the bump-reason prompt a hard blocking modal.
- Don't have auto-carry-forward silently walk back through multiple stale days and dump them all at once —
  that's what the Catch-Up Interview is for.
- Don't attempt to rebuild the old Job Tracker's full pricing/utilisation engine into Scheduler — that was
  explicitly considered and rejected earlier in the source session as unnecessary scope/duplicate-source-of-
  truth risk versus Multitrack.

## Skills to run
- This repo's own agent-team protocol (say "run team" or "yp" after the brief) — not a slash-command skill,
  but the house build process for this project; use it, don't skip straight to solo edits given the
  blast-radius files involved.
- `/code-review` after the build, before any merge — standing repo convention.
