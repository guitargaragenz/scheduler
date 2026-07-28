import { describe, it, expect, vi, beforeEach } from 'vitest';

// Brief G, Build 1a — writePdfImportBatch() and logPdfImport().
//
// What is being protected here is Trevor's hand-kept columns. The Multitrack
// PDF carries six facts about a job. Tag, Hours, Action, VB and BL are his
// own, kept by hand, and are not in the PDF at all. A Supabase upsert given an
// array of rows sends the UNION of all the rows' keys and NULL-fills any row
// that is missing one — so a single careless batch would blank those columns
// across the whole workshop in one click. These tests assert the exact columns
// that leave the app, not merely that a write happened.

let nextResult = { data: [], error: null };
let upsertCalls = [];
let insertCalls = [];

function chain() {
  const promise = Promise.resolve(nextResult);
  return {
    upsert: vi.fn((records, opts) => { upsertCalls.push({ records, opts }); return promise; }),
    insert: vi.fn((record) => { insertCalls.push(record); return promise; }),
    select: vi.fn(() => promise),
  };
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: vi.fn(() => chain()), channel: vi.fn() }),
}));

const { writePdfImportBatch, logPdfImport, PDF_IMPORT_FIELDS } = await import('./supabase.js');

beforeEach(() => {
  nextResult = { data: [], error: null };
  upsertCalls = [];
  insertCalls = [];
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

const existing = {
  id: '1601',
  data: { job: '1601', customer: 'Dave', mfr: 'Fender', model: 'Strat', status: 'Active', desc: 'Fret buzz' },
};
const brandNew = {
  id: '1602',
  isNew: true,
  data: { job: '1602', customer: 'Anne', mfr: 'Gibson', model: 'Les Paul', status: 'Active', desc: 'Restring', bench: 'Setup', hours: 1 },
};

describe('writePdfImportBatch — what actually reaches the database', () => {
  it('sends only the six PDF columns for a job already on the board', async () => {
    const res = await writePdfImportBatch([existing]);
    expect(res.ok).toBe(true);
    expect(upsertCalls).toHaveLength(1);
    expect(Object.keys(upsertCalls[0].records[0]).sort())
      .toEqual([...PDF_IMPORT_FIELDS, 'id', 'updated_at'].sort());
  });

  it("never mentions Trevor's hand-kept columns", async () => {
    await writePdfImportBatch([existing, brandNew]);
    const everyColumn = upsertCalls.flatMap(c => c.records.flatMap(r => Object.keys(r)));
    for (const col of ['tag', 'action', 'vb', 'bl', 'pj', 'days']) {
      expect(everyColumn).not.toContain(col);
    }
  });

  it('splits new and existing jobs into separate requests so neither NULL-fills the other', async () => {
    await writePdfImportBatch([existing, brandNew]);
    expect(upsertCalls).toHaveLength(2);
    const withBench = upsertCalls.find(c => 'bench' in c.records[0]);
    const withoutBench = upsertCalls.find(c => !('bench' in c.records[0]));
    expect(withBench.records.map(r => r.id)).toEqual(['1602']);
    expect(withoutBench.records.map(r => r.id)).toEqual(['1601']);
    // The existing job's request must not carry hours either.
    expect(Object.keys(withoutBench.records[0])).not.toContain('hours');
  });

  it('batches jobs with the same column set into one request', async () => {
    await writePdfImportBatch([existing, { ...existing, id: '1603', data: { ...existing.data, job: '1603' } }]);
    expect(upsertCalls).toHaveLength(1);
    expect(upsertCalls[0].records).toHaveLength(2);
  });

  it('upserts on id, so re-dropping the same PDF cannot duplicate a job', async () => {
    await writePdfImportBatch([existing]);
    expect(upsertCalls[0].opts).toEqual({ onConflict: 'id' });
  });
});

describe('writePdfImportBatch — refusals', () => {
  it('refuses the whole batch, writing nothing, when an app split card is included', async () => {
    const res = await writePdfImportBatch([existing, { id: '1620_Electronics_0', data: { job: '1620' } }]);
    expect(res.ok).toBe(false);
    expect(upsertCalls).toHaveLength(0);
  });

  it('refuses the whole batch when a caller smuggles in a field the PDF cannot own', async () => {
    const res = await writePdfImportBatch([{ ...existing, data: { ...existing.data, tag: 'M' } }]);
    expect(res.ok).toBe(false);
    expect(upsertCalls).toHaveLength(0);
  });

  it('refuses bench/hours on a job that already exists', async () => {
    const res = await writePdfImportBatch([{ ...existing, data: { ...existing.data, bench: 'Setup' } }]);
    expect(res.ok).toBe(false);
    expect(upsertCalls).toHaveLength(0);
  });

  it('refuses a row with no job number, which the NOT NULL column would reject anyway', async () => {
    const res = await writePdfImportBatch([{ id: '1601', data: { customer: 'Dave' } }]);
    expect(res.ok).toBe(false);
    expect(upsertCalls).toHaveLength(0);
  });

  it('resolves { ok: false } rather than throwing when the database errors', async () => {
    nextResult = { data: null, error: new Error('boom') };
    const res = await writePdfImportBatch([existing]);
    expect(res.ok).toBe(false);
  });

  it('does nothing at all for an empty batch', async () => {
    const res = await writePdfImportBatch([]);
    expect(res).toEqual({ ok: true, written: 0 });
    expect(upsertCalls).toHaveLength(0);
  });
});

describe('logPdfImport', () => {
  it('records the filename, row count and every job number touched', async () => {
    await logPdfImport({ filename: 'jobs.pdf', rowCount: 2, ids: ['1601', '1602'] });
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0]).toMatchObject({
      filename: 'jobs.pdf', row_count: 2, job_ids: ['1601', '1602'],
    });
    expect(insertCalls[0].imported_at).toBeTruthy();
  });

  it('still resolves when the log table is missing, so logging can never fail an import', async () => {
    nextResult = { data: null, error: new Error('relation "pdf_import_log" does not exist') };
    await expect(logPdfImport({ filename: 'jobs.pdf', rowCount: 1, ids: ['1601'] })).resolves.toBeUndefined();
  });
});
