---
doc_status: live
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
