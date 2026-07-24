#!/usr/bin/env node
// Read-only Supabase export for the Sunday Board Meeting workflow.
// Never writes anything back — only reads the `jobs`, `completed_jobs`,
// `ad_hoc_tasks` and `parts_to_order` tables and prints one JSON blob to
// stdout. Replaces the old Firestore version (Brief D — Firestore is fully
// retired, see .claude/pending-brief.md).
//
// This is a plain Node script, not a Vite module, so it can't import
// src/utils/supabase.js directly (that file reads import.meta.env, which
// only exists under Vite). Instead it builds its own Supabase client the
// same way scripts/backfill_daily_logs_to_supabase.mjs does, using the SAME
// table/column names supabase.js uses so the two never drift apart.
//
// Job-status derivation (readyToStart/awaiting/inTransit/schedulable) is
// imported from src/data/jobs.js rather than reimplemented here — same rule
// the CSV importer uses, applied to a stored Supabase row instead of a
// fresh CSV line.
//
// NOTE on job age ("days stuck"): there is no clean Supabase equivalent for
// job intake date. `created_at` is row-creation time in Supabase, not when
// the job actually came in on the shop floor, and nothing populates a real
// intake-date column at CSV-import time (adding one is out of scope for
// this Brief — see .claude/pending-brief.md Brief D, scope item 4). Rather
// than guess at an age, this export deliberately omits any `days` field.
// The workflow/Reports layer must not report stuck-30/60-day-style ages
// until a real intake-date column exists to back them.
//
// Also dropped vs. the old Firestore shape: `scheduledSlots` and
// `parkingLotItems`. Nothing in the restructured workflow
// (.claude/workflows/sunday-board-meeting.js) reads scheduledSlots, and
// parking-lot review moves entirely to the live chat session reading
// admin/context/parking-lot.md — a markdown file, NOT the Supabase
// `parking_lot` table (which backs the in-app Parking Lot page, an
// unrelated product-idea feature). This script does not touch that table.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { deriveJobStatusFlags } from '../src/data/jobs.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function loadEnvFile(name, env) {
  let text;
  try {
    text = readFileSync(join(root, name), 'utf8');
  } catch {
    return env; // file may not exist — keys might live in the other one
  }
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

// Keys can be split across .env / .env.local — load both, .env.local wins
// on overlap (Vite convention), same as backfill_daily_logs_to_supabase.mjs.
function loadEnv() {
  const env = {};
  loadEnvFile('.env', env);
  loadEnvFile('.env.local', env);
  return env;
}

const env = loadEnv();
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function loadAll(table, order) {
  const { data, error } = await supabase.from(table).select('*').order(order, { ascending: false });
  if (error) throw new Error(`Supabase read of "${table}" failed: ${error.message}`);
  return data || [];
}

const [jobRows, completedRows, adHocRows, partsRows] = await Promise.all([
  loadAll('jobs', 'created_at'),
  loadAll('completed_jobs', 'created_at'),
  loadAll('ad_hoc_tasks', 'created_at'),
  loadAll('parts_to_order', 'added_at'),
]);

// Top-level jobs only — split children (parent_id set) are bench-card
// breakdowns of a top-level job, not separate backlog items.
const jobs = jobRows
  .filter(row => !row.parent_id)
  .map(row => {
    const backlog = row.bl === 'Y';
    const { readyToStart, awaiting, inTransit, schedulable } =
      deriveJobStatusFlags(row.status, row.action, backlog);
    return {
      id: row.id,
      job: row.job,
      customer: row.customer,
      mfr: row.mfr,
      model: row.model,
      status: row.status,
      bench: row.bench,
      hours: row.hours == null ? row.hours : Number(row.hours),
      action: row.action,
      desc: row.desc,
      vb: row.vb === 'Y',
      backlog,
      project: row.pj === 'Y',
      scheduled: row.scheduled,
      calendarSlot: row.calendar_slot || null,
      hasSubtasks: row.has_subtasks,
      done: row.done,
      readyToStart,
      awaiting,
      inTransit,
      schedulable,
      // No `days` field — see file header note. Do not synthesize one here.
    };
  });

const completedJobs = completedRows.map(row => ({
  id: row.job_id,
  job: row.job_number,
  customer: row.customer,
  mfr: row.mfr,
  model: row.model,
  hours: row.hours == null ? row.hours : Number(row.hours),
  invoiceAmount: Number(row.invoice_amount) || 0,
  weekKey: row.week_key,
  completedAt: row.completed_at,
}));

const adHocTasks = adHocRows.map(row => ({
  id: row.id,
  text: row.text,
  hours: row.hours,
  calendarSlot: row.calendar_slot,
  dateKey: row.date_key,
}));

// Only open (unresolved) items — resolved ones are done, no reason to
// re-surface them in the next meeting's Admin scan-side report.
const partsToOrder = partsRows
  .filter(row => !row.resolved)
  .map(row => ({
    id: row.id,
    description: row.description,
    category: row.category,
    neededForJob: row.needed_for_job,
    addedAt: row.added_at,
  }));

process.stdout.write(JSON.stringify({
  jobs,
  completedJobs,
  adHocTasks,
  partsToOrder,
  exportedAt: new Date().toISOString(),
}, null, 2));

process.exit(0);
