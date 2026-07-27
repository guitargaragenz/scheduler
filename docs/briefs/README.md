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
| [re-fresh-brief-g-pdf-drop-build.md](re-fresh-brief-g-pdf-drop-build.md) | 2026-07-28 | **Current — start here.** Brief G (drop the Multitrack PDF into the app; rebuild the Google Sheet as an in-app page) is **approved and scope-locked**; the brief itself is `.claude/pending-brief.md`. No code written yet. **Step 0 (the match-key gate) has passed** — 2026-07-28, against a fresh export: 46 job numbers, 45 match the `jobs` table character-for-character, 1 genuinely new (`1711`), zero near-misses. Build starts at scope item 1 on branch `staging/brief-g-pdf-drop`. Also records that the CSV pipeline is being retired (don't patch it) and that job `1620` is simply completed. |
| [re-fresh-job-blocking-council-and-build.md](re-fresh-job-blocking-council-and-build.md) | 2026-07-27 | Superseded — Brief E fully shipped and merged this session. Kept for history on the council decisions and round-2/3 fixes. |
| [re-fresh-repo-housekeeping.md](re-fresh-repo-housekeeping.md) | 2026-07-27 | **Fresh session, run it separately.** Clear out misplaced, dead and stale files — 267 MB of broken worktrees, a personal parts list, a client's design doc, three spent one-off scripts. Nothing deleted yet. **Read its STOP section first: the job-blocking build shares this working tree.** |
| [handoff-board-meeting-and-pdf-drop.md](handoff-board-meeting-and-pdf-drop.md) | 2026-07-25 | **Half-superseded.** Its PDF-drop half became Brief G — use `re-fresh-brief-g-pdf-drop-build.md` for that, not this. Its *Sunday board meeting rebuild* half is still unscoped and unbuilt, and is the reason this stays Live. |

## Parked — agreed in principle, waiting on something

| Brief | Date | Waiting on |
|-------|------|------------|
| [blocked-pile-naming-alignment.md](blocked-pile-naming-alignment.md) | 2026-07-27 | Brief F shipping first. Sidebar, Jobs page and the new bench-row chips call the same stuck job three different things and disagree on which jobs are stuck. Raised by Brief F's council. Trevor's call: the word is **"Waiting"**, not "Awaiting". Not scoped. |
| [parked-parts-as-a-stuck-reason.md](parked-parts-as-a-stuck-reason.md) | 2026-07-27 | The first Sunday board meeting run. Parts captured at the bench, shown as the stuck reason on the job. Split out of Brief E — the `parts_to_order` list is empty until the meeting fills it, so the UI would ship showing nothing. Not approved, not scoped. |

## History — completed or superseded

| Brief | Date | What happened |
|-------|------|---------------|
| [handoff-pdf-import-truncation-incident.md](handoff-pdf-import-truncation-incident.md) | 2026-07-26 | ⛔ **CLOSED — history only, do not act on it.** The truncation bug is **fixed and pushed**, the 10 blank-`mfr` jobs are repaired (verified 2026-07-28), the PDF layout never changed (it was a one-off glitch), and Firestore is gone — everything runs on Supabase. Its "recommended order of work" and "do not do next" lists are dead. Read only for the story of what happened. |
| [re-fresh-blocked-status-match-fix.md](re-fresh-blocked-status-match-fix.md) | 2026-07-27 | Shipped and merged (PR #6, `43a5024`). ⚠️ **This brief contains a wrong fact:** it claims Multitrack's real status is `'Waiting Parts'`. It is **`'Waiting'`** — the dropdown *label* reads "Waiting parts" but the export is master, and `src/data/jobs.js` is correct as-is. Do not act on that line. |
| [re-fresh-waiting-chip-handoff.md](re-fresh-waiting-chip-handoff.md) | 2026-07-27 | Brief F — Waiting + Planning chips on the bench row. Shipped and merged to main (`ece2197`). Live browser test surfaced the status-match bug now tracked in `re-fresh-blocked-status-match-fix.md`. |
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
