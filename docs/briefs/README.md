# Session briefs

Handoff notes written at the end of a session so the next one can pick up without
re-deriving anything. Newest first.

**How to use these:** read the one named in your starting prompt, and only that one. The
rest are history — useful when you need to know *why* something was done, not what to do
next. A brief is a snapshot of what was true on its date; verify anything it says about the
code before acting on it.

---

## Live — work that hasn't finished

| Brief | Date | What it's for |
|-------|------|---------------|
| [re-fresh-job-blocking-council-and-build.md](re-fresh-job-blocking-council-and-build.md) | 2026-07-27 | **Current.** Job blocking: get Brief E approved, run council on the four decisions, then build. The plan is written; nothing is built. Micky only. |
| [handoff-pdf-import-truncation-incident.md](handoff-pdf-import-truncation-incident.md) | 2026-07-26 | The data-loss incident, fully diagnosed. **Read the "do not do" section before touching anything in `SCHEDULER_old/`.** The Multitrack PDF parser is still unfixed. |
| [handoff-board-meeting-and-pdf-drop.md](handoff-board-meeting-and-pdf-drop.md) | 2026-07-25 | Scopes two unbuilt features: the Sunday board meeting rebuild, and in-app PDF drop to replace the CSV pipeline. Both need the full protocol. |

## History — completed or superseded

| Brief | Date | What happened |
|-------|------|---------------|
| [re-fresh-job-blocking-implementation-plan.md](re-fresh-job-blocking-implementation-plan.md) | 2026-07-27 | Turn the job-blocking spec into an implementation plan. Done — plan written, five spec corrections found, Brief E raised. Superseded by `re-fresh-job-blocking-council-and-build.md`. |
| [brief-d-board-meeting-full-record.md](brief-d-board-meeting-full-record.md) | 2026-07-27 | Brief D's complete working record, archived out of `.claude/pending-brief.md`. Shipped at `da1d9af`. All nine scope items, council findings, verification and live-test notes. History, not instructions. |
| [re-fresh-clickup-dependencies-in-scheduler.md](re-fresh-clickup-dependencies-in-scheduler.md) | 2026-07-26 | Started the design conversation that produced the job-blocking spec. Superseded by the spec itself. |
| [re-fresh-wire-focus-list-write-path.md](re-fresh-wire-focus-list-write-path.md) | 2026-07-26 | Focus-list write path — shipped (`dda30fd`, `d0e3a2c`). |
| [re-fresh-brief-d-live-test.md](re-fresh-brief-d-live-test.md) | 2026-07-25 | Live test of the Brief D focus-list fix. |
| [re-fresh-brief-d-sunday-board-meeting.md](re-fresh-brief-d-sunday-board-meeting.md) | 2026-07-25 | Brief D — Sunday board meeting rebuild. Shipped; see `handoff-board-meeting-and-pdf-drop.md` for what's left. |
| [handoff-split-piece-completion.md](handoff-split-piece-completion.md) | 2026-07-16 | Split-piece completion fix — parent job now auto-completes when the last piece is done. Was `SESSION-HANDOFF.md` at repo root. |
| [re-fresh-jobsmaster-jobsstate-cutover.md](re-fresh-jobsmaster-jobsstate-cutover.md) | 2026-07-14 | The production migration for the jobsMaster/jobsState split. |
| [re-fresh-jobsmaster-jobsstate-build.md](re-fresh-jobsmaster-jobsstate-build.md) | 2026-07-14 | Building the jobsMaster/jobsState architecture fix — the root-cause fix for the manual-split data loss. |
| [re-fresh-build-three-tracking-fixes.md](re-fresh-build-three-tracking-fixes.md) | 2026-07-14 | Revenue, carry-forward and bump-reason tracking fixes. |
| [re-fresh-job-complete-real-invoicing.md](re-fresh-job-complete-real-invoicing.md) | 2026-07-14 | The real Done + invoiced flow for "Job complete". |
| [re-fresh-runway-rename-and-split-investigation.md](re-fresh-runway-rename-and-split-investigation.md) | 2026-07-14 | Renamed Runway to Projects, then investigated the manual-split data loss. |
| [re-fresh-split-piece-completion-build.md](re-fresh-split-piece-completion-build.md) | 2026-07-14 | Build phase for split-piece completion tracking. |
| [re-fresh-split-piece-completion.md](re-fresh-split-piece-completion.md) | 2026-07-14 | Design phase for split-piece completion tracking. |
| [re-fresh-scheduler-next-changes.md](re-fresh-scheduler-next-changes.md) | 2026-07-14 | General open-backlog session, no single fixed task. |
| [re-fresh-continue-scheduler-fixes.md](re-fresh-continue-scheduler-fixes.md) | 2026-07-14 | General fixes session. |
| [re-fresh-fix-scheduler-bugs.md](re-fresh-fix-scheduler-bugs.md) | 2026-07-14 | General bug-fixing session. |
| [re-fresh-session-summary.md](re-fresh-session-summary.md) | 2026-07-14 | Summary only, no task. |

---

**Note on the older briefs.** Everything dated 2026-07-14 and earlier refers to the project
at its old iCloud path and to **Firebase/Firestore**. The project has since moved to the
Desktop path and to **Supabase**. Read those for history, not for instructions.

Designs and specs live in [`../superpowers/specs/`](../superpowers/specs/), not here. A
brief says *what to do next*; a spec says *what we agreed to build*.
