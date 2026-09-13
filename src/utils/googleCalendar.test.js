import { describe, it, expect } from 'vitest';
import { buildEventDescription } from './googleCalendar.js';

// Brief E, Round 3, item 3 — stop "Bench: null" reaching Google Calendar.
//
// Blocked jobs carry bench: null. Writing that straight into the event
// description produced a literal "Bench: null" line, which reads like a bug
// to anyone glancing at the calendar. Omit the bench line entirely instead.
describe('buildEventDescription', () => {
  it('includes the bench line for a job with a bench', () => {
    expect(buildEventDescription({ bench: 'Luthier', desc: 'restring' }))
      .toBe('Bench: Luthier\nDesc: restring');
  });

  it('omits the bench line entirely for a bench-less (blocked) job', () => {
    expect(buildEventDescription({ bench: null, desc: 'awaiting parts' }))
      .toBe('Desc: awaiting parts');
  });

  it('omits the bench line for an undefined bench too', () => {
    expect(buildEventDescription({ desc: 'no bench field' }))
      .toBe('Desc: no bench field');
  });
});
