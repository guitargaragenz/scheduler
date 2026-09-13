import { describe, it, expect, vi, beforeEach } from 'vitest';

// The workshop_projects table — storage half of the Workshop Projects brief.
//
// These are the Parking Lot's two hard-won rules, re-pinned on a new table
// because the same two failures were available here:
//
// 1. THE READER returns null when the read FAILS, never []. A page that can't
//    tell "the read broke" from "the table is empty" will happily save its
//    empty in-memory list over real rows. That is exactly how the Parking Lot
//    lost data on 2026-08-01. The "a failed read writes nothing" test below is
//    the one that proves it can't happen here.
//
// 2. THE WRITER is a per-item diff, never a clear-and-reinsert. It deletes
//    nothing outside the baseline, and it upserts EDITS as well as new ids —
//    upserting only new ids would silently drop every change to a note, which
//    is most of what this page does.

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
    delete: vi.fn(() => ({
      in: vi.fn((col, vals) => {
        calls.push({ table, op: 'delete', col, vals });
        return promise;
      }),
      // A clear-the-table call. Nothing should ever reach this — if a future
      // edit reintroduces .delete().neq(...), it is recorded as 'delete-all'
      // and the tests below fail.
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

const { loadWorkshopProjects, saveWorkshopProjects } = await import('./supabase.js');

const DB_ERROR = { message: 'permission denied for table', code: '42501' };

// The stored row shape: real columns, with steps and parts as jsonb arrays that
// come back from the driver already parsed — NOT strings, unlike parking_lot's
// `content`.
function row(project, createdAt = '2026-08-03T10:42:56.862+00:00') {
  return {
    id: project.id,
    title: project.title,
    notes: project.notes,
    steps: project.steps,
    parts: project.parts,
    created_at: createdAt,
    updated_at: createdAt,
  };
}

const SHELVING = {
  id: 'wp-001', title: 'Shelving — parts wall', notes: 'Ply not MDF.',
  steps: [{ id: 'st-1', text: 'Measure the wall', done: true }],
  parts: [{ id: 'pt-1', description: '18mm ply', qty: '2 sheets' }],
};
const CUTTING = {
  id: 'wp-002', title: 'Rearrange the cutting room', notes: '', steps: [], parts: [],
};

beforeEach(() => {
  nextResult = { data: [], error: null };
  calls.length = 0;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('loadWorkshopProjects — a failed read is distinguishable from an empty table', () => {
  it('returns null, NOT [], when the read errors', async () => {
    nextResult = { data: null, error: DB_ERROR };
    expect(await loadWorkshopProjects()).toBeNull();
  });

  it('returns [] for a genuinely empty table', async () => {
    nextResult = { data: [], error: null };
    expect(await loadWorkshopProjects()).toEqual([]);
  });

  it('reads a failed load without writing anything', async () => {
    nextResult = { data: null, error: DB_ERROR };
    await loadWorkshopProjects();
    expect(calls.filter(c => c.op !== 'select')).toEqual([]);
  });

  it('parses rows into the four fields plus createdAt', async () => {
    nextResult = { data: [row(SHELVING)], error: null };
    const [p] = await loadWorkshopProjects();
    expect(p.title).toBe('Shelving — parts wall');
    expect(p.notes).toBe('Ply not MDF.');
    expect(p.steps).toEqual([{ id: 'st-1', text: 'Measure the wall', done: true }]);
    expect(p.parts).toEqual([{ id: 'pt-1', description: '18mm ply', qty: '2 sheets' }]);
    expect(p.createdAt).toBe('2026-08-03T10:42:56.862+00:00');
  });

  it('survives null steps/parts columns rather than throwing', async () => {
    nextResult = { data: [{ id: 'wp-x', title: 't', notes: null, steps: null, parts: null }], error: null };
    const [p] = await loadWorkshopProjects();
    expect(p.steps).toEqual([]);
    expect(p.parts).toEqual([]);
    expect(p.notes).toBe('');
  });

  // The tab strip order depends on this, so a project's tab doesn't jump
  // position every time he edits it.
  it('orders by created_at ascending', async () => {
    await loadWorkshopProjects();
    const select = calls.find(c => c.op === 'select');
    expect(select.table).toBe('workshop_projects');
    expect(select.col).toBe('created_at');
    expect(select.opts).toEqual({ ascending: true });
  });
});

describe('saveWorkshopProjects — a per-item diff, never a table wipe', () => {
  it('never clears the table', async () => {
    await saveWorkshopProjects([SHELVING], [SHELVING, CUTTING]);
    expect(calls.some(c => c.op === 'delete-all')).toBe(false);
  });

  it('deletes nothing when the baseline is empty, whatever the table holds', async () => {
    await saveWorkshopProjects([SHELVING]);
    expect(calls.some(c => c.op === 'delete')).toBe(false);
  });

  it('upserts a brand new project', async () => {
    await saveWorkshopProjects([SHELVING], []);
    const upsert = calls.find(c => c.op === 'upsert');
    expect(upsert.records.map(r => r.id)).toEqual(['wp-001']);
    expect(upsert.opts).toEqual({ onConflict: 'id' });
  });

  // The failure mode that would make the planner feel broken: type a note, come
  // back tomorrow, note's gone.
  it('upserts an EDITED project, not just new ids', async () => {
    const edited = { ...SHELVING, notes: 'Ply not MDF. Wall is not square at the far end.' };
    await saveWorkshopProjects([edited], [SHELVING]);
    const upsert = calls.find(c => c.op === 'upsert');
    expect(upsert.records.map(r => r.id)).toEqual(['wp-001']);
    expect(upsert.records[0].notes).toContain('not square');
  });

  it('notices an edit buried inside the steps array', async () => {
    const edited = { ...SHELVING, steps: [{ id: 'st-1', text: 'Measure the wall', done: false }] };
    await saveWorkshopProjects([edited], [SHELVING]);
    expect(calls.find(c => c.op === 'upsert').records.map(r => r.id)).toEqual(['wp-001']);
  });

  it('writes nothing at all when nothing changed', async () => {
    await saveWorkshopProjects([SHELVING, CUTTING], [SHELVING, CUTTING]);
    expect(calls.filter(c => c.op === 'upsert' || c.op === 'delete')).toEqual([]);
  });

  it('deletes only an id that was in the baseline and has genuinely gone', async () => {
    await saveWorkshopProjects([SHELVING], [SHELVING, CUTTING]);
    const del = calls.find(c => c.op === 'delete');
    expect(del.vals).toEqual(['wp-002']);
  });

  // Resending created_at would reshuffle the tab order of every edited project.
  it('never writes created_at on an upsert', async () => {
    await saveWorkshopProjects([SHELVING], []);
    const upsert = calls.find(c => c.op === 'upsert');
    expect(upsert.records[0]).not.toHaveProperty('created_at');
  });

  // The design rule again, at the storage layer this time.
  it('writes no status, date or priority column', async () => {
    await saveWorkshopProjects([SHELVING], []);
    const record = calls.find(c => c.op === 'upsert').records[0];
    expect(Object.keys(record).sort()).toEqual(['id', 'notes', 'parts', 'steps', 'title', 'updated_at']);
  });

  it('reports failure rather than throwing when the write errors', async () => {
    nextResult = { data: null, error: DB_ERROR };
    const result = await saveWorkshopProjects([SHELVING], []);
    expect(result.ok).toBe(false);
  });

  it('coerces a rogue non-string qty rather than storing it raw', async () => {
    const odd = { ...CUTTING, parts: [{ id: 'pt-9', description: 'brackets', qty: 20 }] };
    await saveWorkshopProjects([odd], []);
    expect(calls.find(c => c.op === 'upsert').records[0].parts[0].qty).toBe('');
  });
});
