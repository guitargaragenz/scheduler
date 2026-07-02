import { useEffect, useRef, useState } from 'react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { getApps, initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { isFirebaseConfigured } from '../utils/firebase.js';
import { localDateKey } from '../utils/calendar.js';

// crypto.randomUUID() only exists in secure contexts (HTTPS/localhost) — Safari disables it
// entirely over plain http:// on a LAN IP, which breaks local iPhone testing. Fall back to a
// manual ID in that case; production (Vercel, HTTPS) always has the real one.
function genId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

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
  return localDateKey();
}

function tomorrowKey() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return localDateKey(d);
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
              id: genId(),
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

  // Insert `bullet` so that, restricted to the subsequence of job-bullets (jobId != null),
  // order is ascending by scheduledMinutes. Free-text bullets never move.
  function insertJobBullet(bullets, bullet) {
    let insertAt = bullets.length;
    for (let i = 0; i < bullets.length; i++) {
      const b = bullets[i];
      if (b.jobId != null && b.scheduledMinutes != null && b.scheduledMinutes > bullet.scheduledMinutes) {
        insertAt = i;
        break;
      }
    }
    const next = bullets.slice();
    next.splice(insertAt, 0, bullet);
    return next;
  }

  function upsertScheduledBullet(job, hour, minute) {
    const key = todayKey();
    const scheduledMinutes = hour * 60 + minute;
    const text = `${job.customer ? job.customer + ' — ' : ''}${job.mfr} ${job.model}`;
    const meta = { bench: job.bench, hoursRange: job.hoursRange, action: job.action };

    updateLogs(prev => {
      const day = prev[key] ?? { bullets: [], closedAt: null, locked: false };
      if (day.locked) return prev;

      const existingIdx = day.bullets.findIndex(b => b.jobId === job.id);

      if (existingIdx !== -1) {
        const updated = { ...day.bullets[existingIdx], text, meta, scheduledMinutes };
        const withoutIt = day.bullets.filter((_, i) => i !== existingIdx);
        return { ...prev, [key]: { ...day, bullets: insertJobBullet(withoutIt, updated) } };
      }

      const newBullet = {
        id: genId(),
        text,
        jobId: job.id,
        meta,
        done: false,
        createdAt: new Date().toISOString(),
        migration: null,
        scheduledMinutes,
      };
      return { ...prev, [key]: { ...day, bullets: insertJobBullet(day.bullets, newBullet) } };
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
          id: genId(),
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
    upsertScheduledBullet,
    removeBullet,
    toggleDone,
    closeDay,
  };
}
