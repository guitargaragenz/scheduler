import { describe, it, expect } from 'vitest';
import { parseDays, blockedPile, parseCSV, preserveKnownDays } from './jobs.js';

// Brief E, Task 1 + the blockedPile helper.
//
// The bug these guard against is subtle and invisible: `parseInt(x) || 0`
// turned a blank Days cell into the number 0, so a job whose age Multitrack
// doesn't know rendered as "0d" — identical to a guitar booked in this
// morning. Nobody spots a wrong number that looks plausible, which is why it
// went unnoticed since 25 July. Every assertion below is about keeping
// "unknown" and "brand new" distinguishable.

describe('parseDays', () => {
  it('returns null for a blank cell, NOT 0', () => {
    expect(parseDays('')).toBeNull();
    expect(parseDays('   ')).toBeNull();
    expect(parseDays(null)).toBeNull();
    expect(parseDays(undefined)).toBeNull();
  });

  it('parses a real age', () => {
    expect(parseDays('274')).toBe(274);
    expect(parseDays(274)).toBe(274);
    expect(parseDays(' 12 ')).toBe(12);
  });

  it('keeps a genuine zero as 0, not null', () => {
    expect(parseDays('0')).toBe(0);
    expect(parseDays(0)).toBe(0);
  });

  it('returns null for non-numeric junk rather than 0', () => {
    expect(parseDays('n/a')).toBeNull();
    expect(parseDays('-')).toBeNull();
  });
});

describe('job age sort order', () => {
  // The sort comparator lives inside parseCSV; this exercises the same
  // expression directly so the ordering rule is pinned even if the call site
  // moves.
  const byAge = (a, b) => (b.days ?? -1) - (a.days ?? -1);

  it('sorts oldest first and pushes unknown ages past 0-day jobs', () => {
    const sorted = [{ days: null }, { days: 0 }, { days: 5 }].sort(byAge);
    expect(sorted.map(j => j.days)).toEqual([5, 0, null]);
  });
});

describe('parseCSV job age', () => {
  const header = 'Job,Customer,Mfr,Model,Status,Days,Tag,Hours,Action,Desc,VB,BL,PJ';
  const csv = [
    header,
    '1001,Alice,Fender,Strat,Active,274,,2,CI,restring,N,N,N',
    '1002,Bob,Gibson,LP,Active,,,2,CI,restring,N,N,N',
    '1003,Cass,Ibanez,RG,Active,0,,2,CI,restring,N,N,N',
  ].join('\n');

  it('reads a populated Days cell as a number and a blank one as null', () => {
    const jobs = parseCSV(csv);
    const byId = Object.fromEntries(jobs.map(j => [j.id, j]));
    expect(byId['1001'].days).toBe(274);
    expect(byId['1002'].days).toBeNull();
    expect(byId['1003'].days).toBe(0);
  });

  it('returns them oldest first, with the unknown age last', () => {
    const jobs = parseCSV(csv).filter(j => !j.parentId);
    expect(jobs.map(j => j.id)).toEqual(['1001', '1003', '1002']);
  });
});

describe('preserveKnownDays — the CSV import guard', () => {
  it('keeps the age we already know when the export comes through blank', () => {
    const parsed = [{ job: '1708', days: null }];
    const existing = [{ job: '1708', days: 274, parentId: null }];
    expect(preserveKnownDays(parsed, existing)[0].days).toBe(274);
  });

  it('takes a changed populated value — MT is authoritative when it says something', () => {
    const parsed = [{ job: '1708', days: 300 }];
    const existing = [{ job: '1708', days: 274, parentId: null }];
    expect(preserveKnownDays(parsed, existing)[0].days).toBe(300);
  });

  it('keeps an incoming 0 rather than treating it as blank', () => {
    const parsed = [{ job: '1708', days: 0 }];
    const existing = [{ job: '1708', days: 274, parentId: null }];
    expect(preserveKnownDays(parsed, existing)[0].days).toBe(0);
  });

  it('leaves a blank blank when we never knew the age either', () => {
    const parsed = [{ job: '1710', days: null }];
    const existing = [{ job: '1710', days: null, parentId: null }];
    expect(preserveKnownDays(parsed, existing)[0].days).toBeNull();
  });

  it('does not take an age from a split child row', () => {
    const parsed = [{ job: '1708', days: null }];
    const existing = [{ job: '1708', days: 274, parentId: '1708' }];
    expect(preserveKnownDays(parsed, existing)[0].days).toBeNull();
  });

  it('does not mutate the rows it is handed', () => {
    const parsed = [{ job: '1708', days: null }];
    preserveKnownDays(parsed, [{ job: '1708', days: 274, parentId: null }]);
    expect(parsed[0].days).toBeNull();
  });

  it('handles an empty or missing previous-jobs list', () => {
    expect(preserveKnownDays([{ job: '1', days: null }], [])[0].days).toBeNull();
    expect(preserveKnownDays()).toEqual([]);
  });
});

describe('blockedPile', () => {
  const job = (over = {}) => ({ status: 'Active', action: 'CI', backlog: false, ...over });

  it('puts any INC job in Planning, whatever its status', () => {
    // Settled at council 2026-07-27: Planning is INC alone. On the live data
    // the only INC jobs (393, 693) are `Booked In`, so the spec's original
    // `Waiting + INC` would have shipped an empty pile.
    expect(blockedPile(job({ status: 'Booked In', action: 'INC' }))).toBe('planning');
    expect(blockedPile(job({ status: 'Waiting', action: 'INC' }))).toBe('planning');
    expect(blockedPile(job({ status: 'Active', action: 'INC' }))).toBe('planning');
    expect(blockedPile(job({ status: 'On Hold', action: 'inc' }))).toBe('planning');
  });

  it('puts stalled statuses in Waiting', () => {
    expect(blockedPile(job({ status: 'Waiting' }))).toBe('waiting');
    expect(blockedPile(job({ status: 'In Transit' }))).toBe('waiting');
    expect(blockedPile(job({ status: 'On Hold' }))).toBe('waiting');
  });

  it('leaves workable jobs unblocked', () => {
    expect(blockedPile(job({ status: 'Active' }))).toBeNull();
    expect(blockedPile(job({ status: 'Booked In' }))).toBeNull();
    expect(blockedPile(job({ status: 'To Be Inv' }))).toBeNull();
  });

  it('does not block On Hold + BL=Y + GTS — parts arrived, good to start', () => {
    expect(blockedPile(job({ status: 'On Hold', action: 'GTS', backlog: true }))).toBeNull();
  });

  it('still blocks On Hold + GTS when the backlog flag is not set', () => {
    // readyToStart needs all three; two of three is still stuck.
    expect(blockedPile(job({ status: 'On Hold', action: 'GTS', backlog: false }))).toBe('waiting');
  });

  it('tolerates a missing job without throwing', () => {
    expect(blockedPile(null)).toBeNull();
    expect(blockedPile(undefined)).toBeNull();
    expect(blockedPile({})).toBeNull();
  });
});
