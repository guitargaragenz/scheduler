// The `#PRJ` tag — Merge B of the Workshop Projects brief.
//
// Trevor types a bit of shop work into the Daily Log with `#PRJ` on it and it
// opens a workshop project with the bullet text as its title. The bullet STAYS
// in the day and behaves like any other bullet — carries, drops, completes
// normally. Exactly the `#PL` contract, one table over.
//
// This is a deliberate copy of src/utils/parkingLotTag.js, including the
// constraint that made that file a standalone unit: the workshop-project write
// must be fire-and-forget, called directly from addBullet and never from
// inside updateState / scheduleSave / performSave, and never gated behind
// readyRef. A planner failure must not be able to block or corrupt the
// daily-log save that was hardened after the 2026-07-05 whole-store overwrite.
// Everything exported below therefore swallows its own failures —
// fileBulletToWorkshopProject() never throws and never returns a rejected
// promise, whatever the writer does.

import {
  isSupabaseConfigured as defaultIsSupabaseConfigured,
  saveWorkshopProjects as defaultSaveWorkshopProjects,
} from './supabase.js';

// Word boundary AFTER the tag is the whole point: `#PRJCT` and `#PRJS` must not
// create a project. `\b` between `J` and `C` does not exist (both are word
// characters), so those cases simply do not match. `#PRJ`, `#prj`, `#PRJ.`,
// `#PRJ ` and `#PRJ` at end-of-string all do.
//
// Two separate literals rather than one shared regex: a /g/ regex carries
// lastIndex between calls, so sharing it between test() and replace() would
// make matching depend on call order.
const WORKSHOP_PROJECT_TAG = /#PRJ\b/i;
const WORKSHOP_PROJECT_TAG_ALL = /#PRJ\b/gi;

export function hasWorkshopProjectTag(text) {
  if (typeof text !== 'string') return false;
  return WORKSHOP_PROJECT_TAG.test(text);
}

// The project's title is the bullet text with the tag removed and whitespace
// tidied. The bullet itself keeps its text exactly as typed.
export function stripWorkshopProjectTag(text) {
  if (typeof text !== 'string') return '';
  return text.replace(WORKSHOP_PROJECT_TAG_ALL, ' ').replace(/\s+/g, ' ').trim();
}

// Same id scheme the Projects page uses for projects started with the `+`, so a
// project filed from the Daily Log is indistinguishable from a hand-added one.
export function newWorkshopProjectId() {
  return 'wp-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// Matches the shape loadWorkshopProjects() returns. Notes, steps and parts
// start empty — the bullet gives a title and nothing else, and Trevor fills the
// rest in on the project page. There is deliberately no status or date field to
// populate: a project cannot nag him.
export function buildWorkshopProjectFromBullet(text, deps = {}) {
  const { makeId = newWorkshopProjectId } = deps;
  return {
    id: makeId(),
    title: stripWorkshopProjectTag(text),
    notes: '',
    steps: [],
    parts: [],
  };
}

// Fire-and-forget. Returns a promise purely so tests can await it; callers in
// the app deliberately do NOT await, and it is written so that awaiting it can
// never surface an error either.
//
// saveWorkshopProjects([project]) with the default empty baseline deletes
// nothing and upserts exactly this one row — the baseline argument is
// intentionally omitted, not forgotten.
export function fileBulletToWorkshopProject(text, deps = {}) {
  const {
    save = defaultSaveWorkshopProjects,
    isConfigured = defaultIsSupabaseConfigured,
    onError = e => console.error('Workshop project filing failed (daily log unaffected):', e),
  } = deps;

  try {
    if (!isConfigured()) return Promise.resolve(null);
    const project = buildWorkshopProjectFromBullet(text, deps);
    // An empty title would create a blank, unnamed tab — a bullet that is
    // nothing but the tag is not a project.
    if (!project.title) return Promise.resolve(null);
    return Promise.resolve()
      .then(() => save([project]))
      .then(() => project)
      .catch(e => {
        onError(e);
        return null;
      });
  } catch (e) {
    // Covers a synchronous throw from isConfigured() or from building the item.
    onError(e);
    return Promise.resolve(null);
  }
}
