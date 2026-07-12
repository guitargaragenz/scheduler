import { initializeApp } from 'firebase/app';
import {
  getFirestore, doc, getDoc, getDocs, setDoc, deleteDoc, onSnapshot,
  deleteField, collection, writeBatch,
} from 'firebase/firestore';

const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};

export function isFirebaseConfigured() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);
}

let app, db;

function getDb() {
  if (!db) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
  }
  return db;
}

const SCHEDULE_DOC     = () => doc(getDb(), 'ggnz', 'schedule');
const PARKING_LOT_DOC  = () => doc(getDb(), 'ggnz', 'parkingLot');

export async function loadSchedule() {
  try {
    const snap = await getDoc(SCHEDULE_DOC());
    if (!snap.exists()) return null;
    return snap.data();
  } catch (e) {
    console.error('Firestore load error:', e);
    return null;
  }
}

export async function saveSchedule(jobs, scheduledSlots) {
  try {
    await setDoc(SCHEDULE_DOC(), {
      jobs,
      scheduledSlots,
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error('Firestore save error:', e);
  }
}

export async function loadParkingLot() {
  try {
    const snap = await getDoc(PARKING_LOT_DOC());
    if (!snap.exists()) return [];
    return snap.data().items || [];
  } catch (e) {
    console.error('Firestore parking lot load error:', e);
    return [];
  }
}

export async function saveParkingLot(items) {
  try {
    await setDoc(PARKING_LOT_DOC(), { items, updatedAt: new Date().toISOString() });
  } catch (e) {
    console.error('Firestore parking lot save error:', e);
  }
}

export function subscribeToParkingLot(callback) {
  try {
    return onSnapshot(PARKING_LOT_DOC(), (snap) => {
      if (snap.exists()) callback(snap.data().items || []);
    });
  } catch (e) {
    console.error('Firestore parking lot subscribe error:', e);
    return () => {};
  }
}

const ADHOC_TASKS_DOC = () => doc(getDb(), 'ggnz', 'adHocTasks');

// Ad-hoc maintenance tasks — scheduled bullet-journal notes not tied to a real
// CSV job. Kept in their own doc so they never touch the `jobs` array / CSV
// drift-safety check.
export async function loadAdHocTasks() {
  try {
    const snap = await getDoc(ADHOC_TASKS_DOC());
    if (!snap.exists()) return [];
    return snap.data().tasks || [];
  } catch (e) {
    console.error('Firestore ad-hoc tasks load error:', e);
    return [];
  }
}

export async function saveAdHocTasks(tasks) {
  try {
    await setDoc(ADHOC_TASKS_DOC(), { tasks, updatedAt: new Date().toISOString() });
  } catch (e) {
    console.error('Firestore ad-hoc tasks save error:', e);
  }
}

export function subscribeToAdHocTasks(callback) {
  try {
    return onSnapshot(ADHOC_TASKS_DOC(), snap => {
      callback(snap.exists() ? (snap.data().tasks || []) : []);
    });
  } catch (e) {
    console.error('Firestore ad-hoc tasks subscribe error:', e);
    return () => {};
  }
}

const FOCUS_LIST_DOC = () => doc(getDb(), 'ggnz', 'focusList');

// Focus list — job IDs Trevor is prioritizing this week, picked from the
// Sunday board-meeting interview. Kept in its own doc so it never touches
// the `jobs` array / CSV drift-safety check.
export async function loadFocusList() {
  try {
    const snap = await getDoc(FOCUS_LIST_DOC());
    if (!snap.exists()) return [];
    return snap.data().jobIds || [];
  } catch (e) {
    console.error('Firestore focus list load error:', e);
    return [];
  }
}

export async function saveFocusList(jobIds) {
  try {
    await setDoc(FOCUS_LIST_DOC(), { jobIds, updatedAt: new Date().toISOString() });
  } catch (e) {
    console.error('Firestore focus list save error:', e);
  }
}

export function subscribeToFocusList(callback) {
  try {
    return onSnapshot(FOCUS_LIST_DOC(), snap => {
      callback(snap.exists() ? (snap.data().jobIds || []) : []);
    });
  } catch (e) {
    console.error('Firestore focus list subscribe error:', e);
    return () => {};
  }
}

const COMPLETED_JOBS_DOC = () => doc(getDb(), 'ggnz', 'completedJobs');

export async function saveCompletedJobs(records, doneJobIds) {
  try {
    await setDoc(COMPLETED_JOBS_DOC(), { records, doneJobIds, updatedAt: new Date().toISOString() });
  } catch (e) {
    console.error('Firestore completed jobs save error:', e);
  }
}

export function subscribeToCompletedJobs(callback) {
  try {
    return onSnapshot(COMPLETED_JOBS_DOC(), snap => {
      callback(snap.exists() ? snap.data() : { records: [], doneJobIds: [] });
    });
  } catch (e) {
    console.error('Firestore completed jobs subscribe error:', e);
    return () => {};
  }
}

const CONFLICT_LOG_DOC = () => doc(getDb(), 'ggnz', 'conflictLog');

// Append bump events to the durable conflict log.
// events: array of { ts, jobNum, mfr, model, oldSlot, newSlot|null, reason?, reasonText? }
// reason/reasonText (Problem 3) are optional — set when a bump was captured
// via BumpReasonModal (manual day-to-day drag). Older/GCal-conflict-bump
// events written before Problem 3 simply omit them; no shape validation here,
// so no migration needed for existing log entries.
export async function appendConflictLog(events) {
  try {
    const snap = await getDoc(CONFLICT_LOG_DOC());
    const existing = snap.exists() ? (snap.data().events || []) : [];
    await setDoc(CONFLICT_LOG_DOC(), {
      events: [...existing, ...events],
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error('Firestore conflict log save error:', e);
  }
}

export async function loadConflictLog() {
  try {
    const snap = await getDoc(CONFLICT_LOG_DOC());
    return snap.exists() ? (snap.data().events || []) : [];
  } catch (e) {
    console.error('Firestore conflict log load error:', e);
    return [];
  }
}

export async function clearConflictLog() {
  try {
    await setDoc(CONFLICT_LOG_DOC(), { events: [], updatedAt: new Date().toISOString() });
  } catch (e) {
    console.error('Firestore conflict log clear error:', e);
  }
}

const PENDING_REVENUE_REVIEW_DOC = () => doc(getDb(), 'ggnz', 'pendingRevenueReview');

// Jobs that vanished from a CSV/Sheet sync without being marked done in-app,
// PLUS orphaned split-child jobsState docs surfaced by the jobsMaster/
// jobsState join (architecture brief design decision #1) — both awaiting
// Trevor's Done+invoiced/Cancelled call. Keyed by each item's own Firestore
// doc id (not job number, not a plain array): job number is undefined on a
// top-level jobsState doc (jobsMaster owns it) and is SHARED across every
// split child of the same parent, so keying by job number silently clobbers
// one simultaneous orphan with another — exactly the kind of "data survives
// in Firestore but only the last one is visible" bug this migration exists
// to eliminate. Written with field-level merge, never a blind setDoc, since
// an automated sync (adding a newly-disappeared job) and a manual dismiss
// from another device can land around the same time and this doc holds
// financial data.
export async function loadPendingRevenueReview() {
  try {
    const snap = await getDoc(PENDING_REVENUE_REVIEW_DOC());
    if (!snap.exists()) return {};
    return snap.data().items || {};
  } catch (e) {
    console.error('Firestore pending revenue review load error:', e);
    return {};
  }
}

export async function addPendingRevenueReviewItems(items) {
  if (!items || items.length === 0) return;
  try {
    const itemsById = Object.fromEntries(items.map(j => [String(j.id), j]));
    await setDoc(PENDING_REVENUE_REVIEW_DOC(), {
      items: itemsById,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (e) {
    console.error('Firestore pending revenue review add error:', e);
  }
}

export async function removePendingRevenueReviewItem(itemId) {
  try {
    await setDoc(PENDING_REVENUE_REVIEW_DOC(), {
      items: { [String(itemId)]: deleteField() },
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (e) {
    console.error('Firestore pending revenue review remove error:', e);
  }
}

export function subscribeToPendingRevenueReview(callback) {
  try {
    return onSnapshot(PENDING_REVENUE_REVIEW_DOC(), snap => {
      callback(snap.exists() ? (snap.data().items || {}) : {});
    });
  } catch (e) {
    console.error('Firestore pending revenue review subscribe error:', e);
    return () => {};
  }
}

// Subscribe to real-time updates from other devices
// Returns an unsubscribe function
export function subscribeToSchedule(callback) {
  try {
    return onSnapshot(SCHEDULE_DOC(), (snap) => {
      if (snap.exists()) callback(snap.data());
    });
  } catch (e) {
    console.error('Firestore subscribe error:', e);
    return () => {};
  }
}

// ---------------------------------------------------------------------------
// jobsMaster / jobsState — replaces the legacy single ggnz/schedule doc.
//
// The old doc held ONE `jobs` array mixing CSV/Sheet-owned fields and
// app-owned fields, blind-overwritten in full by two independent writers
// (the Python sync script and this app). That's what silently deleted
// #1520/#1175's manually-split task data — see the architecture brief for
// the full incident writeup. Each collection below has exactly one writer
// and is updated per-document, never as a whole-collection overwrite.
//
// jobsMaster/{jobId} — CSV/Sheet-owned fields only (job number, mfr, model,
//   desc, status, action, customer, tag, vb, backlog, project, days,
//   hours, bench, schedulable flags). Written only by the CSV upload path
//   (handleCsvUpload) and, outside this repo, sheet_to_csv.command — always
//   via per-job upserts, never a full-array rebuild. Holds top-level jobs
//   only; auto-split children are never stored here, they're re-derived by
//   the join layer from bench/desc/hours exactly as before.
//
// jobsState/{jobId} — app-owned fields only (scheduled, calendarSlot,
//   gcalEventId(s), pomoLog, done, noAutoSplit, sessionNote, bumpHistory).
//   Also the sole/full record for split-child ids (manual and auto), since
//   those ids don't correspond to a real CSV row. Written only by the React
//   app. Multi-document split-set changes (handleSaveDrawer) MUST go through
//   batchWriteJobsState() as a single writeBatch() — never sequential writes
//   — so a killed app/dropped network mid-split can't leave a half-created
//   split (architecture brief design decision #5, non-negotiable).
//
// The legacy `ggnz/schedule` functions above are kept in place through the
// post-cutover probation window (see architecture brief) — do not delete
// until that window has passed and the new collections are proven in
// production. This build session does not touch or write to them.
// ---------------------------------------------------------------------------

const JOBS_MASTER_COLLECTION = () => collection(getDb(), 'jobsMaster');
const JOBS_STATE_COLLECTION  = () => collection(getDb(), 'jobsState');
const jobsMasterDoc = (jobId) => doc(getDb(), 'jobsMaster', String(jobId));
const jobsStateDoc  = (jobId) => doc(getDb(), 'jobsState', String(jobId));

export async function loadJobsMaster() {
  try {
    const snap = await getDocs(JOBS_MASTER_COLLECTION());
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error('Firestore jobsMaster load error:', e);
    return [];
  }
}

export async function saveJobMaster(jobId, fields) {
  try {
    await setDoc(jobsMasterDoc(jobId), { ...fields, updatedAt: new Date().toISOString() });
  } catch (e) {
    console.error('Firestore jobsMaster save error:', e);
  }
}

// Per-job upserts for a full CSV parse — one doc write per top-level job in
// a batch, never a whole-collection overwrite. Chunked defensively at
// Firestore's 500-write batch cap (GGNZ's job count today is far below it).
export async function saveJobsMasterBatch(jobsList) {
  if (!jobsList || jobsList.length === 0) return;
  try {
    for (let i = 0; i < jobsList.length; i += 450) {
      const chunk = jobsList.slice(i, i + 450);
      const batch = writeBatch(getDb());
      const now = new Date().toISOString();
      chunk.forEach(job => {
        batch.set(jobsMasterDoc(job.id), { ...job, updatedAt: now });
      });
      await batch.commit();
    }
  } catch (e) {
    console.error('Firestore jobsMaster batch save error:', e);
  }
}

export function subscribeToJobsMaster(callback) {
  try {
    return onSnapshot(JOBS_MASTER_COLLECTION(), snap => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  } catch (e) {
    console.error('Firestore jobsMaster subscribe error:', e);
    return () => {};
  }
}

export async function loadJobsState() {
  try {
    const snap = await getDocs(JOBS_STATE_COLLECTION());
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error('Firestore jobsState load error:', e);
    return [];
  }
}

export async function saveJobState(jobId, fields) {
  try {
    await setDoc(jobsStateDoc(jobId), { ...fields, updatedAt: new Date().toISOString() });
  } catch (e) {
    console.error('Firestore jobsState save error:', e);
  }
}

export async function deleteJobState(jobId) {
  try {
    await deleteDoc(jobsStateDoc(jobId));
  } catch (e) {
    console.error('Firestore jobsState delete error:', e);
  }
}

export function subscribeToJobsState(callback) {
  try {
    return onSnapshot(JOBS_STATE_COLLECTION(), snap => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  } catch (e) {
    console.error('Firestore jobsState subscribe error:', e);
    return () => {};
  }
}

// Atomic multi-document write for one logical change (a split-set edit, or
// the periodic diff-save of scheduling/pomodoro/done state) — every create,
// update, and delete in `writes` lands in a single writeBatch(). Non-
// negotiable per architecture brief design decision #5: sequential
// setDoc/deleteDoc calls would let a killed app/dropped network leave a
// half-created split behind.
//
// writes: array of { id, data } to upsert, or { id, delete: true } to remove.
export async function batchWriteJobsState(writes) {
  if (!writes || writes.length === 0) return;
  try {
    const batch = writeBatch(getDb());
    const now = new Date().toISOString();
    writes.forEach(w => {
      if (w.delete) {
        batch.delete(jobsStateDoc(w.id));
      } else {
        batch.set(jobsStateDoc(w.id), { ...w.data, updatedAt: now });
      }
    });
    await batch.commit();
  } catch (e) {
    console.error('Firestore jobsState batch write error:', e);
  }
}

const SCHEDULED_SLOTS_DOC = () => doc(getDb(), 'ggnz', 'scheduledSlots');

// scheduledSlots — its own single-writer doc (architecture brief design
// decision #3). Previously lived inside the same ggnz/schedule doc as jobs;
// app-owned, follows the existing PARKING_LOT_DOC/FOCUS_LIST_DOC pattern.
export async function loadScheduledSlots() {
  try {
    const snap = await getDoc(SCHEDULED_SLOTS_DOC());
    if (!snap.exists()) return {};
    return snap.data().slots || {};
  } catch (e) {
    console.error('Firestore scheduledSlots load error:', e);
    return {};
  }
}

export async function saveScheduledSlots(slots) {
  try {
    await setDoc(SCHEDULED_SLOTS_DOC(), { slots, updatedAt: new Date().toISOString() });
  } catch (e) {
    console.error('Firestore scheduledSlots save error:', e);
  }
}

export function subscribeToScheduledSlots(callback) {
  try {
    return onSnapshot(SCHEDULED_SLOTS_DOC(), snap => {
      callback(snap.exists() ? (snap.data().slots || {}) : {});
    });
  } catch (e) {
    console.error('Firestore scheduledSlots subscribe error:', e);
    return () => {};
  }
}
