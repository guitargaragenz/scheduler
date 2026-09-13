import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import PartsArrivedBanner from './PartsArrivedBanner.jsx';
import { noticeJobs, dismissAll } from '../data/partsArrivedNotice.js';

const job = (over = {}) => ({
  id: '1679', job: 1679, mfr: 'Fender', model: 'Telecaster',
  status: 'Active', action: 'WP', done: false, ...over,
});

const render = props => renderToStaticMarkup(
  <PartsArrivedBanner onJobClick={() => {}} onDismiss={() => {}} {...props} />
);

describe('PartsArrivedBanner', () => {
  it('renders nothing when no job qualifies', () => {
    expect(render({ jobs: [] })).toBe('');
  });

  it('names the jobs and offers the dismiss control', () => {
    const markup = render({ jobs: [job(), job({ id: '1705', job: 1705 })] });
    expect(markup).toContain('2 jobs may have parts now');
    expect(markup).toContain('#1679');
    expect(markup).toContain('#1705');
    expect(markup).toContain('✕');
  });

  it('reads as one job, not "1 jobs"', () => {
    expect(render({ jobs: [job()] })).toContain('1 job may have parts now');
  });

  // The app knows Multitrack stopped saying waiting. It does not know the parts
  // arrived, and the wording must not claim it does.
  it('does not claim the parts are definitely here', () => {
    const markup = render({ jobs: [job()] });
    expect(markup).toContain('may have parts now');
    expect(markup).toContain('Multitrack no longer says waiting');
  });

  // End to end through the same functions App.jsx uses: dismissing empties the
  // banner, and it stays empty on the next render with the stored list.
  it('goes away after dismiss and stays away on the next load', () => {
    const jobs = [job()];
    expect(render({ jobs: noticeJobs(jobs, []) })).not.toBe('');
    const dismissed = dismissAll(jobs, []);
    expect(render({ jobs: noticeJobs(jobs, dismissed) })).toBe('');
  });
});
