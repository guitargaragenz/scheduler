import { describe, it, expect } from 'vitest';
import { cardActionChange, replacedToast, CARD_ACTIONS } from './cardActions.js';
import { applySheetEdits } from './jobsSheet.js';

describe('card action chips', () => {
  it('offers DG, GTS and WP only', () => {
    expect(CARD_ACTIONS).toEqual(['DG', 'GTS', 'WP']);
    expect(cardActionChange({ action: null }, 'INC')).toBeNull();
  });

  it('sets the action on a job with none', () => {
    const r = cardActionChange({ action: null }, 'DG');
    expect(r).toEqual({ changes: { action: 'DG' }, replaced: null, cleared: false });
    expect(replacedToast(r.replaced, 'DG', 1234)).toBeNull();
  });

  it('a second chip replaces the first — never two actions', () => {
    const r = cardActionChange({ action: 'DG' }, 'GTS');
    expect(r.changes).toEqual({ action: 'GTS' });
    expect(r.replaced).toBe('DG');
  });

  it('replacing a sheet-only action names it in the toast', () => {
    const r = cardActionChange({ action: 'INC' }, 'DG');
    expect(r.changes).toEqual({ action: 'DG' });
    expect(replacedToast(r.replaced, 'DG', 1234)).toBe('INC replaced by DG on #1234');
  });

  it('tapping the lit chip clears the action to blank', () => {
    const r = cardActionChange({ action: 'GTS' }, 'GTS');
    expect(r).toEqual({ changes: { action: null }, replaced: null, cleared: true });
  });

  it('WP clears Backlog in the same change', () => {
    const job = { id: 'j1', job: 55, status: 'Booked In', action: null, backlog: true, vb: false };
    const r = cardActionChange(job, 'WP');
    expect(r.changes).toEqual({ action: 'WP', backlog: false });
    const after = applySheetEdits(job, r.changes);
    expect(after.backlog).toBe(false);
    expect(after.action).toBe('WP');
  });

  it('clearing WP leaves Backlog alone', () => {
    expect(cardActionChange({ action: 'WP', backlog: false }, 'WP').changes).toEqual({ action: null });
  });
});
