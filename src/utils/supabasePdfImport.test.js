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
let updateCalls = [];
let deleteCalls = [];

// Every builder method returns the same thenable object, so a call can be
// awaited at any point in the chain — which is what the real PostgREST builder
// does, and what loadDepartedGcalEvents()'s .select().not().not() needs.
function chain(table) {
  const promise = Promise.resolve(nextResult);
  const api = {
    then: (...a) => promise.then(...a),
    catch: (...a) => promise.catch(...a),
    finally: (...a) => promise.finally(...a),
    upsert: vi.fn((records, opts) => { upsertCalls.push({ table, records, opts }); return api; }),
    insert: vi.fn((record) => { insertCalls.push(record); return api; }),
    update: vi.fn((values) => { updateCalls.push({ table, values }); return api; }),
    delete: vi.fn(() => { deleteCalls.push({ table, ids: null }); return api; }),
    select: vi.fn(() => api),
    not: vi.fn(() => api),
    eq: vi.fn(() => api),
    order: vi.fn(() => api),
    ilike: vi.fn(() => api),
    in: vi.fn((col, vals) => {
      const last = deleteCalls[deleteCalls.length - 1];
      if (last && last.table === table && last.ids === null) last.ids = vals;
      const lastUpdate = updateCalls[updateCalls.length - 1];
      if (lastUpdate && lastUpdate.table === table && !lastUpdate.ids) lastUpdate.ids = vals;
      return api;
    }),
  };
  return api;
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: vi.fn((table) => chain(table)), channel: vi.fn() }),
}));

const {
  writePdfImportBatch, logPdfImport, PDF_IMPORT_FIELDS,
  writeDepartureBatch, deleteScheduledSlotsForJobs, loadJobIdentities,
  loadDepartedGcalEvents, clearDepartedGcalEventIds,
} = await import('./supabase.js');
const { MULTITRACK_DEPARTURE_SOURCE } = await import('../data/pdfImportPlan.js');
const { buildJbaImportPlan } = await import('../data/jbaImportPlan.js');

beforeEach(() => {
  nextResult = { data: [], error: null };
  upsertCalls = [];
  insertCalls = [];
  updateCalls = [];
  deleteCalls = [];
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

// Council amendment 1 — the returning-job write.
describe('writePdfImportBatch — a job coming back from departed', () => {
  const returning = {
    id: '1619',
    isReturning: true,
    data: { ...existing.data, job: '1619', departedAt: null },
  };

  it('sends departed_at = null so the row becomes visible again', async () => {
    const res = await writePdfImportBatch([returning]);
    expect(res.ok).toBe(true);
    const row = upsertCalls[0].records[0];
    expect('departed_at' in row).toBe(true);
    expect(row.departed_at).toBeNull();
  });

  it('still refuses bench and hours, so the row keeps the ones it has', async () => {
    const res = await writePdfImportBatch([{ ...returning, data: { ...returning.data, bench: 'Setup' } }]);
    expect(res.ok).toBe(false);
    expect(upsertCalls).toHaveLength(0);
  });

  it('refuses to set departed_at to an actual value through this door', async () => {
    const res = await writePdfImportBatch([{ ...returning, data: { ...returning.data, departedAt: '2026-08-02T00:00:00Z' } }]);
    expect(res.ok).toBe(false);
    expect(upsertCalls).toHaveLength(0);
  });

  it('refuses departed_at on a plain update of a job already on the board', async () => {
    const res = await writePdfImportBatch([{ ...existing, data: { ...existing.data, departedAt: null } }]);
    expect(res.ok).toBe(false);
    expect(upsertCalls).toHaveLength(0);
  });

  it('keeps returning rows in their own request, away from plain updates', async () => {
    await writePdfImportBatch([existing, returning]);
    expect(upsertCalls).toHaveLength(2);
    const withDeparted = upsertCalls.find(c => 'departed_at' in c.records[0]);
    const without = upsertCalls.find(c => !('departed_at' in c.records[0]));
    expect(withDeparted.records.map(r => r.id)).toEqual(['1619']);
    expect(without.records.map(r => r.id)).toEqual(['1601']);
  });
});

describe('writeDepartureBatch — taking a job off the board', () => {
  const dep = { id: '1619', job: '1619', gcalEventIds: ['ev1'] };

  it('sets departed_at and clears everything calendar-related in one row', async () => {
    const res = await writeDepartureBatch([dep], MULTITRACK_DEPARTURE_SOURCE);
    expect(res.ok).toBe(true);
    const row = upsertCalls[0].records[0];
    expect(row.departed_at).toBeTruthy();
    expect(row.scheduled).toBe(false);
    expect(row.calendar_slot).toBeNull();
    expect(row.gcal_event_id).toBeNull();
    expect(row.gcal_event_ids).toEqual([]);
  });

  it('parks the calendar event ids rather than losing them', async () => {
    await writeDepartureBatch([dep], MULTITRACK_DEPARTURE_SOURCE);
    expect(upsertCalls[0].records[0].departed_gcal_event_ids).toEqual(['ev1']);
  });

  it("never touches Trevor's fields, which is what makes a departure recoverable", async () => {
    await writeDepartureBatch([dep], MULTITRACK_DEPARTURE_SOURCE);
    const cols = Object.keys(upsertCalls[0].records[0]);
    for (const col of ['tag', 'action', 'hours', 'bench', 'vb', 'bl', 'pj', 'desc', 'pomo_log', 'bump_history']) {
      expect(cols).not.toContain(col);
    }
  });

  it('carries the job number, which the NOT NULL column requires on an upsert', async () => {
    await writeDepartureBatch([dep], MULTITRACK_DEPARTURE_SOURCE);
    expect(upsertCalls[0].records[0].job).toBe('1619');
    const res = await writeDepartureBatch([{ id: '1619' }], MULTITRACK_DEPARTURE_SOURCE);
    expect(res.ok).toBe(false);
  });

  it("refuses the whole batch if an app split card is smuggled in", async () => {
    const res = await writeDepartureBatch(
      [dep, { id: '1620_Electronics_0', job: '1620' }], MULTITRACK_DEPARTURE_SOURCE,
    );
    expect(res.ok).toBe(false);
    expect(upsertCalls).toHaveLength(0);
  });
});

// Council amendment 6 — the gate, demonstrated rather than asserted.
describe('writeDepartureBatch — only the Multitrack printout may depart anything', () => {
  const dep = { id: '1619', job: '1619', gcalEventIds: [] };

  it('refuses and writes nothing when the token is missing', async () => {
    const res = await writeDepartureBatch([dep]);
    expect(res.ok).toBe(false);
    expect(upsertCalls).toHaveLength(0);
  });

  it('refuses a made-up token', async () => {
    const res = await writeDepartureBatch([dep], 'jobs-by-age');
    expect(res.ok).toBe(false);
    expect(upsertCalls).toHaveLength(0);
  });

  it('refuses the token the Jobs-by-Age plan actually supplies — which is nothing', async () => {
    // The real thing, not a stand-in: build a genuine Jobs-by-Age plan and hand
    // its departureSource to the writer, exactly as a future edit wiring the
    // JBA path into departures would. Its plan has no such key.
    const jbaPlan = buildJbaImportPlan({
      parsed: [{ ref: '1601', dateIn: '2026-07-01' }],
      statedCount: 1,
      jobs: [{ id: '1601', job: '1601', parentId: null, isDerived: false }],
    });
    expect(jbaPlan.departureSource).toBeUndefined();
    const res = await writeDepartureBatch([dep], jbaPlan.departureSource);
    expect(res.ok).toBe(false);
    expect(upsertCalls).toHaveLength(0);
  });

  it('refuses before it even looks at the list, so an empty batch cannot sneak past', async () => {
    const res = await writeDepartureBatch([], 'jobs-by-age');
    expect(res.ok).toBe(false);
  });

  it('the Jobs-by-Age writer cannot reach the column either', async () => {
    const { writeJbaImportBatch } = await import('./supabase.js');
    const res = await writeJbaImportBatch([{ id: '1601', job: '1601', data: { departedAt: null } }]);
    expect(res.ok).toBe(false);
    expect(upsertCalls).toHaveLength(0);
  });
});

describe('deleteScheduledSlotsForJobs — no phantom-occupied slots', () => {
  it('deletes the slot rows for every departing job', async () => {
    const res = await deleteScheduledSlotsForJobs(['1619', '1620']);
    expect(res.ok).toBe(true);
    expect(deleteCalls).toHaveLength(1);
    expect(deleteCalls[0].table).toBe('scheduled_slots');
    expect(deleteCalls[0].ids).toEqual(['1619', '1620']);
  });

  it('does nothing for an empty list', async () => {
    await deleteScheduledSlotsForJobs([]);
    expect(deleteCalls).toHaveLength(0);
  });
});

describe('loadJobIdentities — the unfiltered read', () => {
  it('returns every job number with its departed state', async () => {
    nextResult = { data: [{ id: '1601', departed_at: null }, { id: '1619', departed_at: '2026-07-01T00:00:00Z' }], error: null };
    const rows = await loadJobIdentities();
    expect(rows).toEqual([
      { id: '1601', departedAt: null },
      { id: '1619', departedAt: '2026-07-01T00:00:00Z' },
    ]);
  });

  it('returns null on a failed read, never an empty list', async () => {
    // An empty list would read as "the board is empty and every printed job is
    // new", which is the whole workshop departed in one click. The caller
    // refuses the import on null.
    nextResult = { data: null, error: new Error('boom') };
    expect(await loadJobIdentities()).toBeNull();
  });
});

describe('departed calendar bookings', () => {
  it('lists only departed jobs that still hold event ids', async () => {
    nextResult = {
      data: [
        { id: '1619', job: '1619', mfr: 'Matchless', model: 'DC30', departed_gcal_event_ids: ['ev1', 'ev2'] },
        { id: '1620', job: '1620', mfr: 'Marshall', model: 'Plexi', departed_gcal_event_ids: [] },
      ],
      error: null,
    };
    const rows = await loadDepartedGcalEvents();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: '1619', eventIds: ['ev1', 'ev2'] });
    expect(rows[0].label).toBe('#1619 Matchless DC30');
  });

  it('clears the parked ids only for the jobs named', async () => {
    const res = await clearDepartedGcalEventIds(['1619']);
    expect(res.ok).toBe(true);
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].values).toEqual({ departed_gcal_event_ids: [] });
    expect(updateCalls[0].ids).toEqual(['1619']);
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
