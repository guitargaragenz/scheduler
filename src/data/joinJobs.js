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
        result.push({
          ...st,
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
