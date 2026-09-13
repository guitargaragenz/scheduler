-- Bench view — Build 1, the week page.
-- Run this once in the Supabase SQL editor.
--
-- WHEN: before the browser test of the week page, not before merge. The Vercel
-- preview points at the same production Supabase — there is one database and no
-- sandbox. Table-before-code is safe: nothing currently deployed reads or writes
-- this table, so it just sits empty. Code-before-table is the trap — every read
-- would fail, and a failed read is what stops the page arming its writes, so the
-- page would render permanently read-only with no obvious reason why.
--
-- HOW: paste the whole file into the SQL editor and run it once.
--
-- ⚠ EXPECTED RED ERROR ON A RE-RUN — NOT A PROBLEM.
--   CREATE TABLE IF NOT EXISTS is idempotent and can be run any number of times.
--   The last line, ALTER PUBLICATION supabase_realtime ADD TABLE ..., is NOT.
--   Running this file a second time makes it throw:
--       ERROR: relation "bench_week_marks" is already member of publication
--              "supabase_realtime"
--   That error is harmless and means the job was already done. Nothing is
--   broken, nothing needs undoing — just ignore it.

-- ---------------------------------------------------------------------------
-- bench_week_marks — one row per job per day, and nothing else
-- ---------------------------------------------------------------------------
-- The week page's marks: · booked, / worked that day, > not worked so move on,
-- × done. One row per (job, date). A day with no mark has NO row — absence is
-- the blank cell, so there is nothing to clean up and no "empty" sentinel.
--
-- This table exists so the week page never writes to jobs, scheduled_slots or
-- jobs.calendar_slot. Those carry live job state; a marking mistake here must
-- not be able to move a job or lose a booking.
--
-- job_id is TEXT and deliberately NOT a foreign key to jobs(id). A CSV import
-- can delete and re-create a job row; ON DELETE CASCADE would then wipe the
-- week's marks for exactly the jobs being re-imported. A stale row for a job
-- that has genuinely gone costs nothing and is re-adopted by job_id if the job
-- comes back — which, per the workshop rules, it does under a new number only,
-- so in practice it simply ages out.
--
-- The trailing ">" column on the page is NOT stored. It is worked out from the
-- row (× anywhere in the week means ×, otherwise >). Storing it would be a
-- second copy of the same fact, free to drift.
--
-- No RLS, deliberately — every other table in this schema is created without it
-- and the app uses the anon key only.
CREATE TABLE IF NOT EXISTS bench_week_marks (
  job_id   TEXT NOT NULL,
  date_key TEXT NOT NULL,          -- local YYYY-MM-DD, never a UTC timestamp
  mark     TEXT NOT NULL,          -- one of: dot, slash, arrow, cross
  PRIMARY KEY (job_id, date_key)
);

-- Realtime: a new table has NO realtime until it is added to the publication,
-- and without this the subscribeToWeekMarks() callback never fires — the iMac
-- and the phone would each hold their own stale copy of the week.
-- ⚠ This is the one line that errors on a re-run — see the note at the top.
ALTER PUBLICATION supabase_realtime ADD TABLE bench_week_marks;

-- ---------------------------------------------------------------------------
-- What to expect afterwards
-- ---------------------------------------------------------------------------
-- bench_week_marks starts EMPTY, so the week page opens with every cell blank
-- on day one. That is correct, not a failed load: marks only exist once someone
-- taps them in.
