import { describe, it, expect, vi, beforeEach } from 'vitest';

// The suppliers list and the shared app_settings store (2026-08-01).
//
// Two things are being protected here.
//
// 1. The same FAILURE CONTRACT as parts_to_order: a database error must reach
//    the caller, never be swallowed into a quiet "success". A settings load
//    that silently returned {} would hand every job an empty keyword list and
//    reshuffle the whole board.
//
// 2. seedAppSetting must send ignoreDuplicates — that is what makes it
//    INSERT ... ON CONFLICT DO NOTHING instead of an overwrite. It is the only
//    thing stopping a MacBook with empty localStorage from wiping the iMac's
//    real keyword edits during the one-time migration. If someone ever turns it
//    into a plain upsert, the test below is what fails.

let nextResult = { data: [], error: null };
let lastCall = {};

function chain() {
  const promise = Promise.resolve(nextResult);
  return {
    // loadAppSettings awaits select('*') directly; loadSuppliers chains .order.
    select: vi.fn(cols => {
      lastCall = { op: 'select', cols };
      const thenable = {
        order: vi.fn((col, opts) => { lastCall = { op: 'select', cols, col, opts }; return promise; }),
        then: (...args) => promise.then(...args),
      };
      return thenable;
    }),
    insert: vi.fn(records => { lastCall = { op: 'insert', records }; return promise; }),
    upsert: vi.fn((record, opts) => { lastCall = { op: 'upsert', record, opts }; return promise; }),
    update: vi.fn(fields => ({
      eq: vi.fn((col, val) => { lastCall = { op: 'update', fields, col, val }; return promise; }),
    })),
    delete: vi.fn(() => ({
      eq: vi.fn((col, val) => { lastCall = { op: 'delete', col, val }; return promise; }),
    })),
  };
}

let lastTable = null;

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: vi.fn(table => { lastTable = table; return chain(); }),
    channel: vi.fn(() => ({ on: vi.fn(function () { return this; }), subscribe: vi.fn(function () { return this; }), unsubscribe: vi.fn() })),
  }),
}));

const {
  loadSuppliers,
  addSupplier,
  renameSupplier,
  removeSupplier,
  loadAppSettings,
  saveAppSetting,
  seedAppSetting,
} = await import('./supabase.js');

const DB_ERROR = { message: 'permission denied for table', code: '42501' };

beforeEach(() => {
  nextResult = { data: [], error: null };
  lastCall = {};
  lastTable = null;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('loadSuppliers', () => {
  it('returns id/name pairs sorted by the database, alphabetically', async () => {
    nextResult = { data: [{ id: 'sup-1', name: 'Rockshop' }], error: null };
    const out = await loadSuppliers();
    expect(out).toEqual([{ id: 'sup-1', name: 'Rockshop' }]);
    expect(lastCall).toMatchObject({ op: 'select', col: 'name', opts: { ascending: true } });
  });

  it('THROWS on a read error rather than returning an empty dropdown', async () => {
    nextResult = { data: null, error: DB_ERROR };
    await expect(loadSuppliers()).rejects.toBeTruthy();
  });
});

describe('addSupplier', () => {
  it('generates an id when none is given', async () => {
    await addSupplier({ name: 'Rockshop' });
    const [row] = lastCall.records;
    expect(row.name).toBe('Rockshop');
    expect(typeof row.id).toBe('string');
    expect(row.id.length).toBeGreaterThan(0);
  });

  it('writes to the suppliers table, never to parts_to_order', async () => {
    await addSupplier({ name: 'Rockshop' });
    expect(lastTable).toBe('suppliers');
  });

  it('THROWS on a write error', async () => {
    nextResult = { data: null, error: DB_ERROR };
    await expect(addSupplier({ name: 'Rockshop' })).rejects.toBeTruthy();
  });
});

describe('renameSupplier / removeSupplier', () => {
  it('renames only the list entry', async () => {
    await renameSupplier('sup-1', 'Rockshop NZ');
    expect(lastTable).toBe('suppliers');
    expect(lastCall).toMatchObject({ op: 'update', fields: { name: 'Rockshop NZ' }, col: 'id', val: 'sup-1' });
  });

  it('removes only the list entry', async () => {
    await removeSupplier('sup-1');
    expect(lastTable).toBe('suppliers');
    expect(lastCall).toMatchObject({ op: 'delete', col: 'id', val: 'sup-1' });
  });

  it('THROW on error rather than looking like a success', async () => {
    nextResult = { data: null, error: DB_ERROR };
    await expect(renameSupplier('sup-1', 'X')).rejects.toBeTruthy();
    await expect(removeSupplier('sup-1')).rejects.toBeTruthy();
  });
});

describe('loadAppSettings', () => {
  it('returns the rows as a plain key/value map', async () => {
    nextResult = {
      data: [
        { key: 'weeklyTarget', value: 2500 },
        { key: 'benchKeywords', value: { Fretwork: ['fret'] } },
      ],
      error: null,
    };
    const out = await loadAppSettings();
    expect(out).toEqual({ weeklyTarget: 2500, benchKeywords: { Fretwork: ['fret'] } });
  });

  it('THROWS on a read error — a swallowed error here would blank the keywords', async () => {
    nextResult = { data: null, error: DB_ERROR };
    await expect(loadAppSettings()).rejects.toBeTruthy();
  });
});

describe('saveAppSetting', () => {
  it('overwrites on purpose — last write wins for a deliberate save', async () => {
    await saveAppSetting('hourlyRate', 95);
    expect(lastTable).toBe('app_settings');
    expect(lastCall.record).toEqual({ key: 'hourlyRate', value: 95 });
    expect(lastCall.opts).toMatchObject({ onConflict: 'key' });
    expect(lastCall.opts.ignoreDuplicates).toBeFalsy();
  });

  it('THROWS on a write error', async () => {
    nextResult = { data: null, error: DB_ERROR };
    await expect(saveAppSetting('hourlyRate', 95)).rejects.toBeTruthy();
  });
});

describe('seedAppSetting', () => {
  it('does NOT overwrite an existing key — first device to seed wins', async () => {
    await seedAppSetting('benchKeywords', { Fretwork: ['fret'] });
    expect(lastCall.op).toBe('upsert');
    expect(lastCall.opts).toMatchObject({ onConflict: 'key', ignoreDuplicates: true });
  });

  it('THROWS on a seed error', async () => {
    nextResult = { data: null, error: DB_ERROR };
    await expect(seedAppSetting('benchKeywords', {})).rejects.toBeTruthy();
  });
});
