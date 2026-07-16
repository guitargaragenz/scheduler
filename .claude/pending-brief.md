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
- **(B) Restore pre-commit visibility, with revenue risk flagged.** Before the sync commits any deletes,
  Trevor sees which job IDs are about to be removed and can abort/force as before (mirrors the old
  drift-panel behavior). **Critically, the warning must call out whether any of those jobs have NOT yet
  been invoiced** (no matching `completedJobs` record with revenue recorded) — an uninvoiced job being
  deleted isn't just a bookkeeping gap, it's real revenue that can silently disappear with no record it
  was ever owed. Jobs already invoiced can be flagged lower-priority in the same warning; uninvoiced
  ones should be the headline.
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
4. **How does the warning determine "invoiced" status for a job about to be deleted?** Needs to
   cross-reference against `completedJobs` (or wherever invoiced-revenue is recorded — see
   `RevenueBreakdown.jsx`/`usePendingRevenueReview.js` for the existing revenue-tracking shape) so the
   warning can distinguish "this job was already invoiced, deleting it is fine" from "this job was never
   invoiced — deleting it loses that revenue silently." This is the actual stakes behind constraint (B),
   per Trevor 2026-07-16.

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
- [ ] Job #1619 (confirmed missing 2026-07-16 despite being present in CSV and Google Sheet) reappears
  in the app after the first sync post-fix
- [ ] A job with an unrecognized/typo'd Status value survives a sync (does NOT get deleted)
- [ ] A job genuinely removed from the Sheet still correctly deletes
- [ ] A job with a stray-whitespace Job id still matches its existing Firestore doc correctly
- [ ] Pre-commit warning correctly lists job IDs about to be deleted, before the delete happens
- [ ] Pre-commit warning correctly distinguishes uninvoiced jobs (flagged prominently) from
  already-invoiced jobs about to be deleted
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
- **Concrete confirmed case (2026-07-16): Job #1619 is completely missing from the app despite being
  present in both the CSV and the Google Sheet.** Not just flagged-then-resolved — actually absent from
  `jobsMaster` right now. This is a live, real-world instance of the delete-pass bug described above (or
  a close variant of it) and should be the first thing the Independent Verifier checks once the fix
  ships — confirm #1619 reappears correctly on the next sync after the fix, and add "job #1619 present
  after sync" as an explicit checklist item below.

---
---

# Pending Brief — Revenue Review Banner "Hide" Doesn't Persist

**Status:** DRAFTED — awaiting Trevor's brief approval ("yp") before Council
**Session:** 2026-07-16
**Next step:** Council review of fix design (once approved)

---

## Brief

**Root cause:** `src/components/RevenueReviewBanner.jsx:90` — the banner's "Hide" button only sets a
local `useState(false)` flag (`hidden`). It is never written to Firestore, localStorage, or anywhere
else. The only actions that genuinely resolve an item are **"Done + invoiced"** and **"Cancelled"**,
which call `removePendingRevenueReviewItem` (`src/utils/firebase.js:255-264`) to actually delete the
item's key from the `ggnz/pendingRevenueReview` Firestore doc.

So clicking "Hide" looks and feels like dismissing the warning, but it's cosmetic — the underlying item
is still sitting in `ggnz/pendingRevenueReview`, fully unresolved. On the next hard refresh or app
reopen, the component remounts, `hidden` resets to `false`, and the exact same warning reappears for
the exact same job(s). A CSV upload can compound this by adding a brand-new detected item into the same
list (`detectDisappearedJobs`, `src/hooks/useFirebase.js:19-24`, fired from the `jobsMaster` subscription
at lines 89-100), which also forces the whole banner back into view.

**Goal:** Make "Hide" behave honestly — either it actually persists a real dismissal, or it's replaced
so the only way to make the warning go away is a genuine resolution (Done + invoiced / Cancelled).
Given these items represent real, possibly-uninvoiced revenue ([[project_gst_convention]] context aside,
this is about not losing track of money owed), a fake "looks handled" state is the actual danger here.

**Hard constraints (non-negotiable):**
- **(A) No fake resolution.** Whatever "Hide" ends up meaning, it must not create a state that looks
  resolved in the UI while the underlying item is still genuinely open and untracked.
- **(B) Don't silently bury unresolved revenue.** If "Hide" is kept as an option (vs. removed entirely),
  it must not be usable as a way to make an uninvoiced item disappear permanently without ever being
  invoiced or explicitly cancelled.

---

## Blast Radius

Touches:
- `src/components/RevenueReviewBanner.jsx` — the "Hide" button and `hidden` state
- `src/hooks/useFirebase.js` — job-disappearance detection (`detectDisappearedJobs`) and the
  `jobsMaster` subscription that feeds it
- `src/hooks/usePendingRevenueReview.js` / `src/utils/firebase.js` — `ggnz/pendingRevenueReview` doc,
  if a real persisted-dismiss field is added here

**Blast-radius files per [[project_agent_team]] / root CLAUDE.md:**
- `useFirebase.js` is explicitly named as a blast-radius file → **MANDATORY council**

---

## Open Design Questions for Council

1. **What should "Hide" actually mean?** Options: (a) remove "Hide" entirely, forcing every item to be
   explicitly resolved via Done+invoiced/Cancelled; (b) make "Hide" a real persisted dismissal (e.g. a
   `dismissedAt` field per item) that survives refresh but the item still counts as open/unresolved
   revenue in any reporting; (c) a snooze (re-appears after N days) rather than a permanent hide. Needs
   Trevor's input on his actual workflow — how does he currently intend to use "Hide" day to day?
2. **Should a dismissed-but-unresolved item still show up elsewhere** (e.g. a revenue/invoicing report)
   so it can't be forgotten even after being hidden from the main banner?

---

## Next Session (Build) — locked once Council + Trevor approve above

**Scope (subject to Council's answers above):**
- Fix `RevenueReviewBanner.jsx` so "Hide" either persists for real or is removed in favor of forcing
  explicit resolution
- If persisted, add whatever Firestore field Council decides on to `ggnz/pendingRevenueReview`

**Independent Verifier Checklist:**
- [ ] Hiding an item, then hard-refreshing, produces the behavior Council decided on (stays hidden, or
  is no longer offered as an option at all)
- [ ] An item hidden (if kept as an option) still shows up somewhere as open/unresolved revenue — it
  can't vanish from all views without being invoiced or cancelled
- [ ] "Done + invoiced" and "Cancelled" still work exactly as before (no regression)
- [ ] A new CSV upload correctly adds newly-disappeared jobs to the list without resurrecting old
  already-resolved (Done/Cancelled) ones

---

## Session Notes

- Raised by Trevor 2026-07-16 as part of the same "popups keep coming back" report that also
  surfaced the CSV wrongful-delete brief above — traced via Explore agent to be a completely
  separate, independent bug (not the same root cause, just a coincidental shared trigger: refresh).
- Trevor confirmed (2026-07-16) this reappears on both hard refresh/reopen AND fresh CSV upload,
  for the reasons above (fake local hide state; new detections added by CSV upload).

---
---

# Pending Brief — Unfinished-Days Catch-Up Nag Reappears After Being Resolved

**Status:** DRAFTED — awaiting Trevor's brief approval ("yp") before Council
**Session:** 2026-07-16
**Next step:** Council review of fix design (once approved)

---

## Brief

**Root cause:** Unlike the revenue banner above, this popup has no fake-dismiss bug — `catchUpNeeded`
(`src/hooks/useDailyLog.js:687-690`) is genuinely recomputed fresh on every render straight from
persisted Firestore data (`ggnz/dailyLogs`), via `dayHasUnresolved()` (lines 84-91). There's no cached
or stale client-side flag involved.

The real problem is a **save-timing race**: resolving the Catch-Up Interview (`CatchUpInterview.jsx`,
resolved via `resolveStaleDays`, `useDailyLog.js:592-679`) writes the resolution back to Firestore, but
regular saves in this hook are debounced by 300ms (`scheduleSave`, line 208; `performSave`, lines
157-178). There's a `visibilitychange`/`pagehide` listener meant to force an eager flush before unload
(lines 184-197), but it isn't airtight — if Trevor refreshes or closes the tab quickly enough right
after finishing the catch-up questions, the in-flight `setDoc()` can be aborted by the page teardown
before it reaches the server. The next load then reads back the true, still-unresolved server state, so
the nag legitimately reappears — it isn't lying, the fix genuinely didn't save in time.

This is the same general bug class flagged in the code's own comment at `useDailyLog.js:152-156`
(referencing the 2026-07-05 data-loss incident that the flush was originally added to guard against) —
it just isn't fully closed against a fast refresh/reopen.

**Confirmed NOT related to CSV upload directly** — `ggnz/dailyLogs` is a completely separate Firestore
doc from `jobsMaster`/`jobsState`, and `handleCsvUpload` (`useJobs.js:225`) never touches it. Trevor
confirmed (2026-07-16) the trigger is refresh/reopen itself, not CSV upload.

**Goal:** Make the resolution write reliably land before the user can navigate away, or reliably block
the nag from re-showing on next load until the write is confirmed.

**Hard constraints (non-negotiable):**
- **(A) No lost resolutions.** Once Trevor completes the Catch-Up Interview, that resolution must
  actually reach Firestore before it's safe to consider the interaction "done" — no more silent races.
- **(B) No regression to the known 2026-07-05 data-loss bug class.** Whatever fix ships here must not
  reopen or weaken the existing debounce/flush protections for *other* Daily Log writes — this is a
  narrow fix to the catch-up-resolution path specifically, not a rewrite of the whole save pipeline.

---

## Blast Radius

Touches:
- `src/hooks/useDailyLog.js` — `performSave`, `scheduleSave`, `resolveStaleDays`, the debounce/flush
  logic (lines ~140-208, 592-679)
- `src/components/CatchUpInterview.jsx` — if a "saving, please wait" UI state is needed before the
  modal can close

**Blast-radius per [[project_agent_team]] / root CLAUDE.md:** not one of the explicitly named files, but
it's a live-data write-path change with prior data-loss history in this exact area — **recommend running
through Council anyway** given that history, rather than treating it as safe-to-solo.

---

## Open Design Questions for Council

1. **Await-before-close vs. block-navigation:** should `resolveStaleDays`'s write be awaited before the
   Catch-Up Interview modal is allowed to close (simplest, adds a brief "saving..." moment), or should
   the fix instead add a `beforeunload` guard that warns/blocks a refresh while a save is still pending
   (matches how other unsaved-changes warnings work, but doesn't fix a same-tab immediate re-render
   case)?
2. **Does this same race affect other Daily Log writes** (regular bullet edits, migrations), or is it
   specific to the catch-up-resolution path? If broader, does it belong in this narrow fix or a separate
   follow-up?

---

## Next Session (Build) — locked once Council + Trevor approve above

**Scope (subject to Council's answers above):**
- Ensure `resolveStaleDays`'s Firestore write is confirmed before the user can trigger a refresh/close
  that would lose it (exact mechanism per Council's answer to Q1 above)

**Independent Verifier Checklist:**
- [ ] Complete the Catch-Up Interview, immediately hard-refresh — nag does NOT reappear
- [ ] Complete the Catch-Up Interview, immediately close/reopen the tab — nag does NOT reappear
- [ ] Normal (non-catch-up) Daily Log bullet edits still save correctly, no regression to existing
  debounce/flush behavior
- [ ] No new console errors/warnings introduced around the save-await logic

---

## Session Notes

- Raised by Trevor 2026-07-16 as part of the same "popups keep coming back" report as the two briefs
  above — traced via Explore agent to an independent root cause (write-race, not a delete or fake-hide
  bug).
- Trevor confirmed (2026-07-16) trigger is opening/refreshing the app itself, not CSV upload — CSV
  upload does not touch `ggnz/dailyLogs` at all.
