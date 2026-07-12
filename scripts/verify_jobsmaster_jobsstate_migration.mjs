#!/usr/bin/env node
// Go/no-go gate for the jobsMaster/jobsState cutover.
//
// Reads back the live jobsMaster + jobsState collections from Firestore,
// reconstructs the flat job list using the ACTUAL joinJobsMasterState()
// from src/data/joinJobs.js (imported, not reimplemented — so this can
// never silently drift from what the running app does), and deep-compares
// that reconstruction against the pre-migration snapshot written by
// migrate_to_jobsmaster_jobsstate.mjs.
//
// Exit code 0 + "0 unexplained diffs"  → PASS, safe to cut over.
// Exit code 1 + itemized diff list     → FAIL, do not cut over.
//
// False negatives (PASS when a real diff exists) are far worse than false
// positives here — when in doubt, this script reports a diff rather than
// silently normalizing it away.
//
// Usage:
//   node scripts/verify_jobsmaster_jobsstate_migration.mjs [path/to/pre-migration-snapshot.json]
//   (with no argument, uses the most recent scripts/backups/pre-migration-*.json)
//
// Read-only against Firestore — never writes anything.

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { joinJobsMasterState } from '../src/data/joinJobs.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function loadEnvLocal() {
  const path = join(root, '.env.local');
  const text = readFileSync(path, 'utf8');
  const env = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

function initFirebase() {
  const env = loadEnvLocal();
  const app = initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  });
  return getFirestore(app);
}

function findMostRecentSnapshot() {
  const backupsDir = join(root, 'scripts', 'backups');
  const files = readdirSync(backupsDir)
    .filter((f) => /^pre-migration-.*\.json$/.test(f))
    .sort(); // ISO-ish timestamp in filename sorts chronologically
  if (files.length === 0) {
    throw new Error(`No pre-migration-*.json snapshot found in ${backupsDir}`);
  }
  return join(backupsDir, files[files.length - 1]);
}

// Fields we deliberately never diff even if present on one side only.
// `updatedAt`: the migration script may stamp a write-time value that never
// existed in the old flat shape — explicitly allowlisted per spec, not a
// silent broad exclusion.
const ALLOWLISTED_IGNORE_FIELDS = new Set(['updatedAt']);

// Fields allowlisted ONLY on split-child ids (parentId set on either side) —
// a documented, permanent, intentional shape difference from the old model,
// not a regression. Under the old withSplitsExpanded()/flat-array model,
// split children wrongly INHERITED the parent's hasSubtasks/subtasks via
// `{ ...parentJob, id, bench, parentId }` spread (see root CLAUDE.md: "don't
// filter on !hasSubtasks... children inherit hasSubtasks:true via spread").
// The new joinJobsMasterState() correctly does NOT reproduce that — a split
// child's own hasSubtasks/subtasks are always false/null, it's the PARENT
// record (a separate id) that carries the real values. Every migration run
// will show old=<parent's value, wrongly inherited>/new=undefined for these
// two fields on every split-child id — expected and permanent, not something
// to chase down or "fix" on future runs.
const SPLIT_CHILD_ONLY_IGNORE_FIELDS = new Set(['hasSubtasks', 'subtasks']);

function isSplitChildId(oldJob, newJob) {
  return Boolean(oldJob?.parentId || newJob?.parentId);
}

function isEqual(a, b) {
  if (a === b) return true;
  // Treat null/undefined as equivalent "absent" values — Firestore drops
  // undefined keys entirely, the old array could have either.
  const aEmpty = a === undefined || a === null;
  const bEmpty = b === undefined || b === null;
  if (aEmpty && bEmpty) return true;
  if (aEmpty !== bEmpty) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    return a.every((v, i) => isEqual(v, b[i]));
  }
  if (typeof a === 'object' && typeof b === 'object') {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      if (ALLOWLISTED_IGNORE_FIELDS.has(k)) continue;
      if (!isEqual(a[k], b[k])) return false;
    }
    return true;
  }
  return false;
}

function diffJob(oldJob, newJob) {
  const diffs = [];
  const skipSplitChildFields = isSplitChildId(oldJob, newJob);
  const keys = new Set([...Object.keys(oldJob), ...Object.keys(newJob)]);
  for (const k of keys) {
    if (ALLOWLISTED_IGNORE_FIELDS.has(k)) continue;
    if (skipSplitChildFields && SPLIT_CHILD_ONLY_IGNORE_FIELDS.has(k)) continue;
    if (!isEqual(oldJob[k], newJob[k])) {
      diffs.push({ field: k, oldValue: oldJob[k], newValue: newJob[k] });
    }
  }
  return diffs;
}

async function main() {
  const snapshotArg = process.argv[2];
  const snapshotPath = snapshotArg ? join(process.cwd(), snapshotArg) : findMostRecentSnapshot();

  console.log('─────────────────────────────────────────────');
  console.log('  jobsMaster/jobsState migration verification');
  console.log('─────────────────────────────────────────────');
  console.log(`Snapshot: ${snapshotPath}`);

  const snapshotPayload = JSON.parse(readFileSync(snapshotPath, 'utf8'));
  const oldJobs = Array.isArray(snapshotPayload.raw?.jobs) ? snapshotPayload.raw.jobs : [];
  console.log(`Snapshot contains ${oldJobs.length} jobs (as of ${snapshotPayload.snapshottedAt})`);

  const db = initFirebase();

  // ── Read back jobsMaster + jobsState collections ────────────────────────
  const [masterSnap, stateSnap] = await Promise.all([
    getDocs(collection(db, 'jobsMaster')),
    getDocs(collection(db, 'jobsState')),
  ]);

  const masterDocs = masterSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
  const stateDocs = stateSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  console.log(`Firestore: ${masterDocs.length} jobsMaster docs, ${stateDocs.length} jobsState docs`);

  // ── Reconstruct flat job list using the ACTUAL join logic ──────────────
  const { jobs: reconstructed, orphans } = joinJobsMasterState(masterDocs, stateDocs, {});

  console.log(`Reconstructed ${reconstructed.length} jobs, ${orphans.length} orphan(s)`);
  console.log('');

  // ── Compare by id, set-based (order-independent) ────────────────────────
  const oldById = new Map(oldJobs.map((j) => [String(j.id), j]));
  const newById = new Map(reconstructed.map((j) => [String(j.id), j]));

  const allIds = new Set([...oldById.keys(), ...newById.keys()]);

  const problems = [];

  for (const id of allIds) {
    const oldJob = oldById.get(id);
    const newJob = newById.get(id);

    if (oldJob && !newJob) {
      problems.push({ id, type: 'MISSING', detail: 'present in snapshot, absent from reconstructed list' });
      continue;
    }
    if (!oldJob && newJob) {
      problems.push({ id, type: 'UNEXPECTED', detail: 'present in reconstructed list, absent from snapshot' });
      continue;
    }
    const diffs = diffJob(oldJob, newJob);
    for (const d of diffs) {
      problems.push({
        id,
        type: 'FIELD_DIFF',
        field: d.field,
        oldValue: d.oldValue,
        newValue: d.newValue,
      });
    }
  }

  // ── Cross-check orphans: every orphan should trace back to a bug, since
  // every snapshot job should have produced a jobsMaster and/or jobsState
  // doc via the migration. Report them as problems too — an orphan here
  // means the migration missed writing a doc for some snapshot job, or a
  // stray jobsState doc exists with no corresponding snapshot job at all.
  const orphanProblems = [];
  for (const o of orphans) {
    const inSnapshot = oldById.has(String(o.id));
    orphanProblems.push({
      id: o.id,
      type: 'UNEXPLAINED_ORPHAN',
      detail: inSnapshot
        ? 'orphaned jobsState doc traces to a real snapshot job — migration likely failed to write its jobsMaster doc'
        : 'orphaned jobsState doc has no corresponding snapshot job at all — unexpected stray data',
    });
  }

  const allProblems = [...problems, ...orphanProblems];

  if (allProblems.length === 0) {
    console.log('0 unexplained diffs');
    console.log('0 unexplained orphans');
    console.log('');
    console.log('PASS — reconstructed jobsMaster/jobsState data matches the pre-migration snapshot exactly.');
    console.log('─────────────────────────────────────────────');
    process.exit(0);
  }

  console.log(`${problems.length} field/id diff(s), ${orphanProblems.length} unexplained orphan(s):`);
  console.log('');
  for (const p of allProblems) {
    if (p.type === 'FIELD_DIFF') {
      console.log(`  [FIELD_DIFF] job ${p.id} — field "${p.field}": old=${JSON.stringify(p.oldValue)} new=${JSON.stringify(p.newValue)}`);
    } else {
      console.log(`  [${p.type}] job ${p.id} — ${p.detail}`);
    }
  }
  console.log('');
  console.log(`FAIL — ${allProblems.length} unexplained diff(s) found. Do not cut over until these are resolved.`);
  console.log('─────────────────────────────────────────────');
  process.exit(1);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
