#!/usr/bin/env node
// THROWAWAY one-shot backfill — Brief C. Copies the single Firestore doc
// `ggnz/dailyLogs` into the new Supabase daily_logs + deferred_items tables.
// Safe to delete once the migration is signed off.
//
// STRICTLY additive: reads Firestore (never writes/deletes it), dumps a raw
// JSON backup FIRST, then upserts into Supabase. Idempotent — re-running just
// re-upserts the same rows by primary key. Run the SQL migration
// (docs/supabase-daily-logs-migration.sql) BEFORE this script.
//
// Usage (from repo root, on Micky with .env.local present):
//   node scripts/backfill_daily_logs_to_supabase.mjs
//
// Requires in .env.local: VITE_FIREBASE_* (read source) and
// VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (write target).

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function loadEnvLocal() {
  const text = readFileSync(join(root, '.env.local'), 'utf8');
  const env = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

const env = loadEnvLocal();

// ---- 1. Read the Firestore doc -------------------------------------------
const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
});
const db = getFirestore(app);

const snap = await getDoc(doc(db, 'ggnz', 'dailyLogs'));
if (!snap.exists()) {
  console.error('Firestore doc ggnz/dailyLogs does not exist — nothing to backfill.');
  process.exit(1);
}
const data = snap.data();
const logs = data.logs || {};
const deferredItems = data.deferredItems || [];

// ---- 2. Dump the raw doc as the recovery artifact BEFORE any write --------
const backupPath = join(root, 'daily-logs-firestore-backup.json');
writeFileSync(backupPath, JSON.stringify(data, null, 2));
console.log(`Backup written: ${backupPath}`);
console.log(`Source: ${Object.keys(logs).length} day(s), ${deferredItems.length} deferred item(s).`);

// ---- 3. Upsert into Supabase ---------------------------------------------
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

// daily_logs — copy date_key VERBATIM. Do NOT recompute from a timestamp /
// toISOString().slice — that is UTC and would shift NZ-evening logs a day.
const logRows = Object.keys(logs).map(dateKey => {
  const day = logs[dateKey] || {};
  return {
    date_key: dateKey,
    bullets: day.bullets || [],
    closed_at: day.closedAt || null,
    locked: day.locked || false,
    updated_at: new Date().toISOString(),
  };
});

if (logRows.length > 0) {
  const { error } = await supabase.from('daily_logs').upsert(logRows, { onConflict: 'date_key' });
  if (error) { console.error('daily_logs upsert failed:', error); process.exit(1); }
}

// deferred_items — keyed by the item's existing id.
const deferredRows = deferredItems.map(item => ({
  id: item.id,
  job_id: item.jobId ?? null,
  bullet_text: item.bulletText ?? null,
  text: item.text ?? null,
  reason: item.reason ?? null,
  created_at: item.createdAt || new Date().toISOString(),
}));

if (deferredRows.length > 0) {
  const { error } = await supabase.from('deferred_items').upsert(deferredRows, { onConflict: 'id' });
  if (error) { console.error('deferred_items upsert failed:', error); process.exit(1); }
}

// ---- 4. Count-match verification -----------------------------------------
const { count: logCount, error: logErr } = await supabase
  .from('daily_logs').select('*', { count: 'exact', head: true });
const { count: deferredCount, error: defErr } = await supabase
  .from('deferred_items').select('*', { count: 'exact', head: true });

if (logErr || defErr) {
  console.error('Count query failed:', logErr || defErr);
  process.exit(1);
}

console.log('\n=== Count comparison ===');
console.log(`daily_logs:     Firestore ${Object.keys(logs).length}  ->  Supabase ${logCount}  ${Object.keys(logs).length === logCount ? 'OK' : 'MISMATCH'}`);
console.log(`deferred_items: Firestore ${deferredItems.length}  ->  Supabase ${deferredCount}  ${deferredItems.length === deferredCount ? 'OK' : 'MISMATCH'}`);
console.log('\n(Supabase counts are totals for the table — expected to match or exceed the Firestore source after an idempotent re-run.)');

process.exit(0);
