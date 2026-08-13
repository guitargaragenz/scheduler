-- Build 2 — the Daily Log.
--
-- RUN THIS IN SUPABASE BEFORE DEPLOYING THE CODE. Code-before-table is the
-- trap: the page loads, the read fails, and the hook sits read-only until
-- someone works out why.
--
-- One row per item put on one day. That is the whole table. A day with nothing
-- on it has no rows at all — absence IS the blank day, exactly as it is in
-- bench_week_marks, so taking an item off a day deletes its row rather than
-- writing an empty one.
--
-- This table is NOT daily_logs / deferred_items. Those belong to the older
-- bullet-journal day view and are untouched by this build.
--
-- Nothing here writes to jobs, scheduled_slots or calendar_slot. The Daily Log
-- has no second write path into job state — closing a job still goes through
-- the existing invoice prompt on the week page, and nowhere else.

CREATE TABLE IF NOT EXISTS bench_day_marks (
  date_key TEXT NOT NULL,           -- local YYYY-MM-DD, never a UTC timestamp
  item_id  TEXT NOT NULL,           -- job/split id, or "task:<random>" for typed work
  kind     TEXT NOT NULL,           -- 'job' or 'task'
  label    TEXT NOT NULL,           -- the text AS IT READ when it was put on the day
  PRIMARY KEY (date_key, item_id)
);

-- `label` is stored, not looked up later on purpose. A split's description can
-- change or the split can stop existing; the day's record of what was worked on
-- must not change with it.

-- item_id is deliberately NOT a foreign key to jobs. A day can hold a typed
-- task with no job behind it, and a job later removed from Multitrack must not
-- take the day's history with it.

-- Realtime, so a mark made on the phone shows on the iMac. Re-running this line
-- after the table is already published errors harmlessly.
ALTER PUBLICATION supabase_realtime ADD TABLE bench_day_marks;

-- No RLS, matching every other table in this app: the anon key is the only key,
-- and the app is not public.
