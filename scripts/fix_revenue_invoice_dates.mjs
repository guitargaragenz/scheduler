// One-off correction: three revenue rows carry the day they were ticked, not
// the day they were invoiced.
//
// Jobs 321, 592 and 1714 (Sheep as Chips Ltd) were all invoiced 4 Aug 2026 but
// only ticked done on 8 Aug, during the live test of the append-only fix. The
// app stamps completed_at at tick time, which is right for normal use and
// wrong for a catch-up like this one.
//
// This changes the date and the week only. It never touches an amount, a job
// number, or a row's existence.
//
// This is deliberately a script and NOT app code. Nothing in the app may
// rewrite a revenue row — that is the whole point of the append-only build.
//
//   node scripts/fix_revenue_invoice_dates.mjs          # dry run
//   node scripts/fix_revenue_invoice_dates.mjs --apply  # writes
//
// Run it from the repo root, so .env and node_modules resolve.

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const APPLY = process.argv.includes('--apply');

// job_id -> the real invoice date, from Trevor (2026-08-08).
const DATES = {
  '321':  '2026-08-04',
  '592':  '2026-08-04',
  '1714': '2026-08-04',
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

const { data, error } = await sb
  .from('completed_jobs')
  .select('id, job_id, job_number, customer, invoice_amount, completed_at, week_key')
  .in('job_id', Object.keys(DATES));

if (error) {
  console.error('Could not read completed_jobs:', error.message);
  process.exit(1);
}

const updates = [];
for (const row of data || []) {
  // Midday local, so no timezone conversion can shift the invoice a day either
  // way and drop it into the wrong week.
  const completedAt = new Date(`${DATES[row.job_id]}T12:00:00`).toISOString();
  const weekKey = weekKeyFor(completedAt);
  console.log(
    `  ${row.job_number}  ${row.customer}  $${row.invoice_amount}  ` +
    `${row.completed_at.slice(0, 10)} -> ${completedAt.slice(0, 10)}   ` +
    `week ${row.week_key} -> ${weekKey}`
  );
  updates.push({ id: row.id, number: row.job_number, completedAt, weekKey });
}

const missing = Object.keys(DATES).filter(k => !(data || []).some(r => r.job_id === k));
for (const k of missing) console.log(`  ${k}  SKIP — no revenue row found`);

if (!updates.length) {
  console.log('\nNothing to change.');
  process.exit(0);
}

if (!APPLY) {
  console.log(`\nDry run. Nothing was written. Re-run with --apply to correct ${updates.length} row(s).`);
  process.exit(0);
}

let done = 0;
for (const u of updates) {
  const { error: upErr } = await sb
    .from('completed_jobs')
    .update({ completed_at: u.completedAt, week_key: u.weekKey })
    .eq('id', u.id);
  if (upErr) console.error(`  FAILED ${u.number}: ${upErr.message}`);
  else { console.log(`  fixed ${u.number} -> ${u.completedAt.slice(0, 10)}`); done += 1; }
}

console.log(`\nDone. ${done} of ${updates.length} row(s) corrected.`);
