import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// The "🔧 PARTS ARRIVED?" group — jobs still tagged WP that Multitrack has moved
// off Waiting. Trevor, 2026-08-03: "I could miss jobs that come free when
// scheduling."
//
// The rule these tests exist to protect is the second one: a WP job is
// schedulable (WP deliberately does not change `schedulable`), so it is in the
// main list already. The group must MOVE it, never copy it. A duplicate card
// would read as two jobs on a board whose whole job is telling him what to book.
//
// Same rendering approach as JobShelf.test.jsx — the real component through
// renderToStaticMarkup, with dnd-kit stubbed out for the node env.
vi.mock('@dnd-kit/core', () => ({
  useDraggable: () => ({ attributes: {}, listeners: {}, setNodeRef: () => {}, transform: null, isDragging: false }),
  useDroppable: () => ({ setNodeRef: () => {}, isOver: false }),
}));
vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Translate: { toString: () => '' } },
}));

const store = {};
globalThis.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; },
};

const { default: Sidebar } = await import('./Sidebar.jsx');
const { partsMayHaveArrived } = await import('../data/jobs.js');

const job = (over) => ({
  id: '1001', job: '1001', customer: 'A', mfr: 'Fender', model: 'Strat',
  desc: 'setup', bench: 'Setup', hours: 2, status: 'Active', action: '',
  scheduled: false, done: false, backlog: false,
  schedulable: true, readyToStart: false, awaiting: false, inTransit: false,
  ...over,
});

const render = (jobs) => renderToStaticMarkup(
  <Sidebar jobs={jobs} dragMode="job" onDragModeChange={() => {}} onPdfUpload={() => {}}
    highlightedJobId={null} onClearHighlight={() => {}} onJobClick={() => {}}
    isOpen={true} onToggle={() => {}} lastSyncedAt={null} />
);

// How many cards carry this job number, anywhere in the sidebar. The count is
// the point — one is correct, two is the bug.
const cardCount = (html, jobNo) => html.split(`#${jobNo}`).length - 1;

describe('partsMayHaveArrived', () => {
  it('is true for a WP job Multitrack has moved off Waiting', () => {
    expect(partsMayHaveArrived(job({ action: 'WP', status: 'Active' }))).toBe(true);
  });

  it('is false while Multitrack still says Waiting', () => {
    expect(partsMayHaveArrived(job({ action: 'WP', status: 'Waiting' }))).toBe(false);
  });

  it('is false for On Hold and In Transit — still blocked, tag or no tag', () => {
    expect(partsMayHaveArrived(job({ action: 'WP', status: 'On Hold' }))).toBe(false);
    expect(partsMayHaveArrived(job({ action: 'WP', status: 'In Transit' }))).toBe(false);
  });

  it('is false without the WP tag', () => {
    expect(partsMayHaveArrived(job({ action: '', status: 'Active' }))).toBe(false);
    expect(partsMayHaveArrived(job({ action: 'CI', status: 'Active' }))).toBe(false);
    expect(partsMayHaveArrived(job({ action: 'FB', status: 'Active' }))).toBe(false);
  });

  it('reads the tag case- and space-insensitively, like every other action check', () => {
    expect(partsMayHaveArrived(job({ action: ' wp ', status: 'Active' }))).toBe(true);
  });

  it('survives a null job', () => {
    expect(partsMayHaveArrived(null)).toBe(false);
  });
});

describe('Sidebar — the Parts Arrived? group', () => {
  it('shows the group when a WP job has come free', () => {
    const html = render([job({ action: 'WP', status: 'Active' })]);
    expect(html).toContain('PARTS ARRIVED?');
    expect(html).toContain('(1)');
  });

  it('lists the freed job exactly once — moved out of the main list, not copied', () => {
    const html = render([job({ action: 'WP', status: 'Active' })]);
    expect(cardCount(html, '1001')).toBe(1);
  });

  it('does not duplicate a WP job that is also backlog', () => {
    const html = render([job({ action: 'WP', status: 'Active', backlog: true })]);
    expect(cardCount(html, '1001')).toBe(1);
    expect(html).toContain('PARTS ARRIVED?');
  });

  it('does not duplicate a WP job that is also ready to start', () => {
    const html = render([job({ action: 'WP', status: 'On Hold', backlog: true, readyToStart: true })]);
    expect(cardCount(html, '1001')).toBe(1);
  });

  it('hides the group entirely when nothing qualifies', () => {
    const html = render([job({ action: '', status: 'Active' })]);
    expect(html).not.toContain('PARTS ARRIVED?');
  });

  it('leaves a still-Waiting WP job where it is', () => {
    const html = render([job({ action: 'WP', status: 'Waiting', schedulable: false })]);
    expect(html).not.toContain('PARTS ARRIVED?');
  });

  it('ignores scheduled and done jobs, like every other group', () => {
    const html = render([
      job({ id: '1', job: '1', action: 'WP', status: 'Active', scheduled: true }),
      job({ id: '2', job: '2', action: 'WP', status: 'Active', done: true }),
    ]);
    expect(html).not.toContain('PARTS ARRIVED?');
  });

  it('does not swallow untagged jobs — they stay in the main list', () => {
    const html = render([
      job({ id: '1001', job: '1001', action: 'WP', status: 'Active' }),
      job({ id: '1002', job: '1002', action: '', status: 'Active' }),
    ]);
    expect(cardCount(html, '1001')).toBe(1);
    expect(cardCount(html, '1002')).toBe(1);
    expect(html).toContain('(1)');
  });
});
