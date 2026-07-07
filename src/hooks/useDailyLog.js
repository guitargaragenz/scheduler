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

const EMPTY_STATE = { logs: {}, deferredItems: [] };

export function useDailyLog() {
  // `logs` and `deferredItems` live in one state atom so every mutation that
  // touches both (closeDay, pullBackIn) is a single atomic setState — no
  // split calls that could race or read a stale snapshot of the other half.
  const [state, setState] = useState(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const saveTimerRef = useRef(null);
  const pendingStateRef = useRef(null);
  const justSavedAt = useRef(0);
  const readyRef = useRef(false);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      readyRef.current = true;
      setLoading(false);
      return;
    }

    const unsub = onSnapshot(DAILY_LOGS_DOC(), snap => {
      if (Date.now() - justSavedAt.current < 3000) return;
      const data = snap.exists() ? snap.data() : {};
      const next = { logs: data.logs || {}, deferredItems: data.deferredItems || [] };
      setState(next);
      pendingStateRef.current = next;
      readyRef.current = true;
      setLoading(false);
    });

    return () => unsub();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function scheduleSave(next) {
    // Guard against writing before the initial Firestore snapshot has loaded —
    // otherwise a save fired from stale/empty local state can overwrite every
    // other day's data with a full-document setDoc (2026-07-05 data loss).
    if (!readyRef.current) return;
    pendingStateRef.current = next;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      justSavedAt.current = Date.now();
      setDoc(DAILY_LOGS_DOC(), {
        logs: pendingStateRef.current.logs,
        deferredItems: pendingStateRef.current.deferredItems,
        updatedAt: new Date().toISOString(),
      });
    }, 300);
  }

  function updateState(updater) {
    setState(prev => {
      const next = updater(prev);
      scheduleSave(next);
      return next;
    });
  }

  function addBullet(text, jobId = null, meta = null) {
    const key = todayKey();
    updateState(prev => {
      const day = prev.logs[key] ?? { bullets: [], closedAt: null, locked: false };
      if (day.locked) return prev;
      return {
        ...prev,
        logs: {
          ...prev.logs,
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

    updateState(prev => {
      const day = prev.logs[key] ?? { bullets: [], closedAt: null, locked: false };
      if (day.locked) return prev;

      const existingIdx = day.bullets.findIndex(b => b.jobId === job.id);

      if (existingIdx !== -1) {
        const updated = { ...day.bullets[existingIdx], text, meta, scheduledMinutes };
        const withoutIt = day.bullets.filter((_, i) => i !== existingIdx);
        return { ...prev, logs: { ...prev.logs, [key]: { ...day, bullets: insertJobBullet(withoutIt, updated) } } };
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
      return { ...prev, logs: { ...prev.logs, [key]: { ...day, bullets: insertJobBullet(day.bullets, newBullet) } } };
    });
  }

  function removeBullet(bulletId) {
    const key = todayKey();
    updateState(prev => {
      const day = prev.logs[key];
      if (!day || day.locked) return prev;
      return {
        ...prev,
        logs: { ...prev.logs, [key]: { ...day, bullets: day.bullets.filter(b => b.id !== bulletId) } },
      };
    });
  }

  function toggleDone(bulletId) {
    const key = todayKey();
    updateState(prev => {
      const day = prev.logs[key];
      if (!day || day.locked) return prev;
      return {
        ...prev,
        logs: {
          ...prev.logs,
          [key]: {
            ...day,
            bullets: day.bullets.map(b =>
              b.id === bulletId ? { ...b, done: !b.done } : b
            ),
          },
        },
      };
    });
  }

  // Nested per-job sub-steps — mirrors the physical bullet journal, where each
  // job gets its own checklist written in the moment. Only meaningful for
  // job-linked bullets; free-text bullets never gain a checklist.
  function addChecklistItem(bulletId, text) {
    const key = todayKey();
    updateState(prev => {
      const day = prev.logs[key];
      if (!day || day.locked) return prev;
      return {
        ...prev,
        logs: {
          ...prev.logs,
          [key]: {
            ...day,
            bullets: day.bullets.map(b =>
              b.id === bulletId
                ? {
                    ...b,
                    checklist: [
                      ...(b.checklist || []),
                      { id: genId(), text, status: 'todo', createdAt: new Date().toISOString() },
                    ],
                  }
                : b
            ),
          },
        },
      };
    });
  }

  function toggleChecklistItem(bulletId, itemId) {
    const key = todayKey();
    updateState(prev => {
      const day = prev.logs[key];
      if (!day || day.locked) return prev;
      return {
        ...prev,
        logs: {
          ...prev.logs,
          [key]: {
            ...day,
            bullets: day.bullets.map(b => {
              if (b.id !== bulletId) return b;
              return {
                ...b,
                checklist: (b.checklist || []).map(item =>
                  item.id === itemId
                    ? { ...item, status: item.status === 'done' ? 'todo' : 'done' }
                    : item
                ),
              };
            }),
          },
        },
      };
    });
  }

  // Pull a deferred item back out of the shelf pool and into today's log —
  // appends to today's bullet for that job if one already exists, else creates it.
  // Single atomic update against `prev` so the removal-from-pool and the
  // add-to-today's-log can never observe inconsistent state.
  function pullBackIn(deferredItemId) {
    const key = todayKey();
    updateState(prev => {
      const item = prev.deferredItems.find(d => d.id === deferredItemId);
      if (!item) return prev;

      const day = prev.logs[key] ?? { bullets: [], closedAt: null, locked: false };
      if (day.locked) return prev;

      const newChecklistItem = { id: genId(), text: item.text, status: 'todo', createdAt: new Date().toISOString() };
      const existingIdx = day.bullets.findIndex(b => b.jobId === item.jobId);

      let bullets;
      if (existingIdx !== -1) {
        bullets = day.bullets.slice();
        bullets[existingIdx] = {
          ...bullets[existingIdx],
          checklist: [...(bullets[existingIdx].checklist || []), newChecklistItem],
        };
      } else {
        bullets = [
          ...day.bullets,
          {
            id: genId(),
            text: item.bulletText,
            jobId: item.jobId,
            meta: null,
            done: false,
            createdAt: new Date().toISOString(),
            migration: null,
            checklist: [newChecklistItem],
          },
        ];
      }

      return {
        ...prev,
        logs: { ...prev.logs, [key]: { ...day, bullets } },
        deferredItems: prev.deferredItems.filter(d => d.id !== deferredItemId),
      };
    });
  }

  // `migrations` shape: { [bulletId]: 'kept'|'dropped'|'deferred', checklist: { [bulletId]: { [itemId]: { action, reason? } } } }
  // Whole-bullet resolutions (first form) only apply to bullets with no checklist items —
  // job bullets that have a checklist are resolved per-item instead; the bullet
  // itself only carries forward if at least one item was kept.
  function closeDay(migrations) {
    const key = todayKey();
    const nextKey = tomorrowKey();
    const checklistMigrations = migrations.checklist || {};

    updateState(prev => {
      const day = prev.logs[key] ?? { bullets: [], closedAt: null, locked: false };
      if (day.locked) return prev;

      const deferredToAdd = [];
      const keptChecklistBullets = [];

      const closedBullets = day.bullets.map(b => {
        const hasChecklist = Array.isArray(b.checklist) && b.checklist.length > 0;
        if (!hasChecklist) {
          return { ...b, migration: migrations[b.id] ?? null };
        }

        const itemMigrations = checklistMigrations[b.id] || {};
        const keptTexts = [];
        const resolvedChecklist = b.checklist.map(item => {
          if (item.status !== 'todo') return item;
          const resolution = itemMigrations[item.id];
          if (!resolution) return item;
          if (resolution.action === 'kept') {
            keptTexts.push(item.text);
            return { ...item, status: 'migrated' };
          }
          if (resolution.action === 'dropped') {
            return { ...item, status: 'irrelevant' };
          }
          if (resolution.action === 'deferred') {
            deferredToAdd.push({
              id: genId(),
              jobId: b.jobId,
              bulletText: b.text,
              text: item.text,
              reason: resolution.reason || '',
              createdAt: new Date().toISOString(),
            });
            return { ...item, status: 'deferred' };
          }
          return item;
        });

        if (keptTexts.length > 0) {
          keptChecklistBullets.push({
            id: genId(),
            text: b.text,
            jobId: b.jobId,
            meta: b.meta ?? null,
            done: false,
            createdAt: new Date().toISOString(),
            migration: null,
            checklist: keptTexts.map(t => ({ id: genId(), text: t, status: 'todo', createdAt: new Date().toISOString() })),
          });
        }

        return { ...b, checklist: resolvedChecklist, migration: null };
      });

      const keptWholeBullets = closedBullets
        .filter(b => (!Array.isArray(b.checklist) || b.checklist.length === 0) && migrations[b.id] === 'kept')
        .map(b => ({
          id: genId(),
          text: b.text,
          jobId: b.jobId,
          done: false,
          createdAt: new Date().toISOString(),
          migration: null,
        }));

      const tomorrow = prev.logs[nextKey] ?? { bullets: [], closedAt: null, locked: false };

      return {
        ...prev,
        logs: {
          ...prev.logs,
          [key]: {
            ...day,
            bullets: closedBullets,
            closedAt: new Date().toISOString(),
            locked: true,
          },
          [nextKey]: {
            ...tomorrow,
            bullets: [...keptWholeBullets, ...keptChecklistBullets, ...tomorrow.bullets],
          },
        },
        deferredItems: deferredToAdd.length > 0 ? [...prev.deferredItems, ...deferredToAdd] : prev.deferredItems,
      };
    });
  }

  const key = todayKey();

  return {
    todayKey: key,
    todayLog: state.logs[key] ?? null,
    deferredItems: state.deferredItems,
    loading,
    addBullet,
    upsertScheduledBullet,
    removeBullet,
    toggleDone,
    addChecklistItem,
    toggleChecklistItem,
    pullBackIn,
    closeDay,
  };
}
