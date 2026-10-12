// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import DailyLogPanel from './DailyLogPanel.jsx';
import BenchWeekPage from './BenchWeekPage.jsx';
import { normalizeJobsFromDb, departedJobsFromDb } from '../hooks/useSupabase.js';
import { ACTION_OPTIONS } from '../data/jobsSheet.js';

// Action labels on the Daily and Weekly Logs (scope lock 2026-10-13).
// Trevor: "I can't see these tags there". Read-only label beside the job
// name, found by job id, parent's action on a split, nothing when blank.

vi.mock('../utils/googleCalendar.js', () => ({
  isSignedIn: () => false,
  listEvents: async () => [],
}));

const MON = '2026-09-07';
const WEEK_DAYS = Array.from({ length: 7 }, (_, i) => new Date(2026, 8, 7 + i));
const ROWKEY = 'week:2026-09-07';

const dbRow = (over = {}) => ({
  customer: 'C', status: 'Booked In', hours: 1, scheduled: false, desc: 'setup',
  tag: '', action: '', vb: 'N', bl: 'N', pj: 'N', has_subtasks: false, subtasks: [],
  is_split: false, no_auto_split: true, is_subtask: false, is_derived: false,
  parent_id: null, departed_at: null, done: false,
  ...over,
});

const rows = (dgAction = 'DG') => [
  dbRow({ id: '1800', job: '1800', mfr: 'Fender', model: 'Strat', bench: 'Setup', action: dgAction }),
  dbRow({ id: '1801', job: '1801', mfr: 'Gibson', model: 'SG', bench: 'Setup' }),
  // Departed, with an action of its own.
  dbRow({
    id: '1735', job: '1735', mfr: 'Yamaha', model: 'RGX', bench: 'Setup', action: 'CI',
    done: true, departed_at: '2026-09-14T00:00:00Z',
  }),
];

const labels = () => screen.queryAllByTestId('action-label').map(e => e.textContent);
const labelBeside = (text) => {
  const name = screen.getAllByText(text)[0];
  return within(name.parentElement).queryByTestId('action-label')?.textContent ?? null;
};

afterEach(() => cleanup());

function dl(jobs, departed, dayItems) {
  const props = {
    departedJobs: departed, weekDays: WEEK_DAYS,
    marks: { 1800: { [ROWKEY]: 'row' }, 1801: { [ROWKEY]: 'row' }, 1735: { [ROWKEY]: 'row', [MON]: 'cross' } },
    dayItems, ready: true, saveError: null,
    addItem: vi.fn(async () => ({ ok: true })), removeItem: vi.fn(async () => ({ ok: true })),
    weekReady: true, setWeekMark: vi.fn(async () => ({ ok: true })),
    onMarkPieceDone: vi.fn(), isMobile: false, showToast: vi.fn(),
  };
  const r = render(<DailyLogPanel jobs={jobs} {...props} />);
  return (next) => r.rerender(<DailyLogPanel jobs={next} {...props} />);
}

const DAY = {
  [MON]: {
    1800: { kind: 'job', label: '1800 Fender Strat' },
    1801: { kind: 'job', label: '1801 Gibson SG' },
    1735: { kind: 'job', label: '1735 Yamaha RGX' },
    'task:2026-09-07:zz': { kind: 'task', label: 'order strings' },
  },
};

describe('Daily Log action labels', () => {
  it('shows the action beside the job, none when blank, none on a typed row, yes on a departed job', () => {
    dl(normalizeJobsFromDb(rows()), departedJobsFromDb(rows()), DAY);
    expect(labels().sort()).toEqual(['CI', 'DG']);
    expect(labelBeside('order strings')).toBeNull();
  });

  it('keeps the label out of the name: aria-label unchanged', () => {
    dl(normalizeJobsFromDb(rows()), departedJobsFromDb(rows()), DAY);
    const box = screen.getAllByRole('combobox').find(b => b.getAttribute('aria-label')?.startsWith('Mark for 1800'));
    expect(box.getAttribute('aria-label')).toBe('Mark for 1800 Fender Strat');
  });

  it('follows a chip change without a reload', () => {
    const rerender = dl(normalizeJobsFromDb(rows()), departedJobsFromDb(rows()), DAY);
    rerender(normalizeJobsFromDb(rows('GTS')));
    expect(labels().sort()).toEqual(['CI', 'GTS']);
    rerender(normalizeJobsFromDb(rows('')));
    expect(labels()).toEqual(['CI']);
  });

  it('a split shows the parent action on its header, not on the pieces', () => {
    const jobs = [
      { id: 'p', job: '1900', mfr: 'PRS', model: 'SE', isSplit: true, bench: 'Luthier', action: 'WP' },
      { id: 'c1', parentId: 'p', bench: 'Fretwork', action: 'RS' },
      { id: 'c2', parentId: 'p', bench: 'Setup' },
    ];
    dl(jobs, [], { [MON]: {
      c1: { kind: 'job', label: '1900 PRS SE — Fretwork' },
      c2: { kind: 'job', label: '1900 PRS SE — Setup' },
    } });
    expect(labels()).toEqual(['WP']);
  });
});

describe('Weekly Log action labels', () => {
  const props = {
    weekDays: WEEK_DAYS, ready: true, saveError: null, setMark: vi.fn(), clearJobKeys: vi.fn(),
    onCloseJob: vi.fn(), onBookedOnDay: vi.fn(), isMobile: false, showToast: vi.fn(),
  };

  it('every action value shows its label; blank shows none', () => {
    const values = ACTION_OPTIONS.filter(Boolean);
    const jobs = values.map((a, i) => ({ id: String(2000 + i), job: String(2000 + i), mfr: 'M', model: a, bench: 'Setup', action: a }));
    jobs.push({ id: '2999', job: '2999', mfr: 'M', model: 'none', bench: 'Setup', action: '' });
    const marks = Object.fromEntries(jobs.map(j => [j.id, { [ROWKEY]: 'row' }]));
    render(<BenchWeekPage jobs={jobs} marks={marks} {...props} />);
    expect(labels().sort()).toEqual([...values].sort());
  });

  it('departed jobs get their label too; chip changes show without a reload', () => {
    const marks = { 1800: { [ROWKEY]: 'row' }, 1801: { [ROWKEY]: 'row' }, 1735: { [ROWKEY]: 'row', [MON]: 'cross' } };
    const r = render(<BenchWeekPage jobs={normalizeJobsFromDb(rows())} departedJobs={departedJobsFromDb(rows())} marks={marks} {...props} />);
    expect(labels().sort()).toEqual(['CI', 'DG']);
    r.rerender(<BenchWeekPage jobs={normalizeJobsFromDb(rows('GTS'))} departedJobs={departedJobsFromDb(rows())} marks={marks} {...props} />);
    expect(labels().sort()).toEqual(['CI', 'GTS']);
  });

  it('a split row shows the parent action, outside the name button', () => {
    const jobs = [
      { id: 'p', job: '1900', mfr: 'PRS', model: 'SE', isSplit: true, bench: 'Luthier', action: 'WP' },
      { id: 'c1', parentId: 'p', bench: 'Fretwork', action: 'RS' },
      { id: 'c2', parentId: 'p', bench: 'Setup' },
    ];
    render(<BenchWeekPage jobs={jobs} marks={{ p: { [ROWKEY]: 'row' } }} {...props} />);
    expect(labels()).toEqual(['WP']);
    const btn = screen.getByRole('button', { name: /^Parts of/ });
    expect(within(btn).queryByTestId('action-label')).toBeNull();
    expect(btn.getAttribute('aria-label')).not.toMatch(/WP/);
  });
});
