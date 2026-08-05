#!/usr/bin/env node
//
// One-off backfill: give the Admin bench to live jobs that are blocked and have
// no bench stored.
//
// Why this needs to exist at all. inferBench() now returns 'Admin' for blocked
// work instead of null (2026-08-05, Trevor's ruling), but that only fixes jobs
// as they are classified. useSupabase.js reads the `bench` column verbatim and
// never re-infers it, so the rows already sitting in Supabase with a NULL bench
// stay that way forever unless something writes to them. This is that something.
//
// It ships as its own commit, landing AFTER the code change has been verified —
// deliberately, and this is the whole reason it is a separate script rather than
// part of the build. The code change is a revert away; this write is one-way.
// Backfilled first, a later revert would leave these rows reading 'Admin' with
// nothing to tell them apart from real Admin work.
//
// Safety rails, in order:
//   - Re-derives the list live every run. It is never a hardcoded list of job
//     numbers, because the set moves with each Multitrack import.
//   - Only touches rows where blockedPile() says blocked AND `bench` is empty.
//     A blocked job that already carries a real bench is left exactly as it is —
//     that is what keeps 393 and 693 (Booked In + INC, both Electronics) out of
//     this. Overwriting a stored bench is not what this is for.
//   - Writes the `bench` column and nothing else.
//   - Dry run by default. Pass --write to actually write.
//
// Usage:
//   node scripts/backfill_admin_bench.mjs           # show what would change
//   node scripts/backfill_admin_bench.mjs --write   # do it

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { blockedPile } from '../src/data/jobs.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Same env loading as board_meeting_export.mjs: .env then .env.local (Vite
// convention, .env.local wins), with real environment variables as the base so
// this also runs in a Claude Code web session where there are no .env files.
function loadEnvFile(name, env) {
  let text;
  try { text = readFileSync(join(root, name), 'utf8'); } catch { return env; }
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

const env = loadEnvFile('.env.local', loadEnvFile('.env', { ...process.env }));
if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
  throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.');
}

const write = process.argv.includes('--write');
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const { data, error } = await sb.from('jobs').select('*');
if (error) throw error;

// Same filters the app itself applies on load: departed rows are soft-deleted
// and invisible, split children take their bench from the parent, and done work
// is off the board.
const candidates = data
  .filter(r => !r.departed_at && !r.parent_id && !r.done && !r.bench)
  .map(r => ({
    raw: r,
    shape: {
      status: r.status,
      action: r.action,
      vb: r.vb === 'Y' || r.vb === true,
      backlog: r.bl === 'Y' || r.bl === true,
    },
  }))
  .filter(c => blockedPile(c.shape) != null);

console.log(`${candidates.length} blocked job(s) with no bench:`);
for (const c of candidates) {
  console.log(`  ${c.raw.job}  ${c.shape.status} / ${c.shape.action || '—'}  → Admin  (pile: ${blockedPile(c.shape)})`);
}

if (!write) {
  console.log('\nDry run. Nothing written. Re-run with --write to apply.');
  process.exit(0);
}

for (const c of candidates) {
  const { error: e } = await sb.from('jobs').update({ bench: 'Admin' }).eq('id', c.raw.id);
  if (e) throw new Error(`job ${c.raw.job}: ${e.message}`);
  console.log(`wrote ${c.raw.job}`);
}
console.log(`\nDone — ${candidates.length} row(s) set to Admin.`);
