import { useEffect, useRef, useState } from 'react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { getApps, initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { isFirebaseConfigured } from '../utils/firebase.js';

function getDb() {
  const existing = getApps();
  const app = existing.length > 0 ? existing[0] : initializeApp({
    apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId:             import.meta.env.VITE_FIREBASE_APP_ID,
  });
  return getFirestore(app);
}

const DAILY_LOGS_DOC = () => doc(getDb(), 'ggnz', 'dailyLogs');

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function tomorrowKey() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function useDailyLog() {
  const [logs, setLogs] = useState({});
  const [loading, setLoading] = useState(true);
  const saveTimerRef = useRef(null);
  const pendingLogsRef = useRef(null);
  const justSavedAt = useRef(0);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(DAILY_LOGS_DOC(), snap => {
      if (Date.now() - justSavedAt.current < 3000) return;
      setLogs(snap.exists() ? (snap.data().logs || {}) : {});
      setLoading(false);
    });

    return () => unsub();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function scheduleSave(nextLogs) {
    pendingLogsRef.current = nextLogs;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      justSavedAt.current = Date.now();
      setDoc(DAILY_LOGS_DOC(), {
        logs: pendingLogsRef.current,
        updatedAt: new Date().toISOString(),
      });
    }, 300);
  }

  function updateLogs(updater) {
    setLogs(prev => {
      const next = updater(prev);
      scheduleSave(next);
      return next;
    });
  }

  function addBullet(text, jobId = null, meta = null) {
    const key = todayKey();
    updateLogs(prev => {
      const day = prev[key] ?? { bullets: [], closedAt: null, locked: false };
      if (day.locked) return prev;
      return {
        ...prev,
        [key]: {
          ...day,
          bullets: [
            ...day.bullets,
            {
              id: crypto.randomUUID(),
              text,
              jobId,
              meta,
              done: false,
              createdAt: new Date().toISOString(),
              migration: null,
            },
          ],
        },
      };
    });
  }

  function seedScheduledJobs(scheduledJobs) {
    const key = todayKey();
    updateLogs(prev => {
      const day = prev[key] ?? { bullets: [], closedAt: null, locked: false };
      if (day.locked) return prev;
      const existingJobIds = new Set(day.bullets.map(b => String(b.jobId)).filter(Boolean));
      const newBullets = scheduledJobs
        .filter(job => !existingJobIds.has(String(job.job)))
        .map(job => ({
          id: crypto.randomUUID(),
          text: `${job.customer ? job.customer + ' — ' : ''}${job.mfr} ${job.model}`,
          jobId: job.job,
          meta: { bench: job.bench, hoursRange: job.hoursRange, action: job.action },
          done: false,
          createdAt: new Date().toISOString(),
          migration: null,
        }));
      if (!newBullets.length) return prev;
      return {
        ...prev,
        [key]: { ...day, bullets: [...newBullets, ...day.bullets] },
      };
    });
  }

  function removeBullet(bulletId) {
    const key = todayKey();
    updateLogs(prev => {
      const day = prev[key];
      if (!day || day.locked) return prev;
      return {
        ...prev,
        [key]: { ...day, bullets: day.bullets.filter(b => b.id !== bulletId) },
      };
    });
  }

  function toggleDone(bulletId) {
    const key = todayKey();
    updateLogs(prev => {
      const day = prev[key];
      if (!day || day.locked) return prev;
      return {
        ...prev,
        [key]: {
          ...day,
          bullets: day.bullets.map(b =>
            b.id === bulletId ? { ...b, done: !b.done } : b
          ),
        },
      };
    });
  }

  function closeDay(migrations) {
    const key = todayKey();
    const nextKey = tomorrowKey();

    updateLogs(prev => {
      const day = prev[key] ?? { bullets: [], closedAt: null, locked: false };
      if (day.locked) return prev;

      const closedBullets = day.bullets.map(b => ({
        ...b,
        migration: migrations[b.id] ?? null,
      }));

      const keptBullets = closedBullets
        .filter(b => migrations[b.id] === 'kept')
        .map(b => ({
          id: crypto.randomUUID(),
          text: b.text,
          jobId: b.jobId,
          done: false,
          createdAt: new Date().toISOString(),
          migration: null,
        }));

      const tomorrow = prev[nextKey] ?? { bullets: [], closedAt: null, locked: false };

      return {
        ...prev,
        [key]: {
          ...day,
          bullets: closedBullets,
          closedAt: new Date().toISOString(),
          locked: true,
        },
        [nextKey]: {
          ...tomorrow,
          bullets: [...keptBullets, ...tomorrow.bullets],
        },
      };
    });
  }

  const key = todayKey();

  return {
    todayKey: key,
    todayLog: logs[key] ?? null,
    loading,
    addBullet,
    seedScheduledJobs,
    removeBullet,
    toggleDone,
    closeDay,
  };
}
