import { createSubtasks } from './jobs.js';

// Fields written only by the React app (scheduling, pomodoro, done, split
// bookkeeping) — everything else on a top-level job is CSV/Sheet-owned and
// lives in jobsMaster. Under the single-table Supabase schema, the split
// fields (isSplit/hasSubtasks/subtasks/isSubtask) and the session fields are
// ALSO app-owned state stored on the job's own row — they're not derived,
// they're written and must round-trip. Omitting them from this allowlist was
// the root cause of splits vanishing on reload, since jobsStateFieldsFor()
// filters every write through this list.
export const JOBS_STATE_TOP_LEVEL_FIELDS = [
  'scheduled', 'calendarSlot', 'gcalEventId', 'gcalEventIds',
  'pomoLog', 'done', 'noAutoSplit', 'sessionNote', 'bumpHistory',
  'isSplit', 'hasSubtasks', 'subtasks', 'isSubtask',
  'sessionIndex', 'sessionTotal', 'pieceDone',
];

export function pickTopLevelState(stateDoc = {}) {
  const out = {};
  JOBS_STATE_TOP_LEVEL_FIELDS.forEach(f => {
    if (stateDoc[f] !== undefined) out[f] = stateDoc[f];
  });
  return out;
}

// pickTopLevelState() only copies fields that actually exist on the stored
// doc — for a top-level job with no jobsState doc at all yet (never
// scheduled/logged), that leaves scheduled/calendarSlot/gcalEventId(s)/
// pomoLog as `undefined` instead of explicit false/null/[]. Downstream code
// isn't guaranteed to guard against that (e.g. a bare pomoLog.length without
// a `|| []` fallback), and it's inconsistent with how split children already
// get explicit fallbacks. Applied on every top-level branch in
// joinJobsMasterState below.
function withTopLevelDefaults(state) {
  return {
    scheduled: state.scheduled ?? false,
    calendarSlot: state.calendarSlot ?? null,
    gcalEventId: state.gcalEventId ?? null,
    gcalEventIds: state.gcalEventIds ?? [],
    pomoLog: state.pomoLog ?? [],
  };
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

// The app-owned fields a DERIVED (auto-split) bench card may persist. This is
// JOBS_STATE_TOP_LEVEL_FIELDS minus every field that describes the card's
// *shape* (isSplit/hasSubtasks/subtasks/isSubtask) or the parent's split
// policy (noAutoSplit). A derived card's shape — bench, hours, label,
// hoursRange, which cards exist at all — is regenerated from the parent by
// createSubtasks() on every load and must never be stored, or a stale value
// pins itself permanently (see the long note in joinJobsMasterState below).
export const DERIVED_STATE_FIELDS = [
  'scheduled', 'calendarSlot', 'gcalEventId', 'gcalEventIds',
  'pomoLog', 'done', 'sessionNote', 'bumpHistory',
  'sessionIndex', 'sessionTotal', 'pieceDone',
];

// The jobsState fields to persist for a given *joined* (flat, UI-shape) job
// object. Manual split children don't correspond to a real CSV row, so
// jobsState owns their entire record, not just an app-owned subset.
//
// Derived (auto-split) children are the exception and the reason this branch
// exists at all. Under the old two-collection Firestore schema they were
// firewalled by living in `jobsState`, a different collection from the
// CSV-owned `jobsMaster`. The single-table Supabase schema removed that
// firewall: writing a derived card's full record here would materialise it as
// a permanent real row in `jobs`, which then reads back as a stored manual
// child, freezes the auto-split against future parent edits, and turns stale
// derived ids into fake orphans in pendingRevenueReview. So a derived card
// persists ONLY its true app-owned state.
//
// `job` and `parentId` are included despite not being app-owned state: the
// `job` column is NOT NULL and `parent_id` is what the delete-by-parent pass
// keys off, so a first-ever write for a derived card (e.g. logging a pomodoro
// on a bench card that has never been touched) would otherwise be rejected
// outright. Both are immutable identity, not stale-able shape.
export function jobsStateFieldsFor(job) {
  if (job.isDerived) {
    const out = {};
    DERIVED_STATE_FIELDS.forEach(f => {
      if (job[f] !== undefined) out[f] = job[f];
    });
    out.job = job.job;
    out.parentId = job.parentId;
    out.isDerived = true;
    return out;
  }
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
      result.push({ ...master, ...pickTopLevelState(state), ...withTopLevelDefaults(state), isSplit: true, hasSubtasks: false, subtasks: null });
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
      result.push({ ...master, ...pickTopLevelState(state), ...withTopLevelDefaults(state), isSplit: false, hasSubtasks: false, subtasks: null, manualSplits: false });
      continue;
    }

    const subtasks = createSubtasks({ ...master, ...pickTopLevelState(state) }, benchHours);
    if (subtasks && subtasks.length > 0) {
      result.push({ ...master, ...pickTopLevelState(state), ...withTopLevelDefaults(state), isSplit: false, hasSubtasks: true, subtasks: subtasks.map(s => s.id) });
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
      result.push({ ...master, ...pickTopLevelState(state), ...withTopLevelDefaults(state), isSplit: false, hasSubtasks: false, subtasks: null, manualSplits: false });
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

// Auto-split expansion for the single-table Supabase schema.
//
// `joinJobsMasterState()` above does this as a side effect of joining two
// Firestore collections. Supabase stores one flat `jobs` table, so the join
// half is meaningless here — and its union-join/`orphans` machinery is
// actively wrong on a flat table (every stored child row would look like an
// unclaimed state doc). This is the same auto-split regeneration, and the
// same fresh-vs-stale field rules, applied to ONE flat camelCase array.
//
// Input and output are both the app's flat UI shape. Stored rows are passed
// through; derived bench cards are regenerated from their parent on every
// call and marked `isDerived: true`.
export function expandAutoSplits(flatJobs = [], benchHours = {}) {
  const storedById = Object.fromEntries(flatJobs.map(j => [j.id, j]));

  // Stored children = rows with a parent_id that are NOT themselves derived.
  // `parentId != null` is the child test, deliberately not `isSubtask`: that
  // column is nullable and auto-split children never carried it, so trusting
  // it would mis-file real stored children as top-level jobs.
  //
  // A row flagged `isDerived` is a leftover materialised bench card (written
  // before the guards existed, or by an older client). It is NOT treated as a
  // stored child — it stays in `storedById` so its pomoLog/scheduled state is
  // merged back onto the freshly regenerated card, and is never emitted
  // directly. That reconciles the corruption instead of reporting it.
  const storedChildrenByParent = {};
  for (const j of flatJobs) {
    if (j.parentId == null) continue;
    if (j.isDerived) continue;
    (storedChildrenByParent[j.parentId] ||= []).push(j);
  }

  const result = [];

  for (const job of flatJobs) {
    if (job.parentId != null) continue; // children are emitted with their parent

    const storedKids = storedChildrenByParent[job.id] || [];

    // Manual split — stored children win outright, no auto-split.
    if (storedKids.length > 0) {
      result.push({ ...job, isSplit: true, hasSubtasks: false, subtasks: null });
      for (const kid of storedKids) {
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

    // Deliberately un-split by the user — never regenerate.
    if (job.noAutoSplit) {
      result.push({ ...job, isSplit: false, hasSubtasks: false, subtasks: null, manualSplits: false });
      continue;
    }

    const subtasks = createSubtasks(job, benchHours);
    if (!subtasks || subtasks.length === 0) {
      result.push({ ...job, isSplit: false, hasSubtasks: false, subtasks: null, manualSplits: false });
      continue;
    }

    result.push({ ...job, isSplit: false, hasSubtasks: true, subtasks: subtasks.map(s => s.id) });

    for (const st of subtasks) {
      const stored = storedById[st.id] || {};
      // `st` (fresh from createSubtasks) is always the base: bench, hours,
      // label, hoursRange and which cards exist at all must reflect the
      // parent's CURRENT desc/hours/bench on every render. Only the true
      // app-owned fields cross over from the stored row — see the long note
      // in joinJobsMasterState above; a stale stored hours/bench must never
      // beat the fresh createSubtasks() value.
      //
      // createSubtasks() spreads the whole parent into each card, so the
      // parent's own split bookkeeping and done flag ride along. Those are
      // meaningless (and actively harmful — a derived card inheriting
      // done:true from its parent, or isSubtask:true, mis-classifies it
      // everywhere downstream), so they are reset explicitly here before the
      // stored state is merged on top.
      const {
        // eslint-disable-next-line no-unused-vars
        isSubtask: _is, isSplit: _sp, hasSubtasks: _hs, subtasks: _st, done: _dn,
        ...base
      } = st;
      const merged = {
        ...base,
        isDerived: true,
        done: false,
        ...pickTopLevelState(stored),
        scheduled: stored.scheduled ?? false,
        calendarSlot: stored.calendarSlot ?? null,
        gcalEventId: stored.gcalEventId ?? null,
        gcalEventIds: stored.gcalEventIds ?? [],
      };
      // A derived card is never itself split, whatever a legacy stored row
      // may claim — pickTopLevelState() would otherwise carry those back in.
      merged.isSubtask = false;
      merged.isSplit = false;
      merged.hasSubtasks = false;
      merged.subtasks = null;
      result.push(merged);
    }
  }

  return result;
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
