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
