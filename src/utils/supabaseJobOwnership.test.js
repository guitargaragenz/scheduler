import { describe, it, expect, vi, beforeEach } from 'vitest';

// Who may overwrite which job columns, pinned at the level of what actually
// leaves the app rather than what a helper intended.
//
// The upsertJobsBatch half of this file went with that function in Brief H,
// Build 2b — it was the CSV import's fixed-row writer, dead since Build 2a.
// What remains is the rule that outlived it: batchWriteJobsState must send only
// the columns its caller edited, grouped so rows with different edits never
// share an upsert. That is the guard against a Supabase array upsert sending
// the union of every row's keys and NULL-filling the rest.

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

const { batchWriteJobsState } = await import('./supabase.js');

beforeEach(() => {
  nextResult = { data: [], error: null };
  upsertCalls = [];
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
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

  it('never writes `days`, even when a caller hands it one', async () => {
    // Brief H, Build 2b. Age is computed from first_seen on every load, so the
    // `days` on an in-memory job is a derived number. If it could still reach
    // the column, any ordinary state write would push today's computed figure
    // back into the database and re-create the stale-number problem the
    // computed age was built to end. The column stays; nothing writes it.
    await batchWriteJobsState([{ id: '1601', data: { days: 412, action: 'INC', job: '1601' } }]);
    expect(upsertCalls).toHaveLength(1);
    expect(upsertCalls[0].records[0]).not.toHaveProperty('days');
  });

  it('turns the VB/BL/PJ booleans into the Y/N the columns store', async () => {
    await batchWriteJobsState([
      { id: '1601', data: { vb: true, backlog: false, project: true, job: '1601' } },
    ]);
    expect(upsertCalls[0].records[0]).toMatchObject({ vb: 'Y', bl: 'N', pj: 'Y' });
  });
});
