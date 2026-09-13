// One-off correction: job 1712 (Jules Lovell) was recorded GST-inclusive.
//
// The row holds $204.45, which is the Total off Multitrack invoice 1431. Every
// amount in completed_jobs is meant to be ex-GST — every entry box in the app
// is labelled so. Ex-GST that invoice is $177.78.
//
// Found 2026-08-08 by cross-checking the whole revenue table against the
// Multitrack invoice list. It was the only row that did not reconcile; the
// rest matched their invoice totals exactly once GST came off.
//
// Deliberately a script and NOT app code: nothing in the app may rewrite a
// revenue row.
//
//   node scripts/fix_1712_gst.mjs          # dry run
//   node scripts/fix_1712_gst.mjs --apply  # writes
//
// Run it from the repo root, so .env and node_modules resolve.

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const APPLY = process.argv.includes('--apply');

const JOB_ID = '1712';
const WRONG = 204.45;   // refuse to touch the row if it does not still hold this
const CORRECT = 177.78; // 204.45 / 1.15, rounded to the cent

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8').split('\n').filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const { data, error } = await sb
  .from('completed_jobs')
  .select('id, job_number, customer, invoice_amount, completed_at')
  .eq('job_id', JOB_ID);

if (error) { console.error('Could not read completed_jobs:', error.message); process.exit(1); }

const row = (data || [])[0];
if (!row) { console.log(`No revenue row for job ${JOB_ID}.`); process.exit(0); }

if (Number(row.invoice_amount) !== WRONG) {
  console.log(`Row already holds $${row.invoice_amount}, not $${WRONG}. Leaving it alone.`);
  process.exit(0);
}

console.log(`  ${row.job_number}  ${row.customer}  $${row.invoice_amount} -> $${CORRECT.toFixed(2)}  (GST removed)`);

if (!APPLY) {
  console.log('\nDry run. Nothing was written. Re-run with --apply to correct it.');
  process.exit(0);
}

// Guard on the old value too, so a row changed by hand in between is not
// silently overwritten.
const { error: upErr } = await sb
  .from('completed_jobs')
  .update({ invoice_amount: CORRECT })
  .eq('id', row.id)
  .eq('invoice_amount', WRONG);

if (upErr) { console.error('FAILED:', upErr.message); process.exit(1); }
console.log(`\nDone. ${row.job_number} corrected to $${CORRECT.toFixed(2)}.`);
