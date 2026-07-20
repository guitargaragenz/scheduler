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

-- Enable realtime subscriptions for the app
ALTER PUBLICATION supabase_realtime ADD TABLE jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE scheduled_slots;
ALTER PUBLICATION supabase_realtime ADD TABLE parking_lot;
ALTER PUBLICATION supabase_realtime ADD TABLE ad_hoc_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE focus_list;
ALTER PUBLICATION supabase_realtime ADD TABLE pending_revenue_review;
ALTER PUBLICATION supabase_realtime ADD TABLE completed_jobs;
