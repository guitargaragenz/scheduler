# Session refresh — implement the real Done+invoiced flow for "Job complete"

Continuing work in the GGNZ Scheduler repo (Vite + React + Firebase), working directory
`/Users/admin/Library/Mobile Documents/com~apple~CloudDocs/Desktop/GGNZ SCHEDULER PROJECT`.
Goal of this session: replace "Job complete"'s current simple done-stamp with the real
Done+invoiced revenue procedure.

## Where things stand

HEAD is `04ca511` on `main`, pushed and deployed. Working tree has the usual untracked
scratch files (`.firecrawl/`, `DESIGN.md`, other `re-fresh-*.md` handoffs, `.vercel/`)
plus small uncommitted edits to `.claude/launch.json` and `admin/context/parking-lot.md`
— background drift, not blocking.

Earlier this session, "Job complete" was added as a third action in the Catch-Up
Interview and a fourth action in Close Day — both were **explicitly scoped as a
placeholder**: it just stamps the bullet (and its checklist items) `done: true` and
stops the nag. It was never wired to the real completion flow, called out in code
comments at the time as deliberate future work, because doing it properly needs the
full job record and an invoice-amount prompt that neither of those two modals have
access to.

The real flow already exists elsewhere in the app (built earlier as "Problem 1" this
session): jobs that disappear from a CSV sync land in `usePendingRevenueReview.js`
(isolated Firestore doc `ggnz/pendingRevenueReview`, keyed by job number), surfaced via
`RevenueReviewBanner.jsx`, with two outcomes — **Done + invoiced** (amount input, calls
the existing `handleMarkDone` in `useJobs.js`) or **Cancelled** (free-text reason). Job
complete should end up triggering the same real path instead of its own separate
done-stamp — not a third, disconnected "done" concept.

Also fixed this session, unrelated but worth knowing: a real data-loss bug where any
Daily Log write (including Catch-Up Interview resolutions) could be lost if the page
unloaded within a 300ms save-debounce window — fixed in `04ca511` by flushing on
`visibilitychange`/`pagehide`. And a live incident: Trevor mass-skipped all 38 stale
Catch-Up items out of frustration; 36 of them (the ones marked Skip) were identified,
confirmed with him, and reverted back to unresolved via a one-off script (snapshot
backed up first, logged to `ggnz/conflictLog`). Whether any of the 38 were marked **Job
complete** instead of Skip (and thus still sitting `done: true`, not reverted) was left
unresolved when the conversation pivoted to this goal — worth a quick check early in the
next session if it still matters to Trevor.

## Next steps
1. Design how "Job complete" (from `CatchUpInterview.jsx`'s `handleComplete` and
   `CloseDayModal.jsx`'s `'completed'` action) should trigger the real flow instead of
   a plain done-stamp — likely: on selecting Job complete, look up the full job record
   (needs `jobs` threaded into both modals, which neither currently receives) and either
   open an inline amount-entry step right there, or route the resolution into
   `usePendingRevenueReview`'s pending-item shape so it surfaces via the existing
   `RevenueReviewBanner` for Trevor to finish with an amount.
2. Decide whether "Job complete" should still resolve the bullet immediately (removing
   it from the interview) while the invoice-amount step happens asynchronously via the
   banner, or whether it should block on entering the amount right there in the modal —
   worth a quick clarifying question to Trevor before committing to one.
3. Wire `jobs` (or a lookup) into `CatchUpInterview.jsx` and `CloseDayModal.jsx`, thread
   the real completion call through to `handleMarkDone` in `useJobs.js` (or into
   `usePendingRevenueReview`'s `addDisappearedJobs`-style path, reusing its Firestore
   doc/banner rather than building a second mechanism).
4. This does NOT touch `scheduledSlots`/`calendarSlot`/blast-radius files — likely a
   judgment call, not mandatory council, per the standing `project_agent_team` protocol
   in memory. Confirm scope with Trevor before building regardless, per usual.

## Files to open (read these, don't re-derive)
- [src/components/CatchUpInterview.jsx](src/components/CatchUpInterview.jsx) — `handleComplete`/`recordAndAdvance('complete')`, the interview-side entry point
- [src/hooks/useDailyLog.js](src/hooks/useDailyLog.js) — `resolveStaleDays`'s `'complete'` branch and `closeDay`'s `'completed'` branch, both currently just `done: true` stamps
- [src/components/CloseDayModal.jsx](src/components/CloseDayModal.jsx) — the Close Day modal's parallel "Job complete" action
- [src/hooks/usePendingRevenueReview.js](src/hooks/usePendingRevenueReview.js) — the real pending-revenue-review mechanism to plug into
- [src/components/RevenueReviewBanner.jsx](src/components/RevenueReviewBanner.jsx) — existing Done+invoiced/Cancelled UI pattern to reuse, not duplicate
- [src/hooks/useJobs.js](src/hooks/useJobs.js) — `handleMarkDone(job, amount)`, the actual completion+invoice write
- [.claude/pending-brief.md](.claude/pending-brief.md) — shipped-status record for the three problems built earlier this session, useful background

## Skills to run
- `/scope` or a quick brief-and-approve pass before building, since this touches revenue data — matches how the three earlier features this session were handled (brief → yp → build → verify → merge yp).
