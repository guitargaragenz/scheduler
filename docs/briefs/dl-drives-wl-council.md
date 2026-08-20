---
doc_status: live
---
# Council record — the Daily Log drives the Weekly Log

Second council run, 2026-08-20, two independent opus reviewers. The earlier sonnet
round on this work is void — Trevor's call, after it blocked twice on points he
judged not worth blocking on. Reviewers were asked to separate findings that give a
wrong result at the bench from unspecified detail a builder resolves sensibly, and
to block only on the former.

**Verdicts:** approve-with-changes and block-on-two-points. Both reviewers landed on
the same two bench-wrong findings, independently.

## Bench-wrong — both folded into the scope lock

1. **"Never overwrite a marked cell" prevented Trevor correcting his own mark.**
   Once a Daily Log pick writes `/` into the week cell, that cell is no longer blank.
   Changing the same row to `×` later would leave the Weekly Log showing `/` — the
   exact disagreement the build exists to remove. Nothing in `bench_week_marks`
   records who wrote a cell (`useWeekMarks.js` stores a bare mark string), so the
   rule cannot tell Trevor's own earlier pick from a mark he set by hand.
   **Fix in the lock:** a row may overwrite or clear the mark it last wrote; it
   refuses only a cell it didn't write, and says so.

2. **Clearing `pieceDone` on any non-`×` mark would silently un-tick the board.**
   `pieceDone` is also written from `JobCard.jsx`, `PomoDrawer.jsx` and
   `CloseDayModal.jsx`. Tick a piece done on the board, then pick `/` in the Daily
   Log because more work happened, and the pick would write `pieceDone: false` with
   no warning. **Fix in the lock:** `pieceDone` moves only as `×` arrives or leaves.

## Detail — defaults taken, no brief change needed

- The mark control already exists on job and split rows (`DailyLogPanel.jsx:467`);
  only hand-typed task rows lack one. Smaller job than the brief implied.
- Marks are stored as keys (`dot`/`slash`/`arrow`/`cross`), not symbols. Passing a
  symbol to `setMark` saves a value `cellMark()` cannot draw — it shows blank.
- No `parentJobId` plumbing needed: splits carry `parentId`, the panel already builds
  `jobById`, and `topLevelJob()` is exported and tested. Rows mix split and top-level
  ids, so the lookup must tolerate both and skip ids absent from `jobs` (typed tasks).
- `handleMarkPieceDone` bails when it can't find a parent, having already changed
  local state — so skip the call entirely when the row isn't a split's child.
- `useDayMarks` and `useWeekMarks` have separate ready flags and failure counters;
  the day half can save while the week half is refused.
- `useJobs.js:695` toasts "ready to invoice" when the last piece goes done, callback
  or not. It is a message, not the invoice prompt — the verifier shouldn't read it
  as a failure.

## Pre-existing bug noticed in passing (not this build's scope)

Removing a hand-typed task passes an id where a row object is expected
(`DailyLogPanel.jsx:595` vs `:339`), so the removal always fails with a toast.

## What the verifier must physically click

- Week loaded: pick `×` on a split row → that job's Weekly cell for that day shows
  `×`, and survives a reload.
- Same row changed to `/` → the Weekly cell follows. (Catches finding 1.)
- Mark a cell by hand in the Weekly Log first, then pick a different mark on the
  Daily Log row for that day → the Weekly cell stays, with a message on screen.
- Two splits of one job, same day, different marks → one Weekly cell, message on the
  second pick.
- Tick a split done on the board, then pick `/` in the Daily Log → the board tick
  survives. (Catches finding 2.)
- Hand-typed task → mark saves, no Weekly Log row appears.
- Week not loaded → a visible message, never a silent tap, and nothing saved.
- `×` on a split → no invoice dialog opens.
