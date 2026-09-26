---
doc_status: live
---
# Logs keep finished jobs, and load a week at a time — verifier checklist

The scope lock is `.claude/pending-brief.md`. This file holds only the numbered checklist.

1. A departed job with marks (1735) shows on the Daily Log for 7 and 8 Sept, with its pieces.
2. The same job shows on the Weekly Log for the week of 7 Sept.
3. Departed jobs do not appear on the Board, Sidebar, Jobs, Jobs Sheet, Projects or DL picker.
4. `normalizeJobsFromDb()` still filters `departed_at`; its tests are unchanged and pass.
5. No log code path writes to `jobs` for a departed job.
6. Startup reads of `bench_day_marks` / `bench_week_marks` are bounded (week, or live-job items), never whole-table.
7. Paging to another week fetches it, shows a loading note, then its marks.
8. A cross made in an earlier week still hides/greys correctly (1708 pieces; 27 Sept picker fix).
9. PDF import still sees the current week's `close:` keys while another week is on screen.
10. A realtime change from another device appears without reload, for the week on screen.
11. A failed read leaves the page read-only, never an empty-looking week.
12. Full test suite passes; new tests cover items 1, 3, 6, 8 and 9.
