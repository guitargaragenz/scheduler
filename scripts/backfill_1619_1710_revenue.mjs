// One-off backfill: jobs 1619 and 1710, invoiced but never given a revenue row.
//
// Found 2026-08-08 by cross-checking the revenue table against the Multitrack
// invoice list. Twelve July invoices had no revenue line; nine of them belong
// to jobs no longer in the database at all, and two (1703 Murray Spicer, Liam
// Jolly) are still live jobs paid in advance — those will get their revenue
// the normal way when they are ticked done. These two are what is left.
//
// Amounts from Trevor (2026-08-08), ex-GST:
//   1619  Sheep as Chips Ltd, Matchless DC30            $1025.66, 20 May
//   1710  John Taotao, Yamaha Pacifica 112VM            $100.00,  29 Jul
//
// 1710 reconciles exactly against Multitrack invoice 1428 ($115.00 inclusive),
// which is what confirmed these figures are ex-GST and not invoice totals.
//
// Deliberately a script and NOT app code: nothing in the app may write a
// revenue row for a job it did not just complete. Safe to run twice — it
// refuses any job that already has a row.
//
//   node scripts/backfill_1619_1710_revenue.mjs          # dry run
//   node scripts/backfill_1619_1710_revenue.mjs --apply  # writes
//
// Run it from the repo root, so .env and node_modules resolve.

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const APPLY = process.argv.includes('--apply');

const INVOICES = {
  '1619': { amount: 1025.66, date: '2026-05-20' },
  '1710': { amount: 100.00,  date: '2026-07-29' },
};

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8').split('\n').filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

// Same rules as src/utils/calendar.js: weeks run Monday to Sunday.
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
  .select('id, job, customer, mfr, model, hours, parent_id')
  .in('job', numbers);

if (jobsErr) { console.error('Could not read jobs:', jobsErr.message); process.exit(1); }

const { data: existing, error: cjErr } = await sb
  .from('completed_jobs')
  .select('job_id')
  .in('job_id', (jobs || []).map(j => String(j.id)));

if (cjErr) { console.error('Could not read completed_jobs:', cjErr.message); process.exit(1); }

const alreadyHasRow = new Set((existing || []).map(r => String(r.job_id)));

const rows = [];
for (const number of numbers) {
  // One invoice per completed job, so the row keys on the top-level job — never
  // on a split piece. Same rule as topLevelJob() in src/hooks/useJobs.js.
  const job = (jobs || []).find(j => String(j.job) === number && !j.parent_id);
  if (!job) { console.log(`  ${number}  SKIP — no top-level job on the board`); continue; }
  if (alreadyHasRow.has(String(job.id))) { console.log(`  ${number}  SKIP — already has a revenue row`); continue; }
  // Midday local, so no timezone conversion can shift the invoice a day either
  // way and drop it into the wrong week.
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

if (!rows.length) { console.log('\nNothing to write.'); process.exit(0); }

console.log(`\n${rows.length} row(s) to insert:\n`);
for (const r of rows) {
  console.log(
    `  ${r.job_number}  ${r.customer}  ${r.mfr} ${r.model}  ` +
    `$${r.invoice_amount.toFixed(2)}  invoiced ${r.completed_at.slice(0, 10)}  week ${r.week_key}`
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
