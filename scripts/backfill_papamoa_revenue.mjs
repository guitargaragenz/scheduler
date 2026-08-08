// One-off backfill: the nine Papamoa College instruments, invoiced 29 Jul 2026
// with no revenue row.
//
// All nine were booked in 10 June and went back to the school together. Six
// still read "To Be Inv" on the board and none was ever ticked done, so no
// revenue line was ever written for any of them.
//
// From Trevor (2026-08-08), off the invoice: 1690 (the Medelli keyboard) at
// $100 ex-GST, the eight ukuleles at $50 ex-GST each, all dated 29 Jul.
//
// This writes revenue rows ONLY. It does not touch the jobs themselves — they
// stay exactly as they are on the board, and clearing them is a separate
// decision.
//
// Deliberately a script and NOT app code: nothing in the app may write a
// revenue row for a job it did not just complete. Safe to run twice — it
// refuses any job that already has a row.
//
//   node scripts/backfill_papamoa_revenue.mjs          # dry run
//   node scripts/backfill_papamoa_revenue.mjs --apply  # writes
//
// Run it from the repo root, so .env and node_modules resolve.

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const APPLY = process.argv.includes('--apply');

const INVOICE_DATE = '2026-07-29';
const KEYBOARD = '1690';
const KEYBOARD_AMOUNT = 100.00;
const UKULELE_AMOUNT = 50.00;

const NUMBERS = ['1682', '1683', '1684', '1685', '1686', '1687', '1688', '1689', '1690'];

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

const { data: jobs, error: jobsErr } = await sb
  .from('jobs')
  .select('id, job, customer, mfr, model, hours')
  .in('job', NUMBERS);

if (jobsErr) {
  console.error('Could not read jobs:', jobsErr.message);
  process.exit(1);
}

const { data: existing, error: cjErr } = await sb
  .from('completed_jobs')
  .select('job_id')
  .in('job_id', (jobs || []).map(j => String(j.id)));

if (cjErr) {
  console.error('Could not read completed_jobs:', cjErr.message);
  process.exit(1);
}

const alreadyHasRow = new Set((existing || []).map(r => String(r.job_id)));

// Midday local, so no timezone conversion can shift the invoice a day either
// way and drop it into the wrong week.
const completedAt = new Date(`${INVOICE_DATE}T12:00:00`).toISOString();
const weekKey = weekKeyFor(completedAt);

const rows = [];
for (const number of NUMBERS) {
  const job = (jobs || []).find(j => String(j.job) === number);
  if (!job) { console.log(`  ${number}  SKIP — not on the board`); continue; }
  if (alreadyHasRow.has(String(job.id))) { console.log(`  ${number}  SKIP — already has a revenue row`); continue; }
  rows.push({
    id: `cj-${job.id}`,
    job_id: String(job.id),
    job_number: job.job ?? null,
    customer: job.customer ?? null,
    mfr: job.mfr ?? null,
    model: job.model ?? null,
    hours: job.hours ?? null,
    invoice_amount: number === KEYBOARD ? KEYBOARD_AMOUNT : UKULELE_AMOUNT,
    week_key: weekKey,
    completed_at: completedAt,
    created_at: new Date().toISOString(),
  });
}

if (!rows.length) {
  console.log('\nNothing to write.');
  process.exit(0);
}

console.log(`\n${rows.length} row(s) to insert, all invoiced ${INVOICE_DATE} (week ${weekKey}):\n`);
for (const r of rows) {
  console.log(`  ${r.job_number}  ${r.mfr} ${r.model}  $${r.invoice_amount.toFixed(2)}`);
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
