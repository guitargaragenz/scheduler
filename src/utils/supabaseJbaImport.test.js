import { describe, it, expect, vi, beforeEach } from 'vitest';

// Brief G, Build 1c — writeJbaImportBatch().
//
// The Jobs-by-Age printout owns exactly TWO columns, first_seen and desc
// (desc added by the Desc build, 2026-08-01). Everything else on a job — the
// remaining Multitrack facts and Trevor's five hand-kept columns — must be
// untouchable from this path. Two specific traps are pinned down here:
//
// 1. A Supabase upsert given an array sends the UNION of all the rows' keys and
//    NULL-fills any row missing one, so rows are grouped by exact column set
//    before they leave.
// 2. Postgres checks NOT NULL against the proposed INSERT row before ON
//    CONFLICT resolves it onto the existing row, so `job` has to ride along on
//    every single row even though this import never means to change it. A
//    payload of { id, first_seen } alone comes back 23502 for a row that
//    plainly exists.

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

const { writeJbaImportBatch, JBA_IMPORT_FIELDS } = await import('./supabase.js');

beforeEach(() => {
  nextResult = { data: [], error: null };
  upsertCalls = [];
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

const write = (id, dateIn = '2017-12-01') => ({ id, job: id, data: { firstSeen: dateIn } });

describe('writeJbaImportBatch — what actually reaches the database', () => {
  it('sends first_seen, the job number it must ride with, and nothing else', async () => {
    const res = await writeJbaImportBatch([write('97')]);
    expect(res.ok).toBe(true);
    expect(upsertCalls).toHaveLength(1);
    expect(Object.keys(upsertCalls[0].records[0]).sort())
      .toEqual(['first_seen', 'id', 'job', 'updated_at']);
    expect(upsertCalls[0].records[0].first_seen).toBe('2017-12-01');
  });

  it('carries `job` on every row — without it Postgres rejects the upsert as 23502', async () => {
    await writeJbaImportBatch([write('97'), write('1601', '2026-01-05')]);
    for (const call of upsertCalls) {
      for (const r of call.records) expect(r.job).toBeTruthy();
    }
  });

  it('names none of the other Multitrack columns or the five hand-kept ones', async () => {
    await writeJbaImportBatch([write('97'), write('1601')]);
    const everyColumn = upsertCalls.flatMap(c => c.records.flatMap(r => Object.keys(r)));
    // `desc` is deliberately absent from this list now — the Desc build gave
    // this printout that column. It is still absent from these rows, because
    // none of these writes asked for it: a write carrying only a date must
    // never reach the description column.
    for (const col of ['customer', 'mfr', 'model', 'status',
                       'tag', 'action', 'vb', 'bl', 'pj', 'hours', 'bench', 'days']) {
      expect(everyColumn).not.toContain(col);
    }
    expect(everyColumn).not.toContain('desc');
  });

  it('batches identical column sets into one request', async () => {
    await writeJbaImportBatch([write('97'), write('1601'), write('1602')]);
    expect(upsertCalls).toHaveLength(1);
    expect(upsertCalls[0].records).toHaveLength(3);
  });

  it('upserts on id, so re-dropping the same file cannot duplicate a job', async () => {
    await writeJbaImportBatch([write('97')]);
    expect(upsertCalls[0].opts).toEqual({ onConflict: 'id' });
  });

  it('owns exactly two fields, and the allow-list says so', () => {
    expect(JBA_IMPORT_FIELDS).toEqual(['firstSeen', 'desc']);
  });

  it('splits date-only and desc-only rows into separate requests', async () => {
    // This is the trap the grouping exists for, and the Desc build is what
    // sprang it. Before, every row carried the same one column. Now a job whose
    // date was already right carries only `desc`, and a job whose description
    // was already right carries only `first_seen`. Sent as one array, Supabase
    // would send the union of the keys and NULL-fill whichever column each row
    // was missing — blanking descriptions and dates across the board in one
    // click, with no error anywhere.
    await writeJbaImportBatch([
      { id: '97', job: '97', data: { firstSeen: '2017-12-01' } },
      { id: '1601', job: '1601', data: { desc: 'Full setup, new nut' } },
      { id: '1602', job: '1602', data: { firstSeen: '2026-01-05', desc: 'Restring' } },
    ]);
    expect(upsertCalls).toHaveLength(3);
    const byId = {};
    for (const call of upsertCalls) {
      for (const r of call.records) byId[r.id] = Object.keys(r).sort();
    }
    expect(byId['97']).toEqual(['first_seen', 'id', 'job', 'updated_at']);
    expect(byId['1601']).toEqual(['desc', 'id', 'job', 'updated_at']);
    expect(byId['1602']).toEqual(['desc', 'first_seen', 'id', 'job', 'updated_at']);
  });

  it('sends the description text through unaltered', async () => {
    await writeJbaImportBatch([{ id: '1708', job: '1708', data: { desc: 'Restring stp elixir 12s Est $1000' } }]);
    expect(upsertCalls[0].records[0].desc).toBe('Restring stp elixir 12s Est $1000');
  });
});

describe('writeJbaImportBatch — refusals', () => {
  it('refuses the whole batch, writing nothing, when an app split card is included', async () => {
    const res = await writeJbaImportBatch([write('97'), { id: '1620_Electronics_0', job: '1620', data: { firstSeen: '2026-01-01' } }]);
    expect(res.ok).toBe(false);
    expect(upsertCalls).toHaveLength(0);
  });

  it('refuses the whole batch when a caller smuggles in any other field', async () => {
    const res = await writeJbaImportBatch([{ id: '97', job: '97', data: { firstSeen: '2017-12-01', status: 'Active' } }]);
    expect(res.ok).toBe(false);
    expect(upsertCalls).toHaveLength(0);
  });

  it('skips a row with no job number rather than losing every other date in the batch', async () => {
    const res = await writeJbaImportBatch([{ id: '97', data: { firstSeen: '2017-12-01' } }, write('1601')]);
    expect(res.ok).toBe(true);
    expect(res.written).toBe(1);
    expect(upsertCalls[0].records.map(r => r.id)).toEqual(['1601']);
  });

  it('resolves { ok: false } rather than throwing when the database errors', async () => {
    nextResult = { data: null, error: new Error('boom') };
    const res = await writeJbaImportBatch([write('97')]);
    expect(res.ok).toBe(false);
  });

  it('does nothing at all for an empty batch', async () => {
    const res = await writeJbaImportBatch([]);
    expect(res).toEqual({ ok: true, written: 0 });
    expect(upsertCalls).toHaveLength(0);
  });
});
