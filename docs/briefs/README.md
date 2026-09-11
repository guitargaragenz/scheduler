# Session briefs

Handoff notes written at the end of a session so the next one can pick up without
re-deriving anything.

**How to use these:** read the one named in your starting prompt, and only that one.

Every brief carries a `doc_status:` line at the very top:

| `doc_status` | What it means |
|--------------|---------------|
| `live` | Real, current work. Act on it. |
| `parked` | Scoped but deliberately not started, and **not approved**. Don't build it. |
| `closed` | Finished history. A record of what happened — **never** a task list. |

A `closed` brief's "next steps", "awaiting approval" and "do this next" sections are part
of the record. They are not work to pick up, however live they sound.

**A brief is a snapshot of the day it was written, not a description of the code.** If a
brief tells you how the app behaves, check the app. Briefs E, F and G each lost a build
round to a fact that was true when written and wrong by the time it was read.

Reading a `closed` or `parked` brief trips a hook (`.claude/hooks/warn-closed-brief.py`)
that says so, wherever in the file you entered. That's a backstop, not permission to skip
the status line.

---

## Live — work that hasn't finished

| Doc | What it does |
|---|---|
| [2026-09-11-session-handoff.md](2026-09-11-session-handoff.md) | **Current — start here.** Nothing is mid-build. Says what the next work should be and where it starts. |

The mobile top bar fix shipped 2026-09-11 at `4e40dd7` — the header now wraps
and the button row swipes, so the week dates and arrows stay on screen at phone
width.

The completion-date fix shipped 2026-09-11 at `049ec99` — money now lands in the
week the work finished. Merged without the browser test, at Trevor's call.

The brand/model bench fix shipped 2026-09-03 at `046a6d6`
(PR #64) — see Closed. Cleared 2026-09-03: 13 briefs were still marked `live` while
describing work that had already shipped, and sessions were starting against them.
The last of them, the keyword revert, went in with PR #60.

The next piece of work gets chosen from Parked, with Trevor — it is not picked off
this page. Start a session with `next`; if this section is still empty, say so.

## Noticed, not scoped

Real, nobody has picked them up, and they are not attached to any brief.

- **Three revenue rows carry the wrong week, all stamped 2026-09-07.** Left by the
  bug the completion-date fix closed (shipped 2026-09-11, `049ec99`). `cj-1632`
  should read Friday 4 Sept. `cj-1740` was completed 10 Sept and then the job
  itself was deleted by hand, so its money survives without a job on the board —
  the finished day still needs confirming with Trevor. `cj-1711` is correct as-is.
  A one-off by-hand fix, not app code. Job 1740 is also still missing from the
  board and has to be re-added under a new number if the work comes back.
- **The importer can strand a job.** `src/data/pdfImportPlan.js` only clears the
  `done` flag on the "returning" path, which needs a non-null `departed_at`. A job
  still on the Multitrack printout can stay flagged done and vanish from the board.
  Job 1740 was unstuck by hand once already. Needs its own brief.
- **Not a bug — corrected 2026-09-03.** This list used to say a job taken off a
  day could not be put back. It can: re-marking the cell in the Weekly Log puts
  it back on the day (`3708b9a`, `App.jsx:867` -> `onBookedOnDay`). Trevor's own
  recollection was that the real fault that day was day alignment in the Weekly
  Log, which shipped separately. All that remains is that the Daily Log's picker
  does not itself offer a removed job — the Weekly Log is the way back, and that
  is where you would go anyway. Nothing to build here.
- **Four screens whose names collide** — Day view and Week view (both
  `CalendarGrid.jsx`), Weekly Log (`BenchWeekPage.jsx`), Daily Log
  (`DailyLogPanel.jsx`). Trevor, 2026-08-26: *"Man these names need to change
  haha"*. It cost a round that same day: the fix could not start until he was
  asked which "day view" he meant.
- **The Projects planner shape would suit customer project jobs.** Raised while
  building Workshop Projects (shipped 2026-08-03, `947ab5a`): the Projects page
  is a tab strip, one tab per workshop project, with the aged customer-jobs view
  pinned right as **Project Jobs**; a project holds title, notes, steps and
  parts and deliberately no status or dates, because Trevor asked for a planner,
  not a tracker (`#PRJ` on a Daily Log bullet starts one, mirroring `#PL`).
  Needs its own conversation about what planning a customer project involves
  before anyone writes a brief.
- **Drawer bench change is silently dropped on split jobs** — changing the
  bench in the job drawer on a split job saves the cards but never the parent
  row, so the board snaps back to the old bench. Found 2026-09-03 on job 1727.
  Workaround: collapse to one card, save, re-split. Write-up:
  [2026-09-03-drawer-bench-change-dropped-on-split-jobs.md](2026-09-03-drawer-bench-change-dropped-on-split-jobs.md).

## Parked — agreed in principle, waiting on something

> **Standing order, Trevor 2026-07-29:** *"save all UI changes until after PDF drop implemented
> successfully and CSV pipeline gone"*. **✅ Satisfied 2026-07-29 — Brief H's Build 2c shipped
> (`1e4186a`), so both halves are done and UI work is unblocked.** The two UI briefs below were
> held by this standing order; re-check with Trevor before restarting either, since being
> unblocked isn't the same as being re-approved.

| Brief | Date | Waiting on |
|-------|------|------------|
| [PARKED-2026-08-23-week-marks-row-cap.md](PARKED-2026-08-23-week-marks-row-cap.md) | 2026-08-23 | **Parked for a month.** The Weekly Log reads `bench_week_marks` with no limit and no order, so it takes the 1000-row default cap. The table grows a row per job per marked day and nothing prunes old weeks, so it fills on calendar time, not job count — roughly January 2027 on an assumed rate. Nothing is deleted; unfetched marks just draw as empty cells, and the newest are the likely casualties. Fix agreed in principle: fetch only the weeks on screen, as the revenue records already do. Blast-radius file, so full protocol. |
| [parked-stale-description-after-import.md](parked-stale-description-after-import.md) | noted 2026-08-01, parked 2026-08-03 | Nothing — it's a real bug, just not picked up. After a PDF import the board shows the old description until the page is reloaded; the data is correct, the screen is stale. `src/hooks/useJobs.js:319` refreshes dates only. Blast-radius (`jobs[]`), so full protocol when it's taken on. Not scoped, not approved. |
| [parked-jobs-sheet-usability-changes.md](parked-jobs-sheet-usability-changes.md) | 2026-07-29, item 3 shipped 2026-07-30 | **White sheet instead of dark — done (`ce1cc65`).** Still open: **Enter-to-move-down a row** (the real complaint: every cell needs the mouse today) and **30-minute snapping on hand-typed hours** (`parseHoursInput()` in `jobsSheet.js`, not the UI). Both are behaviour changes on an app-owned column, so they go through the full protocol. Not approved, not scoped. |
| [blocked-pile-naming-alignment.md](blocked-pile-naming-alignment.md) | 2026-07-27, re-scoped 2026-07-29 | Nothing — Brief F shipped. **Three of its four findings were already fixed** and the brief has been cut down accordingly: the wording is aligned on "Waiting", and `useSupabase.js:43` now folds `blockedPile()` into `schedulable` so the screens agree on which jobs are stuck. What's left is narrow — the Sidebar's three buckets don't match `blockedPile()`'s four piles, so `🔒 ON HOLD` is a catch-all bin. Not scoped, not approved. |
| [parked-parts-as-a-stuck-reason.md](parked-parts-as-a-stuck-reason.md) | 2026-07-27, refs re-verified 2026-07-29 | The first Sunday board meeting run. Parts captured at the bench, shown as the stuck reason on the job. Split out of Brief E — the `parts_to_order` list is empty until the meeting fills it, so the UI would ship showing nothing. Not approved, not scoped. |

Closed briefs — kept only because the reasoning still matters — live in [CLOSED.md](CLOSED.md).

---

Designs and specs live in [`../superpowers/specs/`](../superpowers/specs/), not here. A
brief says *what to do next*; a spec says *what we agreed to build*.
