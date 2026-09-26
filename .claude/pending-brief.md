---
doc_status: live
---
# Scope lock — Logs keep finished jobs, and load a week at a time

Replaces the closed SVT-6 job-card lock (in git at `ac79bc4`). Supersedes
`docs/briefs/PARKED-2026-08-23-week-marks-row-cap.md`. Blast-radius (`useSupabase.js`,
`utils/supabase.js`, what the logs read from `jobs[]`): full protocol.

**Trevor, 2026-09-27:** "There is no data in WL or DL showing any completed jobs dating back
from 2 weeks and back. All completed jobs have disappeared." On loading: current week at
startup, other weeks "load on demand", with a short loading note.

## A — Finished jobs stay on the logs
- Cause: `normalizeJobsFromDb()` (`src/hooks/useSupabase.js:81`) drops every row with
  `departed_at`. Daily Log (`DailyLogPanel.jsx`) and Weekly Log (`BenchWeekPage.jsx`, `weekRows()`)
  build rows from that list, so a job vanishes from its own history once it leaves Multitrack.
  Marks are intact in `bench_day_marks` / `bench_week_marks`; 13 jobs affected (e.g. 1735 on 7–8 Sept).
- Build: both logs show a departed job, with its pieces, on any day/week where it has marks.
- Everywhere else still hides departed jobs (Board, Sidebar, Jobs, Jobs Sheet, Projects, pickers).
  The live `jobs[]` array and `normalizeJobsFromDb()`'s filter stay as they are; give the logs
  a separate read-only source.
- A departed job never appears in the Daily Log picker, and no log action writes to its `jobs` row.

## B — Load marks a week at a time
- Today `loadDayMarks()` / `loadWeekMarks()` (`src/utils/supabase.js`) read whole tables with no
  limit, at app startup, and the realtime handlers re-read whole tables. Supabase stops at
  1,000 rows: day marks 286 (~170/month), week marks 252.
- Build: at startup load the real current week; on changing week, load that week on demand
  with a short loading note (never an empty page that looks real). Realtime keeps working
  and re-reads only loaded weeks. Model: `loadCompletedJobs(weekKeys)`.
- **Must survive:** `latestDayMarks()` (`DailyLogPanel.jsx:96`) and Day View's `crossedIds` read
  crosses from EARLIER weeks (1708 Luthier_1 was crossed 13 Sept). Keep that working by also
  loading marks for items belonging to live jobs, bounded by jobs, not by time.
- **Must survive:** the PDF import reads the real current week's `close:` keys
  (`pdfImportPlan.js:275`, via `useJobs.js:104`). The real current week stays loaded always.
- Keep the null-vs-`{}` rule: a failed read never arms writing or draws a week as empty.

## Not in scope
- `scheduledSlots`, `calendarSlot`, `useGoogleCalendar.js`, Board, Sidebar, pickers' contents.
- The blank-row bug on 1735 (`1735-ST`, `1735-WR`); archiving/CSV export; any table schema change.

## Verifier checklist
In `docs/briefs/logs-keep-finished-jobs.md` — for the verifier (step 4) and council only;
the builder reads it for what "done" means, not to start work.
