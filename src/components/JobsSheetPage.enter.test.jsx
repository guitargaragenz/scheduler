// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

// Every write the page can make goes through batchWriteJobsState. Mocked so the
// test can count calls and nothing reaches the network.
const writes = vi.fn(async () => ({ ok: true }));
vi.mock('../utils/supabase.js', () => ({
  batchWriteJobsState: (...a) => writes(...a),
  isSupabaseConfigured: () => true,
}));

import JobsSheetPage, { sortSheetRows } from './JobsSheetPage.jsx';

const JOBS = [
  { id: '1700', job: '1700', firstSeen: '2026-09-01', customer: 'Ann' },
  { id: '1710', job: '1710', firstSeen: null, customer: 'Bob' },
  { id: '1720', job: '1720', firstSeen: '2026-10-05T09:00:00+00:00', customer: 'Cat' },
  { id: '1650', job: '1650', firstSeen: '2026-10-05', customer: 'Dan' },
  { id: '1600', job: '1600', customer: 'Eve' },
  { id: '1720_Electronics_0', parentId: '1720', job: '1720', customer: 'Cat' },
];

const hours = job => screen.getByLabelText(`Hours for job ${job}`);
const order = () => screen.getAllByLabelText(/^Hours for job /).map(el => el.getAttribute('aria-label').slice(14));

beforeEach(() => writes.mockClear());
afterEach(cleanup);

describe('Jobs Sheet sort', () => {
  it('newest JBA date first, same day by job number desc, no date last', () => {
    expect(sortSheetRows(JOBS.slice(0, 5)).map(j => j.id)).toEqual(['1720', '1650', '1700', '1710', '1600']);
  });

  it('renders rows in that order and owns up to undated jobs', () => {
    render(<JobsSheetPage jobs={JOBS} />);
    expect(order()).toEqual(['1720', '1650', '1700', '1710', '1600']);
    expect(screen.getByText('2 jobs have no JBA date — at the bottom')).toBeTruthy();
  });

  it('shows no note when every job has a date', () => {
    render(<JobsSheetPage jobs={JOBS.slice(0, 1)} />);
    expect(screen.queryByText(/no JBA date/)).toBeNull();
  });
});

describe('Jobs Sheet Enter in Hours', () => {
  it('Enter moves down, Shift+Enter moves up, selecting the text', () => {
    render(<JobsSheetPage jobs={JOBS} />);
    const a = hours('1720');
    a.focus();
    const ev = fireEvent.keyDown(a, { key: 'Enter' });
    expect(ev).toBe(false); // default prevented: a move happened
    const b = hours('1650');
    expect(document.activeElement).toBe(b);
    fireEvent.change(b, { target: { value: '2.5' } });
    fireEvent.keyDown(hours('1650'), { key: 'Enter', shiftKey: true });
    expect(document.activeElement).toBe(hours('1720'));
  });

  it('selects the whole value when focus lands', () => {
    render(<JobsSheetPage jobs={[{ id: '1', job: '1', firstSeen: '2026-10-02', hours: 3 }, { id: '2', job: '2', firstSeen: '2026-10-01', hours: 12 }]} />);
    fireEvent.keyDown(hours('1'), { key: 'Enter' });
    const el = hours('2');
    expect(document.activeElement).toBe(el);
    expect([el.selectionStart, el.selectionEnd]).toEqual([0, 2]);
  });

  it('stays put at the ends without preventing default', () => {
    render(<JobsSheetPage jobs={JOBS} />);
    const last = hours('1600');
    last.focus();
    expect(fireEvent.keyDown(last, { key: 'Enter' })).toBe(true);
    expect(document.activeElement).toBe(last);
    const first = hours('1720');
    first.focus();
    expect(fireEvent.keyDown(first, { key: 'Enter', shiftKey: true })).toBe(true);
    expect(document.activeElement).toBe(first);
  });

  it('ignores ctrl/meta Enter', () => {
    render(<JobsSheetPage jobs={JOBS} />);
    const a = hours('1720');
    a.focus();
    fireEvent.keyDown(a, { key: 'Enter', ctrlKey: true });
    fireEvent.keyDown(a, { key: 'Enter', metaKey: true });
    expect(document.activeElement).toBe(a);
  });

  it('skips rows hidden by the search', () => {
    render(<JobsSheetPage jobs={JOBS} />);
    fireEvent.change(screen.getByLabelText('Search jobs'), { target: { value: 'a' } }); // Ann, Cat, Dan
    expect(order()).toEqual(['1720', '1650', '1700']);
    hours('1650').focus();
    fireEvent.keyDown(hours('1650'), { key: 'Enter' });
    expect(document.activeElement).toBe(hours('1700'));
  });

  it('Enter on the Tag select focuses the same row Hours', () => {
    render(<JobsSheetPage jobs={JOBS} />);
    const tag = hours('1650').closest('tr').querySelector('select');
    tag.focus();
    fireEvent.keyDown(tag, { key: 'Enter' });
    expect(document.activeElement).toBe(hours('1650'));
  });

  it('Enter never writes; Commit still saves the typed hours', async () => {
    render(<JobsSheetPage jobs={JOBS} />);
    for (const id of ['1720', '1650', '1700']) {
      fireEvent.change(hours(id), { target: { value: '4' } });
      fireEvent.keyDown(hours(id), { key: 'Enter' });
      fireEvent.keyDown(hours(id), { key: 'Enter', shiftKey: true });
    }
    expect(writes).toHaveBeenCalledTimes(0);
    fireEvent.click(screen.getByText('Commit'));
    await waitFor(() => expect(writes).toHaveBeenCalledTimes(1));
    const sent = writes.mock.calls[0][0];
    expect(sent.map(w => w.id).sort()).toEqual(['1650', '1700', '1720']);
    for (const w of sent) expect(w.data.hours).toBe(4);
  });
});
