# Session refresh — Split-piece completion tracking

Continuing work in `/Users/admin/Library/Mobile Documents/com~apple~CloudDocs/Desktop/GGNZ SCHEDULER PROJECT` (GGNZ Scheduler, Apps department). Goal of this session: design and build persistent tracking for split-job piece completion, so Trevor knows which bench pieces are done vs. waiting without relying on a personal bullet journal.

## Where things stand

**The gap identified:** When a job is split (Setup + Wiring + Electronics), there's no persistent way to track which pieces Trevor has actually completed, except in his personal bullet journal. Close Day runs at midnight and he's often still working past it, so the session rolls over — he loses the connection between "I finished Setup today" and "Wiring is waiting." This forces him to manually track piece status outside the app.

**Trevor's three UI suggestions:**
1. **Close Day modal enhancement** — recognize split jobs, show "Setup (complete) · Wiring (waiting) · Electronics (waiting)", ask which pieces finished today
2. **Pomodoro drawer** — "Mark piece done" button when finishing a scheduled split piece (simpler, doesn't wait for midnight)
3. **Calendar card** — checkbox/button on a split piece card itself (fastest, right where the work is)

**Three hard constraints (from Trevor, 2026-07-14):**
- **(A) Auto-complete needs visibility** — when the last piece is done and the parent job auto-completes, a toast popup or similar must surface the completion so invoicing isn't silently missed
- **(B) Completed pieces must show as done, not disappear** — grey out or visibly marked (previous attempts had pieces vanish, which broke the UI). The piece must stay visible, marked as complete
- **(C) Invoice only when full job is complete** — all split pieces must be marked done before invoicing happens. MTrack is source of truth — if a completed job comes back for more work, it gets a new job number, not a "re-open" in the app

**Ready for:** Full team protocol (brief → council → build → verify). Three design questions need council input:
1. **State tracking:** Where does "piece done" live? New field on split children (`pieceDone: true/false`), or derived from invoicing state?
2. **Invoicing strategy:** Can Trevor invoice Setup ($X) before Wiring is done, or only invoice when entire job complete?
3. **Piece-done timing:** Can a piece be marked done before its siblings are scheduled? (E.g., Setup is done, but Wiring hasn't been scheduled yet.)

## Next steps

1. Write brief with three design questions, flag as blast-radius (`jobs[]` shape, invoicing logic, split state)
2. Run council review (two independent agents) — they will weigh in on the three questions above
3. Design finalized, Trevor approves brief
4. Build on staging branch with scope locked to approved brief
5. Independent verifier runs blast-radius checklist
6. Live browser test on Vercel preview
7. Merge to main

## Files to open (read these, don't re-derive)

- `src/components/CloseDayModal.jsx` — current Close Day implementation; where split-piece logic will be added. Lines 164–302 show the current action-row UI and how bullets are resolved
- `src/components/PomoDrawer.jsx` or equivalent mobile sheet — alternate UI surface for marking pieces done (TBD which file, may be MobileJobSheet or a new component)
- `src/data/jobs.js` — job/split data structures (`createSubtasks`, `getJobSplits`); may need new field for piece completion state
- `src/hooks/useJobs.js` — `handleSaveDrawer` shows the atomic `writeBatch()` pattern for split-set changes; reference implementation for state updates
- `admin/context/parking-lot.md` — open backlog; this feature will close the "Edit a split from within the calendar" entry and address the broader "no split-piece tracking" gap

## Avoid repeating

- **Don't auto-delete completed split pieces from the UI** — previous attempts had pieces vanish once marked done, which broke findability. Pieces must stay visible, greyed out or marked complete, not removed.
- **Don't silently auto-complete the parent job** — Trevor needs to know it happened via a toast popup, so invoicing isn't accidentally missed.
- **Don't track "piece done" state only locally in Close Day** — it must persist to Firestore so it survives across sessions, and so the calendar/Pomodoro surfaces can read it.

## Skills to run

- `/read-the-manual` — load the session context (memory + CLAUDE.md protocol rules) before starting
- Brief → Council → Build → Verify per `admin/CLAUDE.md` (agent-team protocol)

---

**Handoff ready.** Paste this into a fresh chat to continue. The brief + council design work will determine which of Trevor's three UI surfaces gets built first (or all three), and which design questions win council approval.
