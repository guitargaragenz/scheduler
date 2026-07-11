# GGNZ Pending Brief

_This file is written by the Mac session when a fix brief is ready for Trevor's approval._
_Open claude.ai/code on iPhone → select guitargaragenz/scheduler → read this file → reply "yp" to proceed or "no" to cancel._

---

## Status: AWAITING APPROVAL

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
