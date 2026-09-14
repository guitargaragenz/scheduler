---
doc_status: live
---

# Scope lock — a ticked part always saves as done

Approved by Trevor 2026-09-14. Council done. Blast-radius: full protocol.
Background only: docs/briefs/2026-09-14-part-done-save.md (for the checklist).

## Build (src/hooks/useJobs.js, handleMarkPieceDone)

- Pure `planPieceDone(jobs, parentJobId, childJobId, pieceDone)` →
  `{ updatedChild, parentJob, children, allChildrenDone }`. Tick and untick use it.
- `jobsRef` in useJobs, set to `jobs` each render. Handler plans from
  `jobsRef.current`, then sets `jobsRef.current` to the planned array at once.
- `setJobs(prev => …)` only sets that child's pieceDone. No side effects inside it.
- Supabase write from the planned child on every call, outside the updater.
- Child or parent missing from the ref: stop and report.
- Failing test first: unit tests for planPieceDone, plus a hook test with a
  deferred setJobs updater (the save isn't called on old code, is called on new).
- Keep the failure toast. Leave justSavedAt alone.

## Out of scope

- Daily Log mark rules. Fixing old lost ticks. PR #69 next-bench card.
- scheduledSlots, calendarSlot, jobs[] shape, useGoogleCalendar.js.
