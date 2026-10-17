import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// Brief E, Round 3, item 1 — blocked cards must be non-draggable.
//
// Trevor's settled decision, 2026-07-27: "blocked jobs should never be dnd
// until not blocked then normal." JobCard wires this through a single
// `disabled` flag on useDraggable's options — no separate blocked-drag code
// path, so the instant a job stops being blocked, drag is exactly what it
// was before. These tests mock @dnd-kit/core to capture the options object
// passed to useDraggable and assert `disabled` follows blockedPile().
let capturedOptions;
vi.mock('@dnd-kit/core', () => ({
  useDraggable: (options) => {
    capturedOptions = options;
    return { attributes: {}, listeners: {}, setNodeRef: () => {}, transform: null, isDragging: false };
  },
}));
vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Translate: { toString: () => '' } },
}));

const { default: JobCard } = await import('./JobCard.jsx');

function renderCard(job) {
  capturedOptions = undefined;
  renderToStaticMarkup(<JobCard job={job} />);
  return capturedOptions;
}

describe('JobCard drag disabling', () => {
  it('disables drag for an INC (Planning pile) job', () => {
    const options = renderCard({ id: 'j1', job: 393, status: 'Booked In', action: 'INC', bench: null, mfr: 'Fender', model: 'Strat' });
    expect(options.disabled).toBe(true);
  });

  it('disables drag for a stalled On Hold job', () => {
    const options = renderCard({ id: 'j2', job: 1175, status: 'On Hold', action: 'CI', bench: null, mfr: 'Gibson', model: 'LP' });
    expect(options.disabled).toBe(true);
  });

  it('leaves drag enabled for a normal workable job', () => {
    const options = renderCard({ id: 'j3', job: 1001, status: 'Active', action: 'CI', bench: 'Luthier', mfr: 'Ibanez', model: 'RG' });
    expect(options.disabled).toBe(false);
  });
});

describe('hours box', () => {
  const html = job => renderToStaticMarkup(<JobCard job={{ id: 'a', bench: 'Setup', ...job }} />);
  it('hides when there are no hours, instead of a bare "h"', () =>
    expect(html({})).not.toMatch(/>\s*h\s*</));
  it('shows when hours are set', () => expect(html({ hoursRange: '2' })).toContain('2h'));
});

describe('JobCard action chips', () => {
  const job = { id: 'c1', job: 77, status: 'Booked In', action: 'GTS', bench: 'Setup', mfr: 'Fender', model: 'Strat' };
  it('shows DG, GTS, WP with only the set one lit', () => {
    const html = renderToStaticMarkup(<JobCard job={job} onSetAction={() => {}} />);
    expect(html).toContain('aria-pressed="true"');
    expect(html.match(/aria-pressed="false"/g)).toHaveLength(2);
    expect(html).toContain('Clear GTS');
    expect(html).toContain('Set DG');
    expect(html).toContain('Set WP');
  });
  it('shows no chips without a handler', () => {
    expect(renderToStaticMarkup(<JobCard job={job} />)).not.toContain('aria-pressed');
  });
});

// Review tag on job cards (docs/briefs/review-tag-on-cards.md, checklist item 3).
const { REVIEW_NAMES } = await import('../data/reviewNames.js');
describe('JobCard review tag', () => {
  const base = { id: 'r1', job: 500, status: 'Booked In', bench: 'Setup', mfr: 'Fender', model: 'Strat' };
  const html = (job, props = {}) => renderToStaticMarkup(<JobCard job={job} {...props} />);
  const reviewer = REVIEW_NAMES.find(n => /^\p{L}+ \p{L}+$/u.test(n));

  it('shows 💬 for a two-word customer not in the list', () => {
    const out = html({ ...base, customer: 'Zzyzx Qwertyuiop' });
    expect(out).toContain('💬');
    expect(out).toContain('No Google review found under this name (list updated');
  });
  it('shows ⭐ Probably reviewed for a customer in the list', () => {
    const out = html({ ...base, customer: reviewer });
    expect(out).toContain('title="Probably reviewed"');
    expect(out).not.toContain('💬');
  });
  it('shows nothing for a single-word or business customer', () => {
    for (const customer of ['Andrew', 'Wellington Music Ltd']) {
      const out = html({ ...base, customer });
      expect(out).not.toContain('💬');
      expect(out).not.toContain('Probably reviewed');
    }
  });
  it('compact cards show nothing', () => {
    const out = html({ ...base, customer: 'Zzyzx Qwertyuiop' }, { compact: true });
    expect(out).not.toContain('💬');
    expect(out).not.toContain('Probably reviewed');
  });
});
