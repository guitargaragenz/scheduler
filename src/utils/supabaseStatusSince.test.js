import { describe, it, expect, vi, beforeEach } from 'vitest';

// Brief E, Task 2 — the four job_status_since functions.
//
// What matters here is not that they read and write, it is their FAILURE
// contract. loadStatusSince must return null (not {}) when the read fails,
// because the hook uses "did we actually read the table?" to decide whether it
// is safe to write — and an empty object is indistinguishable from a genuinely
// empty table. If a failed read returned {}, a network blip would look like
// "no rows exist" and the reconcile would happily rewrite every stuck clock.
//
// The writes must resolve { ok: false } rather than throw, because they are
// called from an effect with no try/catch around them; an unhandled rejection
// there takes out the render.

let nextResult = { data: [], error: null };
let lastCall = {};

function chain() {
  const promise = Promise.resolve(nextResult);
  const api = {
    select: vi.fn(() => promise),
    upsert: vi.fn((records, opts) => { lastCall = { op: 'upsert', records, opts }; return promise; }),
    delete: vi.fn(() => ({
      in: vi.fn((col, vals) => { lastCall = { op: 'delete', col, vals }; return promise; }),
    })),
  };
  return api;
}

const channelHandlers = [];
const mockChannel = {
  on: vi.fn((_evt, _cfg, handler) => { channelHandlers.push(handler); return mockChannel; }),
  subscribe: vi.fn(() => mockChannel),
  unsubscribe: vi.fn(),
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: vi.fn(() => chain()),
    channel: vi.fn(() => mockChannel),
  }),
}));

const {
  loadStatusSince,
  upsertStatusSince,
  clearStatusSince,
  subscribeToStatusSince,
} = await import('./supabase.js');

beforeEach(() => {
  nextResult = { data: [], error: null };
  lastCall = {};
  channelHandlers.length = 0;
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('loadStatusSince', () => {
  it('returns rows keyed by job_id', async () => {
    nextResult = {
      data: [
        { job_id: '1001', status: 'Waiting', action: 'CI', since: '2026-07-01T00:00:00Z' },
        { job_id: '1002', status: 'On Hold', action: null, since: '2026-07-10T00:00:00Z' },
      ],
      error: null,
    };
    const out = await loadStatusSince();
    expect(out['1001']).toEqual({ status: 'Waiting', action: 'CI', since: '2026-07-01T00:00:00Z' });
    expect(out['1002'].action).toBeNull();
  });

  it('returns {} for a genuinely empty table', async () => {
    nextResult = { data: [], error: null };
    expect(await loadStatusSince()).toEqual({});
  });

  it('returns NULL on error — the distinction the write gate depends on', async () => {
    nextResult = { data: null, error: new Error('network down') };
    expect(await loadStatusSince()).toBeNull();
  });
});

describe('upsertStatusSince', () => {
  it('maps jobId to job_id and defaults a missing action to null', async () => {
    const res = await upsertStatusSince([{ jobId: 1001, status: 'Waiting', since: '2026-07-01T00:00:00Z' }]);
    expect(res.ok).toBe(true);
    expect(lastCall.records).toEqual([
      { job_id: '1001', status: 'Waiting', action: null, since: '2026-07-01T00:00:00Z' },
    ]);
    expect(lastCall.opts).toEqual({ onConflict: 'job_id' });
  });

  it('is a no-op success for an empty array', async () => {
    expect(await upsertStatusSince([])).toEqual({ ok: true });
    expect(lastCall.op).toBeUndefined();
  });

  it('refuses a non-array instead of throwing', async () => {
    expect(await upsertStatusSince(null)).toEqual({ ok: false });
    expect(await upsertStatusSince({ jobId: '1' })).toEqual({ ok: false });
  });

  it('resolves { ok: false } on error rather than rejecting', async () => {
    nextResult = { data: null, error: new Error('boom') };
    const res = await upsertStatusSince([{ jobId: '1001', status: 'Waiting', since: 'x' }]);
    expect(res.ok).toBe(false);
  });
});

describe('clearStatusSince', () => {
  it('deletes by job_id, stringifying the ids', async () => {
    const res = await clearStatusSince([1001, '1002']);
    expect(res.ok).toBe(true);
    expect(lastCall).toMatchObject({ op: 'delete', col: 'job_id', vals: ['1001', '1002'] });
  });

  it('is a no-op success for an empty list — never a bare delete with no filter', async () => {
    expect(await clearStatusSince([])).toEqual({ ok: true });
    expect(lastCall.op).toBeUndefined();
  });

  it('refuses a non-array instead of throwing', async () => {
    expect(await clearStatusSince(undefined)).toEqual({ ok: false });
  });

  it('resolves { ok: false } on error rather than rejecting', async () => {
    nextResult = { data: null, error: new Error('boom') };
    expect((await clearStatusSince(['1001'])).ok).toBe(false);
  });
});

describe('subscribeToStatusSince', () => {
  it('returns an unsubscribe function and re-reads on a change', async () => {
    const cb = vi.fn();
    const unsub = subscribeToStatusSince(cb);
    expect(typeof unsub).toBe('function');

    nextResult = { data: [{ job_id: '7', status: 'Waiting', action: null, since: 's' }], error: null };
    channelHandlers[0]();
    await new Promise(r => setTimeout(r, 0));
    expect(cb).toHaveBeenCalledWith({ '7': { status: 'Waiting', action: null, since: 's' } });

    unsub();
    expect(mockChannel.unsubscribe).toHaveBeenCalled();
  });

  it('does not push a failed re-read to the callback', async () => {
    const cb = vi.fn();
    subscribeToStatusSince(cb);
    nextResult = { data: null, error: new Error('down') };
    channelHandlers[channelHandlers.length - 1]();
    await new Promise(r => setTimeout(r, 0));
    expect(cb).not.toHaveBeenCalled();
  });
});
