-- Scheduler app Supabase schema
-- Run this in Supabase SQL editor to set up the database

-- Jobs table (normalized from Firestore jobs[] array + jobsState)
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES jobs(id) ON DELETE CASCADE,
  job TEXT NOT NULL,
  customer TEXT,
  mfr TEXT,
  model TEXT,
  status TEXT,
  bench TEXT,
  hours NUMERIC,
  scheduled BOOLEAN DEFAULT FALSE,
  calendar_slot TEXT,
  gcal_event_id TEXT,
  tag TEXT,
  action TEXT,
  vb TEXT,
  bl TEXT,
  pj TEXT,
  "desc" TEXT,
  has_subtasks BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_jobs_parent_id ON jobs(parent_id);
CREATE INDEX IF NOT EXISTS idx_jobs_calendar_slot ON jobs(calendar_slot);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_scheduled ON jobs(scheduled);
CREATE INDEX IF NOT EXISTS idx_jobs_bench ON jobs(bench);

-- Scheduled slots table (normalized from Firestore scheduledSlots map)
CREATE TABLE IF NOT EXISTS scheduled_slots (
  slot_id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  bench TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(slot_id)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_scheduled_slots_job_id ON scheduled_slots(job_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_slots_slot_id_pattern ON scheduled_slots(slot_id);

-- Conflict log (CSV import collisions, non-fatal errors)
CREATE TABLE IF NOT EXISTS conflict_log (
  id TEXT PRIMARY KEY,
  slot_id TEXT,
  job_id TEXT,
  conflict_type TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Parking lot (optional feature for unscheduled items)
CREATE TABLE IF NOT EXISTS parking_lot (
  id TEXT PRIMARY KEY,
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workshop projects (the planner for shop work that isn't a paying job —
-- shelving, rearranging the cutting room, jigs). One row per project.
--
-- Deliberately has NO status, due date, priority or percent-complete column.
-- Trevor asked for a planner, not a tracker: anything that can nag him is the
-- thing that would make him stop opening it. Do not add one later without a
-- brief that says so.
--
-- `steps` and `parts` are jsonb arrays rather than child tables. There is no
-- relationship here that splitting would serve, and daily_logs already stores
-- nested arrays in jsonb, so this is the existing pattern rather than a new one.
--   steps: [{ id, text, done }]
--   parts: [{ id, description, qty }]   -- qty is free text ("2 sheets"), not a number
--
-- `created_at` is load-bearing, not bookkeeping: the tab strip orders projects
-- by it, so the tabs stay put and don't reshuffle as Trevor edits them.
--
-- RLS: none, matching parking_lot and every other table in this file. This
-- schema enables row-level security nowhere, so the anon key reaches this table
-- exactly as it reaches parking_lot. If RLS is ever turned on project-wide,
-- this table must be included or the planner silently reads empty in
-- production while passing locally.
CREATE TABLE IF NOT EXISTS workshop_projects (
  id TEXT PRIMARY KEY,
  title TEXT,
  notes TEXT,
  steps JSONB DEFAULT '[]'::jsonb,
  parts JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workshop_projects_created_at ON workshop_projects(created_at);

-- Daily Log — one row per day, keyed by date rather than by a generated id, so
-- a day can be upserted on `date_key` without first looking up its row.
--
-- Added to this file 2026-08-03. The table has existed in the live database for
-- months and the app reads and writes it every day; it was created directly in
-- Supabase and never written down here. Recovered from how the code uses it
-- (`loadDailyLogs`/`saveDailyLogDays` in `src/utils/supabase.js`), NOT read back
-- from the live database — so treat the column types as the app's requirements
-- rather than a verified dump.
--
-- `bullets` is a jsonb array, each entry roughly { id, text, done, checklist[] }
-- with the checklist nested inside. `locked` and `closed_at` are what closeDay
-- sets; a closed day is still readable, just not editable.
CREATE TABLE IF NOT EXISTS daily_logs (
  date_key TEXT PRIMARY KEY,
  bullets JSONB DEFAULT '[]'::jsonb,
  closed_at TIMESTAMPTZ,
  locked BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Deferred items — bullets carried out of a day rather than completed in it.
-- Written per item (upsert the ones present, delete the ids removed), never as
-- a whole-table rewrite. Same 2026-08-03 caveat as daily_logs above: recovered
-- from `saveDeferredItems`, not from the live database.
CREATE TABLE IF NOT EXISTS deferred_items (
  id TEXT PRIMARY KEY,
  job_id TEXT,
  bullet_text TEXT,
  text TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deferred_items_created_at ON deferred_items(created_at);

-- Ad-hoc tasks (quick bujo notes scheduled onto the calendar)
CREATE TABLE IF NOT EXISTS ad_hoc_tasks (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  hours NUMERIC,
  calendar_slot TEXT,
  slot_keys TEXT[],
  date_key TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_hoc_tasks_date_key ON ad_hoc_tasks(date_key);

-- Focus list (job IDs prioritized from Sunday board meeting)
CREATE TABLE IF NOT EXISTS focus_list (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_focus_list_job_id ON focus_list(job_id);

-- Pending revenue review (disappeared jobs + orphaned split-child docs)
CREATE TABLE IF NOT EXISTS pending_revenue_review (
  id TEXT PRIMARY KEY,
  job TEXT,
  customer TEXT,
  mfr TEXT,
  model TEXT,
  "desc" TEXT,
  hours NUMERIC,
  disappeared_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pending_revenue_review_job ON pending_revenue_review(job);

-- Completed jobs (history of finished work)
CREATE TABLE IF NOT EXISTS completed_jobs (
  id TEXT PRIMARY KEY,
  job_id TEXT,
  job_number TEXT,
  customer TEXT,
  mfr TEXT,
  model TEXT,
  hours NUMERIC,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_completed_jobs_job_id ON completed_jobs(job_id);

-- 2026-07-21: Supabase persistence-gap fix — additive columns for split
-- jobs, session tracking, pomodoro/GCal/done state (see approved Brief in
-- .claude/pending-brief.md, "Fix Supabase Persistence Gaps"). Nullable/
-- defaulted only — safe to run without touching existing rows.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS subtasks TEXT[];
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_split BOOLEAN DEFAULT FALSE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS no_auto_split BOOLEAN DEFAULT FALSE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_subtask BOOLEAN DEFAULT FALSE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS session_note TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS session_index INTEGER;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS session_total INTEGER;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS piece_done BOOLEAN DEFAULT FALSE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS done BOOLEAN DEFAULT FALSE;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS gcal_event_ids TEXT[];
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS pomo_log JSONB DEFAULT '[]'::jsonb;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS bump_history JSONB DEFAULT '[]'::jsonb;

-- 2026-07-22: Auto-split regeneration fix (see approved Brief in
-- .claude/pending-brief.md, "Supabase Auto-Split Regeneration Gap"). Marks a
-- row as a DERIVED auto-split bench card rather than a real stored child.
-- The single-table schema removed the jobsMaster/jobsState firewall that used
-- to keep derived cards out of the CSV-owned collection; this column is what
-- lets the write guards keep derived cards from being materialised as
-- permanent rows. Additive and defaulted — safe to run on existing rows.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_derived BOOLEAN DEFAULT FALSE;

-- 2026-07-25: Sunday Board Meeting Supabase migration (see approved Brief in
-- .claude/pending-brief.md, Brief D). handleMarkDone() in src/hooks/useJobs.js
-- has always computed invoiceAmount/weekKey, but saveCompletedJobs()/
-- loadCompletedJobs() in src/utils/supabase.js never mapped them to/from a
-- column — this was silently dropped on every mark-done. Additive/nullable,
-- safe to run on existing rows.
ALTER TABLE completed_jobs ADD COLUMN IF NOT EXISTS invoice_amount NUMERIC;
ALTER TABLE completed_jobs ADD COLUMN IF NOT EXISTS week_key TEXT;

-- NOT IN THIS FILE, ON PURPOSE — READ BEFORE REBUILDING FROM IT:
-- parts_to_order is the ONE table in this schema that has RLS enabled. It was
-- enabled by hand in the Supabase dashboard when the table was first made, with
-- no policy attached, which silently rejected every insert for a month while
-- the app reported success. On 31 Jul 2026 a permissive policy was added, also
-- by hand in the dashboard, and it is deliberately NOT written here.
--
-- The consequence: rebuilding the database from this file alone gives you a
-- parts_to_order with NO RLS at all, which is the same as every other table
-- here and works fine. What you must never do is re-enable RLS on it without
-- also re-adding that policy — that is the exact silent-write bug.
--
-- Parts to order (Sunday board meeting — Brief D). needed_for_job is a plain
-- TEXT column, NOT a foreign key to jobs(id): a part can be flagged against a
-- job number that later disappears (job finished/deleted) or against no job
-- at all (general shop stock), and this table must never fail to insert or
-- orphan-cascade because of that.
CREATE TABLE IF NOT EXISTS parts_to_order (
  id TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  category TEXT DEFAULT 'part',
  needed_for_job TEXT,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  resolved BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_parts_to_order_resolved ON parts_to_order(resolved);

-- 2026-08-01: Parts to Order round 2 — an optional manufacturer part number on
-- each row. Nullable on purpose and never required: most parts are typed at the
-- bench with no number to hand, and the page must never refuse a part because
-- the number is missing. When there IS one it is the join to PartsBox's
-- `part/mpn`, which is what turns the stock check from a maybe into a
-- certainty. Additive, safe to run on existing rows.
ALTER TABLE parts_to_order ADD COLUMN IF NOT EXISTS part_number TEXT;

-- 2026-08-01: who the part is being ordered from. Optional, exactly like
-- part_number above — the page must never refuse a part because the supplier
-- has not been decided yet, and "not decided" is the default.
--
-- Plain TEXT, NOT a foreign key to suppliers(id) below, and that is the whole
-- design: the name is COPIED onto the part at save time. Removing or renaming a
-- supplier in Settings therefore cannot rewrite, orphan or cascade a single
-- saved part row. A part ordered from "Rockshop" still says Rockshop next year,
-- whatever happened to the list in between.
ALTER TABLE parts_to_order ADD COLUMN IF NOT EXISTS supplier TEXT;

-- 2026-08-01: the managed supplier list (Suppliers + shared settings brief).
-- Names only, on purpose — no account numbers, lead times, links or contacts.
-- This table feeds ONE dropdown; it is not a contacts database.
--
-- No RLS, like every other table here except the parts_to_order exception noted
-- above. See the job_status_since comment further down for the reasoning.
CREATE TABLE IF NOT EXISTS suppliers (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

-- 2026-08-01: app settings, shared across devices instead of per-browser.
--
-- Until now every Settings value lived in localStorage, so a keyword Trevor
-- added on the iMac was invisible on the MacBook and the phone — and invisibly
-- so, because both fell back to the same built-in defaults and looked fine.
-- Bench keywords decide which bench a job lands on, so that was a job
-- classification bug wearing a settings costume.
--
-- Deliberately key/value rather than a column per setting: the four settings
-- that live here (benchKeywords, benchHours, hourlyRate, weeklyTarget) are all
-- app-owned JSON blobs read by exactly one place each, and a column per setting
-- means a hand-run migration every time one is added.
--
-- SEEDING RULE — the app writes first-load seeds as INSERT ... ON CONFLICT
-- (key) DO NOTHING, never an upsert. Three devices seed independently and only
-- the iMac has real edits; with an upsert the LAST device to start wins and a
-- MacBook with empty localStorage would silently wipe the real keyword list.
-- First writer wins, permanently. Do not "fix" that into an upsert.
--
-- No RLS.
CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL
);

-- 2026-07-27: Job blocking — Brief E, Task 1. Job age from the CSV's `Days`
-- column. Until now `days` was parsed into memory by parseCSV() and never
-- persisted anywhere, so every page reload silently reset every job to an
-- unknown age and the Projects-page timeline collapsed to day zero. Nullable
-- on purpose: NULL means "Multitrack doesn't know how old this job is", which
-- is a different fact from 0. Additive, safe on existing rows.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS days INTEGER;

-- Job status clock (Brief E, Task 2). One row per top-level job recording when
-- it last entered its current status+action, so "waiting 12 days" is a real
-- number rather than a guess. Multitrack does not carry this and nothing else
-- in the system knows it.
--
-- job_id is a plain TEXT primary key, NOT a foreign key to jobs(id) — same
-- reasoning as parts_to_order.needed_for_job above, but sharper here: a CSV
-- import can delete and re-create a job row, and an ON DELETE CASCADE would
-- silently reset the stuck clock on exactly the jobs that have been stuck
-- longest. Resetting that clock is the one thing this table exists to prevent.
-- A stale row for a job that has genuinely gone costs nothing and gets
-- re-adopted by job_id if the job comes back.
--
-- No RLS, deliberately. Every other table in this schema is created without it
-- and the app talks to Supabase with the anon key only. A single RLS'd table in
-- an otherwise open schema buys no real security and risks silently blocking
-- reads — loadJobs()'s "RLS policy likely blocking" fallback in
-- src/utils/supabase.js exists because of precisely that failure. Whether the
-- schema as a whole should be locked down is a real question and a separate one.
CREATE TABLE IF NOT EXISTS job_status_since (
  job_id TEXT PRIMARY KEY,
  status TEXT NOT NULL,
  action TEXT,
  since  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2026-07-28: PDF import log (Brief G, Build 1a, decision 5). One row per
-- accepted PDF drop: when it happened, which file, how many jobs were written
-- and exactly which job numbers were touched. The PDF import writes directly
-- to live job rows, so if an import ever does something unexpected this table
-- is the only way to answer "what did it actually write, and when".
--
-- job_ids is a plain TEXT[] and NOT a foreign key to jobs(id) — same reasoning
-- as parts_to_order.needed_for_job and job_status_since.job_id above. The
-- whole point of a forensic record is that it survives the rows it describes.
--
-- The app treats writing this log as best-effort: logPdfImport() in
-- src/utils/supabase.js always writes the record to the browser console first
-- and only then tries the insert, swallowing any failure. So an import still
-- works if this table has not been created — it just isn't recorded anywhere
-- that outlives the browser session. Additive, safe to run on existing rows.
CREATE TABLE IF NOT EXISTS pdf_import_log (
  id TEXT PRIMARY KEY,
  filename TEXT,
  row_count INTEGER,
  job_ids TEXT[],
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pdf_import_log_imported_at ON pdf_import_log(imported_at DESC);

-- 2026-07-29: the date a job came in the door — Brief G, Build 1c.
--
-- This is the one real schema change in Brief G, and it exists to fix a shape
-- problem rather than a missing feature. `days` above stores job age as a
-- NUMBER, and a number does not tick. Multitrack's Jobs-by-Age printout said
-- job 97 was 3162 days old while the database still said 3159 — three days
-- behind, and with the CSV sync switched off it would have sat at 3159 forever.
--
-- A date does tick. With the date in the door stored once, the app computes
-- `today - first_seen` on every load and the age is correct every morning with
-- nothing dropped and nothing synced. That is what the Google Sheet's Days
-- formula did, moved into the app.
--
-- Written by exactly ONE thing: the Jobs-by-Age PDF import, which owns this
-- column and no other. Nullable on purpose — NULL means "we have not been told
-- when this job arrived yet", which is a different fact from a job that arrived
-- today. A job with a NULL first_seen shows no age at all.
-- Additive, safe on existing rows.
--
-- SHIPPED, Brief H, Build 2b (2026-07-29): the app no longer reads or writes
-- the `days` column. It was checked against the live table first — every row
-- with a stored age also had a first_seen, so no job on the board lost an age.
-- The stored-days fallback and preserveKnownDays() are both gone from the code.
--
-- The `days` COLUMN below deliberately STAYS, holding stale values nobody
-- updates. Trevor's call: a dead column costs nothing and a dropped one cannot
-- be un-dropped. Do NOT write an ALTER TABLE ... DROP COLUMN days.
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS first_seen DATE;

-- Enable realtime subscriptions for the app
ALTER PUBLICATION supabase_realtime ADD TABLE jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE scheduled_slots;
ALTER PUBLICATION supabase_realtime ADD TABLE parking_lot;
ALTER PUBLICATION supabase_realtime ADD TABLE workshop_projects;
-- subscribeToDailyLogs listens to both of these, so both must be published or
-- the Daily Log stops syncing between devices without erroring anywhere.
ALTER PUBLICATION supabase_realtime ADD TABLE daily_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE deferred_items;
ALTER PUBLICATION supabase_realtime ADD TABLE ad_hoc_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE focus_list;
ALTER PUBLICATION supabase_realtime ADD TABLE pending_revenue_review;
ALTER PUBLICATION supabase_realtime ADD TABLE completed_jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE parts_to_order;
ALTER PUBLICATION supabase_realtime ADD TABLE job_status_since;
