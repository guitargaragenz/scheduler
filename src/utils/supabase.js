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
  hasSubtasks: 'has_subtasks',
  VB: 'vb',
  BL: 'bl',
  PJ: 'pj',
};

// Fields whose app name already matches the column name.
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
    const col = JOB_COLUMN_MAP[k];
    if (col) row[col] = fields[k];
    else if (JOB_PASSTHROUGH_FIELDS.has(k)) row[k] = fields[k];
  });
  return row;
}

export async function upsertJobsBatch(jobsList) {
  try {
    const transformed = jobsList.map(job => ({
      id: job.id,
      parent_id: job.parentId || null,
      job: job.job,
      customer: job.customer,
      mfr: job.mfr,
      model: job.model,
      status: job.status,
      bench: job.bench,
      hours: job.hours,
      scheduled: job.scheduled,
      calendar_slot: job.calendarSlot || null,
      gcal_event_id: job.gcalEventId || null,
      desc: job.desc,
      tag: job.tag,
      action: job.action,
      vb: job.VB,
      bl: job.BL,
      pj: job.PJ,
      has_subtasks: job.hasSubtasks,
      created_at: job.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }));

    const { error } = await getClient()
      .from('jobs')
      .upsert(transformed, { onConflict: 'id' });
    if (error) throw error;
  } catch (e) {
    console.error('Supabase upsert jobs batch error:', e);
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
    return [];
  }
}

export async function saveFocusList(jobIds) {
  try {
    await clearFocusList();
    const records = jobIds.map((jobId, idx) => ({
      id: `fl-${Date.now()}-${idx}`,
      job_id: jobId,
      created_at: new Date().toISOString(),
    }));
    const { error } = await getClient()
      .from('focus_list')
      .insert(records);
    if (error) throw error;
  } catch (e) {
    console.error('Supabase save focus list error:', e);
  }
}

async function clearFocusList() {
  try {
    const { error } = await getClient()
      .from('focus_list')
      .delete()
      .neq('id', '');
    if (error) throw error;
  } catch (e) {
    console.error('Supabase clear focus list error:', e);
  }
}

export function subscribeToFocusList(callback) {
  try {
    const channel = getClient()
      .channel('public:focus_list')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'focus_list' },
        () => {
          loadFocusList().then(callback);
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

async function loadCompletedJobs() {
  try {
    const { data, error } = await getClient()
      .from('completed_jobs')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return { records: data || [], doneJobIds: (data || []).map(d => d.job_id) };
  } catch (e) {
    console.error('Supabase load completed jobs error:', e);
    return { records: [], doneJobIds: [] };
  }
}

// ============ ALIASES FOR COMPATIBILITY WITH FIREBASE API ============

// Alias: loadJobsMaster is the same as loadJobs
export const loadJobsMaster = loadJobs;

// Alias: saveJobsMasterBatch is the same as upsertJobsBatch
export const saveJobsMasterBatch = upsertJobsBatch;

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
      const records = upserts.map(w => ({
        ...toJobRow(w.data),
        id: w.id,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await getClient()
        .from('jobs')
        .upsert(records, { onConflict: 'id' });
      if (error) throw error;
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
