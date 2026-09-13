import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

// The schema file is the written record of the live Supabase database — what we
// would rebuild from if the database were ever lost, and what a test copy gets
// built from.
//
// It had drifted before: `daily_logs` and `deferred_items` existed in the live
// database and were read and written every day, but neither was in the file.
// They were created straight in Supabase and never written down. A rebuild
// would have come up with no Daily Log at all, and nobody would have found out
// until they went looking for it — months later, with no clue where it went.
//
// So this test fails the day someone adds a table without recording it, rather
// than leaving it to be noticed by accident. If it fails, the fix is to write
// the table into docs/supabase-schema.sql, not to add it to an ignore list.

const SCHEMA_PATH = 'docs/supabase-schema.sql';
const SRC_DIR = 'src';

function sourceFiles(dir) {
  return readdirSync(dir).flatMap(entry => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(js|jsx)$/.test(entry) ? [full] : [];
  });
}

function tablesUsedInCode() {
  const found = new Map(); // table -> first file that uses it
  for (const file of sourceFiles(SRC_DIR)) {
    const text = readFileSync(file, 'utf8');
    for (const m of text.matchAll(/\.from\(\s*['"]([a-z_][a-z0-9_]*)['"]\s*\)/g)) {
      if (!found.has(m[1])) found.set(m[1], file);
    }
  }
  return found;
}

function tablesInSchemaFile() {
  const text = readFileSync(SCHEMA_PATH, 'utf8');
  return new Set(
    [...text.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?([a-z_][a-z0-9_]*)/gi)].map(m => m[1]),
  );
}

describe('supabase schema file', () => {
  it('records every table the app actually reads or writes', () => {
    const used = tablesUsedInCode();
    const recorded = tablesInSchemaFile();

    const missing = [...used.keys()].filter(t => !recorded.has(t)).sort();

    expect(
      missing,
      missing.length === 0
        ? ''
        : `Tables used in code but missing from ${SCHEMA_PATH}:\n` +
          missing.map(t => `  ${t}  (used in ${used.get(t)})`).join('\n') +
          `\n\nAdd a CREATE TABLE for each. Rebuilding from this file would ` +
          `produce a database without them.`,
    ).toEqual([]);
  });

  it('finds the tables at all, so a broken matcher cannot pass silently', () => {
    // Guards the test itself: if either regex stopped matching, both sets would
    // come back empty and the check above would pass while proving nothing.
    expect(tablesUsedInCode().size).toBeGreaterThan(5);
    expect(tablesInSchemaFile().size).toBeGreaterThan(5);
  });
});
