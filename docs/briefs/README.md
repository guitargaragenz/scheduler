# Session briefs

Handoff notes so the next session picks up without re-deriving anything. Read the one
named in your starting prompt, and only that one.

Every brief, spec and plan carries `doc_status:` at the very top:

| `doc_status` | What it means |
|--------------|---------------|
| `live` | Real, current work. Act on it. |
| `parked` | Scoped but deliberately not started, and **not approved**. Don't build it. |
| `closed` | Finished history. A record — **never** a task list, however live it sounds. |

**A brief is a snapshot of the day it was written, not a description of the code.** If a
brief tells you how the app behaves, check the app. `.claude/hooks/warn-closed-brief.py`
warns on any read of a non-`live` doc; that's a backstop, not permission to skip the line.

---

## Live — work that hasn't finished

| Doc | What it does |
|---|---|
| [2026-09-11-session-handoff.md](2026-09-11-session-handoff.md) | **Current — start here.** Nothing is mid-build. Says what the next work should be and where it starts. |

The next piece of work gets chosen from Parked, with Trevor — it is not picked off
this page. Start a session with `next`; if this section is still empty, say so.

## Noticed, not scoped

Real, nobody has picked them up, not attached to any brief.

- **Three revenue rows carry the wrong week**, stamped 2026-09-07, left behind by the
  bug `049ec99` closed. `cj-1632` should read Friday 4 Sept; `cj-1711` is correct as-is;
  `cj-1740`'s job was deleted by hand, so its money survives with no job on the board and
  its finished day still needs confirming with Trevor. A by-hand fix, not app code.
- **The importer can strand a job.** `src/data/pdfImportPlan.js` clears the `done` flag
  only on the "returning" path, which needs a non-null `departed_at`. A job still on the
  printout can stay flagged done and vanish from the board. Job 1740 was unstuck by hand
  once. Needs its own brief.
- **Four screens whose names collide** — Day view and Week view (both `CalendarGrid.jsx`),
  Weekly Log (`BenchWeekPage.jsx`), Daily Log (`DailyLogPanel.jsx`). It already cost a
  round on 2026-08-26, when a fix waited on asking which "day view" Trevor meant.
- **The Projects planner shape would suit customer project jobs.** Raised while building
  Workshop Projects (`947ab5a`). Needs a conversation with Trevor about what planning a
  customer project involves before anyone writes a brief.
- **Drawer bench change is silently dropped on split jobs** — saves the cards but never
  the parent row, so the board snaps back. Found on job 1727. Workaround: collapse to one
  card, save, re-split. Write-up:
  [2026-09-03-drawer-bench-change-dropped-on-split-jobs.md](2026-09-03-drawer-bench-change-dropped-on-split-jobs.md).

## Parked — agreed in principle, waiting on something

> **Standing order, Trevor 2026-07-29:** "save all UI changes until after PDF drop
> implemented successfully and CSV pipeline gone." **Satisfied** 2026-07-29 at `1e4186a`.
> Unblocked is not re-approved — re-check with Trevor before restarting either UI brief.

None of these is scoped or approved; each file holds the detail.

| Brief | Waiting on |
|-------|------------|
| [PARKED-2026-08-23-week-marks-row-cap.md](PARKED-2026-08-23-week-marks-row-cap.md) | The Weekly Log reads `bench_week_marks` unbounded, so it takes the 1000-row default cap — fills on calendar time, roughly January 2027. Fix agreed: fetch only the weeks on screen. Blast-radius, full protocol. |
| [parked-stale-description-after-import.md](parked-stale-description-after-import.md) | Nothing — a real bug, just not picked up. After a PDF import the board shows the old description until reload; `src/hooks/useJobs.js:319` refreshes dates only. Blast-radius (`jobs[]`). |
| [parked-jobs-sheet-usability-changes.md](parked-jobs-sheet-usability-changes.md) | Nothing. White sheet shipped (`ce1cc65`). Still open: Enter-to-move-down a row, and 30-minute snapping in `parseHoursInput()`. Full protocol. |
| [blocked-pile-naming-alignment.md](blocked-pile-naming-alignment.md) | Nothing. Three of four findings already fixed. What's left: the Sidebar's three buckets don't match `blockedPile()`'s four piles, so `🔒 ON HOLD` is a catch-all bin. |
| [parked-parts-as-a-stuck-reason.md](parked-parts-as-a-stuck-reason.md) | The first Sunday board meeting — `parts_to_order` is empty until the meeting fills it, so the UI would ship showing nothing. |

Closed briefs — kept only because the reasoning still matters — live in [CLOSED.md](CLOSED.md).

---

Designs and specs live in [`../superpowers/specs/`](../superpowers/specs/), not here. A
brief says *what to do next*; a spec says *what we agreed to build*.
