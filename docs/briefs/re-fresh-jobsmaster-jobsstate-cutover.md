# Session refresh — jobsMaster/jobsState CUTOVER (production migration)

Continuing work in `/Users/admin/Library/Mobile Documents/com~apple~CloudDocs/Desktop/GGNZ SCHEDULER PROJECT` (GGNZ Scheduler, Apps department). `main` HEAD as of this handoff: `877168a`. The build session shipped the new architecture on branch `jobsmaster-jobsstate-build` (commits `3150696`, `2f40142`) — code-complete, independently reviewed, `/code-review` passed, 13/13 tests, clean build. **Not merged to main, not deployed, production Firestore untouched.**

Goal of this session: **the actual production data migration and coordinated deploy.** This is the highest-stakes session in this whole effort — it touches live data for a real business with no backup/PITR on the Firestore project. Read everything below before running any write against production.

## Why this exists (one paragraph)

Two real jobs (#1520 Ampeg SVT 6 Pro, #1175 Allen & Heath GL2800) permanently lost their manually-split task data because the old Firestore doc `ggnz/schedule` held one array mixing CSV-owned and app-owned fields, both writers blind-overwrote the whole array, and a parent job could temporarily drop out of a CSV sync and silently take its orphaned split children down with it on the next save. The fix, now built: split into `jobsMaster/{jobId}` (CSV-owned, one writer) and `jobsState/{jobId}` (app-owned, one writer), each per-document, never a whole-array overwrite. This session moves Trevor's real 86 jobs / 33 split children into that new shape and cuts the live app over to it.

## What's already true — don't re-derive or re-decide any of this

- **Architecture is approved and built**, not up for redesign. Full spec: `/Users/admin/.claude/plans/handoff-saved-to-re-fresh-runway-rename-quiet-otter.md`, section "# PART 2".
- **The build itself is done and reviewed** — an independent verifier agent and `/code-review` both checked the actual diff (not just trusted the builder's report), found one real bug (orphan review items colliding on a shared key when 2+ went missing simultaneously), sent it back, confirmed the fix. Both the atomic-batched-split-write requirement and the union-join/orphan-surfacing logic were traced through the code personally and confirmed correct, not just assumed.
- **Branch to work from:** `jobsmaster-jobsstate-build` (commits `3150696`, `2f40142`). Do not rebuild the app-side code — it's ready. This session's work is the migration script, verification script, and cutover sequence, plus updating the Python CSV script (deferred by the build session, see below).
- **Rollback point if the branch itself needs discarding:** tag `pre-jobsmaster-jobsstate-stable` on `main` at `877168a`.

## Non-negotiables carried forward from the approved brief — do not relitigate

1. **Manual JSON snapshot of the current `ggnz/schedule` doc to local disk FIRST, before any migration code runs.** This snapshot *is* the backup — there is no other one. Non-negotiable, first step, no exceptions.
2. **Additive-only migration script.** Reads the old doc, writes the new `jobsMaster`/`jobsState` docs, never touches or deletes the old doc. Migration must be reversible by construction as long as only this step has run.
3. **Verification script**, separate from the migration script: reads back the new collections, joins them via the exact `joinJobsMasterState()` logic the app now uses (`src/data/joinJobs.js` on the build branch), and deep-compares against the pre-migration snapshot. Use set/key-based comparison for splits (old shape is an unordered array, new shape is per-doc), not positional comparison. **Zero unexplained diffs required** before proceeding — only intentional shape changes (field renames) are allowlisted.
4. **Hard cutover, not a dual-read/dual-write transition window.** A transition period would recreate the exact two-writer race this migration exists to kill. Sequence: pause the Python sync poller → run migration → run verification → reload every open tab on every device (iMac, MacBook, iPhone — the old `useFirebase.js` subscribes once on mount with no version-check, so a stale tab left open across cutover can still write to the frozen legacy doc) → deploy the updated app AND updated Python script together → resume the poller → smoke-test live.
5. **Freeze (don't delete) the old `ggnz/schedule` doc for a 2-week probation window.** Rollback if anything looks wrong post-cutover: revert the app deploy and the Python script to their previous commits — both still point at the untouched legacy doc, so a fast rollback exists even after cutover.
6. **Job-number reuse and two-device-race defenses are explicitly out of scope** — Trevor ruled both out personally as non-risks for how he runs the shop. Don't add them.

## What the build session deferred — needs doing THIS session before cutover can run

**`scripts/sheet_to_csv.command` was NOT updated by the build session** — flagged as lowest priority and explicitly deferred. It still writes the old single-array model. Before cutover can actually happen, this needs the same treatment as the brief specifies: delete the entire preserve-existing-state/carry-forward block (~lines 335-423 in the pre-migration version) and convert it to pure per-job upserts into `jobsMaster` only — it should never touch `jobsState` or split data at all once this is done. **Both copies need updating and kept in sync**: the repo copy (`scripts/sheet_to_csv.command`) and the deployed twin at `~/Desktop/SCHEDULER_old/sheet_to_csv.command` (outside this repo, on Micky's Desktop, the one actually run every 2 minutes by `start_watcher.command`). Re-deploy via the documented curl command in root `CLAUDE.md`'s CSV pipeline section after editing the repo copy — don't just drag-and-drop (iCloud serves a plist stub, not the real file, per the standing lesson already in memory `reference_csv_pipeline`).

## Files to read before writing any migration/verification code

- `/Users/admin/.claude/plans/handoff-saved-to-re-fresh-runway-rename-quiet-otter.md` ("PART 2") — full architecture spec and the 5-step migration plan this handoff summarizes.
- `.claude/pending-brief.md` (top entry) — mirrors the approved brief plus this session's build-complete status note.
- `/Users/admin/.claude/projects/-Users-admin-Library-Mobile-Documents-com-apple-CloudDocs-Desktop-GGNZ-SCHEDULER-PROJECT/memory/project_manual_split_data_loss_2026_07_12.md` — full incident/investigation history.
- On the `jobsmaster-jobsstate-build` branch: `src/data/joinJobs.js` (the join/orphan logic your verification script must replicate exactly), `src/data/joinJobs.test.js` (13 passing fixture cases — useful reference for what edge cases the verification script should also check against real data), `src/utils/firebase.js` (the new per-document read/write functions your migration script should reuse rather than reimplementing), `src/hooks/useJobs.js`'s `handleSaveDrawer` (confirms what a correctly-formed split-set write batch looks like).
- Root `CLAUDE.md`'s "CSV pipeline" section — for the correct re-deploy procedure for the Python script once updated.

## Standing rules that apply, doubly so this session

- **No sandbox exists for this Firebase project** — every write in this session is real, and there's no backup except the one this session creates itself at step 1. See memory `feedback_no_sandbox_prod_firestore`.
- **This is THE blast-radius session** — `useFirebase.js`, `useJobs.js`, `firebase.js`, plus a live production data migration. Full agent-team protocol applies: council review of the actual migration/verification scripts before running them against prod, independent verifier, per-commit checklist. Don't skip council review just because the architecture itself was already approved twice — the migration script's *correctness* is a new, unreviewed artifact.
- **Narrate before acting** — before running the snapshot, the migration script, or anything touching production, say what's about to happen and why, then do it. Not a full stop-and-ask on every read-only call, but the actual migration write needs an explicit go-ahead from Trevor, stated out loud first.
- **Plain English for Trevor at every checkpoint** — this session has genuine, real stakes (irreversible-if-something-goes-wrong-without-the-snapshot). Every status update at a real decision point gets full plain-English explanation, not compressed brevity — see memory `user_adhd_focus`'s risk-caveat exception.
- **Two "yp"s minimum**: one to approve the exact migration+verification plan before it touches production, one to approve the final merge/deploy after the live smoke test passes.

## Skills to run

- `/read-the-manual` at the very start of this session — this project's memory has the full incident history and standing protocol; don't proceed on assumed context.

## Suggested session shape (not a rigid script — use judgment)

1. Read-the-manual, confirm branch state (`jobsmaster-jobsstate-build` still has the reviewed commits, `main` hasn't moved in a way that conflicts).
2. Update the Python script (both copies) to the new upsert-only model — this is regular build work, no production risk yet, can go through a normal solo/reviewed pass.
3. Write the migration script + verification script, following the 5-step plan above.
4. **Council review the migration/verification scripts themselves** before they touch anything real — this is new code with no prior review, distinct from the already-reviewed app code.
5. State the plan to Trevor, get an explicit go-ahead, THEN: snapshot → migrate → verify (zero-diff gate) → pause poller → reload all devices → deploy app + script together → resume poller → live smoke test (schedule a job, split a job, run a CSV upload, confirm `jobsState` untouched by the CSV upload).
6. Second "yp" after the live smoke test, not before.
7. Freeze the old `ggnz/schedule` doc, note the 2-week probation window end date somewhere memory/parking-lot will actually surface it again.
