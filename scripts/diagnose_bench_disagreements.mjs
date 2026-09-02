#!/usr/bin/env node
//
// READ-ONLY diagnostic. Writes nothing, ever — there is no --write flag.
//
// The question it answers, from the 2026-09-01 keyword handoff: when Trevor
// edits ANY keyword box in Settings, the confirmation dialog lists ~10 jobs
// that have nothing to do with what he typed. The dialog is not lying. Saving
// keywords re-runs bench matching over every job (App.jsx,
// applyBenchKeywordsChange), so the list is dominated by jobs whose STORED
// bench already disagrees with what the keywords produce — a disagreement that
// was sitting there before the edit.
//
// Every one of the ten Trevor read off the board on 2026-09-01 was Admin in one
// direction or the other, and Admin is not a keyword bench: inferBench() hands
// it out when blockedPile() says the job is blocked. So the ten are a
// blocked-state disagreement, not a keyword one.
//
// Three of them (1727, 1448, 1604) sit ON Admin and the app wants to move them
// OFF it — meaning blockedPile() does not think they are blocked. Trevor says
// they are on hold or in transit, and that the Multitrack printout spells those
// exactly 'On Hold' and 'In Transit', which is exactly what blockedPile()
// matches on. So the stored string is not what it appears to be.
//
// That is what this prints, and why it prints the status inside <angle
// brackets> with its character codes: a double space, a non-breaking space or a
// trailing space is invisible on screen — the browser collapses it — while
// `status === 'On Hold'` sees a completely different string. An invisible
// mismatch is exactly the shape of failure this app keeps getting bitten by, so
// the fix must not be guessed at from a rendered page.
//
// Needs .env with the Supabase keys, so it runs on Micky, not in a web session.
//
// Usage:
//   node scripts/diagnose_bench_disagreements.mjs

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { blockedPile } from '../src/data/jobs.js';
import { previewBenchChanges } from '../src/data/benchKeywordPreview.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Same env loading as the other scripts in this folder: .env then .env.local
// (Vite convention, .env.local wins), real environment variables underneath.
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
  throw new Error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — run this on Micky.');
}

const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

// The saved keyword list, exactly as the app reads it. The sanitize step is
// copied inline rather than imported from useAppSettings.js, which is a React
// hook file — this is the whole of sanitizeBenchKeywords() and it is six lines.
const { data: settingRows, error: settingErr } = await sb
  .from('app_settings').select('key, value').eq('key', 'benchKeywords');
if (settingErr) throw settingErr;

const rawSaved = settingRows?.[0]?.value;
const saved = {};
if (rawSaved && typeof rawSaved === 'object' && !Array.isArray(rawSaved)) {
  for (const [bench, list] of Object.entries(rawSaved)) {
    if (Array.isArray(list) && list.length > 0) saved[bench] = list;
  }
}

const { data: rows, error } = await sb.from('jobs').select('*');
if (error) throw error;

// Same read-side filter the app applies: a departed job keeps its row but has
// stopped existing as far as every screen is concerned (normalizeJobsFromDb).
// Only the fields inferBench and isReinferable actually read are mapped.
const jobs = rows
  .filter(r => !r.departed_at)
  .map(r => ({
    id: r.id,
    job: r.job,
    parentId: r.parent_id || null,
    isSplit: r.is_split,
    hasSubtasks: r.has_subtasks,
    desc: r.desc || '',
    model: r.model || '',
    mfr: r.mfr || '',
    status: r.status || '',
    action: r.action || '',
    bench: r.bench,
    backlog: r.bl === 'Y' || r.bl === true,
    vb: r.vb === 'Y' || r.vb === true,
  }));

// A string with nothing hidden in it. Every character that is not a plain
// printable one is named, so a double space, a non-breaking space or a trailing
// space cannot slip past the way it does on a rendered page.
function reveal(s) {
  const shown = String(s).replace(/[^\x20-\x7E]/g, c => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`);
  const odd = [];
  if (/ {2,}/.test(s)) odd.push('DOUBLE SPACE');
  if (s !== s.trim()) odd.push('LEADING/TRAILING SPACE');
  if (/[^\x20-\x7E]/.test(s)) odd.push('NON-ASCII CHARACTER');
  return `<${shown}>${odd.length ? '   ← ' + odd.join(', ') : ''}`;
}

// No edit at all — the saved keyword list, run against itself. Everything this
// returns was already disagreeing before Trevor typed anything.
const moves = previewBenchChanges(jobs, saved);
const byId = new Map(jobs.map(j => [j.id, j]));

console.log(`${jobs.length} live job(s) read.`);
console.log(`${moves.length} already disagree with the SAVED keywords, before any edit.`);
console.log('These are the jobs that appear in the dialog whatever Trevor types.\n');

for (const mv of moves) {
  const j = byId.get(mv.id);
  const pile = blockedPile({ status: j.status, action: j.action, backlog: j.backlog, vb: j.vb });
  console.log(`#${mv.job}  ${mv.from || '(none)'} → ${mv.to || '(none)'}`);
  console.log(`    status stored as: ${reveal(j.status)}`);
  console.log(`    action stored as: ${reveal(j.action)}`);
  console.log(`    BL: ${j.backlog ? 'Y' : 'n'}   VB: ${j.vb ? 'Y' : 'n'}`);
  console.log(`    app thinks it is: ${pile ? `BLOCKED (${pile})` : 'workable'}`);
  console.log(`    desc: ${j.desc}`);
  console.log('');
}

// Every distinct status string in the whole database, so a variant that is
// nearly-but-not-quite one of the three blockedPile() matches on is visible
// even if it is not currently causing a disagreement.
const counts = new Map();
for (const j of jobs) counts.set(j.status, (counts.get(j.status) || 0) + 1);
console.log('Every status string in the database, exactly as stored:');
for (const [s, n] of [...counts].sort((a, b) => b[1] - a[1])) {
  const known = ['On Hold', 'In Transit', 'Waiting'].includes(s);
  console.log(`  ${String(n).padStart(4)}x  ${reveal(s)}${known ? '   [matches blockedPile]' : ''}`);
}

console.log('\nNothing was written.');
