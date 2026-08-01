import { describe, it, expect, vi, beforeEach } from 'vitest';

// The four parts_to_order read/write functions and their FAILURE CONTRACT.
//
// These used to catch their own error, log it, and return normally — a failed
// read handed back an empty map, a failed write handed back nothing at all.
// That is exactly how the table sat for a month with no RLS policy, rejecting
// every insert, while the Sunday board meeting reported success every time.
//
// What is being asserted here is that a database error now REACHES THE CALLER,
// so the Parts to Order page can put it on screen. If someone ever puts the
// swallowing catches back, these tests are what fails.

let nextResult = { data: [], error: null };
let lastCall = {};

function chain() {
  const promise = Promise.resolve(nextResult);
  return {
    select: vi.fn(() => ({
      order: vi.fn((col, opts) => { lastCall = { op: 'select', col, opts }; return promise; }),
    })),
    insert: vi.fn(records => { lastCall = { op: 'insert', records }; return promise; }),
    update: vi.fn(fields => ({
      eq: vi.fn((col, val) => { lastCall = { op: 'update', fields, col, val }; return promise; }),
    })),
    delete: vi.fn(() => ({
      eq: vi.fn((col, val) => { lastCall = { op: 'delete', col, val }; return promise; }),
    })),
  };
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: vi.fn(() => chain()),
    channel: vi.fn(() => ({ on: vi.fn(function () { return this; }), subscribe: vi.fn(function () { return this; }), unsubscribe: vi.fn() })),
  }),
}));

const {
  loadPartsToOrder,
  addPartsToOrderItems,
  removePartsToOrderItem,
  markPartResolved,
} = await import('./supabase.js');

const DB_ERROR = { message: 'new row violates row-level security policy', code: '42501' };

beforeEach(() => {
  nextResult = { data: [], error: null };
  lastCall = {};
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('loadPartsToOrder', () => {
  it('returns parts keyed by id, in app-shape camelCase', async () => {
    nextResult = {
      data: [{
        id: 'pto-2026-07-31-1705', description: '500k pot', category: 'part',
        needed_for_job: '1705', added_at: '2026-07-31T04:00:00Z', resolved: false,
      }],
      error: null,
    };
    const out = await loadPartsToOrder();
    expect(out['pto-2026-07-31-1705']).toEqual({
      id: 'pto-2026-07-31-1705',
      description: '500k pot',
      category: 'part',
      neededForJob: '1705',
      addedAt: '2026-07-31T04:00:00Z',
      resolved: false,
    });
  });

  it('asks the database for newest first', async () => {
    await loadPartsToOrder();
    expect(lastCall).toMatchObject({ op: 'select', col: 'added_at', opts: { ascending: false } });
  });

  it('THROWS on a read error instead of returning an empty list', async () => {
    nextResult = { data: null, error: DB_ERROR };
    await expect(loadPartsToOrder()).rejects.toBeTruthy();
  });
});

describe('addPartsToOrderItems', () => {
  it('THROWS on a write error instead of looking like a success', async () => {
    nextResult = { data: null, error: DB_ERROR };
    await expect(addPartsToOrderItems([{ description: '500k pot' }])).rejects.toBeTruthy();
  });

  it('resolves quietly when the write succeeds', async () => {
    await expect(addPartsToOrderItems([{ description: '500k pot' }])).resolves.toBeUndefined();
    expect(lastCall.op).toBe('insert');
  });

  it('sends the columns the table has, defaulting category and job number', async () => {
    await addPartsToOrderItems([{ description: '500k pot' }]);
    const [row] = lastCall.records;
    expect(row.description).toBe('500k pot');
    expect(row.category).toBe('part');
    expect(row.needed_for_job).toBeNull();
    expect(row.resolved).toBe(false);
    expect(typeof row.id).toBe('string');
    expect(typeof row.added_at).toBe('string');
  });

  it('is a no-op on an empty list — nothing is sent', async () => {
    await addPartsToOrderItems([]);
    expect(lastCall).toEqual({});
  });
});

describe('removePartsToOrderItem', () => {
  it('THROWS on a delete error', async () => {
    nextResult = { data: null, error: DB_ERROR };
    await expect(removePartsToOrderItem('pto-1')).rejects.toBeTruthy();
  });

  it('deletes by id on success', async () => {
    await removePartsToOrderItem('pto-1');
    expect(lastCall).toMatchObject({ op: 'delete', col: 'id', val: 'pto-1' });
  });
});

describe('markPartResolved', () => {
  it('THROWS on an update error, so a tick that did not save cannot look ticked', async () => {
    nextResult = { data: null, error: DB_ERROR };
    await expect(markPartResolved('pto-1', true)).rejects.toBeTruthy();
  });

  it('flips resolved in place rather than deleting the row', async () => {
    await markPartResolved('pto-1', true);
    expect(lastCall).toMatchObject({ op: 'update', fields: { resolved: true }, col: 'id', val: 'pto-1' });
  });
});
