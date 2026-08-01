import { describe, it, expect, vi, beforeEach } from 'vitest';

// The Parking Lot wipe bug (2026-08-01, brief "One Parking Lot, fed from the Daily Log").
//
// Two halves, both live, both tested here because between them they could revert
// Trevor's whole idea list to its June 2026 state without anyone noticing.
//
// 1. THE WRITER. saveParkingLot() used to DELETE the entire table and re-insert
//    the array it was handed — the identical pattern that wiped completed_jobs.
//    It is now a per-item diff. The tests below pin all three of its rules:
//    it deletes nothing outside the baseline, it upserts EDITS (not just new
//    ids), and it deletes an id only once it has genuinely gone.
//
// 2. THE READER. loadParkingLot() used to return [] when the read FAILED, which
//    the page could not tell apart from "the table is empty" — so one network
//    blip on load made it save a hardcoded June seed over the real rows. It now
//    returns null on error. The "a failed read writes nothing" test is the one
//    that proves the live bug is dead.

let nextResult = { data: [], error: null };
const calls = [];

function chain(table) {
  const promise = Promise.resolve(nextResult);
  return {
    select: vi.fn(cols => ({
      order: vi.fn((col, opts) => {
        calls.push({ table, op: 'select', cols, col, opts });
        return promise;
      }),
    })),
    upsert: vi.fn((records, opts) => {
      calls.push({ table, op: 'upsert', records, opts });
      return promise;
    }),
    insert: vi.fn(records => {
      calls.push({ table, op: 'insert', records });
      return promise;
    }),
    delete: vi.fn(() => ({
      in: vi.fn((col, vals) => {
        calls.push({ table, op: 'delete', col, vals });
        return promise;
      }),
      // The old clear-the-table call. Nothing should ever reach this — if a
      // future edit reintroduces .delete().neq(...), the tests below catch it
      // as a recorded 'delete-all'.
      neq: vi.fn((col, val) => {
        calls.push({ table, op: 'delete-all', col, val });
        return promise;
      }),
    })),
  };
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: vi.fn(table => chain(table)),
    channel: vi.fn(() => ({
      on: vi.fn(function () { return this; }),
      subscribe: vi.fn(function () { return this; }),
      unsubscribe: vi.fn(),
    })),
  }),
}));

const { loadParkingLot, saveParkingLot } = await import('./supabase.js');

const DB_ERROR = { message: 'permission denied for table', code: '42501' };

// The real stored shape, copied from admin/context/backups/parking_lot-2026-07-31.json:
// `content` is a TEXT column holding a JSON *string*, not an object.
function row(item, createdAt = '2026-07-25T10:42:56.862+00:00') {
  return {
    id: item.id,
    content: JSON.stringify(item),
    created_at: createdAt,
    updated_at: createdAt,
  };
}

const ITEM_1 = { id: 'pk-001', date: '2026-06-13', title: 'Online session journal', details: 'A journal.', status: 'open' };
const ITEM_2 = { id: 'pk-002', date: '2026-06-13', title: 'Sunday board meeting', details: 'Weekly planning.', status: 'open' };

beforeEach(() => {
  nextResult = { data: [], error: null };
  calls.length = 0;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('loadParkingLot', () => {
  it('parses the content column into the item shape the page renders', async () => {
    nextResult = { data: [row(ITEM_1), row(ITEM_2)], error: null };
    const out = await loadParkingLot();
    expect(out).toEqual([ITEM_1, ITEM_2]);
    // Handing back raw rows would give every card an undefined title.
    expect(out[0].title).toBe('Online session journal');
  });

  it('falls back to a readable item rather than dropping a row with unparseable content', async () => {
    nextResult = { data: [{ id: 'pk-junk', content: 'not json at all' }], error: null };
    const out = await loadParkingLot();
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ id: 'pk-junk', title: 'not json at all', status: 'open' });
  });

  it('returns [] for a genuinely empty table', async () => {
    nextResult = { data: [], error: null };
    expect(await loadParkingLot()).toEqual([]);
  });

  it('returns NULL on a read error — never [] — so a blip cannot look like an empty table', async () => {
    nextResult = { data: null, error: DB_ERROR };
    expect(await loadParkingLot()).toBeNull();
  });
});

describe('a failed read writes nothing (the live bug)', () => {
  it('the load-then-seed sequence never fires a write when the read fails', async () => {
    nextResult = { data: null, error: DB_ERROR };
    const data = await loadParkingLot();

    // This mirrors ParkingLotPage's load effect: null means touch nothing.
    if (data !== null && data.length === 0) {
      await saveParkingLot([ITEM_1, ITEM_2], []); // the old seeding branch
    }

    expect(data).toBeNull();
    const writes = calls.filter(c => c.op !== 'select');
    expect(writes).toEqual([]);
  });

  it('for contrast: a successful read of 8 rows hands back all 8 and still writes nothing', async () => {
    const eight = Array.from({ length: 8 }, (_, i) =>
      row({ ...ITEM_1, id: `pk-00${i + 1}`, title: `Item ${i + 1}` })
    );
    nextResult = { data: eight, error: null };
    const data = await loadParkingLot();
    expect(data).toHaveLength(8);
    expect(calls.filter(c => c.op !== 'select')).toEqual([]);
  });
});

describe('saveParkingLot — per-item diff', () => {
  it('NEVER deletes the whole table', async () => {
    await saveParkingLot([ITEM_1], [ITEM_1, ITEM_2]);
    expect(calls.some(c => c.op === 'delete-all')).toBe(false);
  });

  it('saving a 1-item list against an unknown table deletes nothing', async () => {
    // The verifier's scenario: the table holds 8 rows, the caller has no
    // baseline (nothing loaded yet), and saves a single item. All 8 rows must
    // survive — the save may only add, never clear.
    await saveParkingLot([ITEM_1], []);
    expect(calls.some(c => c.op === 'delete' || c.op === 'delete-all')).toBe(false);
    const upsert = calls.find(c => c.op === 'upsert');
    expect(upsert.records.map(r => r.id)).toEqual(['pk-001']);
  });

  it('upserts a NEW item and leaves the unchanged ones alone', async () => {
    const fresh = { id: 'pk-009', date: '2026-08-01', title: 'New idea', details: '', status: 'open' };
    await saveParkingLot([fresh, ITEM_1, ITEM_2], [ITEM_1, ITEM_2]);
    const upsert = calls.find(c => c.op === 'upsert');
    expect(upsert.records.map(r => r.id)).toEqual(['pk-009']);
    expect(calls.some(c => c.op === 'delete')).toBe(false);
  });

  it('upserts an EDITED item — the deferred_items "new ids only" rule would drop this', async () => {
    const edited = { ...ITEM_2, title: 'Sunday board meeting with Claude + agents' };
    const result = await saveParkingLot([ITEM_1, edited], [ITEM_1, ITEM_2]);
    const upsert = calls.find(c => c.op === 'upsert');
    expect(upsert.records.map(r => r.id)).toEqual(['pk-002']);
    expect(JSON.parse(upsert.records[0].content).title).toBe('Sunday board meeting with Claude + agents');
    expect(result.upsertedIds).toEqual(['pk-002']);
  });

  it('upserts a status toggle (open -> done)', async () => {
    const done = { ...ITEM_1, status: 'done' };
    await saveParkingLot([done, ITEM_2], [ITEM_1, ITEM_2]);
    const upsert = calls.find(c => c.op === 'upsert');
    expect(upsert.records.map(r => r.id)).toEqual(['pk-001']);
    expect(JSON.parse(upsert.records[0].content).status).toBe('done');
  });

  it('writes nothing at all when nothing changed', async () => {
    const result = await saveParkingLot([ITEM_1, ITEM_2], [ITEM_1, ITEM_2]);
    expect(calls.filter(c => c.op !== 'select')).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('deletes ONLY the id that genuinely went, by id', async () => {
    await saveParkingLot([ITEM_1], [ITEM_1, ITEM_2]);
    const del = calls.find(c => c.op === 'delete');
    expect(del).toMatchObject({ table: 'parking_lot', col: 'id', vals: ['pk-002'] });
    expect(calls.some(c => c.op === 'upsert')).toBe(false);
  });

  it('stores content as a JSON string in the canonical field set', async () => {
    await saveParkingLot([ITEM_1], []);
    const record = calls.find(c => c.op === 'upsert').records[0];
    expect(typeof record.content).toBe('string');
    expect(JSON.parse(record.content)).toEqual(ITEM_1);
  });

  it('does not resend created_at, which would reset the age of every edited row', async () => {
    await saveParkingLot([ITEM_1], []);
    const record = calls.find(c => c.op === 'upsert').records[0];
    expect(record.created_at).toBeUndefined();
    expect(record.updated_at).toBeTruthy();
  });

  it('reports failure rather than a quiet success when the write errors', async () => {
    nextResult = { data: null, error: DB_ERROR };
    const result = await saveParkingLot([ITEM_1], []);
    expect(result.ok).toBe(false);
    // The page only advances its baseline on ok:true, so the change is re-sent.
  });

  it('round-trips: what saveParkingLot writes is what loadParkingLot reads back', async () => {
    await saveParkingLot([ITEM_1, ITEM_2], []);
    const written = calls.find(c => c.op === 'upsert').records;
    calls.length = 0;
    nextResult = { data: written.map(r => ({ ...r, created_at: null })), error: null };
    expect(await loadParkingLot()).toEqual([ITEM_1, ITEM_2]);
  });
});
