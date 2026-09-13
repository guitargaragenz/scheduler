// One-off backfill: five jobs finished on 2 Aug 2026 with no revenue row.
//
// They were ticked done under the old code, which deleted the whole
// completed_jobs table and re-inserted whatever the browser tab held in
// memory. Their revenue lines went with it. The jobs themselves survived —
// only the money is missing.
//
// The amounts below came from Trevor, read off the invoices, ex-GST
// (2026-08-08). They are hard-coded on purpose: this script must produce the
// same result every time it runs, and must never invent a figure.
//
// This is deliberately a script and NOT app code. Nothing in the app may write
// a revenue row for a job it did not just complete. This runs by hand, once.
//
// It refuses to touch a job that already has a revenue row, so running it
// twice is safe — the second run reports "already has a row" and writes
// nothing.
//
//   node scripts/backfill_missing_revenue_rows.mjs          # dry run
//   node scripts/backfill_missing_revenue_rows.mjs --apply  # writes
//
// Run it from the repo root, so .env and node_modules resolve.

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const APPLY = process.argv.includes('--apply');

// job number -> invoice amount (ex-GST) and invoice date.
//
// The dates come from the invoices, not from the jobs table. Every one of
// these five carries departed_at 2026-08-02T11:01:20.769Z — the same value to
// the millisecond, which is a batch write stamping them all at once, not the
// day any of them actually finished. Using it would have dumped four months of
// work into a single week's takings.
const INVOICES = {
  '1620': { amount: 583.04, date: '2026-05-20' },
  '1626': { amount: 243.25, date: '2026-07-23' },
  '1671': { amount: 141.36, date: '2026-07-23' },
  '1698': { amount: 89.00,  date: '2026-07-22' },
  '1702': { amount: 48.69,  date: '2026-07-26' },
};

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8').split('\n').filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

// Same rules as the app: localDateKey() and getWeekDays()[0] in
// src/utils/calendar.js. The week runs Monday to Sunday, so a Sunday belongs
// to the week that started six days earlier, not the one starting tomorrow.
const dateKey = d =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function weekKeyFor(iso) {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return dateKey(d);
}

const numbers = Object.keys(INVOICES);

const { data: jobs, error: jobsErr } = await sb
  .from('jobs')
  .select('id, job, customer, mfr, model, bench, hours, done, departed_at')
  .in('job', numbers);

if (jobsErr) {
  console.error('Could not read jobs:', jobsErr.message);
  process.exit(1);
}

const { data: existing, error: cjErr } = await sb
  .from('completed_jobs')
  .select('id, job_id, job_number, invoice_amount')
  .in('job_id', jobs.map(j => String(j.id)));

if (cjErr) {
  console.error('Could not read completed_jobs:', cjErr.message);
  process.exit(1);
}

const alreadyHasRow = new Set((existing || []).map(r => String(r.job_id)));

const rows = [];
for (const number of numbers) {
  const job = jobs.find(j => String(j.job) === number);
  if (!job) {
    console.log(`  ${number}  SKIP — not on the board any more`);
    continue;
  }
  if (alreadyHasRow.has(String(job.id))) {
    console.log(`  ${number}  SKIP — already has a revenue row`);
    continue;
  }
  // Midday local, so no timezone conversion can shift the invoice onto the
  // day before or after — which for a Monday or a Sunday would move it into
  // the wrong week entirely.
  const completedAt = new Date(`${INVOICES[number].date}T12:00:00`).toISOString();
  rows.push({
    id: `cj-${job.id}`,
    job_id: String(job.id),
    job_number: job.job ?? null,
    customer: job.customer ?? null,
    mfr: job.mfr ?? null,
    model: job.model ?? null,
    hours: job.hours ?? null,
    invoice_amount: INVOICES[number].amount,
    week_key: weekKeyFor(completedAt),
    completed_at: completedAt,
    created_at: new Date().toISOString(),
  });
}

if (!rows.length) {
  console.log('\nNothing to write.');
  process.exit(0);
}

console.log(`\n${rows.length} row(s) to insert:\n`);
for (const r of rows) {
  console.log(
    `  ${r.job_number}  ${r.customer}  ${r.mfr} ${r.model}  ` +
    `$${r.invoice_amount.toFixed(2)}  completed ${r.completed_at.slice(0, 10)}  week ${r.week_key}`
  );
}
console.log(`\n  TOTAL  $${rows.reduce((s, r) => s + r.invoice_amount, 0).toFixed(2)}`);

if (!APPLY) {
  console.log('\nDry run. Nothing was written. Re-run with --apply to insert.');
  process.exit(0);
}

let done = 0;
for (const row of rows) {
  const { error } = await sb.from('completed_jobs').insert([row]);
  if (error) console.error(`  FAILED ${row.job_number}: ${error.message}`);
  else { console.log(`  inserted ${row.job_number} -> $${row.invoice_amount.toFixed(2)}`); done += 1; }
}

console.log(`\nDone. ${done} of ${rows.length} row(s) inserted.`);
