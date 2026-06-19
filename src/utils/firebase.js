import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';

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

const JOURNAL_DOC = () => doc(getDb(), 'ggnz', 'journal');

export async function loadJournal() {
  try {
    const snap = await getDoc(JOURNAL_DOC());
    if (!snap.exists()) return [];
    return snap.data().entries || [];
  } catch (e) {
    console.error('Firestore journal load error:', e);
    return [];
  }
}

export async function saveJournal(entries) {
  try {
    await setDoc(JOURNAL_DOC(), { entries, updatedAt: new Date().toISOString() });
  } catch (e) {
    console.error('Firestore journal save error:', e);
  }
}

export function subscribeToJournal(callback) {
  try {
    return onSnapshot(JOURNAL_DOC(), snap => {
      if (snap.exists()) callback(snap.data().entries || []);
    });
  } catch (e) {
    console.error('Firestore journal subscribe error:', e);
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
