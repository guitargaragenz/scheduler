import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  hasParkingLotTag,
  stripParkingLotTag,
  buildParkingLotItemFromBullet,
  fileBulletToParkingLot,
} from './parkingLotTag.js';

// Merge B of docs/briefs/one-parking-lot-fed-from-bujo.md — the `#PL` tag.

describe('hasParkingLotTag — fires only on a real #PL', () => {
  it('fires on a bare #PL', () => {
    expect(hasParkingLotTag('#PL')).toBe(true);
  });

  it('fires on lowercase #pl and mixed case', () => {
    expect(hasParkingLotTag('#pl sort the bench lighting')).toBe(true);
    expect(hasParkingLotTag('#Pl sort the bench lighting')).toBe(true);
  });

  it('fires mid-sentence', () => {
    expect(hasParkingLotTag('get a second soldering station #PL for the meeting')).toBe(true);
  });

  it('fires when the tag is the last thing on the line', () => {
    expect(hasParkingLotTag('get a second soldering station #PL')).toBe(true);
  });

  it('fires when followed by punctuation', () => {
    expect(hasParkingLotTag('new bench idea #PL.')).toBe(true);
    expect(hasParkingLotTag('new bench idea (#PL)')).toBe(true);
  });

  // The whole reason a word boundary is required.
  it('does NOT fire on #PLAN', () => {
    expect(hasParkingLotTag('write up the #PLAN for August')).toBe(false);
  });

  it('does NOT fire on #PLASTIC', () => {
    expect(hasParkingLotTag('order #PLASTIC nut blanks')).toBe(false);
  });

  it('does NOT fire on #PLANNING or #plan', () => {
    expect(hasParkingLotTag('#PLANNING')).toBe(false);
    expect(hasParkingLotTag('#plan the week')).toBe(false);
  });

  it('does NOT fire on plain PL with no hash', () => {
    expect(hasParkingLotTag('PL is not a tag')).toBe(false);
  });

  it('does NOT fire on an untagged bullet', () => {
    expect(hasParkingLotTag('restring the Tele')).toBe(false);
  });

  it('handles non-string input without throwing', () => {
    expect(hasParkingLotTag(null)).toBe(false);
    expect(hasParkingLotTag(undefined)).toBe(false);
    expect(hasParkingLotTag(42)).toBe(false);
  });

  // A shared /g/ regex would carry lastIndex between calls and make the
  // answer depend on how many times it had been asked before.
  it('gives the same answer when asked repeatedly', () => {
    expect(hasParkingLotTag('idea #PL')).toBe(true);
    expect(hasParkingLotTag('idea #PL')).toBe(true);
    expect(hasParkingLotTag('idea #PL')).toBe(true);
  });
});

describe('stripParkingLotTag — the Parking Lot title', () => {
  it('removes the tag and tidies the spacing', () => {
    expect(stripParkingLotTag('#PL new soldering station')).toBe('new soldering station');
    expect(stripParkingLotTag('new soldering station #PL')).toBe('new soldering station');
    expect(stripParkingLotTag('new #PL soldering station')).toBe('new soldering station');
  });

  it('removes every occurrence, not just the first', () => {
    expect(stripParkingLotTag('#PL bench idea #pl')).toBe('bench idea');
  });

  it('leaves a #PLAN in place', () => {
    expect(stripParkingLotTag('write the #PLAN #PL')).toBe('write the #PLAN');
  });

  it('returns an empty string for a bullet that is only the tag', () => {
    expect(stripParkingLotTag('#PL')).toBe('');
    expect(stripParkingLotTag('  #PL  ')).toBe('');
  });
});

describe('buildParkingLotItemFromBullet — matches the stored shape', () => {
  it('builds { id, date, title, details, status } with an empty details and open status', () => {
    const item = buildParkingLotItemFromBullet('#PL second soldering station', {
      dateKey: '2026-08-03',
      makeId: () => 'pk-test1',
    });
    expect(item).toEqual({
      id: 'pk-test1',
      date: '2026-08-03',
      title: 'second soldering station',
      details: '',
      status: 'open',
    });
  });

  it('generates a pk- prefixed id by default, matching the Parking Lot page', () => {
    const item = buildParkingLotItemFromBullet('#PL idea', { dateKey: '2026-08-03' });
    expect(item.id).toMatch(/^pk-/);
  });
});

describe('fileBulletToParkingLot — the write itself', () => {
  const configured = () => true;

  it('saves exactly one item, with no baseline, so nothing is ever deleted', async () => {
    const save = vi.fn().mockResolvedValue({ ok: true });
    await fileBulletToParkingLot('#PL second soldering station', {
      save, isConfigured: configured, dateKey: '2026-08-03', makeId: () => 'pk-test1',
    });
    expect(save).toHaveBeenCalledTimes(1);
    // One argument only — saveParkingLot's `baseline` defaults to [], which
    // deletes nothing whatever the table holds.
    expect(save.mock.calls[0].length).toBe(1);
    expect(save.mock.calls[0][0]).toEqual([{
      id: 'pk-test1', date: '2026-08-03', title: 'second soldering station',
      details: '', status: 'open',
    }]);
  });

  it('writes nothing when Supabase is not configured', async () => {
    const save = vi.fn();
    await fileBulletToParkingLot('#PL idea', { save, isConfigured: () => false });
    expect(save).not.toHaveBeenCalled();
  });

  it('writes nothing when the bullet is only the tag', async () => {
    const save = vi.fn();
    await fileBulletToParkingLot('#PL', { save, isConfigured: configured });
    expect(save).not.toHaveBeenCalled();
  });
});

// Council amendment F. The daily-log save was hardened after the 2026-07-05
// whole-store overwrite; a Parking Lot failure must never be able to reach it.
// addBullet calls this without awaiting, so the guarantee it needs is that the
// call neither throws synchronously nor produces a rejected promise — an
// unhandled rejection here would be a crash in the app, not a logged warning.
describe('fileBulletToParkingLot — a failure never escapes', () => {
  const configured = () => true;

  it('swallows a rejected write and reports it instead', async () => {
    const onError = vi.fn();
    const save = vi.fn().mockRejectedValue(new Error('supabase down'));
    const result = await fileBulletToParkingLot('#PL idea', { save, isConfigured: configured, onError });
    expect(result).toBe(null);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('swallows a writer that throws synchronously', async () => {
    const onError = vi.fn();
    const save = vi.fn(() => { throw new Error('client blew up'); });
    let threw = false;
    let promise;
    try {
      promise = fileBulletToParkingLot('#PL idea', { save, isConfigured: configured, onError });
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
    await expect(promise).resolves.toBe(null);
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('swallows a throwing isConfigured()', async () => {
    const onError = vi.fn();
    const save = vi.fn();
    let threw = false;
    let promise;
    try {
      promise = fileBulletToParkingLot('#PL idea', {
        save, isConfigured: () => { throw new Error('no client'); }, onError,
      });
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
    await expect(promise).resolves.toBe(null);
    expect(save).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('returns a promise that never rejects, so the un-awaited call in addBullet cannot crash', async () => {
    const rejected = fileBulletToParkingLot('#PL idea', {
      save: () => Promise.reject(new Error('boom')),
      isConfigured: configured,
      onError: () => {},
    });
    // If the rejection escaped, this await would throw and fail the test.
    await expect(rejected).resolves.toBe(null);
  });
});

// Amendment F is a structural rule, and a comment is not a guard. This repo has
// no DOM test environment, so useDailyLog's React internals can't be driven
// directly — but the placement rule that keeps a Parking Lot failure out of the
// daily-log save CAN be checked, and it's the part a future edit would break.
describe('useDailyLog wiring — amendment F placement rule', () => {
  const source = readFileSync(
    new URL('../hooks/useDailyLog.js', import.meta.url), 'utf8'
  );

  function bodyOf(fnName) {
    const start = source.indexOf(`function ${fnName}(`);
    expect(start, `${fnName} not found in useDailyLog.js`).toBeGreaterThan(-1);
    const open = source.indexOf('{', start);
    let depth = 0;
    for (let i = open; i < source.length; i++) {
      if (source[i] === '{') depth++;
      else if (source[i] === '}') {
        depth--;
        if (depth === 0) return source.slice(open, i + 1);
      }
    }
    throw new Error(`could not find end of ${fnName}`);
  }

  it('never calls the parking-lot writer from the save path', () => {
    expect(bodyOf('performSave')).not.toContain('fileBulletToParkingLot');
    expect(bodyOf('scheduleSave')).not.toContain('fileBulletToParkingLot');
    expect(bodyOf('updateState')).not.toContain('fileBulletToParkingLot');
  });

  it('hooks addBullet only — never upsertScheduledBullet', () => {
    expect(bodyOf('addBullet')).toContain('fileBulletToParkingLot(');
    expect(bodyOf('upsertScheduledBullet')).not.toContain('fileBulletToParkingLot');
  });

  it('calls the writer outside addBullet updateState() call, and does not await it', () => {
    const body = bodyOf('addBullet');
    const updateStateStart = body.indexOf('updateState(prev =>');
    const call = body.indexOf('fileBulletToParkingLot(');
    // The call sits after the whole updateState(...) statement, not inside it.
    const updateStateEnd = body.indexOf('});', updateStateStart);
    expect(call).toBeGreaterThan(updateStateEnd);
    expect(body).not.toMatch(/await\s+fileBulletToParkingLot/);
  });

  it('is not gated behind readyRef — that guard is for the daily-log store only', () => {
    const body = bodyOf('addBullet');
    expect(body).not.toContain('readyRef');
  });
});
