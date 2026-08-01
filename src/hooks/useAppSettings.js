import { useCallback, useEffect, useRef, useState } from 'react';
import {
  isSupabaseConfigured, loadAppSettings, saveAppSetting, seedAppSetting,
} from '../utils/supabase.js';

// The four settings that used to live in localStorage and now follow Trevor
// between the iMac, the MacBook and the phone.
//
// This is not really a settings feature. `benchKeywords` decides which bench a
// job lands on and `benchHours` decides how big the split cards are, so a
// setting that silently differs per device is a job-classification bug wearing
// a settings costume — which is exactly what it was. Every device fell back to
// the same built-in keyword list, so nothing ever looked broken while the iMac's
// real edits were invisible everywhere else.
//
// Google Calendar settings are NOT here and do not move. Per-device view
// preferences (like the Parts to Order group-by toggle) are not here either —
// those genuinely belong to one browser.

export const SETTING_KEYS = ['benchKeywords', 'weeklyTarget', 'hourlyRate', 'benchHours'];

// Built-in fallbacks. These are what a failed load falls back to, so they must
// keep the app fully working — never a blank keyword list.
export const SETTINGS_DEFAULTS = {
  benchKeywords: {},
  weeklyTarget: 2000,
  hourlyRate: 85,
  benchHours: {},
};

/**
 * What this browser's localStorage holds for a setting, or undefined if it holds
 * nothing usable. Only used for the one-time seed into the shared store.
 */
export function readLocalSetting(key) {
  let raw;
  try { raw = localStorage.getItem(key); } catch { return undefined; }
  if (raw == null || raw === '') return undefined;

  if (key === 'weeklyTarget' || key === 'hourlyRate') {
    const n = Number(raw);
    return Number.isFinite(n) ? n : undefined;
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/**
 * An empty keyword array for a bench is treated as NO ENTRY, not as "match
 * nothing". `[].join('|')` makes `new RegExp('')`, which matches every job and
 * sends the whole board to one bench. inferBench() guards this at the point of
 * use as well; this is the second line of the same defence, keeping the shape
 * held in memory honest so Settings shows the defaults rather than an empty box.
 */
export function sanitizeBenchKeywords(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out = {};
  for (const [bench, list] of Object.entries(value)) {
    if (Array.isArray(list) && list.length > 0) out[bench] = list;
  }
  return out;
}

function sanitizeNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function sanitizeBenchHours(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const out = {};
  for (const [bench, hours] of Object.entries(value)) {
    const n = Number(hours);
    if (Number.isFinite(n) && n > 0) out[bench] = n;
  }
  return out;
}

/**
 * Turn whatever came back from the store (or from localStorage, or nothing at
 * all) into a complete, usable settings object. Anything missing or malformed
 * takes the built-in default.
 */
export function sanitizeSettings(raw = {}) {
  return {
    benchKeywords: sanitizeBenchKeywords(raw.benchKeywords),
    benchHours: sanitizeBenchHours(raw.benchHours),
    weeklyTarget: sanitizeNumber(raw.weeklyTarget, SETTINGS_DEFAULTS.weeklyTarget),
    hourlyRate: sanitizeNumber(raw.hourlyRate, SETTINGS_DEFAULTS.hourlyRate),
  };
}

function localSettings() {
  const raw = {};
  SETTING_KEYS.forEach(key => {
    const v = readLocalSetting(key);
    if (v !== undefined) raw[key] = v;
  });
  return raw;
}

export function useAppSettings() {
  const [settings, setSettings] = useState(() => sanitizeSettings(localSettings()));
  // `ready` is not cosmetic — App.jsx passes it to useSupabase, which will not
  // load or normalize a single job until it flips true. normalizeJobsFromDb()
  // sizes the auto-split bench cards from benchHours, and running that first
  // pass against a placeholder would silently mis-size every split card on the
  // board on every load. Nothing about the job data waits on the OTHER three
  // settings; they are simply loaded in the same read.
  const [ready, setReady] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saveError, setSaveError] = useState(null);
  // Once a load has failed we are working from built-in defaults, and writing
  // those back over whatever the shared store really holds would turn a network
  // blip into data loss on the other two devices.
  const canWriteRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    if (!isSupabaseConfigured()) {
      // No database on this device. Behave exactly as the app did before this
      // change — read and write this browser's localStorage — rather than
      // pretending settings are shared.
      setReady(true);
      return () => { cancelled = true; };
    }

    (async () => {
      try {
        const stored = await loadAppSettings();

        // The migration. For each setting the shared store has never heard of,
        // offer THIS browser's localStorage value — and only if it has one.
        //
        // seedAppSetting writes INSERT ... ON CONFLICT (key) DO NOTHING. That
        // is what makes three devices safe: whichever device gets there first
        // wins permanently, and a MacBook or phone with empty localStorage
        // cannot overwrite the iMac's real keyword edits. There is deliberately
        // no per-device "already seeded" flag — a flag in one browser cannot
        // see the other two, which is the entire problem.
        const local = localSettings();
        const toSeed = SETTING_KEYS.filter(k => stored[k] === undefined && local[k] !== undefined);
        if (toSeed.length > 0) {
          await Promise.all(toSeed.map(k => seedAppSetting(k, local[k])));
        }

        // Re-read rather than assuming our seed landed. If another device seeded
        // first, DO NOTHING means our value was discarded — and the store, not
        // this browser, is the answer from here on.
        const authoritative = toSeed.length > 0 ? await loadAppSettings() : stored;
        if (cancelled) return;

        setSettings(sanitizeSettings(authoritative));
        canWriteRef.current = true;
        setLoadFailed(false);
      } catch (e) {
        if (cancelled) return;
        console.error('App settings failed to load — using built-in defaults for this session:', e);
        // Built-in defaults, merged with whatever this browser last knew. The
        // app keeps working and bench inference keeps its full keyword list.
        setSettings(sanitizeSettings(localSettings()));
        setLoadFailed(true);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  // One setter for all four. Updates the screen straight away, then persists.
  // A failed write is put on screen by SettingsModal rather than logged and
  // forgotten — a setting that looks saved and isn't is the failure mode this
  // whole build exists to close.
  const update = useCallback((key, value) => {
    setSettings(prev => sanitizeSettings({ ...prev, [key]: value }));

    if (!isSupabaseConfigured()) {
      try {
        localStorage.setItem(
          key,
          typeof value === 'number' ? String(value) : JSON.stringify(value)
        );
      } catch { /* a full or blocked localStorage is not worth crashing over */ }
      return;
    }
    if (!canWriteRef.current) {
      setSaveError('Settings could not be loaded from the database this session, so changes are not being saved. Reload to try again.');
      return;
    }
    saveAppSetting(key, value)
      .then(() => setSaveError(null))
      .catch(e => setSaveError(`That setting was NOT saved: ${e?.message || String(e)}`));
  }, []);

  return {
    ready,
    loadFailed,
    saveError,
    benchKeywords: settings.benchKeywords,
    benchHours: settings.benchHours,
    weeklyTarget: settings.weeklyTarget,
    hourlyRate: settings.hourlyRate,
    setBenchKeywords: useCallback(v => update('benchKeywords', v), [update]),
    setBenchHours: useCallback(v => update('benchHours', v), [update]),
    setWeeklyTarget: useCallback(v => update('weeklyTarget', v), [update]),
    setHourlyRate: useCallback(v => update('hourlyRate', v), [update]),
  };
}
