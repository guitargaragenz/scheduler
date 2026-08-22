---
doc_status: live
---
# Two Weekly Log regressions reported 2026-08-22 — not yet diagnosed

**Read this whole file before touching code. Nothing in it has been verified
against the live app or the live data — it is Trevor's report plus the list of
what changed today.** The session that wrote it had already made two wrong
assumptions and was ended deliberately rather than debug tired.

## What Trevor sees, in his words

1. **"completed jobs have disappeared from WL since last fix"**
2. **"a completed subtask puts an x on WL as well"**

Both on the **Weekly Log**. Both noticed after today's merges.

**Ask him which he means before assuming**, on both counts — that is exactly
what cost a build round earlier today:

- For (1): jobs gone from the week page's rows altogether, or the trailing `×`
  closing column gone blank? "Completed" could mean the job is finished, or the
  day cell held a `×`.
- For (2): which tick does he mean — the job card's `○ / ✓` per bench, the
  Pomodoro drawer's "Mark piece done", the Close Day list, or the Daily Log's
  `×`? And is the `×` landing on the day cell, or on the trailing close column?

He has asked, twice, to **be asked when something in his description doesn't
line up** rather than have the code searched around speculatively.

## What shipped today, newest first — the suspect list

All on `main`. Both regressions appeared after these.

| Commit | What it changed |
|---|---|
| `87dad26` (PR #37) | **Prime suspect for both.** Weekly Log day cells stopped being tap-to-cycle buttons and became `<select>` dropdowns. `handleCell()` was replaced by `setCell()`, and **`nextMark()` plus its `CYCLE` constant were deleted** as dead code. Browser arrow stripped off the Daily Log's dropdowns too. |
| `0be24bd` (PR #35) | Daily Log picker rebuilt. `dayJobOptions()` now skips a piece that is `scheduled`, has a `calendarSlot`, **or** is `pieceDone`. This narrowed what the picker offers — if "disappeared" turns out to mean disappeared from a *picker* rather than the week grid, start here. |
| `54ce790` (PR #34) | Daily Log typed-task Remove button fixed. Small, local, unlikely. |
| `f589506` (PR #33) | Build 2 — Daily Log splits render indented under a synthesized job header row, which carries **its own mark**. The header and any split of that job resolve through `weekCellJobId()` to the **same** Weekly Log cell, last pick wins. **If (2) is a stray `×`, this is where a second writer to one cell was introduced.** |

## Facts worth having, verified today

- **The Weekly Log's day cells have never been tap-to-cycle since `87dad26`** —
  that commit is what made them dropdowns. Before it, `handleCell()` cycled
  through `nextMark()`. Trevor believed the dropdowns had been *lost*; they had
  never existed until today.
- **`Sidebar.jsx:20` hides sub-tasks that are `scheduled`, NOT ones that are
  `pieceDone`.** Assuming the opposite cost a build round on job 1632 today.
  Whatever the job card appears to be hiding, read that line before believing it.
- **A Daily Log `×` writes `pieceDone` on the split** (`DailyLogPanel.jsx`,
  `handleSetMark` → `onMarkPieceDone`) **and** writes the mark to the Weekly Log
  cell under the **top-level** job id (`weekCellJobId()`). Two effects from one
  pick — a likely shape for (2).
- **`pieceDone` moves only when a `×` arrives or leaves**, and only for a row
  that is a split's child. That rule is deliberate: `JobCard`, `PomoDrawer` and
  `CloseDayModal` all write `pieceDone` too, and a blind clear silently un-ticks
  their work.
- **The Weekly Log draws one row per top-level job.** `weekRows()` skips
  anything with a `parentId`, so a mark filed under a split's own id saves fine
  and shows nowhere.

## How to work it

1. **Ask Trevor the two clarifying questions above first.** Do not grep around
   to guess which screen he means.
2. Check it against the **live app and live data**, not against this file.
   Documents describe the past.
3. `git revert 87dad26` is the cheap experiment if (1) and (2) both point at the
   week page — it is one self-contained commit and reverting proves or clears it
   in one step. Do not revert as a *fix* without knowing why it worked.
4. Whatever the fix, **the test has to render the page and change a real cell.**
   `BenchWeekPage.marks.test.jsx` and `DailyLogPanel.marks.test.jsx` both do
   this. Every failure this page has ever shipped — the dropped `setMark` in
   `App.jsx` on 2026-08-20, the Remove button today — passed every helper test
   while doing nothing on screen.

## State of the repo

`main` is green: 703 tests, 38 files, production build clean. Nothing is in
flight — no open PRs, no unmerged branches, all of today's documents closed.
Today's other work (Daily Log indented splits, the rebuilt picker, the Remove
fix) is recorded in `dl-picker-rebuild.md` and `dl-drives-wl-full-record.md`.
