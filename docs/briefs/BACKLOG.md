---
doc_status: live
---

# Backlog detail

Split out of [README.md](README.md) on 2026-09-11 because the index loads at the start of
every session and this page is only needed when choosing the next piece of work. Read it
then, with Trevor. Nothing here is scoped or approved.

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

## Parked — what each one is waiting on

The table in the index names these briefs. This is the detail behind each.

- **[Week marks row cap](PARKED-2026-08-23-week-marks-row-cap.md)** — the Weekly Log reads
  `bench_week_marks` unbounded, so it takes the 1000-row default cap; it fills on calendar
  time, roughly January 2027. Fix agreed: fetch only the weeks on screen. Blast-radius,
  full protocol.
- **[Stale description after import](parked-stale-description-after-import.md)** — waiting
  on nothing, a real bug nobody has picked up. After a PDF import the board shows the old
  description until reload; `src/hooks/useJobs.js:319` refreshes dates only. Blast-radius
  (`jobs[]`).
- **[Jobs Sheet usability changes](parked-jobs-sheet-usability-changes.md)** — waiting on
  nothing. White sheet shipped (`ce1cc65`). Still open: Enter-to-move-down a row, and
  30-minute snapping in `parseHoursInput()`. Full protocol.
- **[Blocked-pile naming](blocked-pile-naming-alignment.md)** — waiting on nothing. Three
  of four findings already fixed. What's left: the Sidebar's three buckets don't match
  `blockedPile()`'s four piles, so `🔒 ON HOLD` is a catch-all bin.
- **[Parts as a stuck reason](parked-parts-as-a-stuck-reason.md)** — waiting on the first
  Sunday board meeting; `parts_to_order` is empty until the meeting fills it, so the UI
  would ship showing nothing.
