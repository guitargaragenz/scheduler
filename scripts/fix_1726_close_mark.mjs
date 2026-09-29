// One-off correction: job 1726 lost its Week-page close mark.
//
// On 2026-09-29 a second tap on the x of the already-invoiced job cleared its
// close:2026-09-28 mark, and the finished job dropped off that week. The app
// now refuses that second tap; this puts the one lost mark back.
//
// Deliberately a script and NOT app code. It inserts ONE bench_week_marks row
// and touches nothing else.
//
//   node scripts/fix_1726_close_mark.mjs          # dry run
//   node scripts/fix_1726_close_mark.mjs --apply  # writes
//
// Run it from the repo root, so .env and node_modules resolve.

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const APPLY = process.argv.includes('--apply');

const ROW = { job_id: '1726', date_key: 'close:2026-09-28', mark: 'closed' };

const env = Object.fromEntries(
  fs.readFileSync('.env', 'utf8').split('\n').filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const { data, error } = await sb
  .from('bench_week_marks')
  .select('job_id, date_key, mark')
  .eq('job_id', ROW.job_id)
  .eq('date_key', ROW.date_key);

if (error) { console.error('Could not read bench_week_marks:', error.message); process.exit(1); }

if ((data || []).length > 0) {
  console.log('Row already exists. Leaving it alone:');
  for (const r of data) console.log(`  ${r.job_id}  ${r.date_key}  ${r.mark}`);
  process.exit(0);
}

console.log(`  will insert: ${ROW.job_id}  ${ROW.date_key}  ${ROW.mark}`);

if (!APPLY) {
  console.log('\nDry run. Nothing was written. Re-run with --apply to insert it.');
  process.exit(0);
}

// A plain insert, not an upsert: if the row appeared in between, the unique
// key makes this fail rather than overwrite anything.
const { error: insErr } = await sb.from('bench_week_marks').insert(ROW);

if (insErr) { console.error('FAILED:', insErr.message); process.exit(1); }
console.log(`\nDone. Job ${ROW.job_id} is closed on the week of 2026-09-28 again.`);
