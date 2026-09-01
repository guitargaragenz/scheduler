import { describe, it, expect } from 'vitest';
import {
  buildAndKeyword, andKeywordWords, escapeKeywordWord,
  inferBench, quotedKeyword, DEFAULT_BENCH_KEYWORDS,
} from './jobs.js';

const bench = (desc, keywords) =>
  inferBench(desc, 'Booked In', 'GTS', '', '', keywords, false, false);

const withWiring = extra => ({
  ...DEFAULT_BENCH_KEYWORDS,
  Wiring: [...DEFAULT_BENCH_KEYWORDS.Wiring, extra],
});

describe('building and reading back an "and" entry', () => {
  it('round-trips two plain words', () => {
    const kw = buildAndKeyword('install', 'pickup');
    expect(andKeywordWords(kw)).toEqual(['install', 'pickup']);
  });

  it('lowercases what Trevor types', () => {
    expect(andKeywordWords(buildAndKeyword(' Install ', 'PickUp')))
      .toEqual(['install', 'pickup']);
  });

  it('stores nothing when only one box is filled', () => {
    expect(buildAndKeyword('install', '')).toBeNull();
    expect(buildAndKeyword('', 'pickup')).toBeNull();
    expect(buildAndKeyword('  ', ' ')).toBeNull();
  });

  it('is one entry, so removing it removes the whole thing', () => {
    const kw = buildAndKeyword('install', 'pickup');
    const list = ['solder', kw, 'harness'];
    expect(list.filter(k => k !== kw)).toEqual(['solder', 'harness']);
  });

  it('leaves ordinary and quoted keywords alone', () => {
    expect(andKeywordWords('refret')).toBeNull();
    expect(andKeywordWords('"output jack"')).toBeNull();
    expect(andKeywordWords('')).toBeNull();
    expect(andKeywordWords(undefined)).toBeNull();
  });
});

describe('matching both words', () => {
  const kws = withWiring(buildAndKeyword('install', 'pickup'));

  it('lands on the bench when both words are there', () => {
    expect(bench('install a pickup and check the pot', kws)).toBe('Wiring');
  });

  it('does not care which word comes first', () => {
    expect(bench('pickup needs an install', kws)).toBe('Wiring');
  });

  it('does nothing when only one word is there', () => {
    expect(bench('install a pot', kws)).toBe('Electronics');
    expect(bench('pickup swap', kws)).toBe('Setup');
  });

  it('matches across a line break', () => {
    expect(bench('install\nnew pickup', kws)).toBe('Wiring');
  });
});

describe('it beats the bench order', () => {
  // The live failure on 2026-09-01: a plain `install` on Wiring sent jobs to
  // Electronics, because Electronics is tested first and owns `pickup`.
  it('a plain keyword still loses to the earlier bench', () => {
    // 'pickup' belongs to Setup, which is tested before Wiring, so a plain
    // 'install' on Wiring cannot win the job.
    const plain = withWiring('install');
    expect(bench('install a pickup', plain)).toBe('Setup');
  });

  it('the same two words as an "and" entry win', () => {
    const and = withWiring(buildAndKeyword('install', 'pickup'));
    expect(bench('install a pickup', and)).toBe('Wiring');
  });

  it('beats Fretwork, the first bench of all', () => {
    const and = withWiring(buildAndKeyword('refret', 'harness'));
    expect(bench('refret and a new harness', and)).toBe('Wiring');
  });
});

describe('words with pattern characters in them', () => {
  it('escapes every character that means something in a pattern', () => {
    expect(escapeKeywordWord('a.b+c(d)[e]{f}|g^h$i*j?k\\l'))
      .toBe('a\\.b\\+c\\(d\\)\\[e\\]\\{f\\}\\|g\\^h\\$i\\*j\\?k\\\\l');
  });

  const awkward = [
    ['a.b', 'c+d'],
    ['(x)', '[y]'],
    ['p)q', 'r(s'],
    ['5*', '?why'],
    ['back\\slash', 'do$llar'],
    ['pick-up', 'jack|plug'],
  ];

  it.each(awkward)('reads %s + %s back exactly as typed', (a, b) => {
    expect(andKeywordWords(buildAndKeyword(a, b))).toEqual([a, b]);
  });

  it('matches the characters literally, not as a pattern', () => {
    const kws = withWiring(buildAndKeyword('a.b', 'c+d'));
    expect(bench('a.b and c+d', kws)).toBe('Wiring');
    // 'a.b' as a pattern would match 'axb'; as typed text it must not.
    expect(bench('axb and ccd', kws)).not.toBe('Wiring');
  });

  it('an unbalanced bracket does not break the whole bench', () => {
    const kws = withWiring(buildAndKeyword('(', ')'));
    expect(() => bench('solder work', kws)).not.toThrow();
    expect(bench('solder work', kws)).toBe('Wiring');   // plain 'solder' still fine
    expect(bench('a ( and a )', kws)).toBe('Wiring');
  });
});

describe('nothing that already works is disturbed', () => {
  const kws = withWiring(buildAndKeyword('install', 'pickup'));

  it('the default bench order still holds', () => {
    expect(bench('refret', kws)).toBe('Fretwork');
    expect(bench('brace crack', kws)).toBe('Luthier');
    expect(bench('respray', kws)).toBe('Finishing');
    expect(bench('no output', kws)).toBe('Electronics');
    expect(bench('setup and pot', kws)).toBe('Setup');
    expect(bench('rewire it', kws)).toBe('Wiring');
  });

  it('quoted keywords still win the way they did', () => {
    expect(bench('output jack replacement', kws)).toBe('Wiring');
    expect(bench('input gain is low', kws)).toBe('Electronics');
    expect(quotedKeyword('"output jack"')).toBe('output jack');
  });

  it('blocked work still goes to Admin before keywords are read', () => {
    expect(inferBench('install a pickup', 'On Hold', 'GTS', '', '', kws, false, false))
      .toBe('Admin');
  });

  it('an "and" entry alone on a bench does not swallow every job', () => {
    const only = { ...DEFAULT_BENCH_KEYWORDS, Wiring: [buildAndKeyword('install', 'pickup')] };
    expect(bench('refret', only)).toBe('Fretwork');
    expect(bench('rewire it', only)).toBeNull();
  });
});
