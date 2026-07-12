# GGNZ Pending Brief

_This file is written by the Mac session when a fix brief is ready for Trevor's approval._
_Open claude.ai/code on iPhone → select guitargaragenz/scheduler → read this file → reply "yp" to proceed or "no" to cancel._

---

## Status: SHIPPED 2026-07-12 — cutover complete, live in production.
Merged to `main` and deployed (`0ec7caa` → `bb4ef1c`). Production migration ran for real: 96 job
records (50 top-level + 46 split children) copied from the old `ggnz/schedule` doc into `jobsMaster`/
`jobsState`, verified with 0 unexplained diffs and 0 orphans against a pre-migration snapshot backed
up to `scripts/backups/`. Old `ggnz/schedule` doc frozen (not deleted) for a 2-week probation window
— revoke access/delete it no earlier than **2026-07-26**.

**One real bug caught live, during the smoke test, and fixed on the spot:** the migration wrote the
new `ggnz/scheduledSlots` doc's data under the field name `scheduledSlots` instead of `slots` (what
`firebase.js` actually reads) — the live calendar would have rendered completely empty despite every
job's data being intact. Caught before Trevor ever saw it (a scripted reconstruction check run
immediately after deploy, before any browser click-through), fixed directly on the live doc (same 37
slots, corrected field name), migration script corrected too. Confirmed fixed both computationally
(0 dangling slot references) and visually (live browser check: calendar renders scheduled jobs
correctly, job/bench counts add up, no console errors).

**Not yet done:** `scripts/sheet_to_csv.command`'s deployed twin on Micky's Desktop
(`~/Desktop/SCHEDULER_old/sheet_to_csv.command`) was redeployed via the documented curl command and
confirmed byte-identical to the repo copy — this IS done. What's still open: no live watcher process
was found running during cutover (`ps aux` showed nothing), so the automated 2-minute poller isn't
currently active — if Trevor relies on it, `start_watcher_fixed.command` (note: filename drifted from
`start_watcher.command`, worth reconciling) needs to be started for the new CSV pipeline to actually
sync. First live CSV upload / real split-job edit through the app hasn't been done yet — worth a
deliberate first real test when Trevor's next at the bench, not urgent, the architecture doesn't need
it to be considered done.

Full incident/fix history: memory `project_manual_split_data_loss_2026_07_12.md`.

Superseded status below (architecture approval) kept for history — supersedes the two entries below
it in turn (the `isSubtask`-flag guard and the fresh-eyes split/sync review they point to). Full
investigation: root cause confirmed (not just theorized) by 3 independent code-reading passes, two
rounds of guard-style patches proposed and rejected by adversarial council review, then a full
architectural redesign proposed and approved by Trevor after he explicitly rejected further patching
("I don't want a patch job... I want to eradicate the cause"). Two more independent council reviewers
stress-tested the redesign; both said "sound with modifications" — modifications folded in below.
Trevor then reviewed and ruled out two of the remaining risks (job-number reuse, two-device races —
both structurally impossible given how he actually runs the shop) and required one more fix (atomic
batched writes for a split-set) before calling it resolved.

# Brief — Split `ggnz/schedule` into `jobsMaster` + `jobsState` (job-master/schedule-state migration)

**Root cause / goal:** #1520 (Ampeg SVT 6 Pro) and #1175 (Allen & Heath GL2800) had their manual
split data permanently, silently deleted from Firestore. Confirmed mechanism: `ggnz/schedule` holds
ONE `jobs` array mixing CSV/Sheet-owned fields (written by `scripts/sheet_to_csv.command`) and
app-owned fields (written by the React app) in the same records. Both writers rebuild and blind-
overwrite the *entire* array on every write. When a job's status/Hours/Days momentarily falls
outside the CSV script's accepted set, its parent record drops from that sync's rebuild; the
script's own carry-forward logic re-appends the job's split children regardless (orphaning them, not
deleting them, at that layer) — but `withSplitsExpanded()` (`src/hooks/useFirebase.js:8-73`) only
restores children by iterating *present* top-level parents, so an orphan's parent id is never
visited and the orphan is silently excluded from the next save. Structurally identical bug in the
in-app CSV-upload path (`useJobs.js` `handleCsvUpload`).

Two rounds of guard-style patches were rejected: (1) comparing stored children against freshly-
recomputed `createSubtasks()` output — unsafe, that output isn't stable against desc/bench drift;
(2) a 3-layer additive-guard design — two independent reviewers found it only covered the confirmed
mechanism (not the still-unruled-out isSubtask-flag-loss theory), risked a *new* duplicate-id
corruption mode, and left revived records as permanently invisible zombies with no UI resolution
path. Trevor's call: stop patching, fix the actual architecture.

**Fix scope:** split `ggnz/schedule` into two Firestore collections, each with exactly one writer,
each written via per-document updates (never a blind whole-collection overwrite):
- `jobsMaster/{jobId}` — CSV/Sheet-owned fields only. Written only by `sheet_to_csv.command` (both
  copies — repo + `~/Desktop/SCHEDULER_old/`) and the in-app CSV-upload path, via per-job upserts.
- `jobsState/{jobId}` — app-owned fields only (`scheduled`, `calendarSlot`, `gcalEventId(s)`,
  `pomoLog`, `done`, `isSplit`, `noAutoSplit`, `parentId`, `sessionNote`, `sessionIndex/Total`,
  `bumpHistory`, `manualSplits`). Written only by the React app. **Deliberately keeps today's flat
  `parentId`-linked model** (one doc per job id, parent and split children each their own doc) rather
  than redesigning into an embedded map — an embedded-map alternative was considered and rejected: it
  solves nothing the plain collection-split doesn't already solve, while costing a rewrite of ~15
  `setJobs()` call sites, Google Calendar sync, and leaving `scheduledSlots`' new home undefined. The
  deciding property: **the CSV script never having a code path into `jobsState` at all** is what
  eliminates the orphaning bug, not the internal shape of the records.

Required design decisions folded into the build (see full detail in
`/Users/admin/.claude/plans/handoff-saved-to-re-fresh-runway-rename-quiet-otter.md`, "PART 2"):
join semantics for `jobsMaster`/`jobsState` mismatch (union join, surface via the existing
`pendingRevenueReview` pattern, never silently drop); `App.jsx`'s bench-keyword handler needs an
explicit `jobsMaster` write path; `scheduledSlots` gets its own single-writer doc; cutover needs an
explicit reload-all-devices step, not just pausing the Python poller; **split-set writes must be a
single Firestore batched write (`writeBatch`), never sequential — non-negotiable, a killed
app/network mid-split must never leave a half-created split.** Job-number reuse and two-device races
were raised and explicitly ruled out by Trevor as non-risks for this shop — no defenses needed there.

**Migration for existing production data (86 jobs, 33 split children, no backup/PITR):** manual JSON
snapshot first (this IS the backup) → additive-only migration script (never touches the old doc) →
verification script (set/key-based deep-compare against the snapshot, zero unexplained diffs) → hard
cutover (pause poller → migrate → verify → reload every device → deploy app+script together → resume
poller → live smoke test) → freeze (don't delete) the old doc for a 2-week probation window.

**Blast radius:** `useFirebase.js`, `useJobs.js`, `useGoogleCalendar.js`, `firebase.js`,
`scripts/sheet_to_csv.command` (both copies), plus a real one-time production data migration.
Council-reviewed twice already (this session); genuinely larger blast radius than the rejected
patches, but structurally safer — after this ships, the CSV script has no path through which it
*could* delete split data, structurally, not through discipline.

**Verification:** build session — unit-test the join function against fixture edge cases (normal
job, manual split, auto split, orphaned split, done job with splits, bench-keyword-edited job).
Cutover session — verification script's zero-diff pass is the primary gate; live smoke test after
(schedule a job, split a job, run a CSV upload, confirm `jobsState` untouched by it).

**Honest scope:** not a single-session build. This session = architecture brief + council review,
done. Needs a dedicated build session (implement against scratch Firestore/local fixtures, never
touching prod, independently reviewed before going near prod) and a separate dedicated cutover
session for the actual production migration.

Full design detail: `/Users/admin/.claude/plans/handoff-saved-to-re-fresh-runway-rename-quiet-otter.md`
("PART 2"), investigation history in memory `project_manual_split_data_loss_2026_07_12.md`.

---

## Status: SUPERSEDED — not building this version.
Both independent council reviewers rejected the fix scope below (the `createSubtasks()`-diff approach
isn't stable against desc/bench drift, risks permanently freezing stale auto-split leftovers as fake
manual data). Trevor's call 2026-07-12: review the whole split/sync structure fresh in its own
dedicated session rather than patch this in isolation. Full writeup, both council reports, and a
second (more promising, not yet reviewed) theory are in memory:
`project_manual_split_data_loss_2026_07_12.md`. Kept below for reference only.

# Brief — Stop manual splits being silently dropped on reload (SUPERSEDED, see above)

**Root cause / goal:** Trevor found two jobs (#1520 Ampeg, #1175 Allen & Heath GL2800) whose manual
splits had completely vanished from Firestore — no split flags, no child records, nothing.
`withSplitsExpanded` (`src/hooks/useFirebase.js`) runs on every load/snapshot and only restores a
manual split's children if they carry `isSubtask: true`. If that flag is ever missing on a stored
child, the function falls through to regenerating via `createSubtasks()` instead — which won't
reproduce an arbitrary user-chosen split, so the job appears to have never been split. That state
then gets written back to Firestore by the next debounced save, permanently erasing the split.
Confirmed: every currently-alive manual split in Firestore has `isSubtask: true` set correctly, and
the current split-creation code (`useJobs.js`) does set it — so this can't be reproduced from a fresh
click-through today, but the failure mode itself is real and would resurface if the flag is ever lost
by any future code path (or was on some older split that predates the flag).

**Fix scope:** `withSplitsExpanded` no longer trusts `isSubtask` alone. It computes what
`createSubtasks(job)` would generate for this parent (already computed once, reused — no behavior
change to the actual auto-split regeneration), and classifies any stored child NOT in that
auto-generated id set as a manual child needing restoration — regardless of the `isSubtask` flag.
This can never regress auto-split children (they're always reproducible by `createSubtasks()` so are
correctly excluded from "manual" classification) and self-heals the flag going forward
(`isSubtask: true` re-stamped on every restored manual child).

**Blast radius:** `useFirebase.js` — flagged file, council mandatory, no exceptions.

**Verification:** synthetic test — simulate a stored job with a split child missing `isSubtask`,
confirm it's still restored as a manual child, not dropped. Confirm a genuine auto-split job with no
manual children still regenerates via `createSubtasks()` exactly as before (no regression). Confirm
a job that was deliberately un-split (`noAutoSplit: true`) still stays un-split.

**Not in scope:** recovering #1520/#1175's actual lost split data — no backup/version history exists
for this Firestore project, Trevor will manually re-split both once this fix ships.

---

## Status: SHIPPED — merged to main (commit `95eb262`), deployed.
Independent verifier caught a real double-invoice risk (done jobs weren't excluded from the live
lookup) before commit — fixed and re-verified SAFE TO COMMIT. Approved by Trevor 2026-07-11.

# Brief — Job complete real invoicing + bench/split visibility + completed-job lookup fix

**Root cause / goal:** "Job complete" in Catch-Up Interview / Close Day was a placeholder — it
stamped the daily-log bullet done but never touched the real job record or captured an invoice
amount. Separately, neither screen showed bench/split info, so deciding Carry/Skip/Complete on a
split job meant deciding blind. Both already built and sitting uncommitted in the working tree
(verified via `git diff --stat`, matches the plan at `~/.claude/plans/attach-typed-parasol.md`).

On top of that: live testing surfaced "job complete does nothing" for old bullets. Root cause
(confirmed by two independent agents in the prior session, reconciled): the job lookup only checks
the live `jobs[]` array, never `completedJobs` — so a bullet referencing a job that already finished
and was properly processed through the revenue-review banner still shows as "not found" and silently
does nothing instead of saying "already done."

**Fix scope:**
1. Commit the already-built, uncommitted work as-is (verified clean against the plan):
   `src/App.jsx`, `src/data/jobs.js` (new pure helper `getJobSplits`), `src/components/CatchUpInterview.jsx`,
   `src/components/CloseDayModal.jsx` — inline amount entry on Job complete (reuses existing
   `handleMarkDone`, no new write path), always-visible bench/split chips.
2. New fix on top: extend the job lookup in `CatchUpInterview.jsx`/`CloseDayModal.jsx` to also check
   `completedJobs` before concluding "no matching job" — surface it as already-done (e.g. "already
   invoiced $X — marking bullet done") instead of silently advancing with no feedback.
3. Also closes the parking-lot bug "Job complete silently does nothing when bullet's job can't be
   resolved."

**Blast radius:** none of the 5 flagged files. `getJobSplits` is a pure additive helper, no `jobs[]`
shape change. Job-complete write path reuses existing unmodified `handleMarkDone`. Judgment call —
no council required, but independent verifier still runs given jobs[]-adjacent reads.

**Verification:** dev server — Catch-Up/Close Day "Job complete" on a live job shows amount input,
confirms writes `completedJobs`/`doneJobIds`/`job.done`; a bullet tied to an already-completed job
shows the new "already done" message instead of silent failure; bench/split chips render for both
plain and split jobs; a bullet with no resolvable job at all still falls back gracefully with a
visible message, not silence.

**Rollback:** these commits land on top of current `main` (HEAD `04ca511`) with no blast-radius
touch — if something's wrong post-merge, `git revert` the specific commit rather than a hard reset.

---

## Status: SHIPPED — Problem 3 merged to main (commit `8eb9f90`), deployed.
Rollback tag `pre-bump-reason-stable` at commit `065ac8f` (pre-build, on main before merge).
Independent verifier: PASS (7/7) on the useScheduler.js blast-radius diff. Code review: 3
low-severity non-blocking findings (see merge commit message). Vercel preview click-tested
and approved by Trevor before merge.

All three problems (revenue-review, auto-carry-forward/catch-up, bump-reason) now SHIPPED.

**Issued:** 2026-07-11
**Problem 1 status:** SHIPPED — merged to main, deployed (commit `79c16b9`).
**Problem 2 status:** SHIPPED — merged to main, deployed (commit `efa9b42`).

# Brief — Problem 3: Capture a reason when a job gets bumped to another day

**Root cause / goal:** dragging a scheduled job to a different day is currently a silent overwrite
— no record of why the original slot didn't work out. Trevor wants a quick, skippable prompt
capturing a reason.

**What 2 independent reviewers found before build:**
1. `BumpReasonModal` should reuse the reason-picker UI already built and shipped inside
   `CatchUpInterview.jsx` (Problem 2) rather than build a near-duplicate — extract it into a small
   shared piece first.
2. The exact "is this a genuine bump" check needed to be precise (must compare against the job's
   pre-move slot before it gets overwritten) — now specified exactly in the revised plan.

**Fix scope:**
- Extract shared reason-picker UI from `CatchUpInterview.jsx` into a small shared component; refactor
  `CatchUpInterview` to use it; build `BumpReasonModal` on top of the same piece.
- Detect a genuine bump inside `handleRegularDrop` (`useScheduler.js`) — covers desktop drag AND
  mobile's "Place on Calendar" (confirmed same code path, twice). Only day-to-day moves of an
  already-scheduled job count; first-time placement and same-day time changes don't.
- New `job.bumpHistory` array field, additive, persists automatically through existing save.
- **Explicitly excluded, confirmed with you:** `unscheduleJob` (drag to sidebar — "unwanted noise"
  per your words last session) and `handleUrgentDrop` (force-displacement — shouldn't add friction
  to a flow meant to be fast).
- Auto-carry-forward (Problem 2) also logs a bump entry with no prompt for job-linked carried
  bullets, with an inline reason-picker next to the existing "carried from" badge.
- Every bump entry also appends to the existing conflict log for one chronological feed.
- Touched: `src/hooks/useScheduler.js` (blast-radius file), `src/hooks/useDailyLog.js`,
  `src/components/DailyLogPage.jsx`, `src/components/CatchUpInterview.jsx` (refactor to shared
  picker), `src/utils/firebase.js` (conflict log extension), `src/components/JobDrawer.jsx` /
  `src/components/PomoDrawer.jsx` (read-only bump history display), `src/App.jsx`.
- New: `src/components/BumpReasonModal.jsx`, small shared reason-picker component.

**Blast radius:** `useScheduler.js`/`calendarSlot` — flagged, council already run (2 agents, both
confirmed low corruption risk since the reason capture is additive/fire-after-commit, doesn't touch
the actual slot-write logic).

**Verification:** code review confirming bump detection doesn't misfire on first-time scheduling or
same-day adjustments; synthetic test dragging a throwaway job to a different day, confirm modal
appears/is skippable, confirm `bumpHistory` lands on the job and in the conflict log.

**Rollback:** tag `pre-bump-reason-stable` created before build starts;
`git reset --hard pre-bump-reason-stable && git push origin main --force`.

Full design detail (revised): `/Users/admin/.claude/plans/yp-use-whatever-agents-cozy-conway.md`
(Problem 3 section).

# Brief — Problem 2: Daily Log auto-carry-forward + catch-up interview

**Root cause / goal:** unfinished Daily Log items from a skipped day just sit orphaned — the
Keep/Drop/Defer migration logic exists but only runs if Trevor clicks an easy-to-miss "Close day"
button he usually forgets.

**What two independent reviewers found before build (both confirmed all 4 points):**
1. The new "scan for most recent unresolved prior day" logic must run inside the existing
   `updateState` callback in `useDailyLog.js`, not against outer component state — a subtlety the
   original plan didn't spell out.
2. **Real bug worth fixing now, not later:** Daily Log currently saves via a blind full-document
   overwrite (no merge). Auto-carry adds a new *unattended* automatic write every time Daily Log
   opens — with 3 devices (iMac/MacBook/iPhone), opening it on two around the same time could
   silently drop one device's carried item. Fix: switch to merge-safe per-day writes (same pattern
   already used for Problem 1's revenue doc).
3. "Modeled on the Sunday board-meeting interview" turned out to be UX inspiration only, not code
   reuse — that's an offline agent script, not an in-app component. `CatchUpInterview.jsx` is
   genuinely new UI, budgeted as such.
4. **Pre-existing adjacent bug, unrelated to this feature but must be fixed alongside it:**
   `CloseDayModal.jsx`'s whole-bullet filter doesn't exclude already-migrated bullets (the
   checklist-item filter does this correctly, whole-bullets doesn't) — once auto-carry starts
   stamping bullets, this gap could let an already-carried item get duplicated. Small, contained fix.

**Fix scope:**
- Extract shared "kept" resolver from `closeDay()`, add `autoCarryForward()` (single stale day →
  silent carry with a "carried from" badge; multiple stale days → Catch-Up Interview instead).
- Fix the merge-safety of Daily Log's Firestore save.
- Fix `CloseDayModal.jsx`'s whole-bullet filter gap.
- New: `src/components/CatchUpInterview.jsx`.
- Touched: `src/hooks/useDailyLog.js`, `src/components/DailyLogPage.jsx`,
  `src/components/CloseDayModal.jsx`, `src/utils/firebase.js` (Daily Log save function).
- Nothing else changes — no touch to Problem 1 or Problem 3 scope, no touch to
  `scheduledSlots`/`calendarSlot`/`useGoogleCalendar.js`/`jobs[]`.

**Blast radius:** none of the 5 flagged files. Judgment call, not mandatory — but given this
already had 2 independent review passes and real findings, I'm treating it with the same rigor as
a flagged build: independent verifier still runs after the build, same as Problem 1.

**Verification:** synthetic multi-day test in local dev only (never simulate date changes against
production data) — confirm single-day case carries silently with badge, multi-day case triggers
the interview instead of a silent dump, running carry-forward twice never duplicates, and the
Close Day modal fix doesn't resurface already-migrated bullets.

**Rollback:** tag `pre-daily-log-carry-stable` will be created before build starts;
`git reset --hard pre-daily-log-carry-stable && git push origin main --force`.

Full design detail (revised): `/Users/admin/.claude/plans/yp-use-whatever-agents-cozy-conway.md`
(Problem 2 section).

# Brief — Problem 1: Surface disappeared-from-CSV jobs for invoice entry (REVISED)

**Root cause / goal:** Revenue pill reads $0 because it only updates when a job is marked done
*inside the app*, but Trevor finishes/invoices in Multitrack — the in-app step never fires, so
jobs that vanish from a CSV upload leave no record of being done+invoiced or cancelled.

**What changed:** 2 independent council reviewers unanimously found the original design (diff
inside `handleCsvUpload`) would never fire in Trevor's real automated workflow, since that
pipeline writes to Firestore directly and bypasses the React app's CSV upload path entirely.
Trevor chose the client-side fix: diff inside the `onSnapshot` listener in `useFirebase.js`
instead, which sees every real job-list change regardless of which pipeline wrote it.

**Fix scope:**
- `subscribeToSchedule`'s `onSnapshot` callback (`useFirebase.js`) diffs old vs incoming
  top-level, non-done jobs. Jobs that vanish go into a new isolated Firestore doc
  (`ggnz/pendingRevenueReview`, cloned from the existing `focusList` pattern, but written with
  merge-on-read/keyed-map semantics rather than a blind `setDoc`, since this doc can be written
  by both an automated sync and a manual dismiss around the same time and holds financial data).
- New `RevenueReviewBanner` component (visual pattern from `ConflictBanner`) lists each
  disappeared job with two outcomes only:
  - **Done + invoiced** — amount input, calls existing unmodified `handleMarkDone`.
  - **Cancelled** — free-text notepad, no revenue impact.
- New files: `src/hooks/usePendingRevenueReview.js`, `src/components/RevenueReviewBanner.jsx`.
- Touched: `src/hooks/useFirebase.js` (blast-radius file), `src/utils/firebase.js` (new
  save/load/subscribe trio), `src/App.jsx` (wire + render banner near revenue pill).
  `useJobs.js`/`handleCsvUpload` no longer touched.
- Nothing else changes — no touch to Problem 2/3 scope, no touch to `scheduledSlots`/
  `calendarSlot`/`useGoogleCalendar.js`.

**Blast radius:** `useFirebase.js` (flagged file, new in this revision) + `jobs[]` shape. Council
already run once on the original design and caught this issue — same council findings otherwise
still apply (split children/subtasks correctly excluded via `!parentId`, two-outcome scope
sufficient).

**Verification:** synthetic test simulating an old jobs[] vs a new jobs[] missing one non-done
top-level job (confirm banner shows exactly that job, not `done` jobs or split children); also
confirm no misfire on the very first snapshot after app load. Not run against real active
production jobs.

**Rollback:** `git reset --hard pre-revenue-review-stable && git push origin main --force`
(tag already created @ c72482e, before any commits).

Full design detail: `/Users/admin/.claude/plans/yp-use-whatever-agents-cozy-conway.md` (Problem 1
section, revised 2026-07-11), technical research in the companion
`-agent-a7c224782ef299772.md` file.
