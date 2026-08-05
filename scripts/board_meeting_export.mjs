#!/usr/bin/env node
// Read-only Supabase export for the Sunday Board Meeting workflow.
// Never writes anything back — only reads the `jobs`, `completed_jobs`,
// `ad_hoc_tasks` and `parts_to_order` tables and prints one JSON blob to
// stdout. Replaces the old Firestore version (Brief D — Firestore is fully
// retired, see .claude/pending-brief.md).
//
// This is a plain Node script, not a Vite module, so it can't import
// src/utils/supabase.js directly (that file reads import.meta.env, which
// only exists under Vite). Instead it builds its own Supabase client using
// the SAME table/column names supabase.js uses so the two never drift
// apart.
//
// Job-status derivation (awaiting/inTransit/schedulable) is
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
// Also dropped vs. the old Firestore shape: `scheduledSlots`. Nothing in the
// restructured workflow (.claude/workflows/sunday-board-meeting.js) reads it.
//
// `parkingLotItems` is BACK, and reads the Supabase `parking_lot` table —
// changed 2026-08-01, brief "One Parking Lot, fed from the Daily Log". The note
// here used to say parking-lot review was the live session reading
// admin/context/parking-lot.md, "NOT the Supabase parking_lot table (which
// backs the in-app Parking Lot page, an unrelated product-idea feature)". That
// was wrong on both counts: the table is Trevor's own input channel into this
// meeting, and because of that note the meeting never read it — eight of his
// items sat unread from June 2026. There is now ONE parking lot, the table; the
// markdown file is deleted. If this script stops exporting it, the meeting has
// no parking lot at all.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
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
// on overlap (Vite convention). Real environment variables are the base layer
// and lose to both, so Micky/Moby keep behaving exactly as before.
//
// The process.env layer exists so this script can run where there are no .env
// files at all — a Claude Code web session, where the keys are set on the
// environment instead. Without it a web session cannot export, which means it
// cannot run a board meeting (no job list, no parking lot). Added 2026-08-04.
// Only the anon key is involved: the same key the app already ships to every
// browser that loads the Scheduler, so this adds no exposure the app doesn't
// already have.
function loadEnv() {
  const env = { ...process.env };
  loadEnvFile('.env', env);
  loadEnvFile('.env.local', env);
  return env;
}

const env = loadEnv();
if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Put them in .env (or .env.local) ' +
    'at the repo root, or set them as environment variables. Without them this script ' +
    'cannot read Supabase and the board meeting has no data.'
  );
}
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

async function loadAll(table, order) {
  const { data, error } = await supabase.from(table).select('*').order(order, { ascending: false });
  if (error) throw new Error(`Supabase read of "${table}" failed: ${error.message}`);
  return data || [];
}

const [jobRows, completedRows, adHocRows, partsRows, parkingLotRows] = await Promise.all([
  loadAll('jobs', 'created_at'),
  loadAll('completed_jobs', 'created_at'),
  loadAll('ad_hoc_tasks', 'created_at'),
  loadAll('parts_to_order', 'added_at'),
  loadAll('parking_lot', 'created_at'),
]);

// Top-level jobs only — split children (parent_id set) are bench-card
// breakdowns of a top-level job, not separate backlog items.
//
// Departed jobs are excluded too. A job that drops off the Multitrack printout
// is SOFT-deleted: the row stays, with departed_at stamped (writeDepartureBatch
// in src/utils/supabase.js), and the app filters it out on load — see
// `const live = dbJobs.filter(j => !j.departed_at)` in src/hooks/useSupabase.js.
// This export never had that filter, so every board meeting was reported off a
// job list the app itself does not show. Caught 2026-08-04, when the meeting
// reported 55 jobs — including 5 Sheep as Chips jobs closed months ago —
// against a printout showing 36. Same filter as the app, or the numbers drift
// again.
const jobs = jobRows
  .filter(row => !row.parent_id && !row.departed_at)
  .map(row => {
    const backlog = row.bl === 'Y';
    const { awaiting, inTransit, schedulable } =
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

// Trevor's parking lot — the ideas, queries and bugs he logged during the week
// for this meeting. `content` is a TEXT column holding a JSON string of
// { id, date, title, details, status }; same parse as src/utils/supabase.js's
// loadParkingLot(). A row whose content won't parse is kept as a title-only
// item rather than silently dropped — losing one of his items without a trace
// is the exact failure this brief existed to stop.
// Only open items: done ones are closed business.
const parkingLotItems = parkingLotRows
  .map(row => {
    try {
      const parsed = JSON.parse(row.content);
      if (parsed && typeof parsed === 'object') {
        return { date: null, title: '', details: '', status: 'open', ...parsed, id: parsed.id || row.id };
      }
    } catch {
      // fall through
    }
    return { id: row.id, date: null, title: String(row.content ?? ''), details: '', status: 'open' };
  })
  .filter(item => item.status !== 'done');

// What actually shipped since the last meeting. Added 2026-08-04 because the
// export was data-only: the meeting could see Trevor's workload but had no way
// to know what had been built, so it re-proposed work that was already done and
// he risked approving fixes for things that were already fixed.
//
// Read from git rather than from a hand-kept list, because a list is another
// thing to remember and this needs no maintenance. Merge commits are excluded —
// their subjects just repeat the branch's own commits.
//
// Failure here must never take the meeting down: no git, no history, a shallow
// clone with nothing in range — all return an empty list, and the meeting runs
// exactly as it did before this existed.
function shippedSince(days = 8) {
  try {
    const out = execFileSync(
      'git',
      ['log', `--since=${days}.days`, '--no-merges', '--date=short', '--pretty=%h\t%ad\t%s'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    return out
      .split('\n')
      .filter(Boolean)
      .map(line => {
        const [commit, date, ...rest] = line.split('\t');
        return { commit, date, subject: rest.join('\t') };
      });
  } catch {
    return [];
  }
}

// The "why" behind the above — the Shipped notes written into the briefs index
// when work merges. Sent whole; it's short, and the meeting can read it.
function shippedNotes() {
  try {
    return readFileSync('docs/briefs/README.md', 'utf8');
  } catch {
    return '';
  }
}

process.stdout.write(JSON.stringify({
  jobs,
  completedJobs,
  adHocTasks,
  partsToOrder,
  parkingLotItems,
  shippedSinceLastMeeting: shippedSince(),
  briefsIndex: shippedNotes(),
  exportedAt: new Date().toISOString(),
}, null, 2));

process.exit(0);
