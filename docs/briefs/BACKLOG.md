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
- **On mobile, Day view doesn't show the split cards that Week view and desktop show** — a
  UI difference, not a bug. Trevor, 2026-09-13. A split job shows one card per piece on the
  computer and in mobile Week view; mobile Day view doesn't render them. The old "drawer
  bench change dropped on split jobs" write-up was filed here as a save bug and deleted the
  same day: the board renders each child with the child's own bench
  (`src/components/BenchBoardPage.jsx:49`), so the parent's stale bench never reaches the
  screen and that symptom can't happen. Nothing to fix in the save path. UI work needs a yes.

## Parked — what each one is waiting on

The table in the index names these briefs. This is the detail behind each.

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

## Jobs finished from Close Day, Catch-up or revenue review get no × on the Week page

Only the Week page × writes the close mark, so a job finished from those three places drops off its
week straight away. Found 2026-09-29 while fixing job 1726. Check before scoping: a scan of
finished jobs missing a mark looked worse than it was — 8 finished before the close column existed
and 2 already had a mark on an earlier week.
