-- Brief E — "Why isn't this job moving?" (job blocking)
-- Tasks 1 and 2. Run this in the Supabase SQL editor.
--
-- WHEN: before the browser test, not before merge. The Vercel preview points at
-- the same production Supabase — there is one database and no sandbox.
-- Column-before-code is safe (loadJobs does select('*'), nothing in the
-- currently-deployed app writes or reads `days`, so it just sits NULL).
-- Code-before-column is the trap: PostgREST would reject the whole CSV upsert
-- batch, src/utils/supabase.js swallows the error, and the app would still say
-- "Loaded N jobs from CSV" — a successful-looking import that saved nothing.
--
-- HOW: paste the whole file into the SQL editor and run it once.
--
-- ⚠ EXPECTED RED ERROR ON A RE-RUN — NOT A PROBLEM.
--   The two ALTER TABLE ... IF NOT EXISTS and the CREATE TABLE IF NOT EXISTS
--   lines are idempotent and can be run any number of times.
--   The last line, ALTER PUBLICATION supabase_realtime ADD TABLE ..., is NOT.
--   Running this file a second time makes it throw:
--       ERROR: relation "job_status_since" is already member of publication
--              "supabase_realtime"
--   That error is harmless and means the job was already done. Nothing is
--   broken, nothing needs undoing — just ignore it.

-- ---------------------------------------------------------------------------
-- Task 1 — job age survives a reload
-- ---------------------------------------------------------------------------
-- `days` comes from the CSV's Days column. parseCSV() has always read it into
-- memory and it has never been persisted, so every page reload wiped it and the
-- age numbers have been quietly wrong since 25 July. Nullable on purpose: NULL
-- means "Multitrack doesn't know how old this job is", which is a different
-- fact from 0 (booked in today) and must stay distinguishable.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS days INTEGER;

-- ---------------------------------------------------------------------------
-- Task 2 — the stuck clock
-- ---------------------------------------------------------------------------
-- One row per top-level job, recording when it last entered its current
-- status + action. That is what turns "waiting" into "waiting 12 days".
--
-- job_id is a plain TEXT primary key and deliberately NOT a foreign key to
-- jobs(id). A CSV import can delete and re-create a job row; an ON DELETE
-- CASCADE would then silently reset the clock on exactly the jobs that have
-- been stuck the longest — the one thing this table exists to prevent. A stale
-- row for a job that has genuinely gone costs nothing and is re-adopted by
-- job_id if the job comes back.
--
-- No RLS, deliberately — every other table in this schema is created without it
-- and the app uses the anon key only. A single locked-down table in an
-- otherwise open schema buys no real security and risks silently blocking
-- reads. Locking down the whole schema is a real question, and a separate one.
CREATE TABLE IF NOT EXISTS job_status_since (
  job_id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  action TEXT,
  since  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Realtime: a new table has NO realtime until it is added to the publication,
-- and without this the subscribeToStatusSince() callback never fires.
-- ⚠ This is the one line that errors on a re-run — see the note at the top.
ALTER PUBLICATION supabase_realtime ADD TABLE job_status_since;

-- ---------------------------------------------------------------------------
-- What to expect afterwards
-- ---------------------------------------------------------------------------
-- job_status_since starts EMPTY. The first reconcile stamps since = now on
-- every current job, so every stuck age reads 0 days and the red 14-day flag
-- cannot fire for two weeks. That is correct behaviour on day one, not a bug.
--
-- `days` also starts NULL on every existing row. It fills in on the next CSV
-- upload; until then jobs render with no age badge rather than "0d".
