import { describe, it, expect } from 'vitest';
import {
  TAG_HOURS,
  TAG_OPTIONS,
  ACTION_OPTIONS,
  SHEET_EDITABLE_FIELDS,
  withLegacyOption,
  hoursForTag,
  parseHoursInput,
  isHoursInputInvalid,
  initialRowDraft,
  applyTagToDraft,
  draftChanges,
  buildSheetWrites,
  applySheetEdits,
} from './jobsSheet.js';
import { APP_OWNED_JOB_FIELDS } from './joinJobs.js';

// Brief G, Build 1b — the Jobs Sheet's rules.
//
// These are the parts that can go wrong quietly: a tag filling in the wrong
// number of hours, a range like "2-4" being read as a typo and thrown away, or
// a Commit writing a column Trevor never touched. None of that would throw an
// error — it would just leave the wrong number on a job.

const job = (over = {}) => ({
  id: '1601', job: '1601', customer: 'Dave', mfr: 'Fender', model: 'Strat',
  status: 'Active', desc: 'Fret buzz',
  tag: null, hours: null, action: null, vb: false, backlog: false, project: false,
  ...over,
});

describe('Tag → Hours bands', () => {
  // The corrected order: EZ ≤1.5, M ≤3, T ≤5.5, H above. M and T were the
  // wrong way round everywhere until this build.
  it('offers the agreed hours for each tag', () => {
    expect(TAG_HOURS).toEqual({ EZ: 1.5, M: 3, T: 5.5, H: 6 });
    expect(hoursForTag('EZ')).toBe(1.5);
    expect(hoursForTag('M')).toBe(3);
    expect(hoursForTag('T')).toBe(5.5);
    expect(hoursForTag('H')).toBe(6);
  });

  it('has no opinion when there is no tag, or a tag it does not know', () => {
    expect(hoursForTag('')).toBeNull();
    expect(hoursForTag(null)).toBeNull();
    expect(hoursForTag('SKP')).toBeNull();
  });

  it('fills the hours box in when a tag is picked', () => {
    const d = initialRowDraft(job());
    expect(applyTagToDraft(d, 'M').hoursText).toBe('3');
    expect(applyTagToDraft(d, 'T').hoursText).toBe('5.5');
  });

  it('does not wipe an estimate when the tag is cleared or unknown', () => {
    const d = initialRowDraft(job({ hours: 4 }));
    expect(applyTagToDraft(d, '').hoursText).toBe('4');
    expect(applyTagToDraft(d, '').tag).toBe('');
    expect(applyTagToDraft(d, 'SKP').hoursText).toBe('4');
  });

  it('leaves the filled-in hours hand-overridable', () => {
    const tagged = applyTagToDraft(initialRowDraft(job()), 'H');
    const typed = { ...tagged, hoursText: '8' };
    expect(draftChanges(job(), typed)).toEqual({ tag: 'H', hours: 8 });
  });
});

describe('Hours box', () => {
  it('averages a range, which is how Trevor estimates', () => {
    expect(parseHoursInput('2-4')).toBe(3);
    expect(parseHoursInput('2 - 3')).toBe(2.5);
    expect(parseHoursInput('1-2.5')).toBe(1.75);
  });

  it('takes a plain number', () => {
    expect(parseHoursInput('3')).toBe(3);
    expect(parseHoursInput(' 5.5 ')).toBe(5.5);
  });

  it('treats blank as "not estimated", not as zero', () => {
    expect(parseHoursInput('')).toBeNull();
    expect(parseHoursInput('   ')).toBeNull();
    expect(isHoursInputInvalid('')).toBe(false);
  });

  it('flags a typo instead of guessing at it', () => {
    expect(isHoursInputInvalid('abc')).toBe(true);
    expect(isHoursInputInvalid('2--4')).toBe(true);
    expect(isHoursInputInvalid('-3')).toBe(true);
  });

  it('never blanks a real estimate because the box is mid-typing', () => {
    const j = job({ hours: 4 });
    const d = { ...initialRowDraft(j), hoursText: '2-' };
    expect(draftChanges(j, d)).toEqual({});
  });

  it('does not count a retyped equivalent as a change', () => {
    const j = job({ hours: 3 });
    expect(draftChanges(j, { ...initialRowDraft(j), hoursText: '3.0' })).toEqual({});
    expect(draftChanges(j, { ...initialRowDraft(j), hoursText: '2-4' })).toEqual({});
  });
});

describe('legacy values the pickers do not offer', () => {
  // SKP sits on jobs 182/321/592/1268 and Trevor has decided to keep it.
  // Nothing branches on it — it just has to survive being looked at.
  it('shows a value the list does not contain rather than dropping it', () => {
    expect(withLegacyOption(TAG_OPTIONS, 'SKP')).toContain('SKP');
    expect(withLegacyOption(ACTION_OPTIONS, 'ZZZ')).toContain('ZZZ');
  });

  it('leaves the list alone for values it already offers', () => {
    expect(withLegacyOption(TAG_OPTIONS, 'M')).toBe(TAG_OPTIONS);
    expect(withLegacyOption(TAG_OPTIONS, '')).toBe(TAG_OPTIONS);
  });

  it('opening and closing the page does not rewrite a legacy tag', () => {
    const j = job({ tag: 'SKP' });
    expect(draftChanges(j, initialRowDraft(j))).toEqual({});
    expect(buildSheetWrites([j], { [j.id]: initialRowDraft(j) })).toEqual([]);
  });
});

describe('what a Commit actually writes', () => {
  it('writes only the columns that changed', () => {
    const j = job({ hours: 3, action: 'GTS' });
    const d = { ...initialRowDraft(j), action: 'INC' };
    expect(buildSheetWrites([j], { [j.id]: d })).toEqual([
      { id: '1601', data: { action: 'INC', job: '1601' } },
    ]);
  });

  it('carries `job` on every row, because the column is NOT NULL', () => {
    const a = job({ id: '1601', job: '1601' });
    const b = job({ id: '1602', job: '1602' });
    const writes = buildSheetWrites([a, b], {
      '1601': { ...initialRowDraft(a), vb: true },
      '1602': { ...initialRowDraft(b), hoursText: '2-4' },
    });
    expect(writes).toHaveLength(2);
    for (const w of writes) expect(w.data.job).toBe(w.id);
  });

  it('skips rows nobody touched', () => {
    const j = job({ tag: 'M', hours: 3 });
    expect(buildSheetWrites([j], { [j.id]: initialRowDraft(j) })).toEqual([]);
    expect(buildSheetWrites([j], {})).toEqual([]);
  });

  it('clears a field to null rather than an empty string', () => {
    const j = job({ tag: 'M', action: 'INC' });
    const d = { ...initialRowDraft(j), tag: '', action: '' };
    expect(draftChanges(j, d)).toEqual({ tag: null, action: null });
  });

  it('never writes a column outside the six the app owns', () => {
    const j = job({ tag: 'M', hours: 3, action: 'GTS', vb: true, backlog: true, project: true });
    const d = { tag: 'H', hoursText: '6', action: 'CI', vb: false, backlog: false, project: false };
    const [write] = buildSheetWrites([j], { [j.id]: d });
    const columns = Object.keys(write.data).filter(k => k !== 'job');
    expect(columns.sort()).toEqual([...SHEET_EDITABLE_FIELDS].sort());
    // Same six the CSV path was told to stop writing.
    expect([...SHEET_EDITABLE_FIELDS].sort()).toEqual([...APP_OWNED_JOB_FIELDS].sort());
  });
});

describe('the board after a Commit', () => {
  // Action and BL feed the Ready / Waiting piles, and those are worked out in
  // memory, not stored. Our own writes mute the realtime echo for five
  // seconds, so the page has to re-derive them itself.
  it('moves a job out of the schedulable pile when it goes on hold with INC', () => {
    const j = { ...job({ status: 'Waiting', schedulable: true, awaiting: false }) };
    const after = applySheetEdits(j, { action: 'INC', job: '1601' });
    expect(after.action).toBe('INC');
    expect(after.awaiting).toBe(true);
    expect(after.schedulable).toBe(false);
  });

  // Replaces a test that asserted ticking BL "graduated" an On Hold + GTS job
  // to ready. That was the readyToStart rule, deleted 2026-08-05 — Trevor:
  // "that would never happen." On Hold stays on hold.
  it('keeps an On Hold + GTS job unschedulable when BL is ticked', () => {
    const j = job({ status: 'On Hold', action: 'GTS', backlog: false, schedulable: false });
    const after = applySheetEdits(j, { backlog: true, job: '1601' });
    expect(after.readyToStart).toBeUndefined();
    expect(after.schedulable).toBe(false);
  });

  // VB is one of the six editable boxes and now blocks the job, so the page has
  // to re-derive schedulable itself — the realtime echo that would otherwise do
  // it is muted for five seconds after our own write.
  it('takes a job out of the schedulable pile the moment VB is ticked', () => {
    const j = job({ status: 'Active', action: 'GTS', vb: false, schedulable: true });
    const after = applySheetEdits(j, { vb: true, job: '1601' });
    expect(after.vb).toBe(true);
    expect(after.schedulable).toBe(false);
  });

  it('does not put the NOT NULL passenger `job` into the board state', () => {
    const j = job();
    const after = applySheetEdits(j, { hours: 3, job: '1601' });
    expect(after.hours).toBe(3);
    expect(after.job).toBe('1601'); // unchanged, straight off the original job
  });
});
