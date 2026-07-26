# Session refresh — Build the jobsMaster/jobsState architecture fix

Continuing work in `/Users/admin/Library/Mobile Documents/com~apple~CloudDocs/Desktop/GGNZ SCHEDULER PROJECT` (GGNZ Scheduler, Apps department). Current `main` HEAD: `877168a`, working tree clean aside from pre-existing unrelated noise (`.claude/launch.json` modified, some untracked scratch/re-fresh files at repo root — none of it blocks this build).

Goal of this session: **build** the approved architecture fix for the manual-split data-loss bug — split Firestore's `ggnz/schedule` into two collections (`jobsMaster` for CSV/Sheet-owned job data, `jobsState` for app-owned scheduling/split data), each with exactly one writer, each written per-document instead of a blind whole-array overwrite. Build and test against a scratch/staging setup or local JSON fixtures — **do not touch production Firestore this session.** The actual production cutover (migrating live data, 86 jobs / 33 split children, no backup/PITR) is a separate, later session.

## Where things stand

**Confirmed and approved, nothing left to decide on the "should we do this" question:**
- Root cause of #1520 (Ampeg SVT 6 Pro) and #1175 (Allen & Heath GL2800) losing all manual-split data: confirmed (not theorized) by 3 independent code-reading passes. `ggnz/schedule` holds one `jobs` array mixing CSV-owned and app-owned fields; both writers blind-overwrite the whole array; a job's parent record can drop out of a CSV/Sheet sync (status or Hours/Days momentarily outside the accepted set), orphaning its split children, which then get silently excluded from the app's restore logic (`withSplitsExpanded` in `src/hooks/useFirebase.js`) and permanently erased on the next debounced save.
- Two rounds of guard-style patches (not architecture changes) were designed and rejected by adversarial council review this session — don't revisit either: (1) comparing stored children against freshly-recomputed `createSubtasks()` output — unsafe, that output drifts with desc/bench edits; (2) a 3-layer additive-guard-on-the-shared-array design — found to leave the isSubtask-flag-loss theory uncovered, risked a new duplicate-id corruption mode, and left revived records as permanently invisible zombies in the UI.
- Trevor's explicit direction after seeing patches keep growing new problems: **"I don't want a patch job... I want to eradicate the cause."** The architecture below is that fix, not another guard.
- Full architecture designed, then stress-tested by two more independent reviewers (verdict both times: "sound with modifications," modifications now folded into the approved brief). Trevor reviewed the residual risks personally and ruled two out (job-number reuse — never happens, Multitrack numbers aren't reused; two-device same-job races — he's the sole operator, doesn't happen) and required one fix before calling it resolved: **split-set writes must be a single atomic Firestore batched write (`writeBatch`), never sequential — this is non-negotiable, not optional.**
- Unrelated work also shipped this session and already deployed: Runway page renamed to Projects (`f79e482`, pure UI label, no logic change — not relevant to this build).

**Not started:** no code for this migration has been written. This session is purely the build.

## The approved architecture (read the full brief before writing any code — don't re-derive it)

- **`jobsMaster/{jobId}`** — CSV/Sheet-owned fields only (job number, mfr, model, desc, status, action, customer, tag, vb, backlog, project, days, firstSeen, estimatedHours, CSV-derived bench/schedulable flags). Written only by `scripts/sheet_to_csv.command` (both the repo copy and the deployed twin at `~/Desktop/SCHEDULER_old/sheet_to_csv.command`) and the in-app CSV-upload path, via per-job upserts.
- **`jobsState/{jobId}`** — app-owned fields only (`scheduled`, `calendarSlot`, `gcalEventId`, `gcalEventIds`, `pomoLog`, `done`, `isSplit`, `noAutoSplit`, `parentId`, `sessionNote`, `sessionIndex`, `sessionTotal`, `bumpHistory`, `manualSplits`). Written only by the React app. **Keeps today's flat `parentId`-linked model** (one Firestore doc per job id, split children each get their own doc) — deliberately NOT redesigned into an embedded map. An embedded-map alternative was considered and rejected (adds a full rewrite of ~15 `setJobs()` call sites plus Google Calendar sync, for no extra safety benefit over the plain collection split — the CSV script having zero code path into `jobsState` at all is what fixes the bug, not the internal shape of the records).
- `scheduledSlots` gets its own single-writer doc (app-owned), following the existing `PARKING_LOT_DOC`/`FOCUS_LIST_DOC` pattern already in `src/utils/firebase.js` — it currently lives bundled in `ggnz/schedule` and is read/written by the Python script too, so this needs an explicit new home, not an oversight to fix later.

### Required design decisions (resolve these as part of the build, not after)
1. **Join semantics**: if `jobsMaster/{id}` is ever absent while `jobsState/{id}` still holds real data, the join must be a union (surface as "needs attention," reuse the existing `pendingRevenueReview` pattern), never silently dropped or blank-rendered.
2. **`App.jsx`'s bench-keyword re-infer handler** (`onBenchKeywordsChange`, ~line 676) directly mutates `job.bench` today — `bench` is CSV-owned in the new schema, so this needs an explicit `jobsMaster` write path.
3. **Stale open tabs at cutover** (design note for the *cutover* session, but the reload/version-check mechanism should be built now): `useFirebase.js`'s Firestore listener subscribes once on mount with no re-subscribe/version-check logic — a tab left open across cutover could still write to the frozen legacy doc.
4. **Atomic split-set writes — non-negotiable.** `handleSaveDrawer`'s rewrite in `useJobs.js` must use Firestore `writeBatch()` across all of a job's split documents (creates, updates, deletes of removed pieces) in one atomic operation. Sequential unbatched writes would let a killed app/network mid-split leave a half-created split — a smaller-scoped recurrence of the exact bug this migration exists to eliminate.

### Explicitly out of scope — don't build defenses for these (Trevor ruled them out directly)
- Job-number reuse protection.
- Two-device concurrent-edit transactions/locking (accept the existing narrow single-job race as unchanged risk, no worse than today).

## Files to open (read these, don't re-derive)
- `/Users/admin/.claude/plans/handoff-saved-to-re-fresh-runway-rename-quiet-otter.md` (repo-external plan file) — **"PART 2"** section is the full architecture brief with complete reasoning, the migration/cutover plan, and the full files-that-change list. Read this in full before starting.
- `.claude/pending-brief.md` (top entry) — the same brief in the format Trevor reviews/approves from; mirrors the plan file, useful as the canonical "what was approved" record.
- `/Users/admin/.claude/projects/-Users-admin-Library-Mobile-Documents-com-apple-CloudDocs-Desktop-GGNZ-SCHEDULER-PROJECT/memory/project_manual_split_data_loss_2026_07_12.md` — full investigation history (both rejected patch rounds, both architecture council reviews, the original two data-loss theories) for context on *why* each design decision was made, if you need to justify a choice later.
- `src/utils/firebase.js` — current single-doc `ggnz/schedule` read/write functions (`saveSchedule`, `loadSchedule`, `subscribeToSchedule`, lines ~41-51 for the blind `setDoc`); also has the pattern to copy (`pendingRevenueReview`, `parkingLot`, `focusList` — each already single-writer, merge-safe).
- `src/hooks/useFirebase.js` — `withSplitsExpanded` (lines 8-73), the function being replaced by a join layer; the debounced save effect (lines ~158-166).
- `src/hooks/useJobs.js` — `handleCsvUpload` (lines 168-260, split carry-forward logic to delete), `handleSaveDrawer` (the function that needs the `writeBatch()` rewrite).
- `src/hooks/useGoogleCalendar.js` — `handleSync()` and the 30s poll; currently addresses every job including split children as flat array entries via `.id`/`findIndex` — needs updating to the new per-document persistence calls, but the id-addressing model itself shouldn't need to change.
- `src/data/jobs.js` — `parseCSV`, `createSubtasks`, `getJobSplits` — reshape `getJobSplits` to read the new split collection instead of a flat-array `parentId` filter.
- `scripts/sheet_to_csv.command` — **both copies**, repo (`scripts/sheet_to_csv.command`) and deployed (`~/Desktop/SCHEDULER_old/sheet_to_csv.command`, outside this repo) — the preserve-existing-state/carry-forward block (~lines 335-423) gets deleted entirely; becomes pure per-job upserts to `jobsMaster` only. Keep both copies in sync when editing.
- `admin/context/parking-lot.md` — the "NEXT SESSION FIRST ITEM" entry (top of "Scoped builds") points back to this same brief; update it when this build ships.

## Avoid repeating
- Don't propose another guard/patch layered onto the current shared-array design — that door is closed, Trevor was explicit about it after two rejected rounds.
- Don't redesign splits into an embedded map inside the parent doc — considered, reviewed, and rejected in favor of keeping the flat `parentId` model (see "The approved architecture" above for why).
- Don't build job-number-reuse or two-device-race defenses — explicitly ruled out.
- Don't touch production Firestore this session — build against a scratch/staging Firestore project or local JSON fixtures only. The migration script, verification script, and cutover sequence (already fully specified in the Part 2 brief) are for the *next* session, not this one.
- Don't skip the atomic-batched-write requirement for split creation/editing — it was called out by Trevor personally as the one remaining gap and is non-negotiable.
- `useFirebase.js`, `useJobs.js`, and `firebase.js` are all confirmed blast-radius files — this build needs council review before merge, per the project's standing agent-team protocol (blast-radius trigger forces council review + independent verifier + per-commit checklist). Don't skip that because the architecture itself was already approved — the *implementation* still needs its own review pass.

## Skills to run
- `/read-the-manual` at the start of the build session, before writing any code — this project has real standing conventions (agent-team protocol, blast-radius rules) that need to be loaded, not assumed.
