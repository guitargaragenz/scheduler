-- Brief C — Daily Log (bujo) migration off Firestore onto Supabase
-- Run this in the Supabase SQL editor BEFORE running the backfill script.
--
-- Two tables mirror the single Firestore doc `ggnz/dailyLogs`, whose shape is:
--   { logs: { "2026-07-24": { bullets:[...], closedAt, locked }, ... },
--     deferredItems: [ { id, jobId, bulletText, text, reason, createdAt }, ... ] }
--
-- Design (Council-locked, Option A + separate deferred table):
--   * one row per day in daily_logs, keyed by the LOCAL date string verbatim
--     ("YYYY-MM-DD") — never recomputed from a timestamp, so NZ-evening logs
--     never shift a day under UTC.
--   * deferredItems get their own per-item table so a single deferred change is
--     an upsert/delete by id, never a whole-array rewrite.

CREATE TABLE IF NOT EXISTS daily_logs (
  date_key   TEXT PRIMARY KEY,                 -- "YYYY-MM-DD", local date, copied verbatim
  bullets    JSONB NOT NULL DEFAULT '[]'::jsonb,
  closed_at  TIMESTAMPTZ,                       -- null for open days
  locked     BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS deferred_items (
  id          TEXT PRIMARY KEY,                 -- item's existing genId()
  job_id      TEXT,
  bullet_text TEXT,
  text        TEXT,
  reason      TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- Row Level Security — match the anon access the existing app tables rely on.
-- The app talks to Supabase only with the anon key, so anon needs full CRUD
-- on these two tables exactly like jobs/scheduled_slots/etc.
-- ---------------------------------------------------------------------------
ALTER TABLE daily_logs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE deferred_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon all daily_logs"     ON daily_logs;
DROP POLICY IF EXISTS "anon all deferred_items" ON deferred_items;

CREATE POLICY "anon all daily_logs"     ON daily_logs
  FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "anon all deferred_items" ON deferred_items
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Realtime — a new table has NO realtime until it is added to the publication.
-- Without this the subscribe callbacks in supabase.js would never fire.
-- ---------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE daily_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE deferred_items;
