# Session refresh — More changes/updates to the GGNZ Scheduler app

Continuing work in `/Users/admin/Library/Mobile Documents/com~apple~CloudDocs/Desktop/GGNZ SCHEDULER PROJECT` (GGNZ Scheduler, Apps department, repo root). Goal of this session: general ongoing improvements/fixes to the app — no single fixed task, pick up from the open backlog and whatever Trevor raises live. `main` HEAD as of this handoff: `c5cff63`, working tree clean aside from the usual pre-existing untracked noise (`.claude/workflows/`, `.firecrawl/`, `.vercel/`, `DESIGN.md`, `re-fresh-*.md` files, `scripts/backups/` — all previously identified as benign, not new).

## Where things stand

**The big one just shipped and is live in production, same day as this handoff:** the `jobsMaster`/`jobsState` Firestore architecture migration — the fix for #1520/#1175's manual-split data loss. Full detail in memory `project_manual_split_data_loss_2026_07_12.md`, but the short version: `ggnz/schedule`'s old single shared array (mixing CSV-owned and app-owned data, blind-overwritten by two independent writers) is retired. Now `jobsMaster/{jobId}` (CSV/Sheet-owned, one writer) and `jobsState/{jobId}` (app-owned, one writer) are separate collections, each written per-document. The old `ggnz/schedule` doc is frozen (not deleted) until **2026-07-26** as a probation-window safety net — don't delete it before then without a reason.

**Same-day follow-up fixes, all shipped and deployed, commits `bb4ef1c` through `c5cff63`:**
- Fixed a real live bug caught during the cutover's own smoke test: `scheduledSlots` was written under the wrong Firestore field name (would have shown an empty calendar). Fixed before Trevor ever saw it.
- `getJobSplits()` (`src/data/jobs.js`) was dropping session note/label/index/total for split pieces shown in the Catch-Up Interview and Close Day modals — you'd see the bench but not which specific piece or what it covered. Fixed to match the detail already shown on calendar cards (`JobCard.jsx`).
- Found live: `inferBench()` had no rule for `status === 'On Hold'` (unlike `Waiting`/`In Transit`, which already force `Admin` bench). An On Hold job (#1616) had drifted to a real work bench via keyword matching, and because it had previously been auto-split under a *different* bench, the bench change orphaned its old split-piece records. Fixed in both `src/data/jobs.js` (JS, authoritative) and `scripts/sheet_to_csv.command`'s `infer_bench()` (Python) — **and the fix was redeployed to the live script on Trevor's Desktop** (`~/Desktop/SCHEDULER_old/sheet_to_csv.command`) before his next CSV upload, since that's the one that actually runs.
- Resolving a split-piece "orphan" in the revenue review banner (Cancelled or Done+invoiced) used to only dismiss the notification, leaving the underlying `jobsState` doc behind forever — a latent risk of stale data getting silently "resurrected" if a parent job's bench ever regenerated the same child id again later. Fixed: resolving now actually deletes the orphan's `jobsState` doc. Manually cleaned up #1616's two leftover records the same way, confirmed via a fresh join-reconstruction check: 0 orphans remaining anywhere.

**Not yet done, flagged but not blocking:**
- No live CSV-sync watcher process was found running during the cutover session (`ps aux` showed nothing) — if Trevor relies on the automated 2-minute poller, `start_watcher_fixed.command` needs starting. Filename has drifted from `start_watcher.command` referenced in `CLAUDE.md` — worth reconciling which is actually current.
- First real CSV upload since cutover hasn't happened yet (Trevor was about to do one as of this handoff — check whether it's landed and gone cleanly before assuming the CSV→`jobsMaster` path is fully proven live, though it's been unit-tested and code-reviewed).
- The "changing a job's bench after it's been auto-split can orphan the old split pieces" gap is now *survivable* (the union-join surfaces it instead of losing data, and resolving properly cleans up) but there's still no *warning* at the point of the bench change itself. Not urgent — flagged in case it comes up again.

## Next steps

1. Run `/read-the-manual` first — this project has real standing conventions (agent-team protocol, blast-radius rules) and today added several new facts to memory that a fresh session needs loaded, not assumed.
2. Read `admin/context/parking-lot.md` fresh (not from a memory summary — it changes between sessions) for the actual open backlog. It has NOT been updated to reflect the jobsMaster/jobsState cutover — some old entries reference the legacy single-array model and may need re-reading with that context in mind (e.g. "Firebase writes entire jobs array on every change" is now stale/resolved by the cutover itself, worth closing out).
3. Ask Trevor what specifically he wants worked on this session — the goal handed off here is intentionally open-ended ("more changes/updates"), not a specific ticket.
4. For anything touching `scheduledSlots`, `calendarSlot`, `useGoogleCalendar.js`, `useFirebase.js`, or `jobs[]`/`jobsMaster`/`jobsState` shape — that's the blast-radius list, council review is mandatory per the standing protocol, not a judgment call.

## Files to open (read these, don't re-derive)

- `admin/context/parking-lot.md` — the real, current backlog. Read fresh.
- `src/data/joinJobs.js` — the new join/reconstruction layer (`joinJobsMasterState`) that replaced `withSplitsExpanded`. Central to how jobs/splits/orphans work now — read this before touching anything scheduling- or split-related.
- `src/utils/firebase.js` — new per-collection Firestore functions (`jobsMaster`/`jobsState`/`scheduledSlots`), plus the legacy `ggnz/schedule` functions kept for the probation window (unused by the live app, don't resurrect without reason).
- `src/hooks/useFirebase.js` — subscribes to all three sources, diff-saves `jobsState` only for fields that actually changed.
- `src/hooks/useJobs.js` — `handleSaveDrawer`'s atomic `writeBatch()` pattern for split-set changes is the reference implementation if any future split-editing logic needs touching.
- `CLAUDE.md` (root) — "Key data structure notes" section is accurate for the new model; re-read it, don't assume the pre-cutover version from an older memory of this project.

## Avoid repeating

- Don't spread a split-child's entire stored `jobsState` doc onto its freshly-derived shape for *auto*-split children — only the true app-owned fields (`pickTopLevelState()`'s allowlist: `scheduled, calendarSlot, gcalEventId, gcalEventIds, pomoLog, done, noAutoSplit, sessionNote, bumpHistory`). A blanket spread was tried and reverted today — it let stale `bench`/`hours`/`label` values from a previous save permanently override freshly-recomputed correct ones, since those fields ride along in the same stored doc for split children but must NOT survive a legitimate parent edit. Manual-split children are the one exception where a full spread is correct (their bench/hours are user-set once and meant to persist).
- Don't assume `undefined` fields on a freshly-joined job mean "safe to leave" — the join layer now explicitly defaults `scheduled/calendarSlot/gcalEventId/gcalEventIds/pomoLog` via `withTopLevelDefaults()` for top-level jobs specifically because leaving them `undefined` (vs an explicit `false`/`null`/`[]`) caused real verification-gate noise and could plausibly break code that expects an array/boolean, not `undefined`.
- Any dev-server or local script pointed at Firebase talks to the **real production project** — there is no sandbox. Confirmed again today: opening a local dev server against real data, or running a one-off Node script for diagnosis, is fine for reads; any write (even a "just testing" one) is a real write. When cleaning up stale Firestore state directly (as done for #1616 today), always re-verify from the server (`getDocFromServer`, not just `getDoc`) after a delete — a live app tab with its own snapshot listener can race a cleanup script and silently re-add what you just removed if you don't check twice.

## Skills to run

- `/read-the-manual` at the start, before touching any code — already stated above but worth repeating as the literal first action.
