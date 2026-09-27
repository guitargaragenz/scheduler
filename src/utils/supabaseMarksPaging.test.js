import { describe, it, expect, vi, beforeEach } from 'vitest';

// Logs keep finished jobs — Part B. loadDayMarks() and loadWeekMarks() must read
// the WHOLE table, not the first 1,000 rows Supabase is willing to send in one
// go. Past that cap a plain select quietly drops rows, and a dropped mark looks
// exactly like a cross that "didn't stick". And a failed page must fail the
// whole read (null), never hand on half a table as if it were all of it.

// Fake tables, keyed by name. Each request's .range(from, to) slices them, the
// way PostgREST does. `failOnPage` makes one page come back as an error.
let tables = {};
let failOnPage = null;
let rangeCalls = [];
let orderCalls = [];

function chain(table) {
  const api = {
    select: vi.fn(() => api),
    order: vi.fn((col, opts) => { orderCalls.push({ table, col, opts }); return api; }),
    range: vi.fn((from, to) => {
      rangeCalls.push({ table, from, to });
      const page = Math.floor(from / 1000);
      if (failOnPage === page) {
        return Promise.resolve({ data: null, error: { message: 'boom' } });
      }
      return Promise.resolve({ data: (tables[table] || []).slice(from, to + 1), error: null });
    }),
  };
  return api;
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: vi.fn((table) => chain(table)), channel: vi.fn() }),
}));

const { loadDayMarks, loadWeekMarks, MARKS_PAGE_SIZE } = await import('./supabase.js');

function dayRows(n) {
  return Array.from({ length: n }, (_, i) => ({
    date_key: '2026-09-07', item_id: `mark:${i}`, kind: 'mark', label: 'cross',
  }));
}

function weekRows(n) {
  return Array.from({ length: n }, (_, i) => ({
    job_id: String(1000 + i), date_key: '2026-09-07', mark: 'cross',
  }));
}

beforeEach(() => {
  tables = {};
  failOnPage = null;
  rangeCalls = [];
  orderCalls = [];
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('loadDayMarks paging', () => {
  it('pages in 1,000-row steps', () => {
    expect(MARKS_PAGE_SIZE).toBe(1000);
  });

  it('reads every row when the table is past 1,000 rows', async () => {
    tables.bench_day_marks = dayRows(2503);
    const out = await loadDayMarks();
    expect(Object.keys(out['2026-09-07'])).toHaveLength(2503);
    expect(rangeCalls.map(c => [c.from, c.to])).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });

  it('asks for one more page when the last one was exactly full', async () => {
    tables.bench_day_marks = dayRows(2000);
    const out = await loadDayMarks();
    expect(Object.keys(out['2026-09-07'])).toHaveLength(2000);
    expect(rangeCalls).toHaveLength(3);
  });

  it('orders by the primary key so pages cannot overlap or skip', async () => {
    tables.bench_day_marks = dayRows(5);
    await loadDayMarks();
    expect(orderCalls.map(c => c.col)).toEqual(['date_key', 'item_id']);
  });

  it('an empty table is {} (no marks yet), not null', async () => {
    expect(await loadDayMarks()).toEqual({});
  });

  it('a failed page fails the whole read', async () => {
    tables.bench_day_marks = dayRows(2503);
    failOnPage = 1;
    expect(await loadDayMarks()).toBeNull();
  });
});

describe('loadWeekMarks paging', () => {
  it('reads every row when the table is past 1,000 rows', async () => {
    tables.bench_week_marks = weekRows(1500);
    const out = await loadWeekMarks();
    expect(Object.keys(out)).toHaveLength(1500);
    expect(rangeCalls.map(c => [c.from, c.to])).toEqual([[0, 999], [1000, 1999]]);
  });

  it('orders by the primary key so pages cannot overlap or skip', async () => {
    tables.bench_week_marks = weekRows(5);
    await loadWeekMarks();
    expect(orderCalls.map(c => c.col)).toEqual(['job_id', 'date_key']);
  });

  it('an empty table is {} (no marks yet), not null', async () => {
    expect(await loadWeekMarks()).toEqual({});
  });

  it('a failed first page fails the whole read', async () => {
    tables.bench_week_marks = weekRows(10);
    failOnPage = 0;
    expect(await loadWeekMarks()).toBeNull();
  });

  it('a failed later page fails the whole read', async () => {
    tables.bench_week_marks = weekRows(1500);
    failOnPage = 1;
    expect(await loadWeekMarks()).toBeNull();
  });
});
