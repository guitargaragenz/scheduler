import { describe, it, expect, vi, beforeEach } from 'vitest';

// Brief G, Build 1b, item 3 — the CSV import can no longer touch the six
// columns Trevor now keeps in the app: tag, hours, action, vb, bl and pj.
//
// Nothing was migrated and no data moved. What changed is who may overwrite
// these columns. pickMasterFields() strips them on the way in, but that alone
// would not have been enough: upsertJobsBatch() builds a FIXED row and ignores
// which keys the caller actually supplied, so `job.vb ? 'Y' : 'N'` on a
// stripped record would have written 'N' over every real 'Y' in the workshop.
// The columns had to come out of the row itself, which is what these tests
// pin down — at the level of what actually leaves the app, not what a helper
// intended.

let nextResult = { data: [], error: null };
let upsertCalls = [];

function chain() {
  const promise = Promise.resolve(nextResult);
  return {
    upsert: vi.fn((records, opts) => { upsertCalls.push({ records, opts }); return promise; }),
    insert: vi.fn(() => promise),
    select: vi.fn(() => promise),
  };
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: vi.fn(() => chain()), channel: vi.fn() }),
}));

const { upsertJobsBatch, batchWriteJobsState } = await import('./supabase.js');

const APP_OWNED_COLUMNS = ['tag', 'hours', 'action', 'vb', 'bl', 'pj'];

beforeEach(() => {
  nextResult = { data: [], error: null };
  upsertCalls = [];
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

const csvJob = {
  id: '1601', job: '1601', customer: 'Dave', mfr: 'Fender', model: 'Strat',
  status: 'Active', desc: 'Fret buzz', bench: 'Setup', days: 12,
  // A CSV row still carries these; the point is that they go nowhere.
  tag: 'EZ', hours: 1.5, action: 'GTS', vb: true, backlog: true, project: true,
};

describe('upsertJobsBatch — the CSV import path', () => {
  it('sends none of the six app-owned columns', async () => {
    await upsertJobsBatch([csvJob]);
    expect(upsertCalls).toHaveLength(1);
    const row = upsertCalls[0].records[0];
    APP_OWNED_COLUMNS.forEach(col => expect(row).not.toHaveProperty(col));
  });

  it('still writes the Multitrack facts and the job age', async () => {
    await upsertJobsBatch([csvJob]);
    const row = upsertCalls[0].records[0];
    expect(row).toMatchObject({
      id: '1601', job: '1601', customer: 'Dave', mfr: 'Fender',
      model: 'Strat', status: 'Active', desc: 'Fret buzz', days: 12,
    });
  });
});

describe('batchWriteJobsState — the writer the Jobs Sheet uses', () => {
  it('writes only the columns a sheet row actually edited', async () => {
    await batchWriteJobsState([{ id: '1601', data: { action: 'INC', job: '1601' } }]);
    expect(upsertCalls).toHaveLength(1);
    expect(Object.keys(upsertCalls[0].records[0]).sort())
      .toEqual(['action', 'id', 'job', 'updated_at']);
  });

  it('sends rows with different edits separately, so neither NULL-fills the other', async () => {
    // A Supabase upsert given an array sends the UNION of every row's keys and
    // NULL-fills the rows missing one. Two sheet rows with different edits in
    // one request would blank each other's columns.
    await batchWriteJobsState([
      { id: '1601', data: { action: 'INC', job: '1601' } },
      { id: '1602', data: { hours: 3, job: '1602' } },
    ]);
    expect(upsertCalls).toHaveLength(2);
    const columnSets = upsertCalls.map(c => Object.keys(c.records[0]).sort().join(','));
    expect(columnSets).toContain('action,id,job,updated_at');
    expect(columnSets).toContain('hours,id,job,updated_at');
  });

  it('turns the VB/BL/PJ booleans into the Y/N the columns store', async () => {
    await batchWriteJobsState([
      { id: '1601', data: { vb: true, backlog: false, project: true, job: '1601' } },
    ]);
    expect(upsertCalls[0].records[0]).toMatchObject({ vb: 'Y', bl: 'N', pj: 'Y' });
  });
});
