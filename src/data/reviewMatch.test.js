import { describe, it, expect } from 'vitest';
import { hasReviewed } from './reviewMatch.js';
import { REVIEW_NAMES, REVIEWS_UPDATED } from './reviewNames.js';

// Review tag on job cards (docs/briefs/review-tag-on-cards.md, checklist item 2).
const NAMES = ['John Smith', 'Maria Castañeda', 'Cheyne Hosking (Hoskingsgo)', 'Andrew', 'Sam O\'Neil'];

describe('hasReviewed', () => {
  it('matches an exact name', () => expect(hasReviewed('John Smith', NAMES)).toBe('yes'));
  it('ignores word order', () => expect(hasReviewed('Smith John', NAMES)).toBe('yes'));
  it('ignores case and accents', () => expect(hasReviewed('maria CASTANEDA', NAMES)).toBe('yes'));
  it('ignores bracketed nicknames', () => expect(hasReviewed('Cheyne Hosking', NAMES)).toBe('yes'));
  it('drops apostrophes', () => expect(hasReviewed('Sam ONeil', NAMES)).toBe('yes'));
  it('ignores other punctuation', () => expect(hasReviewed('Smith, John.', NAMES)).toBe('yes'));
  it('does not match an extra word', () => expect(hasReviewed('John Smith Jr', NAMES)).toBe('no'));
  it('a single-word reviewer never matches', () => expect(hasReviewed('Andrew Brown', NAMES)).toBe('no'));
  it('returns no for a two-word name not in the list', () => expect(hasReviewed('Jane Doe', NAMES)).toBe('no'));
  it('single-word customer is unknown', () => expect(hasReviewed('Andrew', NAMES)).toBe('unknown'));
  it('blank customer is unknown', () => {
    expect(hasReviewed('', NAMES)).toBe('unknown');
    expect(hasReviewed(null, NAMES)).toBe('unknown');
    expect(hasReviewed('  ', NAMES)).toBe('unknown');
  });
  it('business names are unknown', () => {
    expect(hasReviewed('Wellington Music Ltd', NAMES)).toBe('unknown');
    expect(hasReviewed('St Marks Church', NAMES)).toBe('unknown');
  });
});

describe('reviewNames.js (generated)', () => {
  it('holds 171 names and a date, names only', () => {
    expect(REVIEW_NAMES).toHaveLength(171);
    expect(Object.isFrozen(REVIEW_NAMES)).toBe(true);
    expect(REVIEWS_UPDATED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const n of REVIEW_NAMES) expect(typeof n).toBe('string');
  });
});
