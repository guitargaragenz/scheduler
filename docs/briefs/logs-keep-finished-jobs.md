---
doc_status: live
---
# Logs keep finished jobs, and read every mark past the 1,000-row cap — checklist

The scope lock is `.claude/pending-brief.md`. This file holds the numbered checklist and the
council record.

1. A departed job with marks (1735) shows on the Daily Log for 7 and 8 Sept, with its pieces
   (7 Sept pieces shown from the saved mark labels).
2. The same job shows on the Weekly Log for the week of 7 Sept.
3. Departed jobs do not appear on the Board, Sidebar, Jobs, Jobs Sheet, Projects or DL picker.
4. `normalizeJobsFromDb()` still filters `departed_at`; its tests are unchanged and pass.
5. A departed job's marks can't be changed on either log, and no log code path writes to `jobs`
   for a departed job.
6. `loadDayMarks()` / `loadWeekMarks()` page with `.range()` until a short page; a test with
   more than 1,000 rows gets them all.
7. A failed page leaves the page read-only, never an empty-looking week.
8. A cross made in an earlier week still hides/greys correctly (1708 pieces; 27 Sept picker fix).
9. PDF import still sees the current week's `close:` keys.
10. A realtime change from another device appears without reload.
11. Full test suite passes; new tests cover items 1, 3, 5 and 6.

## What changed after council (27 Sept)
- Part B switched from per-week loading to batched reads. Reviewer 2: simpler, none of the
  carve-outs. Reviewer 1: "bounded by jobs" would itself outgrow 1,000. Trevor agreed.
- Part A: departed jobs locked, same look (Trevor). Separate display list so the picker and
  write lookup stay live-only (reviewer 1). Label fallback for old piece ids (checked live data).
- Fixed: SVT-6 lock closed at `bc76312`, not `ac79bc4`.
