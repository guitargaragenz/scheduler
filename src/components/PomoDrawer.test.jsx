import { describe, it, expect, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

// Review prompt in the Pomodoro invoice box (brief 2026-10-17).
// PomoDrawer portals to document.body; render the portal content inline so
// renderToStaticMarkup can see it.
// The portal target (document.body) is never touched once createPortal is mocked;
// a stub keeps the node test environment happy.
globalThis.document ??= { body: {} };
vi.mock('react-dom', async (orig) => ({ ...(await orig()), createPortal: (node) => node }));

const { default: PomoDrawer } = await import('./PomoDrawer.jsx');
const { REVIEW_NAMES } = await import('../data/reviewNames.js');

function render(job) {
  return renderToStaticMarkup(
    <PomoDrawer job={{ id: 'j1', job: 101, bench: 'Setup', ...job }} onClose={() => {}} onMarkDone={() => {}} />
  );
}

// A two-word reviewer name from the real list, so 'yes' tracks the data.
const reviewer = REVIEW_NAMES.find(n => n.trim().split(/\s+/).length === 2 && /^[A-Za-z ]+$/.test(n));

describe('PomoDrawer review prompt', () => {
  it('shows the amber ask line for a customer not in the review list', () => {
    const html = render({ customer: 'Zebedee Quixotewright' });
    expect(html).toContain('Job done? Invoice amount');
    expect(html).toContain('No Google review found for Zebedee Quixotewright');
    expect(html).toContain('💬');
  });

  it('shows the star line for a customer who has reviewed', () => {
    const html = render({ customer: reviewer });
    expect(html).toContain('⭐');
    expect(html).toContain('has probably left a review');
    expect(html).not.toContain('No Google review found');
  });

  it.each(['', 'Dave', 'Riverside Music Ltd'])('shows nothing for %j', (customer) => {
    const html = render({ customer });
    expect(html).toContain('Job done? Invoice amount');
    expect(html).not.toContain('No Google review found');
    expect(html).not.toContain('has probably left a review');
  });

  it('split piece (has parentId) shows no invoice box at all', () => {
    const html = render({ customer: 'Zebedee Quixotewright', parentId: 'p1' });
    expect(html).not.toContain('Job done? Invoice amount');
    expect(html).not.toContain('No Google review found');
  });
});
