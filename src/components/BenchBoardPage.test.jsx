import { describe, it, expect } from 'vitest';
import { toBenchCards, columnFor } from './BenchBoardPage.jsx';

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
