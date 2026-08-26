import { describe, it, expect } from 'vitest';
import { buildPdfImportPlan, buildNewJob, applyPdfFields, MULTITRACK_DEPARTURE_SOURCE } from './pdfImportPlan.js';

// The unfiltered read of the jobs table that the importer now requires before
// it will depart anything. `[{ id, departedAt }]` — departedAt null means the
// job is on the board, a timestamp means it departed on an earlier printout.
const known = (...ids) => ids.map(id => ({ id: String(id), departedAt: null }));
const knownDeparted = (...ids) => ids.map(id => ({ id: String(id), departedAt: '2026-07-01T00:00:00Z' }));

const parsedJob = (ref, over = {}) => ({
  ref,
  customer: 'Dave Smith',
  manufacturer: 'Fender',
  model: 'Strat',
  status: 'Active',
  fault: 'Fret buzz on the low E',
  ...over,
});

// A job already on the board, with every one of Trevor's hand-kept fields set,
// so the tests can prove none of them are carried into a write.
const boardJob = (id, over = {}) => ({
  id, job: id, parentId: null, isDerived: false,
  customer: 'Old Name', mfr: 'Fender', model: 'Strat',
  status: 'Waiting', desc: 'old description',
  tag: 'M', hours: 4.5, action: 'CI', vb: true, backlog: true,
  bench: 'Luthier', days: 30,
  ...over,
});

describe('buildPdfImportPlan — the count sanity check', () => {
  it('refuses when the PDF never stated a count', () => {
    const plan = buildPdfImportPlan({ parsed: [parsedJob('1601')], statedCount: null });
    expect(plan.ok).toBe(false);
    expect(plan.error).toMatch(/Jobs found/);
  });

  it('refuses when fewer rows were read than the PDF claims', () => {
    const plan = buildPdfImportPlan({ parsed: [parsedJob('1601')], statedCount: 46 });
    expect(plan.ok).toBe(false);
    expect(plan.error).toMatch(/46 jobs but only 1/);
  });

  it('refuses when the same job number appears twice', () => {
    const plan = buildPdfImportPlan({
      parsed: [parsedJob('1601'), parsedJob('1601')], statedCount: 2,
    });
    expect(plan.ok).toBe(false);
    expect(plan.error).toMatch(/1601/);
  });

  it('proceeds when the count matches exactly', () => {
    const plan = buildPdfImportPlan({ parsed: [parsedJob('1601')], statedCount: 1 });
    expect(plan.ok).toBe(true);
  });
});

describe('buildPdfImportPlan — the three counts and two lists', () => {
  const parsed = [parsedJob('1601'), parsedJob('1602'), parsedJob('1603')];
  const jobs = [boardJob('1602'), boardJob('1603'), boardJob('1700')];
  const plan = buildPdfImportPlan({
    parsed, statedCount: 3, jobs, filename: 'jobs.pdf',
    knownJobIds: known('1602', '1603', '1700'),
  });

  it('counts brand-new jobs and names them', () => {
    expect(plan.newJobs.map(j => j.id)).toEqual(['1601']);
    expect(plan.newLabels[0].label).toBe('#1601 Fender Strat — Dave Smith');
  });

  it('counts jobs already on the board', () => {
    expect(plan.existingCount).toBe(2);
  });

  it('names the jobs that were on the board but are not in this drop', () => {
    expect(plan.missing.map(m => m.id)).toEqual(['1700']);
  });

  it('departs a job that dropped off the printout — but never through the PDF field writer', () => {
    // The six-field writer must not be the thing that departs a job. The
    // departure is its own write, with its own allow-list and its own gate.
    expect(plan.writes.map(w => w.id).sort()).toEqual(['1601', '1602', '1603']);
    expect(plan.writes.some(w => w.id === '1700')).toBe(false);
    expect(plan.departures.map(d => d.id)).toEqual(['1700']);
  });
});

// Checklist item 7, the regression guard. This failure mode is silent and
// destructive: nothing on screen would look wrong afterwards, the jobs would
// simply be gone.
describe('buildPdfImportPlan — no job that IS on the printout ever departs', () => {
  it('departs nothing when every board job is on the printout', () => {
    const parsed = [parsedJob('1601'), parsedJob('1602')];
    const jobs = [boardJob('1601'), boardJob('1602')];
    const plan = buildPdfImportPlan({
      parsed, statedCount: 2, jobs, knownJobIds: known('1601', '1602'),
    });
    expect(plan.departures).toEqual([]);
    expect(plan.missing).toEqual([]);
  });

  it('departs only the board jobs absent from the printout, never a listed one', () => {
    const parsed = [parsedJob('1601'), parsedJob('1602'), parsedJob('1603')];
    const jobs = [boardJob('1601'), boardJob('1602'), boardJob('1603'), boardJob('1700'), boardJob('1701')];
    const plan = buildPdfImportPlan({
      parsed, statedCount: 3, jobs, knownJobIds: known('1601', '1602', '1603', '1700', '1701'),
    });
    expect(plan.departures.map(d => d.id).sort()).toEqual(['1700', '1701']);
    const printedIds = parsed.map(p => p.ref);
    for (const d of plan.departures) {
      expect(printedIds).not.toContain(d.id);
    }
  });

  it("never departs the app's own split cards — they are not Multitrack's to drop", () => {
    const jobs = [
      boardJob('1620'),
      { ...boardJob('1620_Electronics_0'), parentId: '1620' },
      { ...boardJob('1689_Luthier_1'), isDerived: true, parentId: null },
    ];
    const plan = buildPdfImportPlan({
      parsed: [parsedJob('1620')], statedCount: 1, jobs, knownJobIds: known('1620'),
    });
    expect(plan.departures).toEqual([]);
  });
});

// Checklist item 6 — a PDF that fails the count check must depart NOTHING.
// This is the only refusal standing between a misread file and jobs vanishing,
// so it is worth proving it stops departures specifically, not just writes.
describe('buildPdfImportPlan — a refused PDF departs nothing', () => {
  const jobs = [boardJob('1601'), boardJob('1700')];
  const args = { jobs, knownJobIds: known('1601', '1700') };

  it('a count mismatch returns no plan at all, so there is nothing to depart', () => {
    const plan = buildPdfImportPlan({ parsed: [parsedJob('1601')], statedCount: 46, ...args });
    expect(plan.ok).toBe(false);
    expect(plan.departures).toBeUndefined();
    expect(plan.writes).toBeUndefined();
  });

  it('a missing stated count returns no plan either', () => {
    const plan = buildPdfImportPlan({ parsed: [parsedJob('1601')], statedCount: null, ...args });
    expect(plan.ok).toBe(false);
    expect(plan.departures).toBeUndefined();
  });

  it('a duplicated job number returns no plan either', () => {
    const plan = buildPdfImportPlan({
      parsed: [parsedJob('1601'), parsedJob('1601')], statedCount: 2, ...args,
    });
    expect(plan.ok).toBe(false);
    expect(plan.departures).toBeUndefined();
  });
});

// Council amendment 1 — the return path. This is the one the original brief
// would have shipped broken.
describe('buildPdfImportPlan — a departed job number coming back', () => {
  const parsed = [parsedJob('1619')];
  // 1619 is NOT on the board (normalizeJobsFromDb filtered it out), but its row
  // is very much still in the table, carrying every field Trevor put on it.
  const plan = buildPdfImportPlan({
    parsed, statedCount: 1, jobs: [], knownJobIds: knownDeparted('1619'),
  });

  it('is recognised as returning, not as a brand-new job', () => {
    expect(plan.returning.map(r => r.id)).toEqual(['1619']);
    expect(plan.newJobs).toEqual([]);
  });

  it('clears departed_at on the way back in', () => {
    const write = plan.writes.find(w => w.id === '1619');
    expect(write.isReturning).toBe(true);
    expect(write.isNew).toBeFalsy();
    expect('departedAt' in write.data).toBe(true);
    expect(write.data.departedAt).toBeNull();
  });

  it('does not send bench or hours, so the fields on the row survive', () => {
    // buildNewJob() would have guessed a bench from the description and reset
    // hours to 1 or 0. That is what strands the real values.
    const write = plan.writes.find(w => w.id === '1619');
    expect(Object.keys(write.data).sort())
      .toEqual(['customer', 'departedAt', 'desc', 'done', 'job', 'mfr', 'model', 'status']);
  });

  // Trevor's rule: a completed job never comes back — returning work is rebooked
  // under a new number. So a reappearing job number is live work by definition,
  // and a stale `done` from before it departed must not survive the round trip.
  // Left set, the job reappears on the Jobs Sheet but stays invisible on the
  // Jobs page, which filters `!j.done`.
  it('clears done, so a job that was marked done before it departed comes back live', () => {
    const write = plan.writes.find(w => w.id === '1619');
    expect(write.data.done).toBe(false);
  });

  it('is not counted as departing, even though it is not on the board', () => {
    expect(plan.departures).toEqual([]);
  });

  it('treats an unknown job number as genuinely new', () => {
    const fresh = buildPdfImportPlan({
      parsed: [parsedJob('1999')], statedCount: 1, jobs: [], knownJobIds: knownDeparted('1619'),
    });
    expect(fresh.newJobs.map(j => j.id)).toEqual(['1999']);
    expect(fresh.returning).toEqual([]);
  });
});

// Without a trustworthy unfiltered read, departing is not safe at any price:
// an empty list reads as "every job on the board is missing from this printout".
describe('buildPdfImportPlan — no unfiltered read, no departures', () => {
  const parsed = [parsedJob('1601')];
  const jobs = [boardJob('1601'), boardJob('1700')];

  it('departs nothing when knownJobIds was not supplied', () => {
    const plan = buildPdfImportPlan({ parsed, statedCount: 1, jobs });
    expect(plan.canDepart).toBe(false);
    expect(plan.departures).toEqual([]);
    expect(plan.missing).toEqual([]);
  });

  it('still imports the printout normally', () => {
    const plan = buildPdfImportPlan({ parsed, statedCount: 1, jobs });
    expect(plan.ok).toBe(true);
    expect(plan.existingCount).toBe(1);
  });
});

// Council amendment 3a — the calendar ids have to be captured while the job is
// still on the board, because after departure it is filtered out of jobs[] and
// they are unreachable from memory.
describe('buildPdfImportPlan — a departing job carries its calendar bookings out', () => {
  it('captures gcalEventIds from the departing job', () => {
    const jobs = [boardJob('1700', { gcalEventIds: ['ev1', 'ev2'], gcalEventId: 'ev1' })];
    const plan = buildPdfImportPlan({
      parsed: [parsedJob('1601')], statedCount: 1, jobs, knownJobIds: known('1700'),
    });
    expect(plan.departures[0].gcalEventIds).toEqual(['ev1', 'ev2']);
  });

  it('falls back to the older single gcalEventId', () => {
    const jobs = [boardJob('1700', { gcalEventIds: [], gcalEventId: 'solo' })];
    const plan = buildPdfImportPlan({
      parsed: [parsedJob('1601')], statedCount: 1, jobs, knownJobIds: known('1700'),
    });
    expect(plan.departures[0].gcalEventIds).toEqual(['solo']);
  });

  it('is an empty list for a job that was never on the calendar', () => {
    const jobs = [boardJob('1700')];
    const plan = buildPdfImportPlan({
      parsed: [parsedJob('1601')], statedCount: 1, jobs, knownJobIds: known('1700'),
    });
    expect(plan.departures[0].gcalEventIds).toEqual([]);
  });
});

// Council amendment 6 — the Jobs-by-Age gate, at code level.
describe('buildPdfImportPlan — the departure token', () => {
  it('stamps the Multitrack token on its plan', () => {
    const plan = buildPdfImportPlan({ parsed: [parsedJob('1601')], statedCount: 1 });
    expect(plan.departureSource).toBe(MULTITRACK_DEPARTURE_SOURCE);
  });
});

describe("buildPdfImportPlan — the app's own split cards", () => {
  it('never matches, writes or counts them', () => {
    const jobs = [
      boardJob('1620'),
      { ...boardJob('1620_Electronics_0'), parentId: '1620' },
      { ...boardJob('1620_Luthier_1'), isDerived: true, parentId: null },
    ];
    const plan = buildPdfImportPlan({ parsed: [parsedJob('1620')], statedCount: 1, jobs });
    expect(plan.existingCount).toBe(1);
    expect(plan.newJobs).toHaveLength(0);
    expect(plan.missing).toHaveLength(0);
    expect(plan.writes.map(w => w.id)).toEqual(['1620']);
  });
});

describe('buildPdfImportPlan — what gets written', () => {
  it('sends only the six PDF fields for a job already on the board', () => {
    const plan = buildPdfImportPlan({
      parsed: [parsedJob('1602')], statedCount: 1, jobs: [boardJob('1602')],
    });
    const write = plan.writes[0];
    expect(write.isNew).toBe(false);
    expect(Object.keys(write.data).sort())
      .toEqual(['customer', 'desc', 'job', 'mfr', 'model', 'status']);
  });

  it('adds bench and hours for a brand-new job, and nothing else', () => {
    const plan = buildPdfImportPlan({ parsed: [parsedJob('1601')], statedCount: 1 });
    const write = plan.writes[0];
    expect(write.isNew).toBe(true);
    expect(Object.keys(write.data).sort())
      .toEqual(['bench', 'customer', 'desc', 'hours', 'job', 'mfr', 'model', 'status']);
  });

  it("never sends Trevor's hand-kept fields, even though the board job has them", () => {
    const plan = buildPdfImportPlan({
      parsed: [parsedJob('1602')], statedCount: 1, jobs: [boardJob('1602')],
    });
    for (const field of ['tag', 'hours', 'action', 'vb', 'backlog', 'bl', 'days', 'bench']) {
      expect(Object.keys(plan.writes[0].data)).not.toContain(field);
    }
  });
});

describe('buildNewJob', () => {
  it('infers a bench from the PDF description', () => {
    const job = buildNewJob(parsedJob('1601', { fault: 'Full refret and new nut' }));
    expect(job.bench).toBeTruthy();
  });

  it('gives a schedulable job the one-hour default', () => {
    const job = buildNewJob(parsedJob('1601', { status: 'Active' }));
    expect(job.schedulable).toBe(true);
    expect(job.hours).toBe(1);
  });

  it('leaves a blocked job at zero hours rather than guessing', () => {
    const job = buildNewJob(parsedJob('1601', { status: 'Waiting' }));
    expect(job.hours).toBe(0);
  });

  it('starts Tag, Action, VB and BL visibly empty — the PDF does not carry them', () => {
    const job = buildNewJob(parsedJob('1601'));
    expect(job.tag).toBeNull();
    expect(job.action).toBeNull();
    expect(job.vb).toBe(false);
    expect(job.backlog).toBe(false);
  });

  it('is not scheduled and has no calendar slot', () => {
    const job = buildNewJob(parsedJob('1601'));
    expect(job.scheduled).toBe(false);
    expect(job.calendarSlot).toBeNull();
  });
});

describe('applyPdfFields', () => {
  const merged = applyPdfFields(boardJob('1602'), parsedJob('1602'));

  it('refreshes the six PDF fields', () => {
    expect(merged.customer).toBe('Dave Smith');
    expect(merged.desc).toBe('Fret buzz on the low E');
    expect(merged.status).toBe('Active');
  });

  it("leaves Trevor's fields exactly as they were", () => {
    expect(merged.tag).toBe('M');
    expect(merged.hours).toBe(4.5);
    expect(merged.action).toBe('CI');
    expect(merged.vb).toBe(true);
    expect(merged.backlog).toBe(true);
    expect(merged.bench).toBe('Luthier');
    expect(merged.days).toBe(30);
  });

  it('re-derives the status flags so the job moves pile straight away', () => {
    // Board job was Waiting (blocked). The PDF says Active, so the STATUS flag
    // flips immediately rather than after the next reload — status from the PDF
    // always wins, because it is what drives the pile colours.
    expect(merged.status).toBe('Active');
    expect(merged.awaiting).toBe(false);
    expect(merged.inTransit).toBe(false);
    // ...but this fixture also carries VB=Y and BL=Y, and as of 2026-08-05 both
    // block. The guitar is not in the shop, so an Active status cannot make it
    // workable. Was asserting `schedulable === true`.
    expect(merged.vb).toBe(true);
    expect(merged.schedulable).toBe(false);
  });

  it("still respects an action Trevor set, which the PDF cannot see", () => {
    // INC means "still being planned". The PDF saying Active must not drag
    // the job out of the planning pile — the action is Trevor's, not
    // Multitrack's, and it stays in charge.
    const planning = applyPdfFields(boardJob('1602', { action: 'INC' }), parsedJob('1602'));
    expect(planning.schedulable).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// A job closed on the week page this week survives the week
// ---------------------------------------------------------------------------
//
// Multitrack drops a job off its printout the moment it is invoiced. Trevor
// closes that same job on the week page. Without the hold-back, the very next
// import departs it and the week page loses the row he just closed — the week's
// own record of what got finished disappears halfway through the week.
//
// The mark lives in bench_week_marks under the job id as the single key
// `close:<that week's Monday>`, beside the seven day keys. These tests pin that
// format, because the plan builder writes the key out inline rather than
// importing weekCloseKey() from the week page component.
describe('buildPdfImportPlan — a job closed this week is held back', () => {
  const MONDAY = '2026-08-24';
  const LAST_MONDAY = '2026-08-17';
  // The printout no longer lists 1700, so 1700 would normally depart.
  const parsed = [parsedJob('1601')];
  const jobs = [boardJob('1601'), boardJob('1700')];
  const knownIds = known('1601', '1700');

  const planWith = (weekMarks, weekMonday = MONDAY) => buildPdfImportPlan({
    parsed, statedCount: 1, jobs, knownJobIds: knownIds, weekMarks, weekMonday,
  });

  it('holds back a job carrying this week\'s close mark', () => {
    const plan = planWith({ '1700': { [`close:${MONDAY}`]: 'closed' } });
    // Council amendment 5: it leaves BOTH lists. missing[] is what Trevor sees
    // on the preview and departures[] is what the writer acts on, so a job in
    // one and not the other would either depart invisibly or be listed as
    // leaving and then not leave.
    expect(plan.departures).toEqual([]);
    expect(plan.missing).toEqual([]);
    // And nothing else about the plan changes — the hold-back only ever removes
    // a job from the departure lists.
    expect(plan.canDepart).toBe(true);
    expect(plan.existingCount).toBe(1);
  });

  it('departs a job whose close mark is from a previous week', () => {
    // This is the whole point of keying on the Monday: the hold-back expires by
    // itself when the week rolls over. Nothing has to clear the old mark.
    const plan = planWith({ '1700': { [`close:${LAST_MONDAY}`]: 'closed' } });
    expect(plan.departures.map(d => d.id)).toEqual(['1700']);
    expect(plan.missing.map(m => m.id)).toEqual(['1700']);
  });

  it('does not let a mark under a different job id hold back this one', () => {
    // 1601 is on the printout and closed this week; 1700 is not marked at all.
    // A lookup that checked "is there any close mark this week" rather than
    // "does THIS job have one" would hold back the wrong job.
    const plan = planWith({ '1601': { [`close:${MONDAY}`]: 'closed' } });
    expect(plan.departures.map(d => d.id)).toEqual(['1700']);
    expect(plan.missing.map(m => m.id)).toEqual(['1700']);
  });

  it('leaves a marked job that is still on the printout completely alone', () => {
    // 1601 is closed this week AND still listed. It was never departing, so the
    // hold-back has nothing to do — it must still be a normal update.
    const plan = planWith({ '1601': { [`close:${MONDAY}`]: 'closed' } });
    expect(plan.existingCount).toBe(1);
    expect(plan.updates.map(u => String(u.current.id))).toEqual(['1601']);
    expect(plan.writes.some(w => w.id === '1601' && w.isNew === false)).toBe(true);
  });

  it('ignores day marks, which are not close marks', () => {
    // The seven day keys sit under the same job id. A × meaning "I worked on
    // this on Wednesday" is not a × meaning "this guitar is finished".
    const plan = planWith({ '1700': { '2026-08-26': 'x', '2026-08-25': 'x' } });
    expect(plan.departures.map(d => d.id)).toEqual(['1700']);
  });

  // Council amendment 4. Deliberately NOT the knownJobIds rule, where a failed
  // read blocks every departure: a missing marks table must not freeze the
  // board, it just means nothing is held back.
  it.each([
    ['null', null],
    ['undefined', undefined],
    ['an empty object', {}],
  ])('departs normally when the marks are %s', (_label, weekMarks) => {
    const plan = planWith(weekMarks);
    expect(plan.departures.map(d => d.id)).toEqual(['1700']);
    expect(plan.missing.map(m => m.id)).toEqual(['1700']);
  });

  it('departs normally when no Monday was supplied', () => {
    // No Monday means no close key can be built, so there is nothing to match
    // against and the import behaves exactly as it did before this build.
    const plan = planWith({ '1700': { [`close:${MONDAY}`]: 'closed' } }, null);
    expect(plan.departures.map(d => d.id)).toEqual(['1700']);
  });

  it('still departs nothing at all when canDepart is false, marks or no marks', () => {
    // The knownJobIds gate is upstream of the hold-back and stays absolute: a
    // failed unfiltered read departs nothing, whatever the marks say. Proven
    // both with a mark and without, so neither path can leak a departure.
    for (const weekMarks of [null, { '1700': { [`close:${MONDAY}`]: 'closed' } }]) {
      const plan = buildPdfImportPlan({
        parsed, statedCount: 1, jobs, knownJobIds: null, weekMarks, weekMonday: MONDAY,
      });
      expect(plan.canDepart).toBe(false);
      expect(plan.departures).toEqual([]);
      expect(plan.missing).toEqual([]);
    }
  });
});
