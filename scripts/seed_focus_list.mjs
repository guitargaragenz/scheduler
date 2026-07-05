#!/usr/bin/env node
// One-time seed for the Sunday board-meeting Focus list (ggnz/focusList).
// Writes ONLY this one isolated doc — never touches jobs/scheduledSlots.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

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

const jobIds = process.argv.slice(2);
if (jobIds.length === 0) {
  console.error('Usage: node scripts/seed_focus_list.mjs <jobId> <jobId> ...');
  process.exit(1);
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

await setDoc(doc(db, 'ggnz', 'focusList'), {
  jobIds,
  updatedAt: new Date().toISOString(),
});

console.log(`Seeded ggnz/focusList with ${jobIds.length} job IDs:`, jobIds.join(', '));
process.exit(0);
