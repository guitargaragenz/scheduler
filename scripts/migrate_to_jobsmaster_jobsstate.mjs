#!/usr/bin/env node
// One-time migration: splits the single ggnz/schedule doc (jobs array +
// scheduledSlots map) into the new jobsMaster/{jobId} + jobsState/{jobId}
// collections plus a standalone ggnz/scheduledSlots doc.
//
// STRICTLY ADDITIVE. Never writes to, patches, or deletes ggnz/schedule.
// Writes a local JSON snapshot of the raw ggnz/schedule doc BEFORE any
// Firestore write — that snapshot is the only backup this data will ever
// have, so step 1 must succeed and be confirmed before step 2 runs.
//
// Field ownership rules mirror src/data/joinJobs.js exactly (NON_MASTER_FIELDS /
// JOBS_STATE_TOP_LEVEL_FIELDS) — see pickMasterFields()/jobsStateFieldsFor()
// imported from that file, not reimplemented here.
//
// Usage:
//   node scripts/migrate_to_jobsmaster_jobsstate.mjs --dry-run   # logs only, no Firestore writes, no live read required to inspect logic
//   node scripts/migrate_to_jobsmaster_jobsstate.mjs             # live run against the real Firebase project
//
// Do NOT run the live form of this script casually — it writes real
// production Firestore documents. Snapshot step happens first regardless.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp } from 'firebase/app';
import {
  getFirestore, doc, getDoc, writeBatch,
} from 'firebase/firestore';
import { pickMasterFields, jobsStateFieldsFor } from '../src/data/joinJobs.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const DRY_RUN = process.argv.includes('--dry-run');

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

// Firestore batched writes are capped at 500 mutations per batch.
const BATCH_LIMIT = 500;

async function commitInChunks(db, writes, { dryRun }) {
  // writes: [{ path: ['jobsMaster', id], data }, ...]
  let written = 0;
  for (let i = 0; i < writes.length; i += BATCH_LIMIT) {
    const chunk = writes.slice(i, i + BATCH_LIMIT);
    if (dryRun) {
      written += chunk.length;
      continue;
    }
    const batch = writeBatch(db);
    for (const w of chunk) {
      batch.set(doc(db, ...w.path), w.data);
    }
    await batch.commit();
    written += chunk.length;
  }
  return written;
}

// Does a jobsState-eligible top-level job actually have any non-default
// app-owned state worth writing? Mirrors what the join layer (joinJobs.js)
// expects to find — an empty/default state doc is indistinguishable from
// "no doc", so we skip writing pure-noise docs for tidiness, but this is
// purely cosmetic: joinJobsMasterState() treats a missing doc as {} anyway.
function hasNonDefaultState(stateFields) {
  return Object.keys(stateFields).some((k) => {
    const v = stateFields[k];
    if (v == null || v === false) return false;
    if (Array.isArray(v) && v.length === 0) return false;
    return true;
  });
}

async function main() {
  console.log('─────────────────────────────────────────────');
  console.log(`  jobsMaster/jobsState migration${DRY_RUN ? '  (DRY RUN — no Firestore writes)' : ''}`);
  console.log('─────────────────────────────────────────────');

  const db = initFirebase();

  // ── Step 1: read the current ggnz/schedule doc ─────────────────────────
  const scheduleSnap = await getDoc(doc(db, 'ggnz', 'schedule'));
  if (!scheduleSnap.exists()) {
    console.error('ERROR: ggnz/schedule does not exist — nothing to migrate. Aborting.');
    process.exit(1);
  }
  const scheduleData = scheduleSnap.data();
  const jobs = Array.isArray(scheduleData.jobs) ? scheduleData.jobs : [];
  const scheduledSlots = scheduleData.scheduledSlots && typeof scheduleData.scheduledSlots === 'object'
    ? scheduleData.scheduledSlots
    : {};

  console.log(`Read ggnz/schedule: ${jobs.length} jobs, ${Object.keys(scheduledSlots).length} scheduled slots`);

  // ── Step 2: write local snapshot BEFORE any Firestore write ────────────
  const backupsDir = join(root, 'scripts', 'backups');
  if (!existsSync(backupsDir)) mkdirSync(backupsDir, { recursive: true });

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const snapshotPath = join(backupsDir, `pre-migration-${timestamp}.json`);
  const snapshotPayload = {
    snapshotOf: 'ggnz/schedule',
    snapshottedAt: new Date().toISOString(),
    raw: scheduleData,
  };

  writeFileSync(snapshotPath, JSON.stringify(snapshotPayload, null, 2), 'utf8');

  // Confirm the snapshot actually landed on disk before proceeding — this
  // file is the only backup this data will ever have.
  if (!existsSync(snapshotPath)) {
    console.error(`ERROR: snapshot write failed to appear at ${snapshotPath} — aborting before any Firestore write.`);
    process.exit(1);
  }
  const verifyRead = JSON.parse(readFileSync(snapshotPath, 'utf8'));
  if (!Array.isArray(verifyRead.raw?.jobs) || verifyRead.raw.jobs.length !== jobs.length) {
    console.error(`ERROR: snapshot at ${snapshotPath} failed to verify (job count mismatch) — aborting before any Firestore write.`);
    process.exit(1);
  }

  console.log('');
  console.log(`✓ Snapshot saved and verified: ${snapshotPath}`);
  console.log(`  (${jobs.length} jobs, ${Object.keys(scheduledSlots).length} scheduled slots)`);
  console.log('');

  // ── Step 3: split each job into jobsMaster / jobsState fields ──────────
  const masterWrites = [];
  const stateWrites = [];

  for (const job of jobs) {
    if (job == null || typeof job !== 'object' || job.id == null) {
      console.warn('  WARNING: skipping malformed job entry (no id):', JSON.stringify(job).slice(0, 200));
      continue;
    }
    const id = String(job.id);
    const isSplitChild = Boolean(job.parentId);

    if (isSplitChild) {
      // Split children (manual or auto) don't correspond to a real CSV row —
      // jobsState owns their entire record. jobsStateFieldsFor() strips `id`
      // for us (joinJobs.js reattaches it as the doc id on read).
      const stateFields = jobsStateFieldsFor(job);
      stateWrites.push({ path: ['jobsState', id], data: stateFields });
    } else {
      // Top-level job: always gets a jobsMaster doc (CSV/Sheet-owned fields).
      const masterFields = pickMasterFields(job);
      masterWrites.push({ path: ['jobsMaster', id], data: masterFields });

      // ...and a jobsState doc IF it carries any non-default app-owned state.
      const stateFields = jobsStateFieldsFor(job);
      if (hasNonDefaultState(stateFields)) {
        stateWrites.push({ path: ['jobsState', id], data: stateFields });
      }
    }
  }

  console.log(`Prepared ${masterWrites.length} jobsMaster doc(s), ${stateWrites.length} jobsState doc(s)`);

  if (DRY_RUN) {
    console.log('');
    console.log('DRY RUN — sample of what would be written:');
    masterWrites.slice(0, 3).forEach((w) => console.log(`  jobsMaster/${w.path[1]}:`, JSON.stringify(w.data).slice(0, 200)));
    stateWrites.slice(0, 3).forEach((w) => console.log(`  jobsState/${w.path[1]}:`, JSON.stringify(w.data).slice(0, 200)));
  }

  // ── Step 4: write jobsMaster + jobsState docs (batched, chunked at 500) ─
  const masterWritten = await commitInChunks(db, masterWrites, { dryRun: DRY_RUN });
  const stateWritten = await commitInChunks(db, stateWrites, { dryRun: DRY_RUN });

  // ── Step 5: write scheduledSlots to its own new doc ─────────────────────
  let scheduledSlotsWritten = false;
  if (DRY_RUN) {
    console.log(`DRY RUN — would write ggnz/scheduledSlots with ${Object.keys(scheduledSlots).length} slot(s)`);
  } else {
    await writeBatch(db).set(doc(db, 'ggnz', 'scheduledSlots'), { scheduledSlots }).commit();
    scheduledSlotsWritten = true;
  }

  // ── Step 6: never touch ggnz/schedule — nothing to do here, by design ──

  // ── Step 7: summary ─────────────────────────────────────────────────────
  console.log('');
  console.log('─────────────────────────────────────────────');
  console.log(`  Migration ${DRY_RUN ? 'DRY RUN' : 'RUN'} complete`);
  console.log('─────────────────────────────────────────────');
  console.log(`jobsMaster docs written: ${masterWritten}`);
  console.log(`jobsState docs written:  ${stateWritten}`);
  console.log(`scheduledSlots written:  ${DRY_RUN ? 'would write (dry run)' : scheduledSlotsWritten}`);
  console.log(`Snapshot file:           ${snapshotPath}`);
  console.log('ggnz/schedule:           untouched (not written, not deleted)');
  console.log('─────────────────────────────────────────────');

  process.exit(0);
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
