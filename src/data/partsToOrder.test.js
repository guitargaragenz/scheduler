import { describe, it, expect } from 'vitest';
import {
  partitionParts, buildPartPayload, groupPartsByJob,
  parseTerms, matchesPart, findStockMatch,
} from './partsToOrder.js';

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
      .toEqual({ description: '500k pot', neededForJob: null, partNumber: null });
  });

  it('carries category and job number when given', () => {
    expect(buildPartPayload({ description: '500k pot', category: 'electronics', neededForJob: '1705' }))
      .toEqual({ description: '500k pot', category: 'electronics', neededForJob: '1705', partNumber: null });
  });

  it('trims what was typed', () => {
    expect(buildPartPayload({ description: '  500k pot  ', category: ' part ', neededForJob: ' 1705 ' }))
      .toEqual({ description: '500k pot', category: 'part', neededForJob: '1705', partNumber: null });
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

  it('carries a trimmed part number when given', () => {
    expect(buildPartPayload({ description: 'pot', partNumber: '  CTS450  ' }).partNumber)
      .toBe('CTS450');
  });

  it('sends a missing or blank part number as null — it is never required', () => {
    expect(buildPartPayload({ description: 'pot' }).partNumber).toBeNull();
    expect(buildPartPayload({ description: 'pot', partNumber: '   ' }).partNumber).toBeNull();
  });
});

describe('groupPartsByJob', () => {
  it('puts the parts of one job together under one heading', () => {
    const groups = groupPartsByJob([
      part({ id: 'a', neededForJob: '1705' }),
      part({ id: 'b', neededForJob: '1679' }),
      part({ id: 'c', neededForJob: '1705' }),
    ]);
    const j1705 = groups.find(g => g.key === '1705');
    expect(j1705.label).toBe('Job 1705');
    expect(j1705.parts.map(p => p.id)).toEqual(['a', 'c']);
  });

  it('calls the no-job group Shop stock, for both null and blank', () => {
    const groups = groupPartsByJob([
      part({ id: 'a', neededForJob: null }),
      part({ id: 'b', neededForJob: '' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('Shop stock');
    expect(groups[0].parts).toHaveLength(2);
  });

  it('trims the job number so a stray space does not split one job in two', () => {
    const groups = groupPartsByJob([
      part({ id: 'a', neededForJob: '1705' }),
      part({ id: 'b', neededForJob: ' 1705 ' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('1705');
    expect(groups[0].parts).toHaveLength(2);
  });

  it('orders groups by their newest part, so the job just added to is first', () => {
    const groups = groupPartsByJob([
      part({ id: 'a', neededForJob: '1679', addedAt: '2026-07-01T00:00:00Z' }),
      part({ id: 'b', neededForJob: '1705', addedAt: '2026-07-31T00:00:00Z' }),
      part({ id: 'c', neededForJob: '1679', addedAt: '2026-07-02T00:00:00Z' }),
    ]);
    expect(groups.map(g => g.key)).toEqual(['1705', '1679']);
  });

  it('keeps a job number that is free text, not a validated job', () => {
    const groups = groupPartsByJob([part({ neededForJob: 'old 1234 / Dave' })]);
    expect(groups[0].label).toBe('Job old 1234 / Dave');
  });

  it('handles nothing at all', () => {
    expect(groupPartsByJob([])).toEqual([]);
    expect(groupPartsByJob(null)).toEqual([]);
  });
});

// ---- PartsBox stock check ----

const pbPart = (over = {}) => ({
  'part/id': 'pb-1',
  'part/name': '500k audio pot',
  'part/description': 'long shaft',
  'part/mpn': 'CTS450',
  'part/tags': ['pots'],
  'part/stock': [{ 'stock/storage-id': 's1', 'stock/quantity': 4 }],
  ...over,
});

describe('parseTerms', () => {
  it('splits on spaces and lowercases', () => {
    expect(parseTerms('Cap 10uF')).toEqual([
      { term: 'cap', negate: false }, { term: '10uf', negate: false },
    ]);
  });

  it('keeps a quoted phrase together and honours a - exclusion', () => {
    expect(parseTerms('"PTS-BIN 4" -SMD')).toEqual([
      { term: 'pts-bin 4', negate: false }, { term: 'smd', negate: true },
    ]);
  });

  it('handles empty input', () => {
    expect(parseTerms('')).toEqual([]);
    expect(parseTerms(null)).toEqual([]);
  });
});

describe('matchesPart', () => {
  it('searches name, description, mpn and tags', () => {
    expect(matchesPart(pbPart(), 'audio')).toBe(true);
    expect(matchesPart(pbPart(), 'shaft')).toBe(true);
    expect(matchesPart(pbPart(), 'cts450')).toBe(true);
    expect(matchesPart(pbPart(), 'pots')).toBe(true);
  });

  it('does NOT search the storage-location name — that is the drawer\'s job', () => {
    // A part must never flag as in-stock because a shelf is named "amp parts".
    const p = pbPart({ 'part/name': 'nut', 'part/description': '', 'part/mpn': '', 'part/tags': [] });
    expect(matchesPart(p, 'amp parts')).toBe(false);
  });

  it('is plain substring matching — no typo or plural tolerance', () => {
    expect(matchesPart(pbPart(), 'pot')).toBe(true);   // substring of "pot"
    expect(matchesPart(pbPart(), 'potr')).toBe(false); // typo is NOT forgiven
  });
});

describe('findStockMatch', () => {
  it('states an exact part-number match as certain', () => {
    const m = findStockMatch([pbPart()], { description: 'anything', partNumber: 'cts450' });
    expect(m.certain).toBe(true);
    expect(m.quantity).toBe(4);
  });

  it('treats a keyword match as a maybe, never certain', () => {
    const m = findStockMatch([pbPart()], { description: '500k audio pot' });
    expect(m).not.toBeNull();
    expect(m.certain).toBe(false);
  });

  it('requires every word to match', () => {
    expect(findStockMatch([pbPart()], { description: '500k audio pot flange' })).toBeNull();
  });

  it('marks a one-word match as thin so the page can soften it', () => {
    expect(findStockMatch([pbPart()], { description: 'pot' }).matchedTermCount).toBe(1);
    expect(findStockMatch([pbPart()], { description: 'audio pot' }).matchedTermCount).toBe(2);
  });

  it('ignores parts with no stock on hand', () => {
    const empty = pbPart({ 'part/stock': [{ 'stock/storage-id': 's1', 'stock/quantity': 0 }] });
    expect(findStockMatch([empty], { description: 'audio pot' })).toBeNull();
    expect(findStockMatch([empty], { partNumber: 'CTS450' })).toBeNull();
  });

  it('hands back the text the check-stock button should search for', () => {
    expect(findStockMatch([pbPart()], { partNumber: 'CTS450' }).searchText).toBe('CTS450');
    expect(findStockMatch([pbPart()], { description: 'audio pot' }).searchText).toBe('audio pot');
  });

  it('says nothing when there is nothing to go on', () => {
    expect(findStockMatch([pbPart()], { description: '   ' })).toBeNull();
    expect(findStockMatch([], { description: 'audio pot' })).toBeNull();
    expect(findStockMatch(null, { description: 'audio pot' })).toBeNull();
    expect(findStockMatch([pbPart()])).toBeNull();
  });

  it('falls back to a keyword search when the part number matches nothing', () => {
    const m = findStockMatch([pbPart()], { description: 'audio pot', partNumber: 'NOPE1' });
    // "nope1" is not in any field, so the AND match fails — no false certainty.
    expect(m).toBeNull();
  });
});
