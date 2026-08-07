// One-off repair: fill in the null `job_number` values in completed_jobs.
//
// `buildManualInvoiceJob()` used to hard-code `job: null`, so any revenue row
// written through the catch-up / reconfirm flow lost its job number and could
// not be reconciled back to Multitrack. The code is fixed (src/data/jobs.js),
// but the rows already in the database still carry null.
//
// This is deliberately a script and NOT app code. Nothing in the app may
// rewrite a revenue row — that is the whole point of the append-only build.
// This runs by hand, once, on purpose.
//
// It only ever fills a null. It never changes a job_number that already has a
// value, and it never touches an amount, a date or a row's existence.
//
//   node scripts/repair_completed_job_numbers.mjs          # dry run, changes nothing
//   node scripts/repair_completed_job_numbers.mjs --apply  # writes
//
// Run it from the repo root, so .env and node_modules resolve.

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const APPLY = process.argv.includes('--apply');

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8').split('\n').filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

// Same rule as jobNumberFromId() in src/data/jobs.js: every job id starts with
// its number, whether it's "1712", "1520_Luthier_0" or "2000-ST".
const numberFromId = id => (String(id ?? '').match(/^(\d+)/) || [])[1] || null;

const { data, error } = await sb
  .from('completed_jobs')
  .select('id, job_id, job_number, customer, invoice_amount, completed_at')
  .is('job_number', null);

if (error) {
  console.error('Could not read completed_jobs:', error.message);
  process.exit(1);
}

if (!data.length) {
  console.log('Nothing to repair — no completed_jobs row has a null job_number.');
  process.exit(0);
}

console.log(`${data.length} row(s) with a null job_number:\n`);

const fixable = [];
for (const row of data) {
  const number = numberFromId(row.job_id);
  console.log(
    `  ${row.id}  job_id=${row.job_id}  ${row.customer || '(no customer)'}  ` +
    `$${row.invoice_amount}  ->  ${number ? `job_number=${number}` : 'NO NUMBER IN ID, skipping'}`
  );
  if (number) fixable.push({ id: row.id, number });
}

if (!APPLY) {
  console.log(`\nDry run. Nothing was written. Re-run with --apply to fix ${fixable.length} row(s).`);
  process.exit(0);
}

let done = 0;
for (const { id, number } of fixable) {
  // .is('job_number', null) in the filter, so a row that gained a number
  // between the read and the write is left alone rather than overwritten.
  const { error: upErr } = await sb
    .from('completed_jobs')
    .update({ job_number: number })
    .eq('id', id)
    .is('job_number', null);
  if (upErr) console.error(`  FAILED ${id}: ${upErr.message}`);
  else { console.log(`  fixed ${id} -> ${number}`); done += 1; }
}

console.log(`\nDone. ${done} of ${fixable.length} row(s) repaired.`);
