import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Why this test exists (2026-08-26).
//
// Trevor booked job 1730 onto Wednesday believing it was Thursday, then spent
// a session convinced the Daily Log had a bug hiding the job. Nothing was
// hiding it: at half-screen width the day headings had drifted off the columns
// underneath them, so he read the wrong day and booked it. The app did exactly
// what he asked; what he asked was wrong because the screen lied.
//
// That makes column alignment a DATA correctness property on these two grids,
// not a cosmetic one — a misread column writes a mark to the wrong day, and
// nothing about the result looks broken afterwards.
//
// Both grids fail the same way: a heading and the cell under it are separate
// flex items in separate rows, so they only stay lined up while they shrink at
// the same rate. Give one a shrink floor the other does not have and they
// drift apart silently, worse the narrower the pane gets. There is no DOM
// layout in this test setup (jsdom does not do flexbox), so this reads the
// source and pins the rule that keeps the rates equal.

const src = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

describe('Weekly Log — fixed-width day columns never compress', () => {
  const week = src('./BenchWeekPage.jsx');

  // The WL grid is FIXED width: nameW + one cellW per day. Its columns must not
  // shrink at all — the scroll container takes the overflow instead. Every
  // `width: cellW` is a column, in the heading row and in the body rows alike,
  // so every one of them has to be pinned.
  it('every cellW-wide element is flexShrink: 0', () => {
    const uses = week.match(/width: cellW[,\s]/g) || [];
    expect(uses.length).toBeGreaterThan(0);

    const pinned = week.match(/width: cellW, flexShrink: 0/g) || [];
    expect(pinned.length).toBe(uses.length);
  });
});

describe('Calendar grid — headings shrink with their columns', () => {
  const grid = src('./CalendarGrid.jsx');

  // Here the columns are PROPORTIONAL (`flex: 1`), so the rule is the mirror
  // image: every column must be free to shrink to zero. A flex item defaults to
  // `min-width: auto`, which floors it at its own content — so a heading
  // carrying the text "27 Aug" stops shrinking while the empty slot cells below
  // it carry on. minWidth: 0 removes that floor and makes the rates equal.
  it('every flex: 1 column sets minWidth: 0', () => {
    const columns = grid.match(/flex: 1,(?! minWidth: 0)[^}]*?borderLeft/g) || [];
    expect(columns).toEqual([]);
  });

  it('the day heading itself sets minWidth: 0', () => {
    expect(grid).toContain('flex: 1, minWidth: 0, padding: \'10px 6px\'');
  });
});
