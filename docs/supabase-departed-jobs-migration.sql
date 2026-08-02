-- Brief "The board follows the printout (departed jobs)" — 2026-08-02
-- Run this in the Supabase SQL editor.
--
-- WHEN: BEFORE the Vercel preview browser test, and before any import is run
-- against a board that has this build deployed. The Vercel preview points at
-- the same production Supabase — there is one database and no sandbox.
--
-- Column-before-code is safe: loadJobs() does select('*'), and the currently
-- deployed app neither reads nor writes these columns, so they just sit NULL.
-- Code-before-column is the trap: PostgREST rejects the whole upsert batch with
-- "column does not exist", src/utils/supabase.js catches it, and the import
-- reports a failure — or worse, departs nothing while claiming success.
--
-- HOW: paste the whole file into the SQL editor and run it once.
-- Every statement is idempotent; re-running it is harmless and throws nothing.

-- ---------------------------------------------------------------------------
-- departed_at — the soft delete
-- ---------------------------------------------------------------------------
-- When Multitrack drops a job off the printout, the app stops showing it but
-- KEEPS the row: tag, action, hours, bench, VB/BL/PJ, pomo log, bump history
-- and session notes all stay exactly where they were. normalizeJobsFromDb()
-- filters on this one column, so a departed job vanishes from every screen at
-- once, and clearing the column brings it back whole.
--
-- Nullable and additive on purpose. NULL means "on the board" — which is what
-- every existing row already is, so no backfill is needed and nothing changes
-- until an import actually departs something.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS departed_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- departed_gcal_event_ids — the calendar bookings a departed job left behind
-- ---------------------------------------------------------------------------
-- A departing job's own gcal_event_id / gcal_event_ids are cleared immediately,
-- along with its calendar_slot and its scheduled_slots rows, so no slot is left
-- pointing at a job that no longer renders. But the customer's booking in
-- Google Calendar is NOT deleted at import time — a deleted booking cannot be
-- restored, and an import runs unattended off a PDF upload.
--
-- So the ids are parked here on departure, previewSync() lists them as proposed
-- deletions, and confirmSync() is what actually removes them. This column is
-- emptied once those events are gone. Without it the ids would simply be lost
-- at the moment of departure and the events would orphan on the real calendar
-- forever.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS departed_gcal_event_ids TEXT[];

-- Every load filters on departed_at, so it is worth an index.
CREATE INDEX IF NOT EXISTS idx_jobs_departed_at ON jobs(departed_at);

-- ---------------------------------------------------------------------------
-- What to expect afterwards
-- ---------------------------------------------------------------------------
-- Nothing visible. Both columns start NULL on every row, which means "on the
-- board, no orphaned bookings" — the state the whole board is already in.
-- The first Multitrack import after this build ships is what starts using them.
--
-- To see what has departed:
--   SELECT id, job, mfr, model, status, departed_at FROM jobs
--    WHERE departed_at IS NOT NULL ORDER BY departed_at DESC;
--
-- To bring a job back by hand (the app does this automatically when the job
-- reappears on a printout — this is only for a mistake that must be undone now):
--   UPDATE jobs SET departed_at = NULL WHERE id = '1619';
