#!/usr/bin/env node
// One-off migration: admin/context/parking-lot.md -> the Supabase `parking_lot`
// table (brief "One Parking Lot, fed from the Daily Log", Merge A, 2026-08-01).
//
// GGNZ has had two parking lots serving one purpose — this markdown file, which
// the Sunday meeting read every week, and the in-app Parking Lot page, which it
// never read. This script folds the markdown items into the table so there is
// one list. The markdown file is deleted afterwards, in a separate commit, only
// once the items have been confirmed showing in the app.
//
// SAFETY
//   - Dry run by default. Pass --write to actually touch the database.
//   - Only ever UPSERTs. It never deletes and never clears, so it cannot lose
//     the eight rows already in the table.
//   - IDs are deterministic (pk-md-01, pk-md-02 …), so running it twice updates
//     the same rows instead of creating duplicates.
//
// Row shape matches src/utils/supabase.js exactly: `content` is a TEXT column
// holding a JSON string of { id, date, title, details, status }.
//
// Like scripts/board_meeting_export.mjs, this is a plain Node script and cannot
// import src/utils/supabase.js (that file reads import.meta.env, Vite-only), so
// it builds its own client against the same table and column names.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const WRITE = process.argv.includes('--write');
const SOURCE = join(root, 'admin/context/parking-lot.md');
// The date every migrated item lands under on the page. The markdown grouped by
// category, not by date, so there is no per-item date to recover — stamping the
// migration date is honest, and the source section is kept in the details.
const MIGRATION_DATE = '2026-08-01';

function loadEnvFile(name, env) {
  let text;
  try {
    text = readFileSync(join(root, name), 'utf8');
  } catch {
    return env;
  }
  for (const line of text.split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
  }
  return env;
}

function loadEnv() {
  const env = {};
  loadEnvFile('.env', env);
  loadEnvFile('.env.local', env);
  return env;
}

// Strips markdown emphasis/links/code so the title reads as plain text on a card.
function plain(text) {
  return text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// The title is the item's bolded LEAD if it opens with one (most items here do),
// otherwise the first sentence. It must be the lead specifically: several done
// items bold their outcome mid-sentence ("**dealt with, confirmed by Trevor**"),
// and taking that as the title loses what the item was about. Full text always
// survives in details either way.
function deriveTitle(text) {
  const lead = text.match(/^\*\*(.+?)\*\*/);
  if (lead) return plain(lead[1]).replace(/[.—-]\s*$/, '');
  const first = plain(text).split(/(?<=[.?!])\s/)[0];
  return first.length > 90 ? `${first.slice(0, 87)}…` : first;
}

// Section label for items that appear before the first `##` heading.
const PREHEADING_SECTION = 'Parking Lot';

function parseMarkdown(md) {
  const lines = md.split('\n');
  const items = [];
  let section = PREHEADING_SECTION;
  let current = null;

  const flush = () => {
    if (current) items.push(current);
    current = null;
  };

  for (const line of lines) {
    const heading = line.match(/^##\s+(.*)$/);
    if (heading) {
      flush();
      section = plain(heading[1]);
      continue;
    }

    // Checkbox items, including ones nested inside a blockquote warning block.
    const item = line.match(/^\s*(?:>\s*)?-\s+\[([ xX])\]\s+(.*)$/);
    if (item) {
      flush();
      current = {
        done: item[1].toLowerCase() === 'x',
        section,
        text: item[2].trim(),
      };
      continue;
    }

    // Continuation of the item above: an indented or blockquoted wrapped line
    // that is not itself a new bullet, heading or rule.
    if (current) {
      const cont = line.match(/^\s*(?:>\s*)?(?:\s{2,})(\S.*)$/);
      const isBreak = /^\s*(?:>\s*)?$/.test(line) || /^(#|---)/.test(line);
      if (cont && !isBreak) {
        current.text += ` ${cont[1].trim()}`;
        continue;
      }
      if (isBreak) flush();
    }
  }
  flush();

  return items.map((it, i) => {
    // Items in the warning block above the first heading are the two that
    // describe THIS merge — "merge the two parking lots" and "saveParkingLot()
    // clears the table". Both are done the moment this migration runs, so they
    // land as done rather than sitting at the top of his list as stale work.
    // Kept rather than dropped: nothing from the file is silently lost.
    const isAboutThisMerge = it.section === PREHEADING_SECTION;
    return {
      id: `pk-md-${String(i + 1).padStart(2, '0')}`,
      date: MIGRATION_DATE,
      title: deriveTitle(it.text),
      details: `${plain(it.text)}\n\n— Migrated from admin/context/parking-lot.md (section: ${it.section}) on ${MIGRATION_DATE}.${
        isAboutThisMerge ? ' Closed by that merge — kept for the record.' : ''
      }`,
      status: it.done || isAboutThisMerge ? 'done' : 'open',
    };
  });
}

const md = readFileSync(SOURCE, 'utf8');
const items = parseMarkdown(md);

console.error(`Parsed ${items.length} items from ${SOURCE}:`);
for (const it of items) {
  console.error(`  ${it.id}  [${it.status === 'done' ? 'x' : ' '}]  ${it.title}`);
}

if (!WRITE) {
  console.error('\nDRY RUN — nothing written. Re-run with --write to apply.');
  console.error(JSON.stringify(items, null, 2));
  process.exit(0);
}

const env = loadEnv();
if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env or .env.local.');
  process.exit(1);
}
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const before = await supabase.from('parking_lot').select('id');
if (before.error) {
  console.error(`Could not read parking_lot: ${before.error.message}`);
  process.exit(1);
}
console.error(`\nTable currently holds ${before.data.length} rows. Upserting ${items.length}.`);

const records = items.map(item => ({
  id: item.id,
  content: JSON.stringify(item),
  updated_at: new Date().toISOString(),
}));

const { error } = await supabase.from('parking_lot').upsert(records, { onConflict: 'id' });
if (error) {
  console.error(`Upsert failed: ${error.message}`);
  process.exit(1);
}

const after = await supabase.from('parking_lot').select('id');
console.error(`Done. Table now holds ${after.data?.length ?? '?'} rows.`);
console.error('Now open the Parking Lot page and confirm the items render BEFORE deleting the markdown file.');
process.exit(0);
