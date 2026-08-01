import { describe, it, expect } from 'vitest';
import { partitionParts, buildPartPayload } from './partsToOrder.js';

const part = (over = {}) => ({
  id: 'pto-1', description: '500k pot', category: 'part',
  neededForJob: null, addedAt: '2026-07-31T04:00:00Z', resolved: false,
  ...over,
});

describe('partitionParts', () => {
  it('splits the chase list from the already-sorted parts', () => {
    const { active, resolved } = partitionParts({
      a: part({ id: 'a', resolved: false }),
      b: part({ id: 'b', resolved: true }),
    });
    expect(active.map(p => p.id)).toEqual(['a']);
    expect(resolved.map(p => p.id)).toEqual(['b']);
  });

  it('keeps resolved parts rather than dropping them', () => {
    const { active, resolved } = partitionParts({ b: part({ id: 'b', resolved: true }) });
    expect(active).toEqual([]);
    expect(resolved).toHaveLength(1);
  });

  it('orders both lists newest first regardless of key order', () => {
    const { active } = partitionParts({
      old: part({ id: 'old', addedAt: '2026-07-01T00:00:00Z' }),
      new: part({ id: 'new', addedAt: '2026-07-31T00:00:00Z' }),
      mid: part({ id: 'mid', addedAt: '2026-07-15T00:00:00Z' }),
    });
    expect(active.map(p => p.id)).toEqual(['new', 'mid', 'old']);
  });

  it('does not fall over on a missing or unparseable added date', () => {
    const { active } = partitionParts({
      a: part({ id: 'a', addedAt: null }),
      b: part({ id: 'b', addedAt: 'not a date' }),
      c: part({ id: 'c', addedAt: '2026-07-31T00:00:00Z' }),
    });
    expect(active.map(p => p.id)[0]).toBe('c');
    expect(active).toHaveLength(3);
  });

  it('handles nothing at all', () => {
    expect(partitionParts({})).toEqual({ active: [], resolved: [] });
    expect(partitionParts(null)).toEqual({ active: [], resolved: [] });
  });
});

describe('buildPartPayload', () => {
  it('builds the minimum: a description, no job', () => {
    expect(buildPartPayload({ description: '500k pot' }))
      .toEqual({ description: '500k pot', neededForJob: null });
  });

  it('carries category and job number when given', () => {
    expect(buildPartPayload({ description: '500k pot', category: 'electronics', neededForJob: '1705' }))
      .toEqual({ description: '500k pot', category: 'electronics', neededForJob: '1705' });
  });

  it('trims what was typed', () => {
    expect(buildPartPayload({ description: '  500k pot  ', category: ' part ', neededForJob: ' 1705 ' }))
      .toEqual({ description: '500k pot', category: 'part', neededForJob: '1705' });
  });

  it('omits a blank category so the database default applies', () => {
    const payload = buildPartPayload({ description: '500k pot', category: '   ' });
    expect('category' in payload).toBe(false);
  });

  it('sends a blank job number as null, not an empty string', () => {
    expect(buildPartPayload({ description: '500k pot', neededForJob: '  ' }).neededForJob).toBeNull();
  });

  it('accepts any free-text job number — job numbers are NOT validated against jobs', () => {
    expect(buildPartPayload({ description: 'nut', neededForJob: 'old 1234 / Dave' }).neededForJob)
      .toBe('old 1234 / Dave');
  });

  it('refuses an empty description', () => {
    expect(buildPartPayload({ description: '   ' })).toBeNull();
    expect(buildPartPayload({})).toBeNull();
    expect(buildPartPayload()).toBeNull();
  });
});
