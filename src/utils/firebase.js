import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, onSnapshot, deleteField } from 'firebase/firestore';

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
// events: array of { ts, jobNum, mfr, model, oldSlot, newSlot|null }
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

// Jobs that vanished from a CSV/Sheet sync without being marked done in-app —
// awaiting Trevor's Done+invoiced/Cancelled call. Keyed by job number (not a
// plain array) and written with field-level merge, never a blind setDoc, since
// an automated sync (adding a newly-disappeared job) and a manual dismiss from
// another device can land around the same time and this doc holds financial data.
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
    const itemsByJobNo = Object.fromEntries(items.map(j => [String(j.job), j]));
    await setDoc(PENDING_REVENUE_REVIEW_DOC(), {
      items: itemsByJobNo,
      updatedAt: new Date().toISOString(),
    }, { merge: true });
  } catch (e) {
    console.error('Firestore pending revenue review add error:', e);
  }
}

export async function removePendingRevenueReviewItem(jobNo) {
  try {
    await setDoc(PENDING_REVENUE_REVIEW_DOC(), {
      items: { [String(jobNo)]: deleteField() },
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
