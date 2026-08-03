import { describe, it, expect } from 'vitest';
import {
  qualifyingJobs, sanitizeDismissed, pruneDismissed, noticeJobs, dismissAll,
} from './partsArrivedNotice.js';

// The dismissed-list rule is the reason this build has state at all, so it gets
// the bulk of the coverage here. The behaviour that matters most is the last
// describe block: dismiss → re-block → come free again → notify again.

const job = (over = {}) => ({
  id: '1679', job: 1679, customer: 'Gav Comber', mfr: 'Fender', model: 'Telecaster',
  status: 'Active', action: 'WP', done: false, ...over,
});

// Multitrack putting a job back on the blocked list. `partsMayHaveArrived` reads
// the status column through blockedPile(), so this is all a re-block is.
const reBlocked = j => ({ ...j, status: 'Waiting' });

describe('qualifyingJobs', () => {
  it('names a WP job Multitrack has moved off Waiting', () => {
    expect(qualifyingJobs([job()]).map(j => j.job)).toEqual([1679]);
  });

  it('ignores a WP job Multitrack still calls stuck', () => {
    expect(qualifyingJobs([reBlocked(job())])).toEqual([]);
  });

  it('ignores a job with no WP tag', () => {
    expect(qualifyingJobs([job({ action: '' })])).toEqual([]);
  });

  it('ignores done jobs', () => {
    expect(qualifyingJobs([job({ done: true })])).toEqual([]);
  });

  it('ignores split pieces and derived bench cards, which share their parent number', () => {
    const jobs = [
      job(),
      job({ id: '1679_Setup_0', parentId: '1679', isDerived: true }),
      job({ id: '1679_child', parentId: '1679' }),
    ];
    expect(qualifyingJobs(jobs).map(j => j.id)).toEqual(['1679']);
  });

  it('never names the same job number twice', () => {
    expect(qualifyingJobs([job(), job({ id: 'other' })]).length).toBe(1);
  });

  it('skips a job with no job number — the banner would have nothing to print', () => {
    expect(qualifyingJobs([job({ job: null })])).toEqual([]);
  });

  it('lists in job-number order', () => {
    const jobs = [job({ id: 'b', job: 1705 }), job({ id: 'a', job: 1679 })];
    expect(qualifyingJobs(jobs).map(j => j.job)).toEqual([1679, 1705]);
  });
});

describe('sanitizeDismissed', () => {
  it('turns whatever the store held into clean number strings', () => {
    expect(sanitizeDismissed([1679, '1705', ' 1712 ', '', null, 1679]))
      .toEqual(['1679', '1705', '1712']);
  });

  it('treats a missing or malformed stored value as nothing dismissed', () => {
    expect(sanitizeDismissed(undefined)).toEqual([]);
    expect(sanitizeDismissed('1679')).toEqual([]);
    expect(sanitizeDismissed({ a: 1 })).toEqual([]);
  });
});

describe('noticeJobs — what the banner names', () => {
  it('names every qualifying job when nothing is dismissed', () => {
    const jobs = [job(), job({ id: '1705', job: 1705 })];
    expect(noticeJobs(jobs, []).map(j => j.job)).toEqual([1679, 1705]);
  });

  it('drops the ones already dismissed', () => {
    const jobs = [job(), job({ id: '1705', job: 1705 })];
    expect(noticeJobs(jobs, ['1679']).map(j => j.job)).toEqual([1705]);
  });

  it('matches a dismissed entry stored as a number, not a string', () => {
    expect(noticeJobs([job()], [1679])).toEqual([]);
  });

  it('shows nothing when everything qualifying is dismissed', () => {
    expect(noticeJobs([job()], ['1679'])).toEqual([]);
  });
});

describe('dismissAll — what ✕ writes', () => {
  it('adds everything currently on the notice', () => {
    const jobs = [job(), job({ id: '1705', job: 1705 })];
    expect(dismissAll(jobs, [])).toEqual(['1679', '1705']);
  });

  it('keeps earlier dismissals that still qualify', () => {
    const jobs = [job(), job({ id: '1705', job: 1705 })];
    expect(dismissAll(jobs, ['1679'])).toEqual(['1679', '1705']);
  });

  it('does not resurrect a number that stopped qualifying while the banner was up', () => {
    // 1679 was dismissed earlier and has since gone back on Waiting. Dismissing
    // 1705 must not quietly re-arm the suppression of 1679.
    const jobs = [reBlocked(job()), job({ id: '1705', job: 1705 })];
    expect(dismissAll(jobs, ['1679'])).toEqual(['1705']);
  });

  it('never writes a duplicate', () => {
    expect(dismissAll([job()], ['1679', '1679'])).toEqual(['1679']);
  });
});

describe('pruneDismissed — the entries the store should stop holding', () => {
  it('keeps an entry whose job still qualifies', () => {
    expect(pruneDismissed(['1679'], [job()])).toEqual(['1679']);
  });

  it('drops an entry whose job went back on Waiting', () => {
    expect(pruneDismissed(['1679'], [reBlocked(job())])).toEqual([]);
  });

  it('drops an entry whose WP tag has been cleared in the Jobs Sheet', () => {
    expect(pruneDismissed(['1679'], [job({ action: '' })])).toEqual([]);
  });

  it('drops an entry whose job left the board entirely', () => {
    expect(pruneDismissed(['1679'], [])).toEqual([]);
  });

  it('returns the same array instance when nothing needed dropping, so no needless write', () => {
    const stored = ['1679'];
    expect(pruneDismissed(stored, [job()])).toBe(stored);
  });

  it('returns a new array when something was dropped, so the caller writes', () => {
    const stored = ['1679'];
    expect(pruneDismissed(stored, [])).not.toBe(stored);
  });
});

describe('the whole point: dismiss, re-block, come free again', () => {
  it('notifies again after a genuine re-block and re-arrive', () => {
    const free = job();

    // 1. Parts turn up. The banner names it.
    expect(noticeJobs([free], []).map(j => j.job)).toEqual([1679]);

    // 2. He clicks ✕.
    const afterDismiss = dismissAll([free], []);
    expect(afterDismiss).toEqual(['1679']);

    // 3. Next import, still free, still dismissed — no nag.
    expect(noticeJobs([free], afterDismiss)).toEqual([]);

    // 4. Something else breaks; Multitrack puts it back on Waiting. The stored
    //    dismissal has nothing left to suppress and is pruned away.
    const blocked = reBlocked(free);
    expect(noticeJobs([blocked], afterDismiss)).toEqual([]);
    const afterPrune = pruneDismissed(afterDismiss, [blocked]);
    expect(afterPrune).toEqual([]);

    // 5. The new parts arrive. It notifies again.
    expect(noticeJobs([free], afterPrune).map(j => j.job)).toEqual([1679]);
  });

  it('does NOT notify again if the dismissal was never pruned in between', () => {
    // The guard on step 4 above: without the prune, the same dismissal would
    // still be sitting there and the second arrival would go unannounced. This
    // is why pruning is a real step and not tidy-up.
    const stale = ['1679'];
    expect(noticeJobs([job()], stale)).toEqual([]);
  });
});
