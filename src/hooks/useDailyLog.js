import { useEffect, useRef, useState } from 'react';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { getApps, initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import {
  isSupabaseConfigured,
  loadDailyLogs,
  saveDailyLogDays,
  saveDeferredItems,
  subscribeToDailyLogs,
} from '../utils/supabase.js';
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

// Shared "kept" resolver — builds a fresh bullet/checklist-item copy for the
// destination day. Reused by closeDay's explicit Keep path, autoCarryForward's
// silent single-day carry, and resolveStaleDays' Catch-Up Interview carry, so
// the three mechanisms cannot drift out of sync.
function buildCarriedChecklistItem(item) {
  return { id: genId(), text: item.text, status: 'todo', createdAt: new Date().toISOString() };
}

function buildCarriedWholeBullet(b, carriedFrom = null, reasonInfo = null) {
  return {
    id: genId(),
    text: b.text,
    jobId: b.jobId,
    done: false,
    createdAt: new Date().toISOString(),
    migration: null,
    ...(carriedFrom ? { carriedFrom } : {}),
    ...(reasonInfo ? { carryReason: reasonInfo.reason, carryReasonText: reasonInfo.reasonText } : {}),
  };
}

function buildCarriedChecklistBullet(b, keptItems, carriedFrom = null, reasonInfo = null) {
  return {
    id: genId(),
    text: b.text,
    jobId: b.jobId,
    meta: b.meta ?? null,
    done: false,
    createdAt: new Date().toISOString(),
    migration: null,
    checklist: keptItems.map(buildCarriedChecklistItem),
    ...(carriedFrom ? { carriedFrom } : {}),
    ...(reasonInfo ? { carryReason: reasonInfo.reason, carryReasonText: reasonInfo.reasonText } : {}),
  };
}

// A day counts as "unresolved" for auto-carry/catch-up purposes when it has at
// least one checklist-bullet with a 'todo' item, or a checklist-less bullet
// that's neither done nor already migrated/carried.
function dayHasUnresolved(day) {
  if (!day || day.locked) return false;
  return day.bullets.some(b => {
    const hasChecklist = Array.isArray(b.checklist) && b.checklist.length > 0;
    if (hasChecklist) return b.checklist.some(i => i.status === 'todo');
    return !b.done && b.migration == null;
  });
}

// Carries every unresolved item on `day` forward as "kept" — no per-item choice.
// Returns the new carried bullets (destined for another day) and the source
// day's bullets with migrated/carried stamps so they're never picked up again.
function carryDayForward(day, sourceDateKey) {
  const carried = [];
  const updatedBullets = day.bullets.map(b => {
    const hasChecklist = Array.isArray(b.checklist) && b.checklist.length > 0;
    if (hasChecklist) {
      const unresolvedItems = b.checklist.filter(i => i.status === 'todo');
      if (unresolvedItems.length === 0) return b;
      const resolvedChecklist = b.checklist.map(i =>
        i.status === 'todo' ? { ...i, status: 'migrated' } : i
      );
      carried.push(buildCarriedChecklistBullet(b, unresolvedItems, sourceDateKey));
      return { ...b, checklist: resolvedChecklist };
    }
    if (!b.done && b.migration == null) {
      carried.push(buildCarriedWholeBullet(b, sourceDateKey));
      return { ...b, migration: 'carried' };
    }
    return b;
  });
  return { carriedBullets: carried, updatedSourceBullets: updatedBullets };
}

export function useDailyLog() {
  // `logs` and `deferredItems` live in one state atom so every mutation that
  // touches both (closeDay, pullBackIn) is a single atomic setState — no
  // split calls that could race or read a stale snapshot of the other half.
  const [state, setState] = useState(EMPTY_STATE);
  const [loading, setLoading] = useState(true);
  const saveTimerRef = useRef(null);
  const pendingStateRef = useRef(null);
  const readyRef = useRef(false);
  const touchedLogKeysRef = useRef(new Set());
  const deferredItemsTouchedRef = useRef(false);
  // Last-persisted deferred items — the baseline performSave() diffs against to
  // produce per-item upserts/deletes (never a whole-array rewrite). Kept in sync
  // with the server whenever a reload takes server deferred state.
  const persistedDeferredRef = useRef([]);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      readyRef.current = true;
      setLoading(false);
      return;
    }

    let cancelled = false;

    // MERGE-not-replace. Supabase postgres_changes has no hasPendingWrites flag
    // (Firestore's onSnapshot used it to ignore its own echoes), so on every
    // server reload we keep any date_key currently mid-write locally and take
    // server for the rest — never blanket-replacing the atom while a write is
    // pending. Same for deferredItems: keep local while a deferred change is
    // pending, otherwise take server (and re-baseline the diff).
    function applyServer(server) {
      if (!server) return; // null = read error; never flip ready / blank state
      setState(prev => {
        const mergedLogs = { ...server.logs };
        touchedLogKeysRef.current.forEach(k => {
          if (prev.logs[k] !== undefined) mergedLogs[k] = prev.logs[k];
        });

        let deferredItems;
        if (deferredItemsTouchedRef.current) {
          deferredItems = prev.deferredItems; // keep pending local change
        } else {
          deferredItems = server.deferredItems;
          persistedDeferredRef.current = server.deferredItems;
        }

        const next = { logs: mergedLogs, deferredItems };
        pendingStateRef.current = next;
        return next;
      });
      // Confirmed successful load — safe to open the write gate now.
      readyRef.current = true;
      setLoading(false);
    }

    // Explicit initial load gates readyRef on a confirmed successful read, so
    // an error path (loadDailyLogs -> null) never flips ready and re-opens the
    // 2026-07-05 whole-store-overwrite window.
    loadDailyLogs().then(server => {
      if (cancelled) return;
      applyServer(server);
    });

    const unsub = subscribeToDailyLogs(server => {
      if (cancelled) return;
      applyServer(server);
    });

    return () => {
      cancelled = true;
      unsub();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fires the actual write immediately — pulled out of the debounce timeout so
  // it can also be invoked eagerly on tab-hide/unload (see the effect below).
  // Without that eager flush, closing the Catch-Up Interview and refreshing
  // within the 300ms debounce window silently drops the write: the resolved
  // day looks fixed locally, but Firestore never saw it, so the next load
  // shows the same unresolved day again — same bug class as the 2026-07-05
  // data loss this file's ready-gate was built to prevent.
  function performSave() {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = null;
    if (touchedLogKeysRef.current.size === 0 && !deferredItemsTouchedRef.current) return;
    // Merge-safe per-date-key write, not a blind whole-doc setDoc — two
    // devices opening Daily Log near-simultaneously touch different (or the
    // same) date keys without clobbering each other's `logs` entries.
    // deferredItems is a plain array (Firestore doesn't deep-merge arrays),
    // so it's only included when this device actually changed it — an
    // unrelated save (e.g. autoCarryForward touching only `logs`) must not
    // overwrite it with a possibly-stale local copy.
    const keys = Array.from(touchedLogKeysRef.current);
    touchedLogKeysRef.current = new Set();

    // Per-date-key upsert of only the touched days (closeDay touches today +
    // tomorrow; resolveStaleDays touches many) — never a whole-store write.
    if (keys.length > 0) {
      const days = keys
        .map(k => ({ dateKey: k, day: pendingStateRef.current.logs[k] }))
        .filter(d => d.day !== undefined);
      if (days.length > 0) saveDailyLogDays(days);
    }

    // Deferred items: per-item diff against the last-persisted baseline so a
    // single add/remove is one upsert or one delete, never an array rewrite.
    if (deferredItemsTouchedRef.current) {
      deferredItemsTouchedRef.current = false;
      const current = pendingStateRef.current.deferredItems || [];
      const persisted = persistedDeferredRef.current || [];
      const currentIds = new Set(current.map(d => d.id));
      const persistedIds = new Set(persisted.map(d => d.id));
      const removeIds = persisted.filter(d => !currentIds.has(d.id)).map(d => d.id);
      const upserts = current.filter(d => !persistedIds.has(d.id));
      if (upserts.length > 0 || removeIds.length > 0) {
        saveDeferredItems(upserts, removeIds);
      }
      persistedDeferredRef.current = current;
    }
  }

  // Eager flush on tab-hide/unload — `visibilitychange` fires reliably on
  // both desktop (refresh/close/tab-switch) and mobile Safari (which often
  // skips `beforeunload` entirely), so it's the primary safety net; `pagehide`
  // is a second layer for desktop navigations `visibilitychange` might miss.
  useEffect(() => {
    function flush() {
      if (saveTimerRef.current) performSave();
    }
    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') flush();
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', flush);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', flush);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function scheduleSave(next, changedKeys, deferredItemsChanged) {
    // Guard against writing before the initial Supabase load has confirmed —
    // otherwise a save fired from stale/empty local state could overwrite good
    // days with an empty local snapshot (the 2026-07-05 data-loss class).
    if (!readyRef.current) return;
    pendingStateRef.current = next;
    changedKeys.forEach(k => touchedLogKeysRef.current.add(k));
    if (deferredItemsChanged) deferredItemsTouchedRef.current = true;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(performSave, 300);
  }

  function updateState(updater) {
    setState(prev => {
      const next = updater(prev);
      if (next === prev) return prev;
      const changedKeys = Object.keys(next.logs).filter(k => next.logs[k] !== prev.logs[k]);
      scheduleSave(next, changedKeys, next.deferredItems !== prev.deferredItems);
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
          // The real invoicing write (handleMarkDone in useJobs.js) happens in
          // CloseDayModal itself before onClose fires, since it needs the full
          // job record and an amount that only the modal has. This just stamps
          // the daily-log bullet — additive, not a replacement for that write.
          if (migrations[b.id] === 'completed') {
            return { ...b, done: true, migration: null };
          }
          return { ...b, migration: migrations[b.id] ?? null };
        }

        const itemMigrations = checklistMigrations[b.id] || {};
        const keptItems = [];
        const resolvedChecklist = b.checklist.map(item => {
          if (item.status !== 'todo') return item;
          const resolution = itemMigrations[item.id];
          if (!resolution) return item;
          if (resolution.action === 'kept') {
            keptItems.push(item);
            return { ...item, status: 'migrated' };
          }
          if (resolution.action === 'dropped') {
            return { ...item, status: 'irrelevant' };
          }
          if (resolution.action === 'completed') {
            return { ...item, status: 'done' };
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

        if (keptItems.length > 0) {
          keptChecklistBullets.push(buildCarriedChecklistBullet(b, keptItems));
        }

        return { ...b, checklist: resolvedChecklist, migration: null };
      });

      const keptWholeBullets = closedBullets
        .filter(b => (!Array.isArray(b.checklist) || b.checklist.length === 0) && migrations[b.id] === 'kept')
        .map(b => buildCarriedWholeBullet(b));

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

  // Silently carries forward the single most recent unresolved-and-unlocked
  // prior day. The scan runs against `prev.logs` inside the setState updater
  // (not against `state.logs` read outside it) so it always decides against
  // the state actually being written, never a possibly-stale snapshot.
  //
  // `onJobBumped(jobId, { fromDateKey, toDateKey })` is an optional, additive
  // hook for Problem 3's bump-history capture — fired once per carried
  // job-linked bullet, AFTER updateState's closure has resolved (using the
  // sourceKey/key locals captured inside it, not any outer/stale state). The
  // existing carry decision logic above is unchanged; this only reports what
  // already happened.
  function autoCarryForward(onJobBumped) {
    const key = todayKey();
    let bumpedJobIds = null;
    let sourceKeyForBump = null;

    updateState(prev => {
      const staleDays = Object.keys(prev.logs)
        .filter(k => k < key && dayHasUnresolved(prev.logs[k]))
        .sort();

      if (staleDays.length !== 1) return prev;

      const sourceKey = staleDays[0];
      const sourceDay = prev.logs[sourceKey];
      const { carriedBullets, updatedSourceBullets } = carryDayForward(sourceDay, sourceKey);
      if (carriedBullets.length === 0) return prev;

      const today = prev.logs[key] ?? { bullets: [], closedAt: null, locked: false };
      if (today.locked) return prev;

      if (onJobBumped) {
        bumpedJobIds = carriedBullets.filter(b => b.jobId != null).map(b => b.jobId);
        sourceKeyForBump = sourceKey;
      }

      return {
        ...prev,
        logs: {
          ...prev.logs,
          [sourceKey]: { ...sourceDay, bullets: updatedSourceBullets },
          [key]: { ...today, bullets: [...carriedBullets, ...today.bullets] },
        },
      };
    });

    if (onJobBumped && bumpedJobIds) {
      bumpedJobIds.forEach(jobId => {
        onJobBumped(jobId, { fromDateKey: sourceKeyForBump, toDateKey: key });
      });
    }
  }

  // Catch-Up Interview resolution — 'carry' brings the bullet forward to today
  // (with an attached reason); 'skip' dismisses it in place (marked irrelevant/
  // skipped so it stops re-triggering the catch-up prompt, but isn't counted
  // done); 'complete' is a simple done-stamp for backlog cleanup. Never locks
  // the source days.
  // resolutions shape: { [dateKey]: { [bulletId]: { action: 'carry'|'skip'|'complete', reason, reasonText } } }
  //
  // The real invoicing write (handleMarkDone in useJobs.js) happens in
  // CatchUpInterview itself before onClose fires, since it needs the full job
  // record and an amount this hook doesn't have. This just stamps the
  // daily-log bullet done — additive, not a replacement for that write.
  function resolveStaleDays(resolutions) {
    const key = todayKey();
    updateState(prev => {
      const logsPatch = {};
      const allCarried = [];

      Object.keys(resolutions).forEach(sourceKey => {
        const sourceDay = prev.logs[sourceKey];
        if (!sourceDay) return;
        const dayResolutions = resolutions[sourceKey];
        let dayChanged = false;

        const updatedBullets = sourceDay.bullets.map(b => {
          const res = dayResolutions[b.id];
          if (!res) return b;

          const hasChecklist = Array.isArray(b.checklist) && b.checklist.length > 0;

          if (res.action === 'carry') {
            if (hasChecklist) {
              const unresolvedItems = b.checklist.filter(i => i.status === 'todo');
              if (unresolvedItems.length === 0) return b;
              const resolvedChecklist = b.checklist.map(i =>
                i.status === 'todo' ? { ...i, status: 'migrated' } : i
              );
              allCarried.push(buildCarriedChecklistBullet(b, unresolvedItems, sourceKey, res));
              dayChanged = true;
              return { ...b, checklist: resolvedChecklist };
            }

            if (b.done || b.migration != null) return b;
            allCarried.push(buildCarriedWholeBullet(b, sourceKey, res));
            dayChanged = true;
            return { ...b, migration: 'carried' };
          }

          if (res.action === 'skip') {
            if (hasChecklist) {
              const hasUnresolved = b.checklist.some(i => i.status === 'todo');
              if (!hasUnresolved) return b;
              dayChanged = true;
              return {
                ...b,
                checklist: b.checklist.map(i => i.status === 'todo' ? { ...i, status: 'irrelevant' } : i),
              };
            }
            if (b.done || b.migration != null) return b;
            dayChanged = true;
            return { ...b, migration: 'skipped' };
          }

          if (res.action === 'complete') {
            if (hasChecklist) {
              const hasUnresolved = b.checklist.some(i => i.status === 'todo');
              if (!hasUnresolved && b.done) return b;
              dayChanged = true;
              return {
                ...b,
                done: true,
                checklist: b.checklist.map(i => i.status === 'todo' ? { ...i, status: 'done' } : i),
              };
            }
            if (b.done) return b;
            dayChanged = true;
            return { ...b, done: true };
          }

          return b;
        });

        if (dayChanged) logsPatch[sourceKey] = { ...sourceDay, bullets: updatedBullets };
      });

      if (Object.keys(logsPatch).length === 0) return prev;

      const today = prev.logs[key] ?? { bullets: [], closedAt: null, locked: false };
      if (today.locked) return prev;

      return {
        ...prev,
        logs: {
          ...prev.logs,
          ...logsPatch,
          [key]: { ...today, bullets: [...allCarried, ...today.bullets] },
        },
      };
    });
  }

  const key = todayKey();

  // Derived, read-only signal for the UI — recomputed fresh every render from
  // `state.logs`. Purely informational (whether to show the Catch-Up prompt);
  // the actual carry-forward mutation always re-scans `prev` inside its own
  // updater, so this never drives a write decision.
  const staleDayKeys = Object.keys(state.logs)
    .filter(k => k < key && dayHasUnresolved(state.logs[k]))
    .sort();
  const catchUpNeeded = staleDayKeys.length > 1 ? { days: staleDayKeys } : null;

  return {
    todayKey: key,
    todayLog: state.logs[key] ?? null,
    logs: state.logs,
    deferredItems: state.deferredItems,
    loading,
    catchUpNeeded,
    addBullet,
    upsertScheduledBullet,
    removeBullet,
    toggleDone,
    addChecklistItem,
    toggleChecklistItem,
    pullBackIn,
    closeDay,
    autoCarryForward,
    resolveStaleDays,
  };
}
