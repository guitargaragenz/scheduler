# Pending Brief — CSV Sync Wrongful-Delete Fix

**Status:** DRAFTED — awaiting Trevor's brief approval ("yp") before Council
**Session:** 2026-07-16
**Next step:** Council review of fix design

---

## Brief

**Root cause:** In `scripts/sheet_to_csv.command`, the delete-pass that removes jobs from Firestore's
`jobsMaster` collection during a fresh CSV/Sheet sync decides what to delete by process of elimination:
any job doc whose id isn't in the current CSV's accepted job list gets deleted (lines ~451–516). A row
only gets spared from that list if it's skipped for ONE specific reason — missing Hours/Days (lines
367–371, tracked in `skipped_incomplete_ids`). Rows skipped for a DIFFERENT reason — a Status value
that doesn't exactly match the fixed list `{'On Hold', 'Waiting', 'To Be Inv', 'In Transit'}` or isn't
flagged "schedulable" (line 365) — get no such protection and fall straight into the delete list, even
though the job still exists in the Sheet and was never actually finished or removed.

A stray space, a typo, an unlisted status word, or a Sheet cell caught mid-edit is enough to trigger
this. It only deletes a handful of jobs per sync, not the whole set, so the existing 30%-mass-deletion
safety guard (`DELETE_FRACTION_LIMIT`, line 489) never catches it. This is why the "jobs keep
disappearing" complaint has recurred across ~7 prior "fix" commits (`1359015`, `0e8cb58`, `97922b9`,
`d985201`, `ec75dab`, `f99523b`, `2c321b9`) — each fixed a different specific data-loss path, but this
asymmetry in the spare-list logic was never closed.

**Secondary contributing factor:** the on-screen "CSV drift" warning panel that used to show missing
job IDs *before* an upload was committed (added in `30ac7c3`/`a1da6e7`) was removed somewhere during
the later `jobsMaster`/`jobsState` rewrite (`c13510e`/`3150696`). So even when this bug fires today,
nothing warns Trevor before the delete happens.

**Separately confirmed NOT the cause:** the 2026-07-12 `jobsMaster`/`jobsState` two-collection split
(see [[project_manual_split_data_loss_2026_07_12]]) fixed a different bug — a writer-collision race
between the app and the CSV pipeline on one shared field. That fix is working as designed and is
unrelated to this gap, which lives entirely inside the CSV sync script's own row-filtering logic.

**Goal:** Stop the sync script from deleting a job solely because its Status text didn't match an
exact string, when the job is still genuinely present in the CSV. Restore a pre-commit warning so any
job the script does intend to delete is visible before it happens, not after.

**Hard constraints (non-negotiable):**
- **(A) No silent deletes.** A job present in the CSV, in any row, must never be deleted purely because
  its Status value isn't recognized. Only delete when a job is genuinely absent from every CSV row.
- **(B) Restore pre-commit visibility.** Before the sync commits any deletes, Trevor sees which job IDs
  are about to be removed and can abort/force as before (mirrors the old drift-panel behavior).
- **(C) No change to legitimate deletes.** Jobs genuinely removed from the Sheet (truly absent from
  every row) must still delete correctly — this is a precision fix, not a "never delete" change.

---

## Blast Radius

Touches:
- `scripts/sheet_to_csv.command` — delete-pass logic (lines ~349–516), specifically the status filter
  (line 365) and candidate-delete list construction (lines 465–467)
- Firestore `jobsMaster` collection — the collection being deleted from
- Possibly `src/App.jsx` / `src/hooks/useJobs.js` if the pre-commit warning is restored as an in-app
  panel rather than a script-side confirmation prompt (needs a design decision — see below)

**Blast-radius files per [[project_agent_team]] / root CLAUDE.md:**
- `jobsMaster` (Firestore state, job identity/deletion) → **MANDATORY council**

**No backup exists for this Firestore project** ([[reference_no_backup_on_micky]]) — any bug in this
fix has the same unrecoverable-data-loss risk as the thing it's fixing. Extra care required.

---

## Open Design Questions for Council

1. **Where does the spare-list exception belong?** Extend `skipped_incomplete_ids`-style handling to
   cover unrecognized-status rows too, or restructure the filter so "recognized status" is required to
   qualify for *deletion* rather than required to qualify for *survival* (inverting the default from
   "delete unless known-safe" to "keep unless known-gone")?
2. **Should the Job id `.strip()` fix ship in the same pass?** (`job_id = str(obj['Job'])` at line 375
   has no whitespace trimming — a stray space in the Sheet's Job cell produces a mismatched id and can
   trigger the same false-delete path independently of the status issue.)
3. **Where should the restored pre-commit warning live?** Back in the script as a confirmation prompt
   (matches old CLI-driven flow) vs. an in-app panel like the old `30ac7c3` drift report (matches
   current in-app CSV upload path via `useJobs.js:handleCsvUpload`)? Note the CSV upload UI has since
   moved in-app — script-side prompting may no longer match how Trevor actually triggers syncs.

---

## Next Session (Build) — locked once Council + Trevor approve above

**Scope (subject to Council's answers above):**
- Fix the status-filter/spare-list asymmetry in `scripts/sheet_to_csv.command` so no job is deleted
  solely for an unrecognized Status value while still present in the CSV
- `.strip()` the Job id before use, if Council confirms in scope
- Restore a pre-commit warning showing job IDs about to be deleted

**Do NOT include in this build:**
- The Day View "unfinished" labeling Trevor also flagged — that turned out (per Explore agent) to be
  about unfinished *daily logs*, not unfinished *jobs*, and needs its own separate investigation before
  it's scoped into any brief
- Any other CSV pipeline changes not directly tied to this delete-pass gap

**Tag before first commit:**
```bash
git tag pre-csv-wrongful-delete-fix-stable <HEAD-commit-at-build-start>
git push origin pre-csv-wrongful-delete-fix-stable
```

**Independent Verifier Checklist (run after each blast-radius commit):**
- [ ] A job with an unrecognized/typo'd Status value survives a sync (does NOT get deleted)
- [ ] A job genuinely removed from the Sheet still correctly deletes
- [ ] A job with a stray-whitespace Job id still matches its existing Firestore doc correctly
- [ ] Pre-commit warning correctly lists job IDs about to be deleted, before the delete happens
- [ ] Existing 30%-mass-deletion safety guard (`DELETE_FRACTION_LIMIT`) still functions unchanged
- [ ] Split/manual-split children unaffected by the fix (spot-check a split job through a sync)
- [ ] Full sync end-to-end: upload CSV, confirm job counts before/after match expectations
- [ ] Browser: trigger a CSV upload through the app's actual upload path, confirm warning surfaces

---

## Session Notes

- Raised by Trevor 2026-07-16: "jobs disappeared from sync popup has been filled multiple times but
  keeps coming back with every fresh csv u/l and refresh"
- Root cause traced via Explore agent to `scripts/sheet_to_csv.command` lines 349–516 (script last
  touched in commit `42abee3`, 2026-07-13)
- Confirmed this is a fix-the-cause change, not another patch layer: closes the actual asymmetry in
  the spare-list logic rather than adding a new guard on top
- Confirmed NOT solved by the 2026-07-12 jobsMaster/jobsState split — separate root cause
- Trevor approved drafting this brief ("yp") — next step is Council review before Builder Agent starts
