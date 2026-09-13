import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  hasWorkshopProjectTag,
  stripWorkshopProjectTag,
  buildWorkshopProjectFromBullet,
  fileBulletToWorkshopProject,
} from './workshopProjectTag.js';

// The `#PRJ` tag — Merge B of the Workshop Projects brief. Deliberately the
// same shape as parkingLotTag.test.js, because the tag is deliberately the same
// mechanism one table over.

describe('hasWorkshopProjectTag — fires only on a real #PRJ', () => {
  it('fires on a bare #PRJ', () => {
    expect(hasWorkshopProjectTag('#PRJ')).toBe(true);
  });

  it('fires on lowercase #prj and mixed case', () => {
    expect(hasWorkshopProjectTag('#prj shelving for the parts wall')).toBe(true);
    expect(hasWorkshopProjectTag('#Prj shelving for the parts wall')).toBe(true);
  });

  it('fires mid-sentence', () => {
    expect(hasWorkshopProjectTag('build shelves #PRJ behind the setup bench')).toBe(true);
  });

  it('fires when the tag is the last thing on the line', () => {
    expect(hasWorkshopProjectTag('rearrange the cutting room #PRJ')).toBe(true);
  });

  it('fires when followed by punctuation', () => {
    expect(hasWorkshopProjectTag('dust extraction #PRJ.')).toBe(true);
    expect(hasWorkshopProjectTag('dust extraction (#PRJ)')).toBe(true);
  });

  // The whole reason a word boundary is required — the near misses.
  it('does NOT fire on #PRJCT or #PRJS', () => {
    expect(hasWorkshopProjectTag('#PRJCT shelving')).toBe(false);
    expect(hasWorkshopProjectTag('#PRJS shelving')).toBe(false);
  });

  it('does NOT fire on #PROJECT — the obvious thing to type by mistake', () => {
    expect(hasWorkshopProjectTag('#PROJECT shelving')).toBe(false);
  });

  it('does NOT fire on plain PRJ with no hash', () => {
    expect(hasWorkshopProjectTag('PRJ is not a tag')).toBe(false);
  });

  it('does NOT fire on #PL — the two tags are separate', () => {
    expect(hasWorkshopProjectTag('#PL second soldering station')).toBe(false);
  });

  it('does NOT fire on an untagged bullet', () => {
    expect(hasWorkshopProjectTag('restring the Tele')).toBe(false);
  });

  it('handles non-string input without throwing', () => {
    expect(hasWorkshopProjectTag(null)).toBe(false);
    expect(hasWorkshopProjectTag(undefined)).toBe(false);
    expect(hasWorkshopProjectTag(42)).toBe(false);
  });

  // A shared /g/ regex would carry lastIndex between calls and make the answer
  // depend on how many times it had been asked before.
  it('gives the same answer when asked repeatedly', () => {
    expect(hasWorkshopProjectTag('shelving #PRJ')).toBe(true);
    expect(hasWorkshopProjectTag('shelving #PRJ')).toBe(true);
    expect(hasWorkshopProjectTag('shelving #PRJ')).toBe(true);
  });
});

describe('stripWorkshopProjectTag — the project title', () => {
  it('removes the tag and tidies the spacing', () => {
    expect(stripWorkshopProjectTag('#PRJ shelving for the parts wall')).toBe('shelving for the parts wall');
    expect(stripWorkshopProjectTag('shelving for the parts wall #PRJ')).toBe('shelving for the parts wall');
    expect(stripWorkshopProjectTag('shelving #PRJ for the parts wall')).toBe('shelving for the parts wall');
  });

  it('removes every occurrence, not just the first', () => {
    expect(stripWorkshopProjectTag('#PRJ shelving #prj')).toBe('shelving');
  });

  it('leaves a #PROJECT in place', () => {
    expect(stripWorkshopProjectTag('the #PROJECT wall #PRJ')).toBe('the #PROJECT wall');
  });

  it('returns an empty string for a bullet that is only the tag', () => {
    expect(stripWorkshopProjectTag('#PRJ')).toBe('');
    expect(stripWorkshopProjectTag('  #PRJ  ')).toBe('');
  });
});

describe('buildWorkshopProjectFromBullet — matches the stored shape', () => {
  it('builds { id, title, notes, steps, parts } and nothing else', () => {
    const project = buildWorkshopProjectFromBullet('#PRJ shelving for the parts wall', {
      makeId: () => 'wp-test1',
    });
    expect(project).toEqual({
      id: 'wp-test1',
      title: 'shelving for the parts wall',
      notes: '',
      steps: [],
      parts: [],
    });
  });

  // The design rule, pinned as a test so a later "small addition" trips it: a
  // project cannot nag him. No status, no date, no priority, no percentage.
  it('has no status, date, priority or done field', () => {
    const project = buildWorkshopProjectFromBullet('#PRJ shelving');
    expect(Object.keys(project).sort()).toEqual(['id', 'notes', 'parts', 'steps', 'title']);
  });

  it('generates a wp- prefixed id by default', () => {
    expect(buildWorkshopProjectFromBullet('#PRJ shelving').id).toMatch(/^wp-/);
  });
});

describe('fileBulletToWorkshopProject — the write itself', () => {
  const configured = () => true;

  it('saves exactly one project, with no baseline, so nothing is ever deleted', async () => {
    const save = vi.fn().mockResolvedValue({ ok: true });
    await fileBulletToWorkshopProject('#PRJ shelving for the parts wall', {
      save, isConfigured: configured, makeId: () => 'wp-test1',
    });
    expect(save).toHaveBeenCalledTimes(1);
    // One argument only — saveWorkshopProjects's `baseline` defaults to [],
    // which deletes nothing whatever the table holds.
    expect(save.mock.calls[0].length).toBe(1);
    expect(save.mock.calls[0][0]).toEqual([{
      id: 'wp-test1', title: 'shelving for the parts wall', notes: '', steps: [], parts: [],
    }]);
  });

  it('writes nothing for a bullet that is only the tag', async () => {
    const save = vi.fn().mockResolvedValue({ ok: true });
    const result = await fileBulletToWorkshopProject('#PRJ', { save, isConfigured: configured });
    expect(save).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it('writes nothing when Supabase is not configured', async () => {
    const save = vi.fn();
    const result = await fileBulletToWorkshopProject('#PRJ shelving', {
      save, isConfigured: () => false,
    });
    expect(save).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  // The whole reason this file is a standalone unit. The daily-log save was
  // hardened after the 2026-07-05 whole-store overwrite; a planner failure must
  // not be able to reach it.
  it('swallows a rejected save and never rejects', async () => {
    const onError = vi.fn();
    const save = vi.fn().mockRejectedValue(new Error('network down'));
    await expect(
      fileBulletToWorkshopProject('#PRJ shelving', { save, isConfigured: configured, onError }),
    ).resolves.toBeNull();
    expect(onError).toHaveBeenCalled();
  });

  it('swallows a synchronous throw from the writer and never rejects', async () => {
    const onError = vi.fn();
    const save = vi.fn(() => { throw new Error('boom'); });
    await expect(
      fileBulletToWorkshopProject('#PRJ shelving', { save, isConfigured: configured, onError }),
    ).resolves.toBeNull();
    expect(onError).toHaveBeenCalled();
  });

  it('swallows a synchronous throw from isConfigured and never rejects', async () => {
    const onError = vi.fn();
    await expect(
      fileBulletToWorkshopProject('#PRJ shelving', {
        isConfigured: () => { throw new Error('no env'); },
        onError,
      }),
    ).resolves.toBeNull();
    expect(onError).toHaveBeenCalled();
  });
});

// Council amendment F, inherited from #PL: the write is fire-and-forget and
// lives in addBullet, NOT in the daily-log save path. Read as source text
// because the constraint is about WHERE the call sits, which no amount of
// calling addBullet can prove.
describe('the #PRJ write stays outside the Daily Log save path', () => {
  const src = readFileSync(new URL('../hooks/useDailyLog.js', import.meta.url), 'utf8');

  it('calls fileBulletToWorkshopProject exactly once, from addBullet', () => {
    const calls = src.match(/fileBulletToWorkshopProject\(/g) || [];
    // One import reference and one call site.
    expect(calls.length).toBe(1);
    const callIndex = src.indexOf('fileBulletToWorkshopProject(text)');
    const addBulletIndex = src.indexOf('function addBullet(');
    expect(addBulletIndex).toBeGreaterThan(-1);
    expect(callIndex).toBeGreaterThan(addBulletIndex);
  });

  it('is not awaited — a slow planner write must not hold up the bullet', () => {
    expect(src).not.toMatch(/await\s+fileBulletToWorkshopProject/);
  });

  it('is not called from updateState, scheduleSave or performSave', () => {
    for (const fn of ['function updateState', 'function scheduleSave', 'function performSave']) {
      const start = src.indexOf(fn);
      if (start === -1) continue;
      // Everything from the start of that function to the start of the next
      // top-level `function ` declaration.
      const rest = src.slice(start + fn.length);
      const end = rest.indexOf('\n  function ');
      const body = end === -1 ? rest : rest.slice(0, end);
      expect(body).not.toContain('fileBulletToWorkshopProject');
    }
  });
});
