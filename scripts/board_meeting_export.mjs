#!/usr/bin/env node
// Read-only Firestore export for the Sunday Board Meeting workflow.
// Never writes anything back — only reads ggnz/schedule, ggnz/completedJobs,
// ggnz/parkingLot, ggnz/adHocTasks and prints one JSON blob to stdout.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

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

const env = loadEnvLocal();

const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
});
const db = getFirestore(app);

async function getDocData(collection, id) {
  const snap = await getDoc(doc(db, collection, id));
  return snap.exists() ? snap.data() : null;
}

const [schedule, completedJobs, parkingLot, adHocTasks] = await Promise.all([
  getDocData('ggnz', 'schedule'),
  getDocData('ggnz', 'completedJobs'),
  getDocData('ggnz', 'parkingLot'),
  getDocData('ggnz', 'adHocTasks'),
]);

process.stdout.write(JSON.stringify({
  jobs: schedule?.jobs || [],
  scheduledSlots: schedule?.scheduledSlots || {},
  completedJobs: completedJobs?.records || completedJobs?.items || [],
  parkingLotItems: parkingLot?.items || [],
  adHocTasks: adHocTasks?.tasks || [],
  exportedAt: new Date().toISOString(),
}, null, 2));

process.exit(0);
