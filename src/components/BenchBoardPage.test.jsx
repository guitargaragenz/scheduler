import { describe, it, expect } from 'vitest';
import { toBenchCards, columnFor, groupCards } from './BenchBoardPage.jsx';

const job = (over = {}) => ({
  id: over.id ?? 'j1', job: '1000', customer: 'C', status: 'Active', action: 'GTS',
  bench: 'Setup', hours: 1, done: false, ...over,
});

describe('toBenchCards', () => {
  it('drops done jobs', () => {
    expect(toBenchCards([job({ done: true })])).toHaveLength(0);
  });

  it('gives an unsplit job exactly one card', () => {
    const cards = toBenchCards([job()]);
    expect(cards).toHaveLength(1);
    expect(cards[0].piece).toBeNull();
  });

  // The whole point of the board: a Fretwork session inside a Luthier job has
  // to surface under Fretwork, which the parent's single `bench` field hides.
  it('expands an auto-split job into its pieces and not the parent', () => {
    const cards = toBenchCards([
      job({ id: 'p', bench: 'Luthier', hasSubtasks: true, subtasks: ['a', 'b'] }),
      job({ id: 'a', parentId: 'p', bench: 'Luthier', hours: 2 }),
      job({ id: 'b', parentId: 'p', bench: 'Fretwork', hours: 3 }),
    ]);
    expect(cards.map(c => c.card.id).sort()).toEqual(['a', 'b']);
    expect(cards.map(c => c.card.bench)).toContain('Fretwork');
  });

  it('expands a manual split by parentId', () => {
    const cards = toBenchCards([
      job({ id: 'p', isSplit: true }),
      job({ id: 'a', parentId: 'p', bench: 'Wiring' }),
    ]);
    expect(cards).toHaveLength(1);
    expect(cards[0].card.id).toBe('a');
  });

  // A parent whose children were all filtered out must still appear, or its
  // hours vanish off the board entirely.
  it('falls back to the parent when no child survives', () => {
    const cards = toBenchCards([job({ id: 'p', hasSubtasks: true, subtasks: ['gone'] })]);
    expect(cards).toHaveLength(1);
    expect(cards[0].card.id).toBe('p');
  });
});

describe('groupCards', () => {
  const split = () => toBenchCards([
    job({ id: 'p', bench: 'Luthier', hasSubtasks: true, subtasks: ['a', 'b'] }),
    job({ id: 'a', parentId: 'p', bench: 'Luthier', hours: 2 }),
    job({ id: 'b', parentId: 'p', bench: 'Fretwork', hours: 3 }),
  ]);

  it('collapses a job\'s pieces into one group', () => {
    const groups = groupCards(split());
    expect(groups).toHaveLength(1);
    expect(groups[0].pieces).toHaveLength(2);
  });

  it('leaves unsplit jobs as their own single-piece groups', () => {
    const groups = groupCards(toBenchCards([job({ id: 'x' }), job({ id: 'y' })]));
    expect(groups).toHaveLength(2);
    expect(groups.every(g => g.pieces.length === 1)).toBe(true);
  });

  // Grouping is per column, so a booked piece and its unbooked sibling stay
  // in the columns they belong to rather than being forced together.
  it('keeps pieces separate when they sit in different columns', () => {
    const cards = split();
    const byColumn = {};
    for (const c of cards) (byColumn[columnFor(c)] ||= []).push(c);
    cards[0].card.calendarSlot = 'mon-1';
    const regrouped = {};
    for (const c of cards) (regrouped[columnFor(c)] ||= []).push(c);
    expect(Object.keys(regrouped).sort()).toEqual(['bench', 'ready']);
    expect(groupCards(regrouped.bench)).toHaveLength(1);
    expect(groupCards(regrouped.ready)).toHaveLength(1);
  });

  it('does not merge two different jobs that are both split', () => {
    const groups = groupCards(toBenchCards([
      job({ id: 'p1', hasSubtasks: true, subtasks: ['a1'] }),
      job({ id: 'a1', parentId: 'p1' }),
      job({ id: 'p2', hasSubtasks: true, subtasks: ['a2'] }),
      job({ id: 'a2', parentId: 'p2' }),
    ]));
    expect(groups).toHaveLength(2);
  });
});

describe('columnFor', () => {
  const col = over => columnFor({ card: job(over), parent: job(over) });

  it('puts booked work on the bench, whatever else it says', () => {
    expect(col({ calendarSlot: 'x', status: 'On Hold' })).toBe('bench');
  });

  it('puts workable unbooked work in ready', () => {
    expect(col({})).toBe('ready');
  });

  it.each(['INC', 'RS', 'RS-C', 'DG'])('puts %s in still-working-it-out', act => {
    expect(col({ action: act })).toBe('thinking');
  });

  it('splits the two waits apart', () => {
    expect(col({ action: 'WP', status: 'Waiting' })).toBe('parts');
    expect(col({ action: 'CI', status: 'Waiting' })).toBe('customer');
  });

  it('parks on-hold work', () => {
    expect(col({ status: 'On Hold' })).toBe('parked');
  });

  // The catch-all exists so nothing falls off the board. 1679 is live data:
  // Waiting + GTS, which matches none of the five named reasons.
  it('catches a blocked job that matches no named reason', () => {
    expect(col({ status: 'Waiting', action: 'GTS' })).toBe('other');
    expect(col({ status: 'In Transit' })).toBe('other');
  });

  // A split piece reads its status from the parent — it has none of its own.
  it('reads blocking off the parent, not the piece', () => {
    const parent = job({ id: 'p', status: 'On Hold' });
    const card = job({ id: 'a', parentId: 'p', status: 'Active' });
    expect(columnFor({ card, parent })).toBe('parked');
  });
});
