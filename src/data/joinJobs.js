import { createSubtasks } from './jobs.js';

// Fields written only by the React app (scheduling, pomodoro, done, split
// bookkeeping) — everything else on a top-level job is CSV/Sheet-owned and
// lives in jobsMaster. Deliberately does NOT include isSplit/manualSplits:
// whether a top-level job is "split" is always derived from whether live
// manual-split-child jobsState docs exist for it (see joinJobsMasterState
// below), never trusted as a stored flag — that's one whole class of the
// "flag silently lost, data survives, UI shows it wrong" bugs this migration
// exists to eliminate.
export const JOBS_STATE_TOP_LEVEL_FIELDS = [
  'scheduled', 'calendarSlot', 'gcalEventId', 'gcalEventIds',
  'pomoLog', 'done', 'noAutoSplit', 'sessionNote', 'bumpHistory',
];

export function pickTopLevelState(stateDoc = {}) {
  const out = {};
  JOBS_STATE_TOP_LEVEL_FIELDS.forEach(f => {
    if (stateDoc[f] !== undefined) out[f] = stateDoc[f];
  });
  return out;
}

// Fields that are never jobsMaster-owned on a top-level job: app-owned state
// fields plus fields the join layer derives fresh on every read (never
// stored). Used to strip a flat/joined job object down to CSV/Sheet-owned
// fields only before writing to jobsMaster (e.g. the bench-keyword re-infer
// handler in App.jsx, architecture brief design decision #2).
const NON_MASTER_FIELDS = new Set([
  'id', ...JOBS_STATE_TOP_LEVEL_FIELDS,
  'isSplit', 'hasSubtasks', 'subtasks', 'manualSplits', 'parentId', 'isSubtask',
]);

export function pickMasterFields(job = {}) {
  const out = {};
  Object.keys(job).forEach(k => {
    if (!NON_MASTER_FIELDS.has(k)) out[k] = job[k];
  });
  return out;
}

// The jobsState fields to persist for a given *joined* (flat, UI-shape) job
// object. Split children (manual or auto) don't correspond to a real CSV
// row, so jobsState owns their entire record, not just an app-owned subset.
export function jobsStateFieldsFor(job) {
  if (job.parentId) {
    // eslint-disable-next-line no-unused-vars
    const { id, ...rest } = job;
    return rest;
  }
  return pickTopLevelState(job);
}

// Joins jobsMaster (CSV-owned, top-level jobs only) with jobsState
// (app-owned: scheduling/split/pomodoro state, keyed by job id — including
// synthetic split-child ids) into the exact flat shape every component in
// this app already consumes: one entry per top-level job, one entry per
// split child (manual or auto), with parentId/hasSubtasks/subtasks/isSplit/
// isSubtask reconstructed on every record — this is a drop-in replacement
// for the old withSplitsExpanded()'s output shape.
//
// Union-join semantics (architecture brief design decision #1): a jobsState
// doc that still holds real, non-done data but has no matching jobsMaster
// parent is NEVER silently dropped from the result — it comes back
// separately as `orphans` for the caller to surface (e.g. via the existing
// pendingRevenueReview pattern) instead of the old silent-deletion bug.
export function joinJobsMasterState(masterDocs = [], stateDocs = [], benchHours = {}) {
  const stateById = Object.fromEntries(stateDocs.map(d => [d.id, d]));

  // Manual-split children — stateDocs with parentId + isSubtask:true.
  const manualChildrenByParent = {};
  for (const s of stateDocs) {
    if (!s.parentId || !s.isSubtask) continue;
    (manualChildrenByParent[s.parentId] ||= []).push(s);
  }

  const result = [];
  const claimedStateIds = new Set();

  for (const master of masterDocs) {
    const state = stateById[master.id] || {};
    claimedStateIds.add(master.id);

    const manualKids = manualChildrenByParent[master.id] || [];
    if (manualKids.length > 0) {
      result.push({ ...master, ...pickTopLevelState(state), isSplit: true, hasSubtasks: false, subtasks: null });
      for (const kid of manualKids) {
        claimedStateIds.add(kid.id);
        // jobsState fully owns manual split-child records.
        result.push({
          ...kid,
          scheduled: kid.scheduled ?? false,
          calendarSlot: kid.calendarSlot ?? null,
          gcalEventId: kid.gcalEventId ?? null,
          gcalEventIds: kid.gcalEventIds ?? [],
        });
      }
      continue;
    }

    if (state.noAutoSplit) {
      result.push({ ...master, ...pickTopLevelState(state), isSplit: false, hasSubtasks: false, subtasks: null, manualSplits: false });
      continue;
    }

    const subtasks = createSubtasks({ ...master, ...pickTopLevelState(state) }, benchHours);
    if (subtasks && subtasks.length > 0) {
      result.push({ ...master, ...pickTopLevelState(state), isSplit: false, hasSubtasks: true, subtasks: subtasks.map(s => s.id) });
      for (const st of subtasks) {
        const stState = stateById[st.id] || {};
        claimedStateIds.add(st.id);
        // Auto-split children aren't stored/re-derived wholesale like manual
        // children — their shape (bench, hours, label, hoursRange, parentId)
        // comes FRESH from createSubtasks() on every call, deliberately: if
        // the parent's desc/hours change, or a bench-keyword reclassification
        // changes what qualifies as a split, these cards must reflect that
        // immediately, every render. `st` is always the base for those.
        //
        // Their jobsState doc is still a real, fully-owned record for the
        // true app-owned fields (pomoLog/done/sessionNote/bumpHistory/
        // scheduled/calendarSlot/gcalEventId(s)) — pomoLog logged against one
        // specific bench-card of a split job must survive reconstruction,
        // not get silently discarded. But `jobsStateFieldsFor()` (the write
        // side, same file) saves the FULL joined record for any job with a
        // parentId, including bench/hours/label/hoursRange — those are
        // CSV-shaped fields that just happen to also be sitting in the
        // jobsState doc, not real app-owned data. Spreading the whole stored
        // doc here would let a stale hours/bench from a previous save win
        // over the fresh createSubtasks() value, and — because that stale
        // value then round-trips right back into jobsState via the diff-save
        // — permanently pin it there, even after the parent legitimately
        // changes. pickTopLevelState() is the exact allowlist that avoids
        // this: only the true app-owned fields cross over. Explicit defaults
        // below matter when the child has no jobsState doc yet at all (a
        // fresh auto-split card, never scheduled/logged) — pickTopLevelState
        // only copies fields that actually exist on the stored doc, it
        // doesn't invent scheduled:false/calendarSlot:null out of thin air.
        result.push({
          ...st,
          ...pickTopLevelState(stState),
          scheduled: stState.scheduled ?? false,
          calendarSlot: stState.calendarSlot ?? null,
          gcalEventId: stState.gcalEventId ?? null,
          gcalEventIds: stState.gcalEventIds ?? [],
        });
      }
    } else {
      result.push({ ...master, ...pickTopLevelState(state), isSplit: false, hasSubtasks: false, subtasks: null, manualSplits: false });
    }
  }

  // Union-join: any jobsState doc never claimed above still holds real data
  // with no live jobsMaster parent — surface it, never drop it silently.
  // `done` jobs are excluded: they're already accounted for via the separate
  // completedJobs/doneJobIds record, so a done job whose CSV row has since
  // rolled off isn't a revenue-review candidate, it's just history.
  const orphans = [];
  for (const s of stateDocs) {
    if (claimedStateIds.has(s.id)) continue;
    if (s.done) continue;
    const hasRealData = Object.keys(s).some(k => {
      if (k === 'id' || k === 'updatedAt') return false;
      const v = s[k];
      if (v == null || v === false) return false;
      if (Array.isArray(v) && v.length === 0) return false;
      return true;
    });
    if (!hasRealData) continue;
    orphans.push({ ...s });
  }

  return { jobs: result, orphans };
}

// Keys a list of pendingRevenueReview candidates (disappeared top-level jobs
// or joinJobsMasterState()'s `orphans`) by each item's own Firestore doc id,
// never by job number: a top-level jobsState doc never carries a `job`
// field (jobsMaster owns it, so it'd be undefined), and every split child of
// the same parent shares the SAME job number — keying by job number lets a
// second simultaneous orphan silently clobber the first in the review list.
// `id` is always present and unique across every record this app produces
// (top-level ids are the job number string; split-child ids are suffixed/
// synthetic), so it's the only safe key here.
export function keyReviewItemsById(items) {
  return Object.fromEntries((items || []).map(j => [String(j.id), j]));
}
