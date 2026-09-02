---
doc_status: closed
---

# Council record — "one tick, one truth: DL split marks and the board card"

Two independent `ggnz-council` reviewers, 2026-08-20, against the scope lock at
`.claude/pending-brief.md`. Written down because the previous session's council left
no record and the next session had to ask whether it had happened.

**Both verdicts: approve-with-changes. Neither said build it as written.**

## What both reviewers confirmed

Every factual claim in the brief checks out against the live code — `handleMarkPieceDone`
(`src/hooks/useJobs.js:649`), its invoice callback, the D Log's `mark:<itemId>` storage in
`bench_day_marks`, and "Weekly Log rows are one per job, never per split". No stale facts.
No schema change needed. Blast-radius scoping is right.

## Blocking findings

1. **This is a reversal, not a gap-fill.** `src/components/DailyLogPanel.jsx:9-13` and
   `:275-277` carry deliberate, dated comments saying the opposite: "nothing here finishes
   a job", "the Daily Log's mark belongs to the ROW, not the job... ticking one here must
   not tick the job off." Those were written 2026-08-19, one day before this brief. They
   are not stale — they describe the current code correctly. The brief must say it is
   overriding them, and why.

2. **Only one of the two directions is written.** Rules 1–3 wire D Log → `pieceDone`.
   Nothing wires board → D Log. `PomoDrawer.jsx:329` and `CloseDayModal.jsx:21` write to
   `jobs[]` only and never touch `bench_day_marks`. So a tick made on the board leaves the
   D Log's mark exactly where it was, permanently. That is the main path through the
   drawer, not an edge case. Needs its own rule, and `useDayMarks.js` has to be in the
   builder's file list on the **write** side.

3. **"The log and the job can never disagree" is not achievable as specified.** A D Log `×`
   is two independent network writes to two tables (`addItem()` → `bench_day_marks`, and
   `handleMarkPieceDone` → `jobsState`). Either can fail alone. The brief needs a stated
   error/reconcile path, not a promise.

4. **Rule 5 describes UI that does not exist.** The D Log is a flat list — `partsOf` returns
   children only (`kids.length > 0 ? kids : [job]`), so a split job has no "job line" row at
   all. "Splits indented under their job, the job's own line carrying its own mark" is
   net-new UI, not a wiring change. Scope it as such or drop it.

5. **The invoice question must be answered in the scope lock, not deferred to council.**
   A builder needs one answer. Both reviewers recommend the same one: D Log ticks call
   `handleMarkPieceDone` with the `onAllPiecesDone` callback suppressed; board ticks keep
   it. Mechanically safe — `allChildrenDone` is recomputed on every call, never cached, so
   a later board toggle still fires the prompt correctly.

## Non-blocking, worth knowing

- **Finishing the last split from the D Log will tell Trevor nothing.** The invoice toast
  and prompt only exist on the callback path being suppressed. He would only find out the
  job is ready to invoice by opening the board.
- **Re-scheduling moves the row but not the mark.** `bookedOnDay()` places a split from its
  current `calendarSlot`; the `×` is stored under the old day's key. Tick on Thursday, drag
  to Friday — Friday's row shows blank while `pieceDone` is still true.
- **Un-tick from the board is unspecified** when several days carry a `×`. Clear all, clear
  none, or clear the last booked day are all real choices. The builder should not invent one.
- **Board-ticking onto a hidden row** writes a mark that never renders — dead data, harmless,
  but should be a documented non-issue rather than a surprise.
- **Re-splitting a job** drops children whose ids change, leaving orphaned marks; a genuinely
  finished piece can silently reset to not-done on both screens with no flag.
- **A blank job line above all-`×` splits is not a bug** — the Weekly Log already draws this
  exact distinction (`BenchWeekPage.jsx:89-93`). The brief should say so out loud.
- **Both writes must go through the same batched path** (`batchWriteJobsState`/
  `jobsStateFieldsFor`) as the board's existing calls. A parallel write path makes the two
  truths drift by construction.

---

# Round 3 — 2026-08-20, opus reviewers, against the rewritten scope lock

Rounds 1 and 2 are history from here down: they reviewed the *old* design ("one
tick, one truth" — a Daily Log tick and the board tick as one fact in both
directions). Trevor redirected to a different design, so those rulings were set
aside, and he asked for opus reviewers after two sonnet rounds blocked on points
he judged not worth blocking on.

**The design reviewed:** the marks already in use — `/` worked on today, `×`
complete but waiting on the Weekly Log's final `×`, `>` deferred to some other
day — get a control on every Daily Log row. Picking one writes the same mark to
that job's Weekly Log cell for that day, so Trevor isn't tapping both logs. The
app never books a day and never raises a picker, popup or toast. The Weekly Log's
closing `×` stays his tap and the only thing that invoices.

**Verdicts: approve-with-changes, and block-on-two-points.** Both reviewers
reached the same two findings independently, and both were folded into the scope
lock before the build.

## Would have been wrong at the bench

1. **"Never overwrite a marked cell" blocked Trevor correcting his own mark.**
   Once a pick writes `/` into the week cell, the cell is no longer blank — so
   changing that row to `×` later left the Weekly Log stuck on `/`, the exact
   thing the build exists to stop. A cell stores only a mark string
   (`useWeekMarks.js:10-13`), with no record of who wrote it. Resolution: a row
   may overwrite or clear the mark it itself last wrote; it refuses only a cell
   holding a mark it didn't write, and says so.

2. **Clearing `pieceDone` on any non-`×` mark silently un-ticks the board.**
   `pieceDone` is written from three other places (`JobCard.jsx:90`,
   `PomoDrawer.jsx:329`, `CloseDayModal.jsx:21`). Tick a piece done on the board,
   then pick `/` in the Daily Log because more work happened, and the tick
   vanished with no warning. Resolution: `pieceDone` moves only as `×` arrives or
   leaves.

## Corrections to the brief's facts

3. Marks are stored as **keys** (`slash`/`cross`/`arrow`), not symbols — writing
   the symbol saves a value `cellMark()` cannot draw, i.e. a mark that saves and
   shows blank.
4. The mark control **already exists** on job and split rows
   (`DailyLogPanel.jsx:467`); only hand-typed tasks lack one. Smaller than the
   brief implied.
5. No new `parentJobId` field: splits already carry `parentId`, the panel already
   builds `jobById`, and `topLevelJob()` is exported and tested. Rows mix split
   ids and top-level ids, so the lookup must skip ids not in `jobs` (typed tasks).
6. "A marked cell" must mean the **stored** mark. `cellMark()` draws `·` on any
   booked day without storing anything, so testing what's drawn would refuse
   nearly every job.
7. Pass raw `handleMarkPieceDone`, not `handleMarkPieceDoneWithInvoicing`
   (`App.jsx:376`), which hard-wires the invoice callback.
8. `useJobs.js:695` still toasts "ready to invoice" when the last piece goes done,
   callback or not. It is a message, not the prompt — the verifier should not read
   it as a failure.
9. `dayMarks.ready` and `weekMarks.ready` are separate gates with separate failure
   counters; check both before writing either half, and don't reuse the panel's
   existing `ready` prop for the new one.

## Noted in passing, not this build

- The board's own `pieceDone` ticks will not update the Daily Log mark — out of
  scope by decision, but the two can read differently.
- Pre-existing bug: the typed-task Remove passes an id where a row object is
  expected (`DailyLogPanel.jsx:595` vs `:339`), so removing a typed task always
  fails with a toast.
- This design does override `DailyLogPanel.jsx:275`'s dated comment that a Daily
  Log mark must not reach the job. That is Trevor's call, made knowingly.
- No collision with the workshop rules: the app books no days, so the 12-hour glue
  rule is untouched, and nothing here re-opens a completed job or reads BL/WP.

## What the verifier must physically click

- Week loaded: pick `×` on a split row → that job's Weekly Log cell for that day
  shows `×`, and it survives a reload.
- Same row changed to `/` → the week cell follows (this is the finding-1 check).
- Mark a cell by hand in the Weekly Log first, then pick a different mark on the
  Daily Log row for that day → the week cell stays, and a message says so.
- Two splits of one job, same day, different marks → one week cell, message on the
  second.
- Tick a split done on the board, then pick `/` in the Daily Log → the board tick
  survives (the finding-2 check).
- Hand-typed task → mark saves, no Weekly Log row appears.
- Week not loaded → a visible message, never a silent tap.
