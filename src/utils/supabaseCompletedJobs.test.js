import { describe, it, expect, vi, beforeEach } from 'vitest';

// The revenue wipe (2026-08-07, brief "The revenue record stops being deletable").
//
// saveCompletedJobs() used to DELETE every row in completed_jobs and re-insert
// whatever array the browser tab happened to be holding. After a reload, before
// the load finished, that array was short or empty — so ticking one job off
// destroyed every revenue line before it. It also swallowed its own errors, so
// a blip between the delete and the insert wiped the table and said nothing.
//
// The job board can be rebuilt from the Multitrack printout. The revenue record
// cannot. These tests pin the three rules that replaced it:
//
//   1. NOTHING IS EVER DELETED. There is no deleter left in the module. If a
//      future edit reintroduces .delete() against completed_jobs, the mock
//      records it and the first test fails.
//   2. ONE ROW PER TOP-LEVEL JOB, keyed on the job id. A second write for the
//      same job is REFUSED, not applied — the app never overwrites money.
//   3. A REFUSAL IS REPORTED, not swallowed. { duplicate: true } comes back
//      carrying the amount already stored, so the caller can name it in a
//      toast. And every failure returns { ok: false } — the old version
//      returned undefined whether it worked or not.

let results = [];
const calls = [];

function nextResult() {
  return results.length > 1 ? results.shift() : (results[0] ?? { data: [], error: null });
}

function chain(table) {
  return {
    select: vi.fn(cols => ({
      eq: vi.fn((col, val) => ({
        limit: vi.fn(n => {
          calls.push({ table, op: 'select', cols, col, val, limit: n });
          return Promise.resolve(nextResult());
        }),
      })),
      order: vi.fn((col, opts) => {
        calls.push({ table, op: 'select', cols, col, opts });
        return Promise.resolve(nextResult());
      }),
      // The week-key bound (Build 2). Recorded so a read that silently loses
      // its bound — and goes back to downloading the whole revenue history —
      // shows up as a failing assertion.
      in: vi.fn((col, vals) => ({
        order: vi.fn((oCol, opts) => {
          calls.push({ table, op: 'select', cols, col, vals, order: oCol, opts });
          return Promise.resolve(nextResult());
        }),
      })),
    })),
    insert: vi.fn(records => {
      calls.push({ table, op: 'insert', records });
      return Promise.resolve(nextResult());
    }),
    upsert: vi.fn((records, opts) => {
      calls.push({ table, op: 'upsert', records, opts });
      return Promise.resolve(nextResult());
    }),
    // Nothing in the completed_jobs path should ever reach these. Both are
    // recorded so a reintroduced delete shows up as a failing assertion rather
    // than as a quietly emptied table.
    delete: vi.fn(() => ({
      neq: vi.fn((col, val) => {
        calls.push({ table, op: 'delete-all', col, val });
        return Promise.resolve(nextResult());
      }),
      in: vi.fn((col, vals) => {
        calls.push({ table, op: 'delete', col, vals });
        return Promise.resolve(nextResult());
      }),
    })),
  };
}

// Every channel handed out, so a test can fire the realtime handler the
// subscription registered and check what it does with the re-read.
const channels = [];

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: vi.fn(table => chain(table)),
    channel: vi.fn(() => {
      const ch = {
        on: vi.fn(function (event, filter, handler) { ch.handler = handler; return this; }),
        subscribe: vi.fn(function () { return this; }),
        unsubscribe: vi.fn(),
      };
      channels.push(ch);
      return ch;
    }),
  }),
}));

const supabaseModule = await import('./supabase.js');
const { appendCompletedJob, loadCompletedJobs, subscribeToCompletedJobs } = supabaseModule;
const { recentWeekKeys } = await import('./calendar.js');

const DB_ERROR = { message: 'permission denied for table', code: '42501' };
const UNIQUE_VIOLATION = { message: 'duplicate key value violates unique constraint', code: '23505' };

// The shape handleMarkDone() builds in src/hooks/useJobs.js.
const RECORD = {
  id: '1687', job: '1687', mfr: 'Fender', model: 'Telecaster',
  bench: 'Setup', hours: 2, customer: 'Jules Lovell',
  invoiceAmount: 204.45, completedAt: '2026-08-07T03:16:00.000Z', weekKey: '2026-08-04',
};

// The stored row, as completed_jobs actually holds it (snake_case columns).
function storedRow(over = {}) {
  return {
    id: 'cj-1687', job_id: '1687', job_number: '1687',
    invoice_amount: 50, completed_at: '2026-08-06T01:00:00.000Z', ...over,
  };
}

const found = row => ({ data: [row], error: null });
const empty = { data: [], error: null };

beforeEach(() => {
  results = [empty];
  calls.length = 0;
  channels.length = 0;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('the deleter is gone, not merely unused', () => {
  it('exports no clearCompletedJobs, so nothing can call it again', () => {
    expect(supabaseModule.clearCompletedJobs).toBeUndefined();
  });

  it('a successful append issues no delete of any kind', async () => {
    results = [empty, { error: null }];
    await appendCompletedJob(RECORD);
    expect(calls.some(c => c.op === 'delete' || c.op === 'delete-all')).toBe(false);
  });

  it('a REFUSED append deletes nothing either', async () => {
    results = [found(storedRow())];
    await appendCompletedJob(RECORD);
    expect(calls.some(c => c.op === 'delete' || c.op === 'delete-all')).toBe(false);
  });

  it('a FAILED append deletes nothing either — the old bug lost rows on the way', async () => {
    results = [{ data: null, error: DB_ERROR }];
    await appendCompletedJob(RECORD);
    expect(calls.some(c => c.op === 'delete' || c.op === 'delete-all')).toBe(false);
  });
});

describe('appendCompletedJob — one row, appended', () => {
  it('inserts exactly ONE row and touches nothing else (checklist 3)', async () => {
    results = [empty, { error: null }];
    const res = await appendCompletedJob(RECORD);

    expect(res).toMatchObject({ ok: true, duplicate: false });
    const inserts = calls.filter(c => c.op === 'insert');
    expect(inserts).toHaveLength(1);
    expect(inserts[0].table).toBe('completed_jobs');
    expect(inserts[0].records).toHaveLength(1);
  });

  it('writes the money and the job number into the columns the readers read', async () => {
    results = [empty, { error: null }];
    await appendCompletedJob(RECORD);
    const row = calls.find(c => c.op === 'insert').records[0];

    expect(row).toMatchObject({
      job_id: '1687',
      job_number: '1687',
      customer: 'Jules Lovell',
      invoice_amount: 204.45,
      week_key: '2026-08-04',
      completed_at: '2026-08-07T03:16:00.000Z',
    });
  });

  it('keys the row on the job id, not on a timestamp', async () => {
    // The old id was `cj-${Date.now()}-${idx}`, regenerated on every save, so
    // no row had a stable identity and ON CONFLICT had nothing to catch.
    results = [empty, { error: null }];
    await appendCompletedJob(RECORD);
    expect(calls.find(c => c.op === 'insert').records[0].id).toBe('cj-1687');
  });

  it('refuses a record with no id rather than writing an unidentifiable row', async () => {
    const res = await appendCompletedJob({ ...RECORD, id: undefined });
    expect(res.ok).toBe(false);
    expect(calls.filter(c => c.op === 'insert')).toEqual([]);
  });
});

describe('ticking the same job twice (checklist 5, 5b, 5c)', () => {
  it('same job, SAME amount → still one row, no second insert', async () => {
    results = [found(storedRow({ invoice_amount: 204.45 }))];
    const res = await appendCompletedJob(RECORD);

    expect(res.duplicate).toBe(true);
    expect(calls.filter(c => c.op === 'insert')).toEqual([]);
  });

  it('same job, DIFFERENT amount → refused, and the STORED amount comes back', async () => {
    // Checklist 5b, council ruling 4: a bare ON CONFLICT DO NOTHING would keep
    // the old figure and drop the correction in silence — a new quiet bug on
    // top of the one being fixed. The refusal has to be reportable.
    results = [found(storedRow({ invoice_amount: 50 }))];
    const res = await appendCompletedJob({ ...RECORD, invoiceAmount: 204.45 });

    expect(res).toMatchObject({ ok: true, duplicate: true });
    expect(res.existing.invoiceAmount).toBe(50);
    expect(res.existing.job).toBe('1687');
    // The caller needs both halves to say "1687 already recorded at $50".
    expect(calls.filter(c => c.op === 'insert')).toEqual([]);
  });

  it('matches on job_id, so a LEGACY cj-<timestamp> row still blocks a second write', async () => {
    // The one real row in the live table has id "cj-1754...-0". Checking the
    // primary key alone would miss it and write job 1712 a second time.
    results = [found(storedRow({ id: 'cj-1754536000000-0', job_id: '1712', job_number: null }))];
    const res = await appendCompletedJob({ ...RECORD, id: '1712' });

    expect(res.duplicate).toBe(true);
    const select = calls.find(c => c.op === 'select');
    expect(select).toMatchObject({ table: 'completed_jobs', col: 'job_id', val: '1712' });
  });

  it('a SPLIT job resolved to its parent hits the same key and is refused (checklist 5c)', async () => {
    // useJobs.topLevelJob() walks 1520_Luthier_0 and 1520_Setup_0 both up to
    // 1520, so the second piece arrives here as job 1520 and finds the row the
    // first piece wrote. Two revenue rows for one job is the failure mode.
    results = [empty, { error: null }];
    await appendCompletedJob({ ...RECORD, id: '1520', job: '1520' });
    expect(calls.find(c => c.op === 'insert').records[0].job_id).toBe('1520');

    calls.length = 0;
    results = [found(storedRow({ id: 'cj-1520', job_id: '1520', job_number: '1520' }))];
    const second = await appendCompletedJob({ ...RECORD, id: '1520', job: '1520' });

    expect(second.duplicate).toBe(true);
    expect(calls.filter(c => c.op === 'insert')).toEqual([]);
  });

  it('a race that beats the check is still caught by the primary key', async () => {
    // Two tabs, both read "no row", both insert. The database refuses the
    // second with 23505 and this reports it as the duplicate it is, rather
    // than as a failed save Trevor would be told to re-check.
    results = [empty, { error: UNIQUE_VIOLATION }, found(storedRow({ invoice_amount: 50 }))];
    const res = await appendCompletedJob(RECORD);

    expect(res).toMatchObject({ ok: true, duplicate: true });
    expect(res.existing.invoiceAmount).toBe(50);
  });
});

// Build 2 (2026-08-08). Build 1 stopped the table being wiped, so it now grows
// forever. Every reader that only wants recent weeks must say so, or the app
// downloads the entire revenue history on every load and every realtime tick.
describe('reads are bounded to the weeks asked for', () => {
  it('a week-bounded load filters on the stored week_key column', async () => {
    results = [{ data: [], error: null }];
    await loadCompletedJobs(['2026-08-04']);

    const select = calls.find(c => c.op === 'select');
    expect(select).toMatchObject({
      table: 'completed_jobs', col: 'week_key', vals: ['2026-08-04'],
    });
  });

  it('no argument still reads all-time, so no existing caller changes meaning', async () => {
    results = [{ data: [], error: null }];
    await loadCompletedJobs();

    const select = calls.find(c => c.op === 'select');
    expect(select.col).toBe('created_at'); // straight to .order(), no .in()
    expect(select.vals).toBeUndefined();
  });

  it('maps the bounded rows to the same camelCase shape as before', async () => {
    results = [{ data: [storedRow({ week_key: '2026-08-04', customer: 'Jules Lovell' })], error: null }];
    const { records, doneJobIds } = await loadCompletedJobs(['2026-08-04']);

    expect(doneJobIds).toEqual(['1687']);
    expect(records[0]).toMatchObject({
      id: '1687', job: '1687', invoiceAmount: 50, weekKey: '2026-08-04',
    });
  });

  it('recentWeekKeys returns Monday keys, newest first, one per week back', () => {
    // Friday 2026-08-07 — its Monday is 2026-08-03.
    const keys = recentWeekKeys(3, new Date(2026, 7, 7));
    expect(keys).toEqual(['2026-08-03', '2026-07-27', '2026-07-20']);
  });

  it('recentWeekKeys keeps Monday LOCAL — the UTC slice would say Sunday in NZ', () => {
    // Monday 2026-08-03 at 00:00 local is 2026-08-02 in UTC at +12/+13, which
    // is the $0-revenue bug fixed 2026-07-31. The key must still be the Monday.
    expect(recentWeekKeys(1, new Date(2026, 7, 3, 0, 0, 0))).toEqual(['2026-08-03']);
  });
});

describe('failures are reported, never swallowed (checklist 7)', () => {
  it('an insert error returns ok:false so the caller can raise a toast', async () => {
    results = [empty, { error: DB_ERROR }];
    const res = await appendCompletedJob(RECORD);

    expect(res.ok).toBe(false);
    expect(res.error).toBe(DB_ERROR);
  });

  it('a failed duplicate CHECK refuses the write rather than guessing "no row exists"', async () => {
    // Treating a failed read as "nothing there" is how the parking lot wrote a
    // seed list over real data. Here it would write a second money row.
    results = [{ data: null, error: DB_ERROR }];
    const res = await appendCompletedJob(RECORD);

    expect(res.ok).toBe(false);
    expect(calls.filter(c => c.op === 'insert')).toEqual([]);
  });

  it('the old signature is gone — saveCompletedJobs cannot be called at all', () => {
    expect(supabaseModule.saveCompletedJobs).toBeUndefined();
  });
});

// Build 3 (2026-08-12). The app now reads this table back on start and applies
// whatever loadCompletedJobs() hands it straight to the on-screen revenue. That
// makes the difference between "this week is empty" and "the read failed"
// load-bearing for the first time: the two used to share a return value.
describe('a failed read is distinguishable from an empty week', () => {
  it('returns null on a read error, never an empty result the caller would apply', async () => {
    results = [{ data: null, error: DB_ERROR }];
    expect(await loadCompletedJobs(['2026-08-04'])).toBeNull();
  });

  it('an empty week is still a real, applicable result — not null', async () => {
    results = [{ data: [], error: null }];
    expect(await loadCompletedJobs(['2026-08-04'])).toEqual({ records: [], doneJobIds: [] });
  });

  it('doneJobIds come back as strings, because handleMarkDone compares strings', async () => {
    // A numeric job_id in the database would never match the String(job.id)
    // handleMarkDone stores, so the job would look untouched after a reload and
    // could be recorded a second time.
    results = [{ data: [storedRow({ job_id: 1687, week_key: '2026-08-04' })], error: null }];
    const { doneJobIds } = await loadCompletedJobs(['2026-08-04']);

    expect(doneJobIds).toEqual(['1687']);
  });

  it('the subscription drops a failed re-read instead of passing it on', async () => {
    const callback = vi.fn();
    subscribeToCompletedJobs(callback, ['2026-08-04']);

    results = [{ data: null, error: DB_ERROR }];
    channels[0].handler();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(callback).not.toHaveBeenCalled();
  });

  it('the subscription re-read stays bounded to the same weeks', async () => {
    const callback = vi.fn();
    subscribeToCompletedJobs(callback, ['2026-08-04']);

    results = [{ data: [storedRow({ week_key: '2026-08-04' })], error: null }];
    channels[0].handler();
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(calls.find(c => c.op === 'select')).toMatchObject({
      table: 'completed_jobs', col: 'week_key', vals: ['2026-08-04'],
    });
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('subscribing hands back an unsubscribe, so the caller can clean up on unmount', () => {
    const unsubscribe = subscribeToCompletedJobs(vi.fn(), ['2026-08-04']);
    expect(typeof unsubscribe).toBe('function');

    unsubscribe();
    expect(channels[0].unsubscribe).toHaveBeenCalled();
  });
});
