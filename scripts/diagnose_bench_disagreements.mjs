#!/usr/bin/env node
//
// READ-ONLY diagnostic. Writes nothing, ever — there is no --write flag.
//
// The question it answers, from the 2026-09-01 keyword handoff: when Trevor
// edits ANY keyword box in Settings, the confirmation dialog lists ~10 jobs
// that have nothing to do with what he typed. The dialog is not wrong. Saving
// keywords re-runs bench matching over every job (App.jsx, applyBenchKeywords-
// Change), so the list is dominated by jobs whose STORED bench already
// disagrees with what the keywords produce — a disagreement that was sitting
// there before the edit and has nothing to do with it.
//
// What was never established is WHY those jobs disagree. This prints exactly
// that, off the live data:
//
//   - runs the app's own preview (previewBenchChanges) with the SAVED keyword
//     list, unchanged. No edit at all. Every job it returns is a pre-existing
//     disagreement, i.e. one of the jobs that turns up in the dialog no matter
//     what Trevor types.
//   - for each one, prints stored bench -> what the keywords say, and then the
//     actual keywords on the target bench that match the job's text.
//
// It uses the app's own inferBench/previewBenchChanges rather than a second
// copy of the rules, so it cannot disagree with what the dialog shows.
//
// Needs .env with the Supabase keys, so it runs on Micky, not in a web session.
//
// Usage:
//   node scripts/diagnose_bench_disagreements.mjs

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { DEFAULT_BENCH_KEYWORDS, quotedKeyword, andKeywordWords } from '../src/data/jobs.js';
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

// The saved keyword list, exactly as the app reads it. Copied inline rather
// than imported from useAppSettings.js, which is a React hook file — this is
// the whole of sanitizeBenchKeywords() and it is six lines.
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

// No edit. The saved list, run against itself.
const moves = previewBenchChanges(jobs, saved);
const byId = new Map(jobs.map(j => [j.id, j]));

// Which of a bench's keywords actually hit this job's text, so the cause is
// named rather than guessed at. Same text inferBench builds.
function matchingKeywords(job, bench) {
  if (!bench) return [];
  const list = (saved[bench]?.length ? saved[bench] : DEFAULT_BENCH_KEYWORDS[bench]) || [];
  const text = (job.desc + ' ' + job.model).toLowerCase();
  const hits = [];
  for (const word of list) {
    const inner = quotedKeyword(word);
    const pattern = inner ?? word;
    let rx;
    try { rx = new RegExp(pattern); } catch { hits.push(`${word}  (INVALID PATTERN)`); continue; }
    const m = text.match(rx);
    if (!m) continue;
    const pair = andKeywordWords(word);
    const label = pair ? `${pair[0]} + ${pair[1]}` : word;
    hits.push(`${label}${inner ? ' [quoted]' : ''} → matched "${m[0]}"`);
  }
  return hits;
}

const benches = Object.keys({ ...DEFAULT_BENCH_KEYWORDS, ...saved });
console.log('Saved keyword lists in app_settings:');
for (const b of benches) {
  const isSaved = Boolean(saved[b]?.length);
  console.log(`  ${b.padEnd(12)} ${isSaved ? 'saved  ' : 'DEFAULT'}  ${JSON.stringify(saved[b] ?? DEFAULT_BENCH_KEYWORDS[b])}`);
}

console.log(`\n${jobs.length} live job(s) read. ${moves.length} already disagree with the saved keywords,`);
console.log('before any edit. These are the jobs that show up in the dialog whatever Trevor types.\n');

for (const mv of moves) {
  const j = byId.get(mv.id);
  console.log(`#${mv.job}  ${mv.from || '(none)'} → ${mv.to || '(none)'}`);
  console.log(`    status: ${j.status || '—'} / ${j.action || '—'}${j.backlog ? ' / BL' : ''}${j.vb ? ' / VB' : ''}`);
  console.log(`    desc:   ${j.desc}`);
  if (mv.to === 'Admin') {
    console.log('    cause:  blocked (blockedPile) — no keyword involved.');
  } else {
    const hits = matchingKeywords(j, mv.to);
    console.log(`    matched on ${mv.to}: ${hits.length ? '' : '(none — check bench order)'}`);
    hits.forEach(h => console.log(`      - ${h}`));
  }
  console.log('');
}

console.log('Nothing was written.');
