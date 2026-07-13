# Session refresh — Rename Runway to Projects, then pick up the manual-split data-loss investigation

Continuing work in `/Users/admin/Library/Mobile Documents/com~apple~CloudDocs/Desktop/GGNZ SCHEDULER PROJECT` (GGNZ Scheduler, Apps department). Current `main` HEAD: `bcec6b3`, clean (nothing uncommitted from the last session — working tree only has pre-existing unrelated untracked files).

Goal of this session: rename the "Runway" page to "Projects" (small, low-risk), then start a from-scratch review of the whole manual-split/CSV-sync structure — not a quick patch, a real architecture look.

## Where things stand

**Shipped and deployed last session (all pushed to main, no action needed):**
- Session-rules audit closed — one build had skipped the brief/tag protocol; added a "no commit without a `pending-brief.md` entry first" tripwire to `project_agent_team` memory.
- "Job complete" in Catch-Up Interview / Close Day now really invoices (amount prompt → real write), shows bench/split chips, shows "already invoiced $X" for jobs finished elsewhere, and offers manual invoice entry for bullets whose job is genuinely gone (was previously silent). All independently verified by a separate agent pass before each commit.
- Found and deduped 23→13 `completedJobs` Firestore records (two jobs had duplicate/inconsistent entries — same amount saved once ex-GST, once GST-inclusive). Standardized: **invoiceAmount is ex-GST everywhere**, all four invoice-amount inputs in the app now say so.

**Investigated but deliberately NOT built (this is the real work for this session):**
- Found #1520 (Ampeg SVT 6 Pro) and #1175 (Allen & Heath GL2800) had their manual split data completely wiped from Firestore — no flags, no child records.
- Proposed a quick patch to `withSplitsExpanded` (`src/hooks/useFirebase.js`) — **two independent council reviewers both rejected it.** The approach (classify a stored child as "manual" if it's not in a freshly-recomputed `createSubtasks()` output) is unsafe because `createSubtasks()`'s output shifts whenever a job's `desc`/`bench` changes, which could wrongly promote stale auto-split leftovers to permanent "protected manual split" status — the opposite failure mode.
- Confirmed pattern: every currently-alive manual split has ≥1 scheduled child; both lost ones had zero. Found a second, more promising, **not-yet-council-reviewed** theory: the CSV/Sheet sync script only rebuilds `jobs` from rows in an accepted-status list — if a job's status briefly falls outside that list, the parent drops out of the rebuild, and `withSplitsExpanded`'s restore logic is entirely parent-driven, so orphaned-but-still-present children never get looked up and get silently wiped on the next save.
- Full writeup with both council reports verbatim: see file pointer below. Trevor's own words on next steps: "let's look at this a different way... maybe we need to review the whole split structure and look at it from fresh eyes."
- This is closely related to an older, still-parked idea: splitting "job master data" (CSV-owned) from "live schedule state" (app-owned) into separate Firestore fields, so this whole class of bug becomes structurally impossible. Recommend tackling both in the same session — same root cause class (one shared array field, fragile multi-writer reconciliation).
- Trevor's workaround in the meantime: only manually splitting jobs right when they're getting scheduled, not ahead of time on backlog jobs.

**Decided, not yet built:** rename "Runway" → "Projects" (header button, page title, component/file names). No logic change, just labels.

## Next steps

1. Rename Runway → Projects across `RunwayPage.jsx` and wherever it's referenced (header button, App.jsx wiring). Quick, no blast-radius files touched.
2. Re-read the split-data-loss investigation memory file (path below) in full before proposing anything.
3. Decide whether to fold this into the job-master-data-split migration brief, or scope it separately but in the same session.
4. Whatever gets proposed, run it through full council review (`useFirebase.js` is blast-radius, mandatory) before writing any code — this bit the last session twice already.

## Files to open (read these, don't re-derive)

- `admin/context/parking-lot.md` — both the split-data-loss entry and the job-master-data-split migration entry sit together in "Scoped builds", full context there.
- `/Users/admin/.claude/projects/-Users-admin-Library-Mobile-Documents-com-apple-CloudDocs-Desktop-GGNZ-SCHEDULER-PROJECT/memory/project_manual_split_data_loss_2026_07_12.md` — full investigation writeup, both council reports, the unconfirmed theory, and the open question (did #1520/#1175 lose the parent's `isSplit` flag or just children's `isSubtask` flag — still unanswered).
- `src/hooks/useFirebase.js` — `withSplitsExpanded`, the function at the center of this.
- `src/data/jobs.js` — `createSubtasks()`, whose desc-dependent output is why the quick patch failed review.
- `src/hooks/useJobs.js` — manual-split creation logic (`isSubtask`/`isSplit`/`parentId` handling), around line 55-145.
- `scripts/sheet_to_csv.command` (in `~/Desktop/SCHEDULER_old/`, outside this repo) — the accepted-status filter and manual-split carry-forward logic, lines ~410-421.
- `.claude/pending-brief.md` — the superseded brief is still there for reference, marked clearly as not-building.

## Skills to run

- `/read-the-manual` before starting build work on the split investigation — this project's standing convention for grounding a session in memory before touching blast-radius files.
