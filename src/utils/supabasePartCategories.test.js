import { describe, it, expect, vi, beforeEach } from 'vitest';

// The managed part category list (2026-09-13), a copy of the suppliers list.
// Same failure contract (errors reach the caller), and every write goes to
// part_categories, never parts_to_order.

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
  loadPartCategories, addPartCategory, renamePartCategory, removePartCategory,
} = await import('./supabase.js');

const DB_ERROR = { message: 'permission denied for table', code: '42501' };

beforeEach(() => {
  nextResult = { data: [], error: null };
  lastCall = {};
  lastTable = null;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('loadPartCategories', () => {
  it('returns id/name pairs sorted alphabetically', async () => {
    nextResult = { data: [{ id: 'cat-1', name: 'Pots' }], error: null };
    expect(await loadPartCategories()).toEqual([{ id: 'cat-1', name: 'Pots' }]);
    expect(lastTable).toBe('part_categories');
    expect(lastCall).toMatchObject({ op: 'select', col: 'name', opts: { ascending: true } });
  });

  it('THROWS on a read error rather than returning an empty dropdown', async () => {
    nextResult = { data: null, error: DB_ERROR };
    await expect(loadPartCategories()).rejects.toBeTruthy();
  });
});

describe('addPartCategory', () => {
  it('generates an id when none is given', async () => {
    await addPartCategory({ name: 'Pots' });
    const [row] = lastCall.records;
    expect(row.name).toBe('Pots');
    expect(typeof row.id).toBe('string');
    expect(row.id.length).toBeGreaterThan(0);
  });

  it('writes to part_categories, never to parts_to_order', async () => {
    await addPartCategory({ name: 'Pots' });
    expect(lastTable).toBe('part_categories');
  });

  it('THROWS on a write error', async () => {
    nextResult = { data: null, error: DB_ERROR };
    await expect(addPartCategory({ name: 'Pots' })).rejects.toBeTruthy();
  });
});

describe('renamePartCategory / removePartCategory', () => {
  it('renames only the list entry', async () => {
    await renamePartCategory('cat-1', 'Potentiometers');
    expect(lastTable).toBe('part_categories');
    expect(lastCall).toMatchObject({ op: 'update', fields: { name: 'Potentiometers' }, col: 'id', val: 'cat-1' });
  });

  it('removes only the list entry', async () => {
    await removePartCategory('cat-1');
    expect(lastTable).toBe('part_categories');
    expect(lastCall).toMatchObject({ op: 'delete', col: 'id', val: 'cat-1' });
  });

  it('THROWS on error rather than looking like a success', async () => {
    nextResult = { data: null, error: DB_ERROR };
    await expect(renamePartCategory('cat-1', 'X')).rejects.toBeTruthy();
    await expect(removePartCategory('cat-1')).rejects.toBeTruthy();
  });
});
