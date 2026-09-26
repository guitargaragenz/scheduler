---
doc_status: live
---
# Scope lock — Logs keep finished jobs, and read every mark past the 1,000-row cap

Replaces the closed SVT-6 job-card lock (closed at `bc76312`). Supersedes
`docs/briefs/PARKED-2026-08-23-week-marks-row-cap.md`. Blast-radius (`useSupabase.js`,
`utils/supabase.js`, what the logs read from `jobs[]`): full protocol.

**Trevor, 2026-09-27:** "There is no data in WL or DL showing any completed jobs dating back
from 2 weeks and back. All completed jobs have disappeared."

**Status (27 Sept, end of session):** brief approved, council done (both NOT YET), Trevor's
rulings below ("yp, go with batches and locked collected jobs"). **Next: step 3 builder.**

## A — Finished jobs stay on the logs, locked
- Cause: `normalizeJobsFromDb()` (`src/hooks/useSupabase.js:81`) drops every row with
  `departed_at`. Daily Log (`DailyLogPanel.jsx`) and Weekly Log (`BenchWeekPage.jsx`, `weekRows()`)
  build rows from that list, so a job vanishes from its own history once it leaves Multitrack.
- Build: both logs show a departed job, with its pieces and marks, on any day/week where it has
  marks. Same look as any other job. **Locked:** its marks can't be changed.
- The live `jobs[]` array and `normalizeJobsFromDb()`'s filter stay as they are. Pass the logs a
  **separate** list for display only. The picker (`dayJobOptions`, `bookedOnDay`) and the
  write lookup (`handleSetMark` → `useJobs.js:736 handleMarkPieceDone`) keep using live `jobs`
  only — do not merge departed jobs into the one `jobs` prop.
- Old piece ids: 1735's 7 Sept marks point at `1735_Wiring_0/1`, `1735_Setup_0`, which no longer
  exist as rows. Show them from the `label` saved on the `bench_day_marks` row.
- Everywhere else still hides departed jobs. No log action writes to a departed job's `jobs` row.

## B — Read every mark, in batches of 1,000
- Today `loadDayMarks()` / `loadWeekMarks()` (`src/utils/supabase.js` ~1909, ~2417) do a plain
  `select('*')`; realtime handlers re-read via the same loaders. Supabase returns max 1,000 rows
  per request, silently. Day marks ~290 (+~170/month), week marks 252.
- Build: both loaders page with `.range()` in 1,000-row steps until a short page comes back,
  with a stable order. Everything else (startup load, realtime, cross-week readers, PDF import
  `close:` keys) works as today — no per-week loading.
- Keep the null-vs-`{}` rule: a failed page fails the whole read; never arm writing or draw
  an empty week on a partial read.

## Not in scope
- `scheduledSlots`, `calendarSlot`, `useGoogleCalendar.js`, Board, Sidebar, pickers' contents.
- The blank-row bug on 1735 (`1735-ST`, `1735-WR`); archiving/CSV export; any table schema change.

## Verifier checklist
Background, not needed to start: `docs/briefs/logs-keep-finished-jobs.md` — checklist and
council changes.
