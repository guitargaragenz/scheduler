import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export function isSupabaseConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

let supabaseClient;

function getClient() {
  if (!supabaseClient) {
    supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
  }
  return supabaseClient;
}

// ============ JOBS (jobsMaster + jobsState combined) ============

let jobsCache = [];
let jobsCacheTime = 0;

export async function loadJobs() {
  try {
    const { data, error } = await getClient()
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      // RLS policy likely blocking; return cached data silently
      return jobsCache;
    }
    jobsCache = data || [];
    jobsCacheTime = Date.now();
    return jobsCache;
  } catch (e) {
    // Return cache without logging to reduce console spam
    return jobsCache;
  }
}

export async function saveJob(jobId, fields) {
  // pickMasterFields() returns null when it is handed a split child (stored
  // or derived) rather than a real top-level job. Writing that would create
  // a phantom row, so refuse rather than upsert a bare id.
  if (!fields || Object.keys(fields).length === 0) {
    console.error(`Supabase save job ${jobId}: refused — empty/rejected field set.`);
    return null;
  }
  if (fields.isDerived || fields.parentId) {
    console.error(`Supabase save job ${jobId}: refused — split children go through batchWriteJobsState, not saveJob.`);
    return null;
  }
  try {
    const { data, error } = await getClient()
      .from('jobs')
      .upsert({ ...toJobRow(fields), id: jobId, updated_at: new Date().toISOString() }, { onConflict: 'id' })
      .select();
    if (error) throw error;
    return data?.[0];
  } catch (e) {
    console.error(`Supabase save job ${jobId} error:`, e);
    return null;
  }
}

export async function deleteJob(jobId) {
  try {
    const { error } = await getClient()
      .from('jobs')
      .delete()
      .eq('id', jobId);
    if (error) throw error;
  } catch (e) {
    console.error(`Supabase delete job ${jobId} error:`, e);
  }
}

// App-shape (camelCase) field name -> jobs table column. The app and the DB
// disagree on naming, so anything written to the jobs table has to be mapped
// first — spreading raw app fields into a query makes PostgREST reject the
// whole request with "column does not exist", which is why pomodoro/done/
// drawer writes were silently failing after the Supabase migration.
const JOB_COLUMN_MAP = {
  parentId: 'parent_id',
  calendarSlot: 'calendar_slot',
  gcalEventId: 'gcal_event_id',
  gcalEventIds: 'gcal_event_ids',
  pomoLog: 'pomo_log',
  bumpHistory: 'bump_history',
  noAutoSplit: 'no_auto_split',
  sessionNote: 'session_note',
  sessionIndex: 'session_index',
  sessionTotal: 'session_total',
  pieceDone: 'piece_done',
  isSplit: 'is_split',
  isSubtask: 'is_subtask',
  isDerived: 'is_derived',
  hasSubtasks: 'has_subtasks',
  // Brief G, Build 1c — the date a job came in the door, written only by the
  // Jobs-by-Age import. Without an entry here toJobRow() drops the key
  // silently, and that import would write rows carrying nothing but `job`: a
  // no-op that looks exactly like a successful import.
  firstSeen: 'first_seen',
};

// vb/backlog/project are booleans on the app-shape job but stored as 'Y'/'N'
// TEXT columns (vb/bl/pj) — the convention the columns have carried since the
// Multitrack CSV days. A stale uppercase VB/BL/PJ key set used to sit in
// JOB_COLUMN_MAP here, but app jobs have never had those keys (jobs.js has
// always produced lowercase vb/backlog/project), so it silently matched
// nothing and these three fields were dropped from every partial write that
// went through toJobRow().
const JOB_BOOLEAN_YN_COLUMN_MAP = {
  vb: 'vb',
  backlog: 'bl',
  project: 'pj',
};

// Fields whose app name already matches the column name.
//
// `days` is deliberately NOT here — Brief H, Build 2b. Job age is computed from
// first_seen on every load and is no longer stored, so an app-shape job's
// `days` is a derived number. Listing it would let any partial write push that
// derived figure back into the column, which is exactly the stale-number
// problem the computed age was built to end. The column still exists and still
// holds old values; nothing in the app writes to it any more.
const JOB_PASSTHROUGH_FIELDS = new Set([
  'id', 'job', 'customer', 'mfr', 'model', 'status', 'bench', 'hours',
  'scheduled', 'done', 'subtasks', 'desc', 'tag', 'action',
  'created_at', 'updated_at',
]);

// Map an app-shape job (or partial job) to a jobs table row. Only keys that
// are actually present are included — this must never fill in absent keys,
// because partial state writes (e.g. scheduling a job) would otherwise blank
// out the CSV-owned columns they didn't mention. Keys with no column (UI-only
// derived fields such as manualSplits) are dropped rather than sent, since
// including them would fail the entire write.
export function toJobRow(fields) {
  const row = {};
  Object.keys(fields).forEach(k => {
    const ynCol = JOB_BOOLEAN_YN_COLUMN_MAP[k];
    if (ynCol) { row[ynCol] = fields[k] ? 'Y' : 'N'; return; }
    const col = JOB_COLUMN_MAP[k];
    if (col) row[col] = fields[k];
    else if (JOB_PASSTHROUGH_FIELDS.has(k)) row[k] = fields[k];
  });
  return row;
}

// Deletes every child row of a parent at the DB level, optionally keeping a
// set of ids. Un-split / re-split used to delete only the children it could
// see in the in-memory jobs array, which silently leaked rows: any stored
// child not currently loaded (or a derived card that had been wrongly
// materialised as a real row before the isDerived guards existed) survived
// the un-split and reappeared on the next load, re-freezing the split.
export async function deleteChildJobs(parentId, keepIds = []) {
  if (!parentId) return;
  try {
    let q = getClient().from('jobs').delete().eq('parent_id', parentId);
    if (keepIds.length > 0) q = q.not('id', 'in', `(${keepIds.map(id => `"${id}"`).join(',')})`);
    const { error } = await q;
    if (error) throw error;
  } catch (e) {
    console.error(`Supabase delete child jobs of ${parentId} error:`, e);
  }
}

// A batch writer named upsertJobsBatch() (aliased saveJobsMasterBatch) used to
// live here, feeding the Multitrack CSV upload. It went dead with the CSV path
// in Build 2a and was deleted in Build 2b. Do not write another one.
//
// The rule it leaves behind, which every writer below follows: a batch writer
// must send only the columns its caller actually supplied, grouped so that
// every row in one upsert carries the identical set of keys. A Supabase upsert
// given an array sends the UNION of all the rows' keys and NULL-fills any row
// missing one, so a writer that builds a fixed row regardless of its input
// overwrites columns the caller never mentioned — quietly, across the whole
// board, on rows that only needed one field changed.

// ============ MULTITRACK PDF IMPORT (Brief G) ============

// The six fields the Multitrack PDF actually carries. Everything else on a
// job — Tag, Hours, Action, VB, BL — is Trevor's own, maintained by hand, and
// simply is not printed on the PDF. The import path must be incapable of
// writing them, not merely careful about it.
export const PDF_IMPORT_FIELDS = Object.freeze(['job', 'customer', 'mfr', 'model', 'status', 'desc']);

// Two extra fields a job is allowed to be BORN with, and only on the write
// that first creates it: the bench inferred from the PDF description, and the
// starting hours estimate. Neither may ever appear on an update of a job that
// already exists — that would overwrite a bench Trevor moved by hand, or an
// hours figure he set from experience, on every single drop.
export const PDF_NEW_JOB_FIELDS = Object.freeze(['bench', 'hours']);

/**
 * The Brief G PDF writer. Deliberately its own writer, not a general one.
 *
 * The CSV-era batch writer (deleted in Build 2b, see the note above
 * writePdfImportBatch's section) built a fixed ~20-column row for every job,
 * including tag/action/days/vb/bl/pj. Running the PDF through anything like it
 * would send those columns as undefined on every row and blank Trevor's
 * hand-kept fields across the whole workshop in one click. This function exists
 * so that the PDF path can never reach those columns at all.
 *
 * `writes` is [{ id, data, isNew }]. Returns { ok, written } / { ok: false, error },
 * matching batchWriteJobsState()'s convention — callers gate on res?.ok.
 *
 * Three guards, all of which refuse the WHOLE batch rather than write part of
 * it. A partial import is worse than a failed one: it looks like it worked.
 */
export async function writePdfImportBatch(writes) {
  if (!writes || writes.length === 0) return { ok: true, written: 0 };
  try {
    const rows = [];
    for (const w of writes) {
      // Guard 1: top-level jobs only, identified by a purely numeric id. A
      // top-level job's id IS its Multitrack job number; the app's own split
      // cards carry ids like "1620_Electronics_0". Those are the app's
      // business and the PDF knows nothing about them, so they must never be
      // matched, written or counted here.
      if (!/^\d+$/.test(String(w.id ?? ''))) {
        throw new Error(`refusing batch: "${w.id}" is not a top-level Multitrack job number`);
      }
      // Guard 2: the allow-list. Anything outside it is a programming error
      // upstream, so fail loudly instead of quietly dropping the key and
      // leaving a half-wrong import looking healthy.
      const allowed = w.isNew
        ? [...PDF_IMPORT_FIELDS, ...PDF_NEW_JOB_FIELDS]
        : PDF_IMPORT_FIELDS;
      const stray = Object.keys(w.data || {}).filter(k => !allowed.includes(k));
      if (stray.length > 0) {
        throw new Error(`refusing batch: job ${w.id} carried fields the PDF cannot own (${stray.join(', ')})`);
      }
      const fields = {};
      for (const k of allowed) {
        if (w.data && k in w.data) fields[k] = w.data[k];
      }
      // Guard 3: the `job` column is NOT NULL, and Postgres checks that
      // against the proposed row before it resolves the upsert conflict — so
      // a row missing `job` fails the request outright rather than falling
      // back to the existing value.
      if (!fields.job) {
        throw new Error(`refusing batch: job ${w.id} has no job number`);
      }
      rows.push({ ...toJobRow(fields), id: String(w.id), updated_at: new Date().toISOString() });
    }

    // Group by exact column set before writing — the same mitigation
    // batchWriteJobsState() uses, and it is load-bearing here. A Supabase
    // upsert given an array sends the UNION of all rows' keys and NULL-fills
    // any row that lacks one. New jobs carry bench/hours and existing jobs
    // do not, so batching them together would push bench=NULL, hours=NULL
    // onto every job already on the board. Grouping means every row in a
    // request has identical columns, so nothing is ever NULL-filled.
    const groups = new Map();
    for (const row of rows) {
      const sig = Object.keys(row).sort().join(',');
      if (!groups.has(sig)) groups.set(sig, []);
      groups.get(sig).push(row);
    }
    for (const records of groups.values()) {
      // onConflict 'id' is what makes re-dropping the same PDF safe: the job
      // number is the primary key, so a job already on the board is updated
      // in place and never duplicated.
      const { error } = await getClient().from('jobs').upsert(records, { onConflict: 'id' });
      if (error) throw error;
    }
    return { ok: true, written: rows.length };
  } catch (e) {
    console.error('Supabase PDF import batch error:', e);
    return { ok: false, error: e };
  }
}

/**
 * Forensic record of one PDF import: when, which file, how many rows, and
 * exactly which job numbers were touched. If an import ever does something
 * unexpected, this is the only way to answer "what did it actually write".
 *
 * Strictly best-effort by design. The console line is written first and
 * unconditionally, so the record exists even if the table has not been
 * created yet or the insert is refused — logging must never be the reason a
 * good import fails. Needs the pdf_import_log table from
 * docs/supabase-schema.sql to persist beyond the console.
 */
export async function logPdfImport({ filename, rowCount, ids }) {
  const entry = {
    id: `pdfimp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    filename: filename || null,
    row_count: rowCount ?? null,
    job_ids: ids || [],
    imported_at: new Date().toISOString(),
  };
  console.log('PDF import:', entry);
  try {
    const { error } = await getClient().from('pdf_import_log').insert(entry);
    if (error) throw error;
  } catch (e) {
    console.warn('PDF import log not persisted (see console line above):', e?.message || e);
  }
}

// ============ JOBS-BY-AGE PDF IMPORT (Brief G, Build 1c) ============

// The two columns the Jobs-by-Age printout owns. It also prints Mfr, Model and
// Status, and reading those here would be the two-masters bug in a new place —
// the Jobs PDF already owns them. So: two columns, and this allow-list makes
// that structural rather than a matter of care.
//
// `desc` joined `firstSeen` in the Desc build (2026-08-01), and it is the one
// column BOTH printouts can write — so the ownership rule is by lifecycle
// stage, not by document. PDF_IMPORT_FIELDS lets the Jobs PDF write `desc` when
// it creates a job; from then on this printout owns it, because the Jobs PDF
// prints descriptions truncated mid-word and this one prints them whole (job
// 1708: "...stp eli" there, "...stp elixir 12s Est $1000" here). Full reasoning
// in the header of src/data/parseJobsByAgePdf.js.
export const JBA_IMPORT_FIELDS = Object.freeze(['firstSeen', 'desc']);

/**
 * The Build 1c writer: fills in `first_seen` and `desc`, and touches nothing else.
 *
 * Its own writer, for the same reason writePdfImportBatch() is: a writer that
 * builds a fixed row regardless of what the caller supplied would blank real
 * data across the whole workshop in one click when handed a one-column import.
 * That was the CSV-era batch writer, deleted in Build 2b.
 *
 * `writes` is [{ id, job, data }], where data carries `firstSeen`, `desc`, or
 * both — the plan omits whichever one did not change, so the column sets
 * genuinely vary from row to row. Returns { ok, written } or { ok: false,
 * error }, matching writePdfImportBatch()'s convention.
 *
 * Every guard refuses the WHOLE batch rather than writing part of it, with the
 * one deliberate exception noted at Guard 3. A partial import is worse than a
 * failed one because it looks like it worked.
 */
export async function writeJbaImportBatch(writes) {
  if (!writes || writes.length === 0) return { ok: true, written: 0 };
  try {
    const rows = [];
    for (const w of writes) {
      // Guard 1: top-level jobs only, identified by a purely numeric id — the
      // app's own split cards ("1620_Electronics_0") are not Multitrack's
      // business and JBA has never heard of them.
      if (!/^\d+$/.test(String(w.id ?? ''))) {
        throw new Error(`refusing batch: "${w.id}" is not a top-level Multitrack job number`);
      }
      // Guard 2: the allow-list. A key outside it is a programming error
      // upstream, so fail loudly rather than drop it quietly and leave a
      // half-wrong import looking healthy.
      const stray = Object.keys(w.data || {}).filter(k => !JBA_IMPORT_FIELDS.includes(k));
      if (stray.length > 0) {
        throw new Error(`refusing batch: job ${w.id} carried fields the Jobs-by-Age PDF cannot own (${stray.join(', ')})`);
      }
      // Guard 3: `job` has to ride along, and this is the whole reason this
      // writer cannot be three lines long.
      //
      // `jobs.job` is NOT NULL, and this is a PostgREST **upsert**, not a
      // PATCH. Postgres validates NOT NULL against the *proposed insert row*
      // BEFORE it resolves ON CONFLICT onto the existing row — so a payload of
      // { id, first_seen } is rejected outright with 23502 even though the row
      // already exists and only an update was ever intended. Documented at
      // src/data/joinJobs.js:135-171, where it was the reproduced-live cause of
      // drags never persisting after the Supabase migration (job 842).
      //
      // A row with no job number is SKIPPED rather than thrown, unlike the
      // guards above: this is the one failure that is per-row rather than a
      // sign the whole file was misread, and aborting the batch over it would
      // cost every other job its date. Logged loudly with its id, and never
      // sent as `job: undefined` — that would abort the batch anyway, with an
      // illegible NOT NULL error naming nobody.
      if (!w.job) {
        console.error(`Jobs-by-Age import: skipping job ${w.id} — no job number to write alongside first_seen.`);
        continue;
      }
      rows.push({
        ...toJobRow({ job: w.job, ...(w.data || {}) }),
        id: String(w.id),
        updated_at: new Date().toISOString(),
      });
    }

    // Group by exact column set before writing, the same mitigation
    // writePdfImportBatch() and batchWriteJobsState() use.
    //
    // This was written when every row carried the identical four columns, as a
    // guard against the day someone added a conditional key. The Desc build
    // (2026-08-01) is that day, and this is now doing real work on every
    // import: a row whose date was already right carries only `desc`, a row
    // whose description was already right carries only `first_seen`, and most
    // rows carry one or the other rather than both. A Supabase array upsert
    // sends the UNION of all rows' keys and NULL-fills any row missing one —
    // so without this grouping, one mixed batch would blank the description of
    // every job that only needed its date corrected, and vice versa. Silently,
    // across the whole board, in one click.
    const groups = new Map();
    for (const row of rows) {
      const sig = Object.keys(row).sort().join(',');
      if (!groups.has(sig)) groups.set(sig, []);
      groups.get(sig).push(row);
    }
    for (const records of groups.values()) {
      // onConflict 'id' is what makes re-dropping the same JBA file safe: the
      // job number is the primary key, so an existing job is updated in place
      // and never duplicated.
      const { error } = await getClient().from('jobs').upsert(records, { onConflict: 'id' });
      if (error) throw error;
    }
    return { ok: true, written: rows.length };
  } catch (e) {
    console.error('Supabase Jobs-by-Age import batch error:', e);
    return { ok: false, error: e };
  }
}

export function subscribeToJobs(callback) {
  try {
    const channel = getClient()
      .channel('public:jobs')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jobs' },
        () => {
          loadJobs().then(jobs => {
            if (jobs && jobs.length > 0) {
              callback(jobs);
            }
          }).catch(() => {
            // Silently handle - RLS may be blocking
          });
        }
      )
      .subscribe();
    return () => {
      channel.unsubscribe();
    };
  } catch (e) {
    // Silently handle subscription errors
    return () => {};
  }
}

// ============ SCHEDULED SLOTS ============

let slotsCache = {};
let slotsCacheTime = 0;

export async function loadScheduledSlots() {
  try {
    const { data, error } = await getClient()
      .from('scheduled_slots')
      .select('*');
    if (error) {
      // RLS policy likely blocking; return cached silently
      return slotsCache;
    }

    // Transform flat array back into the app's slot map: slotKey -> jobId.
    // The value MUST be the bare job id string, not an object — every reader
    // (useScheduler.js, scheduler.js:59) compares it directly against job.id,
    // and the optimistic drag updates write bare ids too. Returning objects
    // here silently broke slot-clearing on every code path after a reload.
    const slotMap = {};
    (data || []).forEach(slot => {
      slotMap[slot.slot_id] = slot.job_id;
    });
    slotsCache = slotMap;
    slotsCacheTime = Date.now();
    return slotMap;
  } catch (e) {
    // Return cache without logging
    return slotsCache;
  }
}

export async function loadScheduledSlotsForDay(dateStr) {
  try {
    const { data, error } = await getClient()
      .from('scheduled_slots')
      .select('*')
      .ilike('slot_id', `${dateStr}-%`);
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error(`Supabase load slots for ${dateStr} error:`, e);
    return [];
  }
}

export async function saveScheduledSlot(slotId, jobId, bench) {
  try {
    const { data, error } = await getClient()
      .from('scheduled_slots')
      .upsert(
        { slot_id: slotId, job_id: jobId, bench },
        { onConflict: 'slot_id' }
      )
      .select();
    if (error) throw error;
    return data?.[0];
  } catch (e) {
    if (e.code === '23505') {
      // Unique constraint violation
      console.warn(`Slot ${slotId} already occupied`);
      return null;
    }
    console.error(`Supabase save scheduled slot ${slotId} error:`, e);
    return null;
  }
}

export async function deleteScheduledSlot(slotId) {
  try {
    const { error } = await getClient()
      .from('scheduled_slots')
      .delete()
      .eq('slot_id', slotId);
    if (error) throw error;
  } catch (e) {
    console.error(`Supabase delete slot ${slotId} error:`, e);
  }
}

// Batch add/remove scheduled slots in one round-trip each (used by
// calendar drag-and-drop, which moves several slots at once). Removes run
// before adds so a slot being freed up and re-claimed in the same move
// doesn't collide with the unique slot_id constraint.
export async function saveScheduledSlotsBatch(adds, removes) {
  try {
    if (removes && removes.length > 0) {
      const { error } = await getClient()
        .from('scheduled_slots')
        .delete()
        .in('slot_id', removes);
      if (error) throw error;
    }
    if (adds && adds.length > 0) {
      const records = adds.map(a => ({ slot_id: a.slotId, job_id: a.jobId, bench: a.bench }));
      const { error } = await getClient()
        .from('scheduled_slots')
        .upsert(records, { onConflict: 'slot_id' });
      if (error) throw error;
    }
    return { ok: true };
  } catch (e) {
    console.error('Supabase save scheduled slots batch error:', e);
    return { ok: false, error: e };
  }
}

export function subscribeToScheduledSlots(callback) {
  try {
    const channel = getClient()
      .channel('public:scheduled_slots')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'scheduled_slots' },
        () => {
          loadScheduledSlots().then(slots => {
            if (slots && Object.keys(slots).length > 0) {
              callback(slots);
            }
          }).catch(() => {
            // Silently handle - RLS may be blocking
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          loadScheduledSlots().then(callback).catch(() => {
            callback({});
          });
        }
      });
    return () => {
      channel.unsubscribe();
    };
  } catch (e) {
    console.error('Supabase subscribe to scheduled slots error:', e);
    return () => {};
  }
}

// ============ CONFLICT LOG ============

export async function appendConflictLog(events) {
  try {
    const records = events.map(e => ({
      id: `${Date.now()}-${Math.random()}`,
      slot_id: e.slotId,
      job_id: e.jobId,
      conflict_type: e.type,
      details: e.details || {},
      created_at: new Date().toISOString(),
    }));

    const { error } = await getClient()
      .from('conflict_log')
      .insert(records);
    if (error) throw error;
  } catch (e) {
    console.error('Supabase append conflict log error:', e);
  }
}

export async function loadConflictLog() {
  try {
    const { data, error } = await getClient()
      .from('conflict_log')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error('Supabase load conflict log error:', e);
    return [];
  }
}

export async function clearConflictLog() {
  try {
    const { error } = await getClient()
      .from('conflict_log')
      .delete()
      .neq('id', '');
    if (error) throw error;
  } catch (e) {
    console.error('Supabase clear conflict log error:', e);
  }
}

// ============ PARKING LOT (other features, if needed) ============

export async function loadParkingLot() {
  try {
    const { data, error } = await getClient()
      .from('parking_lot')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error('Supabase load parking lot error:', e);
    return [];
  }
}

export async function saveParkingLot(items) {
  try {
    // Clear and re-insert (simple approach; could be optimized later)
    await clearParkingLot();
    const records = items.map((item, idx) => ({
      id: item.id || `pl-${Date.now()}-${idx}`,
      content: item.content || item,
      created_at: new Date().toISOString(),
    }));
    const { error } = await getClient()
      .from('parking_lot')
      .insert(records);
    if (error) throw error;
  } catch (e) {
    console.error('Supabase save parking lot error:', e);
  }
}

async function clearParkingLot() {
  try {
    const { error } = await getClient()
      .from('parking_lot')
      .delete()
      .neq('id', '');
    if (error) throw error;
  } catch (e) {
    console.error('Supabase clear parking lot error:', e);
  }
}

export function subscribeToParkingLot(callback) {
  try {
    const channel = getClient()
      .channel('public:parking_lot')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'parking_lot' },
        () => {
          loadParkingLot().then(callback);
        }
      )
      .subscribe();
    return () => {
      channel.unsubscribe();
    };
  } catch (e) {
    console.error('Supabase subscribe to parking lot error:', e);
    return () => {};
  }
}

// ============ AD HOC TASKS ============

export async function loadAdHocTasks() {
  try {
    const { data, error } = await getClient()
      .from('ad_hoc_tasks')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (e) {
    console.error('Supabase load ad-hoc tasks error:', e);
    return [];
  }
}

export async function saveAdHocTasks(tasks) {
  try {
    await clearAdHocTasks();
    const records = tasks.map((task, idx) => ({
      id: task.id || `adhoc-${Date.now()}-${idx}`,
      text: task.text,
      hours: task.hours,
      calendar_slot: task.calendarSlot,
      slot_keys: task.slotKeys,
      date_key: task.dateKey,
      created_at: task.createdAt || new Date().toISOString(),
    }));
    const { error } = await getClient()
      .from('ad_hoc_tasks')
      .insert(records);
    if (error) throw error;
  } catch (e) {
    console.error('Supabase save ad-hoc tasks error:', e);
  }
}

async function clearAdHocTasks() {
  try {
    const { error } = await getClient()
      .from('ad_hoc_tasks')
      .delete()
      .neq('id', '');
    if (error) throw error;
  } catch (e) {
    console.error('Supabase clear ad-hoc tasks error:', e);
  }
}

export function subscribeToAdHocTasks(callback) {
  try {
    const channel = getClient()
      .channel('public:ad_hoc_tasks')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ad_hoc_tasks' },
        () => {
          loadAdHocTasks().then(callback);
        }
      )
      .subscribe();
    return () => {
      channel.unsubscribe();
    };
  } catch (e) {
    console.error('Supabase subscribe to ad-hoc tasks error:', e);
    return () => {};
  }
}

// ============ FOCUS LIST ============

// Returns an array of job IDs on success, or null if the read genuinely
// failed. The null/[] distinction matters: callers must never treat a failed
// read as "the focus list is empty" and then persist that emptiness back —
// saveFocusList() clears the table before inserting, so one bad read followed
// by an auto-save would permanently destroy the list.
export async function loadFocusList() {
  try {
    const { data, error } = await getClient()
      .from('focus_list')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(d => d.job_id);
  } catch (e) {
    console.error('Supabase load focus list error:', e);
    return null;
  }
}

// Replaces the whole list. Snapshots the existing rows first and restores them
// if the insert fails, so a half-completed write can't leave the table empty.
// Returns true on success, false on failure.
export async function saveFocusList(jobIds) {
  if (!Array.isArray(jobIds)) {
    console.error('Supabase save focus list refused: expected an array, got', jobIds);
    return false;
  }
  let previousRows = null;
  try {
    const { data: prev, error: prevError } = await getClient()
      .from('focus_list')
      .select('*');
    if (prevError) throw prevError;
    previousRows = prev || [];

    await clearFocusList();

    const records = jobIds.map((jobId, idx) => ({
      id: `fl-${Date.now()}-${idx}`,
      job_id: jobId,
      created_at: new Date().toISOString(),
    }));
    if (records.length) {
      const { error } = await getClient()
        .from('focus_list')
        .insert(records);
      if (error) throw error;
    }
    return true;
  } catch (e) {
    console.error('Supabase save focus list error:', e);
    if (previousRows && previousRows.length) {
      try {
        // upsert, not insert: the failure may have been the clear itself, in
        // which case the rows are still present and an insert would collide on
        // the primary key. upsert restores in both cases.
        const { error: restoreError } = await getClient()
          .from('focus_list')
          .upsert(previousRows, { onConflict: 'id' });
        if (restoreError) throw restoreError;
        console.error('Supabase save focus list: restored previous rows after failed write');
      } catch (restoreError) {
        console.error('Supabase save focus list: RESTORE FAILED', restoreError);
      }
    }
    return false;
  }
}

// Throws on failure — saveFocusList() needs to know the clear didn't happen
// so it can abort rather than insert on top of rows it thinks are gone.
async function clearFocusList() {
  const { error } = await getClient()
    .from('focus_list')
    .delete()
    .neq('id', '');
  if (error) throw error;
}

export function subscribeToFocusList(callback) {
  try {
    const channel = getClient()
      .channel('public:focus_list')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'focus_list' },
        () => {
          // null means the re-read failed — drop the event rather than hand
          // the caller a bogus value it might persist back over good data.
          loadFocusList().then(data => {
            if (data !== null) callback(data);
          });
        }
      )
      .subscribe();
    return () => {
      channel.unsubscribe();
    };
  } catch (e) {
    console.error('Supabase subscribe to focus list error:', e);
    return () => {};
  }
}

// ============ PENDING REVENUE REVIEW ============

export async function loadPendingRevenueReview() {
  try {
    const { data, error } = await getClient()
      .from('pending_revenue_review')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;

    // Transform array to map keyed by id for compatibility
    const itemsById = {};
    (data || []).forEach(item => {
      itemsById[String(item.id)] = {
        id: item.id,
        job: item.job,
        customer: item.customer,
        mfr: item.mfr,
        model: item.model,
        desc: item.desc,
        hours: item.hours,
        disappearedAt: item.disappeared_at,
      };
    });
    return itemsById;
  } catch (e) {
    console.error('Supabase load pending revenue review error:', e);
    return {};
  }
}

export async function addPendingRevenueReviewItems(items) {
  if (!items || items.length === 0) return;
  try {
    const records = items.map(j => ({
      id: j.id || `prr-${Date.now()}-${Math.random()}`,
      job: j.job,
      customer: j.customer,
      mfr: j.mfr,
      model: j.model,
      desc: j.desc,
      hours: j.hours,
      disappeared_at: j.disappearedAt || new Date().toISOString(),
      created_at: new Date().toISOString(),
    }));
    const { error } = await getClient()
      .from('pending_revenue_review')
      .insert(records);
    if (error) throw error;
  } catch (e) {
    console.error('Supabase add pending revenue review items error:', e);
  }
}

export async function removePendingRevenueReviewItem(itemId) {
  try {
    const { error } = await getClient()
      .from('pending_revenue_review')
      .delete()
      .eq('id', String(itemId));
    if (error) throw error;
  } catch (e) {
    console.error('Supabase remove pending revenue review item error:', e);
  }
}

export function subscribeToPendingRevenueReview(callback) {
  try {
    const channel = getClient()
      .channel('public:pending_revenue_review')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pending_revenue_review' },
        () => {
          loadPendingRevenueReview().then(callback);
        }
      )
      .subscribe();
    return () => {
      channel.unsubscribe();
    };
  } catch (e) {
    console.error('Supabase subscribe to pending revenue review error:', e);
    return () => {};
  }
}

// ============ PARTS TO ORDER (Sunday board meeting — Brief D) ============
//
// needed_for_job is a plain nullable TEXT column, NOT a foreign key — a part
// can be needed for a job number that no longer exists in `jobs` (or for no
// job in particular, e.g. general shop stock), and this table must not fail
// to insert just because that job row was deleted or never existed.
//
// FAILURE CONTRACT (changed 2026-08-01, when the page below them was built):
// all four read/write functions here log and then RE-THROW. They used to
// swallow the error and return normally — an empty map from a failed read, and
// nothing at all from a failed write. That is why nobody noticed that the table
// had no RLS policy for its first month: every insert the Sunday board meeting
// made was rejected by Postgres and looked like a success to its caller.
// PartsToOrderPage.jsx catches these and puts the failure on screen as
// persistent text. Do not put the swallowing catches back.
//
// subscribeToPartsToOrder is deliberately left alone: its try/catch governs
// subscription setup, not a write, and it has to return an unsubscribe function.

export async function loadPartsToOrder() {
  try {
    const { data, error } = await getClient()
      .from('parts_to_order')
      .select('*')
      .order('added_at', { ascending: false });
    if (error) throw error;

    // Transform array to map keyed by id, matching loadPendingRevenueReview().
    const itemsById = {};
    (data || []).forEach(item => {
      itemsById[String(item.id)] = {
        id: item.id,
        description: item.description,
        category: item.category,
        neededForJob: item.needed_for_job,
        addedAt: item.added_at,
        resolved: item.resolved,
      };
    });
    return itemsById;
  } catch (e) {
    console.error('Supabase load parts to order error:', e);
    throw e;
  }
}

export async function addPartsToOrderItems(items) {
  if (!items || items.length === 0) return;
  try {
    const records = items.map(item => ({
      id: item.id || `pto-${Date.now()}-${Math.random()}`,
      description: item.description,
      category: item.category || 'part',
      needed_for_job: item.neededForJob ?? null,
      added_at: item.addedAt || new Date().toISOString(),
      resolved: item.resolved || false,
    }));
    const { error } = await getClient()
      .from('parts_to_order')
      .insert(records);
    if (error) throw error;
  } catch (e) {
    console.error('Supabase add parts to order items error:', e);
    throw e;
  }
}

export async function removePartsToOrderItem(itemId) {
  try {
    const { error } = await getClient()
      .from('parts_to_order')
      .delete()
      .eq('id', String(itemId));
    if (error) throw error;
  } catch (e) {
    console.error('Supabase remove parts to order item error:', e);
    throw e;
  }
}

// In-place update rather than delete+re-add — resolving a part is a status
// flip, not a removal, and the row (description/category/neededForJob) is
// worth keeping for the next meeting's "what got sorted this week" glance.
export async function markPartResolved(id, resolved) {
  try {
    const { error } = await getClient()
      .from('parts_to_order')
      .update({ resolved })
      .eq('id', String(id));
    if (error) throw error;
  } catch (e) {
    console.error('Supabase mark part resolved error:', e);
    throw e;
  }
}

export function subscribeToPartsToOrder(callback) {
  try {
    const channel = getClient()
      .channel('public:parts_to_order')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'parts_to_order' },
        () => {
          loadPartsToOrder().then(callback);
        }
      )
      .subscribe();
    return () => {
      channel.unsubscribe();
    };
  } catch (e) {
    console.error('Supabase subscribe to parts to order error:', e);
    return () => {};
  }
}

// ============ JOB STATUS SINCE (stuck clock — Brief E) ============
//
// One row per top-level job: when it last entered its current status+action.
//
// Deliberately NOT modelled on the focus list. saveFocusList() clears the whole
// table and rewrites it, which is why it needs a snapshot-and-restore guard —
// one bad read there can destroy every row. This table is per-row: an upsert
// touches only the jobs that actually changed and a delete names its ids
// explicitly, so that failure mode does not exist and copying the pattern would
// import the risk for no benefit. There is no table-wipe function here on
// purpose — no bare .neq('job_id', ''), ever.

// Returns { [jobId]: { status, action, since } } on success, or null if the
// read genuinely failed. The null/{} distinction is load-bearing, exactly as it
// is for loadFocusList(): it is what lets useJobStatusSince refuse to arm any
// write after a failed read. An empty object means "no job has a clock yet"
// (true on day one); null means "we don't know", and a caller that treats those
// the same will re-stamp since=now over every real stuck age in the shop.
export async function loadStatusSince() {
  try {
    const { data, error } = await getClient()
      .from('job_status_since')
      .select('*');
    if (error) throw error;
    const byJobId = {};
    (data || []).forEach(r => {
      byJobId[String(r.job_id)] = { status: r.status, action: r.action, since: r.since };
    });
    return byJobId;
  } catch (e) {
    console.error('Supabase load job status since error:', e);
    return null;
  }
}

// Per-row upsert, keyed on job_id. Resolves { ok: boolean } rather than
// throwing — same convention as batchWriteJobsState(), so callers can gate on
// res?.ok and surface a failure to the user instead of an unhandled rejection.
export async function upsertStatusSince(rows) {
  if (!Array.isArray(rows)) {
    console.error('Supabase upsert job status since refused: expected an array, got', rows);
    return { ok: false };
  }
  if (rows.length === 0) return { ok: true };
  try {
    const records = rows.map(r => ({
      job_id: String(r.jobId ?? r.job_id),
      status: r.status ?? '',
      action: r.action ?? null,
      since: r.since || new Date().toISOString(),
    }));
    const { error } = await getClient()
      .from('job_status_since')
      .upsert(records, { onConflict: 'job_id' });
    if (error) throw error;
    return { ok: true };
  } catch (e) {
    console.error('Supabase upsert job status since error:', e);
    return { ok: false, error: e };
  }
}

// Deletes the named rows and nothing else. The id list is required and an empty
// list is a no-op, never a wipe: a bug that produced an empty array must not be
// able to clear the table.
export async function clearStatusSince(jobIds) {
  if (!Array.isArray(jobIds)) {
    console.error('Supabase clear job status since refused: expected an array, got', jobIds);
    return { ok: false };
  }
  if (jobIds.length === 0) return { ok: true };
  try {
    const { error } = await getClient()
      .from('job_status_since')
      .delete()
      .in('job_id', jobIds.map(String));
    if (error) throw error;
    return { ok: true };
  } catch (e) {
    console.error('Supabase clear job status since error:', e);
    return { ok: false, error: e };
  }
}

export function subscribeToStatusSince(callback) {
  try {
    const channel = getClient()
      .channel('public:job_status_since')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'job_status_since' },
        () => {
          // null means the re-read failed — drop the event rather than hand the
          // caller an empty picture it might reconcile against and overwrite.
          loadStatusSince().then(data => {
            if (data !== null) callback(data);
          });
        }
      )
      .subscribe();
    return () => {
      channel.unsubscribe();
    };
  } catch (e) {
    console.error('Supabase subscribe to job status since error:', e);
    return () => {};
  }
}

// ============ COMPLETED JOBS ============

export async function saveCompletedJobs(records, doneJobIds) {
  try {
    // Clear and re-insert completed jobs
    await clearCompletedJobs();
    const completedRecords = records.map((record, idx) => ({
      id: `cj-${Date.now()}-${idx}`,
      job_id: record.id,
      job_number: record.job,
      customer: record.customer,
      mfr: record.mfr,
      model: record.model,
      hours: record.hours,
      invoice_amount: record.invoiceAmount,
      week_key: record.weekKey,
      completed_at: record.completedAt || new Date().toISOString(),
      created_at: new Date().toISOString(),
    }));

    const { error } = await getClient()
      .from('completed_jobs')
      .insert(completedRecords);
    if (error) throw error;
  } catch (e) {
    console.error('Supabase save completed jobs error:', e);
  }
}

async function clearCompletedJobs() {
  try {
    const { error } = await getClient()
      .from('completed_jobs')
      .delete()
      .neq('id', '');
    if (error) throw error;
  } catch (e) {
    console.error('Supabase clear completed jobs error:', e);
  }
}

export function subscribeToCompletedJobs(callback) {
  try {
    const channel = getClient()
      .channel('public:completed_jobs')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'completed_jobs' },
        () => {
          loadCompletedJobs().then(callback);
        }
      )
      .subscribe();
    return () => {
      channel.unsubscribe();
    };
  } catch (e) {
    console.error('Supabase subscribe to completed jobs error:', e);
    return () => {};
  }
}

// Was missing `export` and returned raw snake_case rows — nothing could
// actually call this from outside the module, and handleMarkDone()'s
// invoiceAmount/weekKey would have come back as invoice_amount/week_key had
// anything tried. Exported and remapped to the same camelCase shape
// handleMarkDone() builds in src/hooks/useJobs.js.
export async function loadCompletedJobs() {
  try {
    const { data, error } = await getClient()
      .from('completed_jobs')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    const records = (data || []).map(row => ({
      id: row.job_id,
      job: row.job_number,
      customer: row.customer,
      mfr: row.mfr,
      model: row.model,
      hours: row.hours,
      invoiceAmount: row.invoice_amount,
      completedAt: row.completed_at,
      weekKey: row.week_key,
    }));
    return { records, doneJobIds: (data || []).map(d => d.job_id) };
  } catch (e) {
    console.error('Supabase load completed jobs error:', e);
    return { records: [], doneJobIds: [] };
  }
}

// ============ DAILY LOG (bujo) ============
//
// Two tables: daily_logs (one row per local date_key) + deferred_items (one
// row per deferred item). Writes are per-key upserts (onConflict), NOT the
// parking-lot clear-and-re-insert — clearing would wipe months of log history
// on every save. loadDailyLogs() reconstructs the exact { logs, deferredItems }
// shape useDailyLog.js expects; the per-key writers touch only the keys/ids the
// caller changed so two devices editing different days never clobber each other.

export async function loadDailyLogs() {
  const empty = { logs: {}, deferredItems: [] };
  try {
    const [logsRes, deferredRes] = await Promise.all([
      getClient().from('daily_logs').select('*'),
      getClient().from('deferred_items').select('*').order('created_at', { ascending: true }),
    ]);
    if (logsRes.error) throw logsRes.error;
    if (deferredRes.error) throw deferredRes.error;

    const logs = {};
    (logsRes.data || []).forEach(row => {
      logs[row.date_key] = {
        bullets: row.bullets || [],
        closedAt: row.closed_at || null,
        locked: row.locked || false,
      };
    });

    const deferredItems = (deferredRes.data || []).map(row => ({
      id: row.id,
      jobId: row.job_id,
      bulletText: row.bullet_text,
      text: row.text,
      reason: row.reason,
      createdAt: row.created_at,
    }));

    return { logs, deferredItems };
  } catch (e) {
    console.error('Supabase load daily logs error:', e);
    // Signal failure with null so the hook's load-gate does NOT flip ready on a
    // failed read (an empty-object fallback would look like a real empty load
    // and re-open the 2026-07-05 data-loss window).
    return null;
  }
}

// Upsert only the touched date_keys. `days` is an array of
// { dateKey, day: { bullets, closedAt, locked } } — closeDay touches 2+ days
// (today + tomorrow) in one flush, resolveStaleDays touches many.
export async function saveDailyLogDays(days) {
  if (!days || days.length === 0) return { ok: true };
  try {
    const records = days.map(({ dateKey, day }) => ({
      date_key: dateKey,
      bullets: day.bullets || [],
      closed_at: day.closedAt || null,
      locked: day.locked || false,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await getClient()
      .from('daily_logs')
      .upsert(records, { onConflict: 'date_key' });
    if (error) throw error;
    return { ok: true };
  } catch (e) {
    console.error('Supabase save daily log days error:', e);
    return { ok: false, error: e };
  }
}

// Per-item deferred writes: upsert the items present now, delete the ids that
// were removed. Never rewrites the whole table.
export async function saveDeferredItems(upserts, removeIds) {
  try {
    if (removeIds && removeIds.length > 0) {
      const { error } = await getClient()
        .from('deferred_items')
        .delete()
        .in('id', removeIds);
      if (error) throw error;
    }
    if (upserts && upserts.length > 0) {
      const records = upserts.map(item => ({
        id: item.id,
        job_id: item.jobId ?? null,
        bullet_text: item.bulletText ?? null,
        text: item.text ?? null,
        reason: item.reason ?? null,
        created_at: item.createdAt || new Date().toISOString(),
      }));
      const { error } = await getClient()
        .from('deferred_items')
        .upsert(records, { onConflict: 'id' });
      if (error) throw error;
    }
    return { ok: true };
  } catch (e) {
    console.error('Supabase save deferred items error:', e);
    return { ok: false, error: e };
  }
}

// On any change, hand the freshly-loaded server state back to the hook, which
// does the MERGE-not-replace (keep pending local keys, take server for the
// rest). Deliberately NO `length > 0` non-empty guard — an empty daily log is
// legitimate, unlike scheduled_slots. loadDailyLogs() returns null only on a
// read error, which we skip so a transient failure can't blank local state.
export function subscribeToDailyLogs(callback) {
  try {
    const reload = () => {
      loadDailyLogs().then(state => {
        if (state) callback(state);
      }).catch(() => {
        // Silently handle - RLS may be blocking
      });
    };
    const channel = getClient()
      .channel('public:daily_logs')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_logs' },
        reload
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'deferred_items' },
        reload
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') reload();
      });
    return () => {
      channel.unsubscribe();
    };
  } catch (e) {
    console.error('Supabase subscribe to daily logs error:', e);
    return () => {};
  }
}

// ============ ALIASES FOR COMPATIBILITY WITH FIREBASE API ============

// Alias: loadJobsMaster is the same as loadJobs
export const loadJobsMaster = loadJobs;

// Alias: loadJobsState is the same as loadJobs (combined in Supabase)
export const loadJobsState = loadJobs;

// Alias: subscribeToJobsMaster is the same as subscribeToJobs
export const subscribeToJobsMaster = subscribeToJobs;

// Alias: subscribeToJobsState is the same as subscribeToJobs (combined in Supabase)
export const subscribeToJobsState = subscribeToJobs;

// Batch write for jobsState — upserts (not update-only) so brand-new rows
// (e.g. freshly created split children) actually persist instead of silently
// no-oping. Deletes and upserts are each done in one round-trip.
export async function batchWriteJobsState(writes) {
  if (!writes || writes.length === 0) return { ok: true };
  const upserts = writes.filter(w => !w.delete);
  const deletes = writes.filter(w => w.delete);
  try {
    if (upserts.length > 0) {
      // Build every row first, then group by its exact set of columns. A
      // single Supabase upsert with an array sends the UNION of all rows'
      // keys as the column list and fills any row missing a key with NULL.
      // That's silently destructive here: a manual split batches the sparse
      // parent row (state fields only, no `job`) together with full child
      // rows (which carry `job`), so the parent row gets job=NULL — either
      // aborting the whole batch on the NOT NULL `job` column (so the split
      // never persists, the exact bug this fix targets) or blanking a
      // nullable column a sparser row never meant to touch. Grouping means
      // every row in a given request has identical columns, so nothing is
      // NULL-filled. Same-column rows still batch in one round-trip.
      const groups = new Map();
      for (const w of upserts) {
        const row = { ...toJobRow(w.data), id: w.id, updated_at: new Date().toISOString() };
        const sig = Object.keys(row).sort().join(',');
        if (!groups.has(sig)) groups.set(sig, []);
        groups.get(sig).push(row);
      }
      for (const records of groups.values()) {
        const { error } = await getClient()
          .from('jobs')
          .upsert(records, { onConflict: 'id' });
        if (error) throw error;
      }
    }
    if (deletes.length > 0) {
      const { error } = await getClient()
        .from('jobs')
        .delete()
        .in('id', deletes.map(w => w.id));
      if (error) throw error;
    }
    return { ok: true };
  } catch (e) {
    console.error('Supabase batch write jobs state error:', e);
    return { ok: false, error: e };
  }
}
