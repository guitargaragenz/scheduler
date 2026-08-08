// One-off correction: job 1712's revenue row is missing its make and model,
// and carries the wrong hours.
//
// The row was created by hand-backfill, which only had the money — so mfr and
// model were never filled, and hours came from the job card's estimate rather
// than the time actually worked. Trevor supplied the real values 2026-08-08:
// PRS CE, 1.5 hours.
//
// Nothing on the revenue screens totals hours, so this is a tidy-up, not a
// figures correction. The amount is not touched.
//
// Deliberately a script and NOT app code: nothing in the app may rewrite a
// revenue row.
//
//   node scripts/fix_1712_make_model_hours.mjs          # dry run
//   node scripts/fix_1712_make_model_hours.mjs --apply  # writes
//
// Run it from the repo root, so .env and node_modules resolve.

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const APPLY = process.argv.includes('--apply');

const JOB_ID = '1712';
const MFR = 'PRS';
const MODEL = 'CE';
const HOURS = 1.5;

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8').split('\n').filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const { data, error } = await sb
  .from('completed_jobs')
  .select('id, job_number, customer, mfr, model, hours, invoice_amount')
  .eq('job_id', JOB_ID);

if (error) { console.error('Could not read completed_jobs:', error.message); process.exit(1); }

const row = (data || [])[0];
if (!row) { console.log(`No revenue row for job ${JOB_ID}.`); process.exit(0); }

if (row.mfr === MFR && row.model === MODEL && Number(row.hours) === HOURS) {
  console.log(`Job ${JOB_ID} already reads ${MFR} ${MODEL}, ${HOURS}h. Nothing to do.`);
  process.exit(0);
}

console.log(`  ${row.job_number}  ${row.customer}  $${row.invoice_amount} (unchanged)`);
console.log(`    make  : ${row.mfr ?? '(blank)'} -> ${MFR}`);
console.log(`    model : ${row.model ?? '(blank)'} -> ${MODEL}`);
console.log(`    hours : ${row.hours ?? '(blank)'} -> ${HOURS}`);

if (!APPLY) {
  console.log('\nDry run. Nothing was written. Re-run with --apply to correct it.');
  process.exit(0);
}

const { error: upErr } = await sb
  .from('completed_jobs')
  .update({ mfr: MFR, model: MODEL, hours: HOURS })
  .eq('id', row.id);

if (upErr) { console.error('FAILED:', upErr.message); process.exit(1); }
console.log(`\nDone. ${row.job_number} now reads ${MFR} ${MODEL}, ${HOURS}h. Amount untouched.`);
