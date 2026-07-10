import { useState, useEffect, useCallback, useRef } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  closestCenter,
} from '@dnd-kit/core';
import { parseCSV, RAW_CSV, BENCH_COLORS, DEFAULT_BENCH_KEYWORDS, inferBench } from './data/jobs.js';
import { getWeekDays, formatDateRange, localDateKey } from './utils/calendar.js';
import { isConfigured } from './utils/googleCalendar.js';
import { isFirebaseConfigured, loadConflictLog, clearConflictLog, appendConflictLog } from './utils/firebase.js';
import CalendarGrid from './components/CalendarGrid.jsx';
import Sidebar from './components/Sidebar.jsx';
import Toast from './components/Toast.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import JobCard from './components/JobCard.jsx';
import JobDrawer from './components/JobDrawer.jsx';
import PomoDrawer from './components/PomoDrawer.jsx';
import WeeklySummaryModal from './components/WeeklySummaryModal.jsx';
import PartsDrawer from './components/PartsDrawer.jsx';
import HelpDrawer from './components/HelpDrawer.jsx';
import RunwayPage from './components/RunwayPage.jsx';
import MobileJobSheet from './components/MobileJobSheet.jsx';
import ParkingLotPage from './components/ParkingLotPage.jsx';
import DailyLogPage from './components/DailyLogPage.jsx';
import JobsPage from './components/JobsPage.jsx';
import CloseDayModal from './components/CloseDayModal.jsx';
import CatchUpInterview from './components/CatchUpInterview.jsx';
import BumpReasonModal from './components/BumpReasonModal.jsx';
import ConflictBanner from './components/ConflictBanner.jsx';
import RevenueReviewBanner from './components/RevenueReviewBanner.jsx';
import { useFirebase } from './hooks/useFirebase.js';
import { useGoogleCalendar } from './hooks/useGoogleCalendar.js';
import { useScheduler } from './hooks/useScheduler.js';
import { useJobs } from './hooks/useJobs.js';
import { useDailyLog } from './hooks/useDailyLog.js';
import { useAdHocTasks } from './hooks/useAdHocTasks.js';
import { useFocusList } from './hooks/useFocusList.js';
import { usePendingRevenueReview } from './hooks/usePendingRevenueReview.js';

export default function App() {
  // --- Core state ---
  const [benchKeywords, setBenchKeywords] = useState(() => {
    try { return JSON.parse(localStorage.getItem('benchKeywords') || 'null') || {}; } catch { return {}; }
  });
  const [jobs, setJobs] = useState(() => {
    const stored = (() => { try { return JSON.parse(localStorage.getItem('benchKeywords') || 'null') || {}; } catch { return {}; } })();
    const storedBH = (() => { try { return JSON.parse(localStorage.getItem('benchHours') || 'null') || {}; } catch { return {}; } })();
    return parseCSV(RAW_CSV, stored, storedBH);
  });
  const [scheduledSlots, setScheduledSlots] = useState({});
  const [weekDays, setWeekDays] = useState(() => getWeekDays());
  const [displayedDate, setDisplayedDate] = useState(() =>
    getWeekDays().find(d => d.toDateString() === new Date().toDateString()) || new Date()
  );
  const [dragMode, setDragMode] = useState('regular');
  const [toast, setToast] = useState('');
  const [changelog, setChangelog] = useState([
    { date: '2026-06-23', note: 'Fix: calendar bookings wiped by watcher on network error — script now aborts instead of overwriting with empty slots' },
    { date: '2026-06-21', note: 'Add Wiring bench (teal) — Setup jobs with pickup/wiring work split into Setup + Wiring cards' },
    { date: '2026-06-21', note: 'Fix Luthier hierarchy — Luthier now always beats Setup/Electronics keywords' },
    { date: '2026-06-21', note: 'Fix bridge pup false positive — "bridge pickup/pup" no longer triggers Luthier bench' },
    { date: '2026-06-21', note: 'Fix: Google Sheet now receives Multitrack PDF field updates (Desc, Customer, Mfr, Model, Status) on every sync' },
    { date: '2026-06-21', note: 'Add reauth_google.command — renew Google OAuth token without re-entering credentials' },
    { date: '2026-06-14', note: 'Ship Runway view — long-running project timeline (PJ=Y jobs), with age colours and status sections' },
    { date: '2026-06-14', note: 'Ship mobile tap-to-schedule — bottom sheet for iPhone: pick day/time, change bench, add splits' },
    { date: '2026-06-13', note: 'Add Setup+Luthier split cards — Luthier jobs with restring/setup work auto-split into two bench cards' },
    { date: '2026-06-13', note: 'Add Fretwork+Setup and Refret+Setup split cards' },
    { date: '2026-06-13', note: 'Add GCal conflict detection — warns when a scheduled slot overlaps a Google Calendar appointment' },
  ]);
  const [showSettings, setShowSettings] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [highlightedJobId, setHighlightedJobId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [pomoJob, setPomoJob] = useState(null);
  const [showSummary, setShowSummary] = useState(false);
  const [showParts, setShowParts] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showRunway, setShowRunway] = useState(false);
  const [showParkingLot, setShowParkingLot] = useState(() => window.location.hash === '#parking-lot');
  const [showWeekView, setShowWeekView] = useState(false);
  const [showJobs, setShowJobs] = useState(false);
  const [showCloseDay, setShowCloseDay] = useState(false);
  const [showCatchUp, setShowCatchUp] = useState(false);
  const [bumpPrompt, setBumpPrompt] = useState(null); // { job, fromSlot, toSlot } | null
  const [completedJobs, setCompletedJobs] = useState([]);
  const [doneJobIds, setDoneJobIds] = useState([]);
  const [weeklyTarget, setWeeklyTarget] = useState(() => Number(localStorage.getItem('weeklyTarget') || 2000));
  const [hourlyRate, setHourlyRate] = useState(() => Number(localStorage.getItem('hourlyRate') || 85));
  const [benchHours, setBenchHours] = useState(() => {
    try { return JSON.parse(localStorage.getItem('benchHours') || 'null') || {}; } catch { return {}; }
  });
  const [isMobile] = useState(() => window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768);
  const [conflictEvents, setConflictEvents] = useState([]);

  // Shared refs — written by multiple hooks; must live here to avoid split ownership
  const justSavedAt = useRef(0);
  const scheduledSlotsRef = useRef({});
  const jobsRef = useRef([]);
  const externalEventsRef = useRef([]);

  useEffect(() => { scheduledSlotsRef.current = scheduledSlots; }, [scheduledSlots]);
  useEffect(() => { jobsRef.current = jobs; }, [jobs]);

  // Load unread conflict bump events on startup
  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    loadConflictLog().then(events => {
      if (events.length > 0) setConflictEvents(events);
    });
  }, []);

  const showToast = useCallback((msg) => setToast(msg), []);
  const addChangelog = useCallback((msg) => {
    setChangelog(prev => [...prev, { ts: Date.now(), msg }]);
  }, []);

  // --- Hooks ---
  const { pendingRevenueReview, addDisappearedJobs, resolveItem: resolvePendingRevenueReviewItem } = usePendingRevenueReview();

  useFirebase({
    jobs, scheduledSlots, setJobs, setScheduledSlots,
    setFirebaseReady, setLastSyncedAt,
    setCompletedJobs, setDoneJobIds,
    justSavedAt, firebaseReady,
    onJobsDisappeared: addDisappearedJobs,
  });

  const gcal = useGoogleCalendar({
    weekDays, jobs, scheduledSlots, scheduledSlotsRef, jobsRef,
    setJobs, setScheduledSlots, showToast, addChangelog,
  });

  // Keep externalEventsRef in sync for useScheduler (reads it directly)
  useEffect(() => { externalEventsRef.current = gcal.externalEvents; }, [gcal.externalEvents]);

  const {
    todayLog, addBullet, removeBullet, toggleDone, closeDay, upsertScheduledBullet,
    deferredItems, addChecklistItem, toggleChecklistItem, pullBackIn,
    logs: dailyLogs, catchUpNeeded, autoCarryForward, resolveStaleDays,
  } = useDailyLog();
  // Stamps a `source: 'auto-carry'` bump-history entry (reason left null —
  // filled in later via handleSetBumpReason) on a job whose Daily Log bullet
  // just silently migrated to today via autoCarryForward. Auto-carry has no
  // real calendar slot (it's a log-day migration, not a scheduling move), so
  // fromSlot/toSlot hold bare YYYY-MM-DD date-keys here, not slotKey() strings.
  const handleJobAutoCarryBumped = useCallback((jobId, { fromDateKey, toDateKey }) => {
    const entry = {
      ts: Date.now(),
      reason: null,
      reasonText: undefined,
      fromSlot: fromDateKey,
      toSlot: toDateKey,
      source: 'auto-carry',
    };
    setJobs(prev => prev.map(j =>
      j.id === jobId ? { ...j, bumpHistory: [...(j.bumpHistory || []), entry] } : j
    ));
  }, [setJobs]);

  const handleAutoCarryForward = useCallback(() => {
    autoCarryForward(handleJobAutoCarryBumped);
  }, [autoCarryForward, handleJobAutoCarryBumped]);

  // Retroactively fills in a reason on a previously-unresolved auto-carry bump
  // entry — called from DailyLogPage's CarriedReasonPicker, correlated by the
  // bullet's `carriedFrom` date-key matching the entry's `fromSlot`.
  const handleSetBumpReason = useCallback((jobId, carriedFrom, { reason, reasonText }) => {
    setJobs(prev => prev.map(j => {
      if (j.id !== jobId) return j;
      const bumpHistory = (j.bumpHistory || []).map(entry =>
        entry.source === 'auto-carry' && entry.fromSlot === carriedFrom && !entry.reason
          ? { ...entry, reason, reasonText: reason === 'Other' ? reasonText : undefined }
          : entry
      );
      return { ...j, bumpHistory };
    }));
  }, [setJobs]);

  const { adHocTasks, scheduleAdHocTask, removeAdHocTask } = useAdHocTasks();
  const { focusList } = useFocusList();

  const schedulerWeekDays = showWeekView ? weekDays : [displayedDate];

  const handleBumpDetected = useCallback(({ job, fromSlot, toSlot }) => {
    setBumpPrompt({ job, fromSlot, toSlot });
  }, []);

  const scheduler = useScheduler({
    jobs, setJobs, scheduledSlots, setScheduledSlots,
    weekDays: schedulerWeekDays, externalEventsRef, justSavedAt,
    signedIn: gcal.signedIn, showToast, addChangelog,
    upsertScheduledBullet,
    onBumpDetected: handleBumpDetected,
  });

  const jobOps = useJobs({
    jobs, setJobs, scheduledSlots, setScheduledSlots,
    doneJobIds, completedJobs, setCompletedJobs, setDoneJobIds,
    benchKeywords, benchHours, justSavedAt,
    setPomoJob, setHighlightedJobId, setSidebarOpen,
    showToast, addChangelog,
  });

  const handleRevenueReviewDone = useCallback((item, amount) => {
    jobOps.handleMarkDone(item, amount);
    resolvePendingRevenueReviewItem(item.job);
  }, [jobOps, resolvePendingRevenueReviewItem]);

  const handleRevenueReviewCancelled = useCallback((item, note) => {
    addChangelog(`#${item.job} ${item.mfr} ${item.model} — cancelled${note ? `: ${note}` : ''}`);
    resolvePendingRevenueReviewItem(item.job);
  }, [addChangelog, resolvePendingRevenueReviewItem]);

  // Deep-link: ?job=XXXX opens that job's drawer on load
  const deepLinkJobNum = useRef(new URLSearchParams(window.location.search).get('job'));
  const deepLinkApplied = useRef(false);
  useEffect(() => {
    if (deepLinkApplied.current || !deepLinkJobNum.current || jobs.length === 0) return;
    const found = jobs.find(j => String(j.job) === deepLinkJobNum.current || j.id === deepLinkJobNum.current);
    if (found) {
      deepLinkApplied.current = true;
      setEditingJob(found);
      setSidebarOpen(true);
    }
  }, [jobs]);

  // Auto-close focus mode once all split cards are scheduled
  useEffect(() => {
    if (!highlightedJobId) return;
    const subtasks = jobs.filter(j => j.parentId === highlightedJobId);
    if (subtasks.length > 0 && subtasks.every(j => j.scheduled)) {
      setHighlightedJobId(null);
      setSidebarOpen(false);
    }
  }, [jobs, highlightedJobId]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Build scheduled job map for CalendarGrid
  const scheduledJobObjects = {};
  Object.entries(scheduledSlots).forEach(([key, jobId]) => {
    const job = jobs.find(j => j.id === jobId);
    if (job) scheduledJobObjects[key] = job;
  });
  // Merge in ad-hoc maintenance tasks (never touch `jobs`/`scheduledSlots` —
  // kept in their own store so CSV drift-detection can't see them).
  adHocTasks.forEach(task => {
    const pseudoJob = {
      id: task.id, job: null, mfr: 'Maintenance', model: task.text,
      bench: 'Admin', hours: task.hours, desc: task.text, customer: '',
      calendarSlot: task.calendarSlot, isAdHoc: true, done: false,
    };
    task.slotKeys.forEach(k => { if (!scheduledJobObjects[k]) scheduledJobObjects[k] = pseudoJob; });
  });

  // Attempt to schedule a bujo note as an ad-hoc calendar task. Returns
  // { ok, reason } — DailyLogPage shows the reason inline on failure.
  const handleScheduleAdHocNote = useCallback((text, date, hour, minute, hours) => {
    const result = scheduleAdHocTask({
      text, date, hour, minute, hours,
      occupiedKeys: new Set(Object.keys(scheduledSlotsRef.current)),
    });
    if (result.ok) {
      addBullet(text, null, {
        isAdHoc: true, hoursRange: hours,
        scheduledDateKey: localDateKey(date), hour, minute,
      });
    }
    return result;
  }, [scheduleAdHocTask, addBullet]);

  const syncColors = { idle: '#64748b', syncing: '#fbbf24', synced: '#22c55e', error: '#ef4444' };
  const syncLabels = { idle: 'Sync', syncing: 'Syncing…', synced: 'Synced ✓', error: 'Sync Error' };

  const currentWeekKey = weekDays[0]?.toISOString().slice(0, 10);
  const weekRevenue = completedJobs.filter(r => r.weekKey === currentWeekKey).reduce((s, r) => s + (Number(r.invoiceAmount) || 0), 0);
  const revenueRatio = weeklyTarget > 0 ? weekRevenue / weeklyTarget : 0;
  const revenueColor = revenueRatio >= 0.8 ? '#4ade80' : revenueRatio >= 0.5 ? '#fbbf24' : '#f87171';

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={scheduler.onDragStart}
      onDragEnd={(e) => scheduler.onDragEnd(e, dragMode)}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        {/* Header */}
        <header style={{
          padding: '10px 20px', background: '#1e293b', borderBottom: '1px solid #334155',
          display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0,
          overflowX: 'auto',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'linear-gradient(135deg, #22c55e, #16a34a)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 900, color: '#fff',
            }}>G</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#e2e8f0', letterSpacing: -0.3 }}>GGNZ Scheduler</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>Guitar Garage NZ Ltd</div>
            </div>
          </div>

          <div style={{ textAlign: 'center', lineHeight: 1.3, flexShrink: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>
              <span style={{ color: revenueColor }}>${weekRevenue.toLocaleString()}</span>
              <span style={{ color: '#334155' }}> / </span>
              <span
                style={{ color: '#475569', cursor: 'pointer' }}
                title="Click to change weekly target"
                onClick={() => {
                  const v = window.prompt('Weekly revenue target ($):', weeklyTarget);
                  if (v !== null && !isNaN(Number(v))) {
                    const t = Number(v);
                    setWeeklyTarget(t);
                    localStorage.setItem('weeklyTarget', String(t));
                  }
                }}
              >${weeklyTarget.toLocaleString()}</span>
            </div>
            <div style={{ fontSize: 9, color: '#334155', textTransform: 'uppercase', letterSpacing: '.08em' }}>week revenue</div>
          </div>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <button
              onClick={() => setWeekDays(getWeekDays(new Date(weekDays[0].getTime() - 7 * 86400000)))}
              style={{ background: 'none', border: '1px solid #334155', borderRadius: 6, color: '#94a3b8', fontSize: 16, width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >‹</button>
            <span style={{ fontSize: 12, color: '#94a3b8', minWidth: 160, textAlign: 'center' }}>{formatDateRange(weekDays)}</span>
            <button
              onClick={() => setWeekDays(getWeekDays(new Date(weekDays[0].getTime() + 7 * 86400000)))}
              style={{ background: 'none', border: '1px solid #334155', borderRadius: 6, color: '#94a3b8', fontSize: 16, width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >›</button>
            <button
              onClick={() => setWeekDays(getWeekDays())}
              style={{ background: 'none', border: '1px solid #2563eb', borderRadius: 6, color: '#60a5fa', fontSize: 11, fontWeight: 600, padding: '0 8px', height: 28, cursor: 'pointer' }}
            >Today</button>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div title={gcal.signedIn ? 'Calendar connected' : 'Calendar disconnected'} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: syncColors[gcal.syncStatus],
                boxShadow: gcal.syncStatus === 'synced' ? '0 0 6px #22c55e' : 'none',
              }} />
            </div>

            {!gcal.signedIn ? (
              <button
                onClick={gcal.handleSignIn}
                style={{
                  padding: '7px 14px', borderRadius: 6, border: '1px solid #1d4ed8',
                  background: '#1e3a8a', color: '#bfdbfe', fontSize: 12, fontWeight: 700,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Connect Google
              </button>
            ) : (
              <button
                onClick={gcal.handleSignOut}
                title="Disconnect Google Calendar"
                style={{
                  padding: '7px 14px', borderRadius: 6, border: '1px solid #334155',
                  background: '#1e293b', color: '#4ade80', fontSize: 12, fontWeight: 700,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Google ✓
              </button>
            )}

            <button
              onClick={gcal.handleSync}
              style={{
                padding: '7px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
                background: '#166534', color: '#bbf7d0', fontSize: 12, fontWeight: 700,
                opacity: gcal.syncStatus === 'syncing' ? 0.7 : 1,
              }}
            >
              {syncLabels[gcal.syncStatus]}
            </button>

            {isMobile && (
              <button
                onClick={() => setShowJobs(j => !j)}
                style={{
                  padding: '7px 14px', borderRadius: 6, border: `1px solid ${showJobs ? '#0369a1' : '#334155'}`,
                  background: showJobs ? '#0c4a6e' : '#1e293b',
                  color: showJobs ? '#7dd3fc' : '#94a3b8',
                  fontSize: 12, cursor: 'pointer', fontWeight: showJobs ? 700 : 400,
                }}
              >
                Jobs
              </button>
            )}

            <button
              onClick={() => setShowWeekView(w => !w)}
              style={{
                padding: '7px 14px', borderRadius: 6, border: `1px solid ${showWeekView ? '#065f46' : '#334155'}`,
                background: showWeekView ? '#022c22' : '#1e293b',
                color: showWeekView ? '#6ee7b7' : '#94a3b8',
                fontSize: 12, cursor: 'pointer', fontWeight: showWeekView ? 700 : 400,
              }}
            >
              {showWeekView ? 'Day View' : 'Week View'}
            </button>

            <button
              onClick={() => setShowRunway(r => !r)}
              style={{
                padding: '7px 14px', borderRadius: 6, border: `1px solid ${showRunway ? '#4f46e5' : '#334155'}`,
                background: showRunway ? '#1e1b4b' : '#1e293b',
                color: showRunway ? '#a5b4fc' : '#94a3b8',
                fontSize: 12, cursor: 'pointer', fontWeight: showRunway ? 700 : 400,
              }}
            >
              Runway
            </button>

            <button
              onClick={() => setShowParts(p => !p)}
              style={{
                padding: '7px 14px', borderRadius: 6, border: '1px solid #334155',
                background: showParts ? '#1e3a5f' : '#1e293b',
                color: showParts ? '#93c5fd' : '#94a3b8',
                fontSize: 12, cursor: 'pointer',
              }}
            >
              Parts
            </button>

            <button
              onClick={() => setShowSummary(true)}
              style={{
                padding: '7px 14px', borderRadius: 6, border: '1px solid #334155',
                background: '#1e293b', color: '#94a3b8', fontSize: 12, cursor: 'pointer',
              }}
            >
              Summary
            </button>

            <button
              onClick={() => setShowHelp(h => !h)}
              style={{
                padding: '7px 12px', borderRadius: 6, border: '1px solid #334155',
                background: showHelp ? '#1e3a5f' : '#1e293b',
                color: showHelp ? '#93c5fd' : '#94a3b8',
                fontSize: 13, cursor: 'pointer', fontWeight: 600,
              }}
            >
              ?
            </button>

            <button
              onClick={() => {
                const next = !showParkingLot;
                setShowParkingLot(next);
                window.history.replaceState(null, '', next ? '#parking-lot' : '#');
              }}
              style={{
                padding: '7px 14px', borderRadius: 6, border: `1px solid ${showParkingLot ? '#4f46e5' : '#334155'}`,
                background: showParkingLot ? '#1e1b4b' : '#1e293b',
                color: showParkingLot ? '#a5b4fc' : '#94a3b8',
                fontSize: 12, cursor: 'pointer', fontWeight: showParkingLot ? 700 : 400,
              }}
            >
              Parking Lot
            </button>

            <button
              onClick={() => setShowSettings(true)}
              style={{
                padding: '7px 14px', borderRadius: 6, border: '1px solid #334155',
                background: '#1e293b', color: '#94a3b8', fontSize: 12, cursor: 'pointer',
              }}
            >
              ⚙ Settings
            </button>
          </div>
        </header>

        {/* Body */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {showParkingLot ? (
            <ParkingLotPage onBack={() => {
              setShowParkingLot(false);
              window.history.replaceState(null, '', '#');
            }} />
          ) : showJobs ? (
            <JobsPage
              jobs={jobs}
              onJobClick={job => { setEditingJob(job); }}
            />
          ) : showRunway ? (
            <RunwayPage jobs={jobs} />
          ) : showWeekView ? (
            <>
              <CalendarGrid
                weekDays={weekDays}
                scheduledJobs={scheduledJobObjects}
                externalEvents={gcal.externalEvents}
                isDragging={scheduler.isDragging}
                activeJobId={scheduler.activeJob?.id ?? null}
                onJobClick={jobOps.handleOpenPomo}
                onRemoveAdHocTask={removeAdHocTask}
              />
              <Sidebar
                jobs={jobs}
                dragMode={dragMode}
                onDragModeChange={setDragMode}
                onCsvUpload={jobOps.handleCsvUpload}
                highlightedJobId={highlightedJobId}
                onClearHighlight={() => { setHighlightedJobId(null); setSidebarOpen(false); }}
                onJobClick={setEditingJob}
                isOpen={sidebarOpen}
                onToggle={() => setSidebarOpen(o => !o)}
                lastSyncedAt={lastSyncedAt}
                focusList={focusList}
              />
            </>
          ) : (
            <DailyLogPage
              jobs={jobs}
              scheduledSlots={scheduledSlots}
              weekDays={weekDays}
              displayedDate={displayedDate}
              onDisplayedDateChange={setDisplayedDate}
              scheduledJobs={scheduledJobObjects}
              externalEvents={gcal.externalEvents}
              isDragging={scheduler.isDragging}
              activeJobId={scheduler.activeJob?.id ?? null}
              onCalendarJobClick={jobOps.handleOpenPomo}
              onRemoveAdHocTask={removeAdHocTask}
              onScheduleAdHocNote={handleScheduleAdHocNote}
              dragMode={dragMode}
              onDragModeChange={setDragMode}
              onCsvUpload={jobOps.handleCsvUpload}
              highlightedJobId={highlightedJobId}
              onClearHighlight={() => { setHighlightedJobId(null); setSidebarOpen(false); }}
              onJobClick={setEditingJob}
              lastSyncedAt={lastSyncedAt}
              todayLog={todayLog}
              onAddBullet={addBullet}
              onToggleDone={toggleDone}
              onRemoveBullet={removeBullet}
              onAddChecklistItem={addChecklistItem}
              onToggleChecklistItem={toggleChecklistItem}
              deferredItems={deferredItems}
              onPullBackIn={pullBackIn}
              onBulletJobClick={jobId => {
                const j = jobs.find(job => job.id === jobId);
                if (j) setEditingJob(j);
              }}
              onRequestCloseDay={() => setShowCloseDay(true)}
              focusList={focusList}
              onAutoCarryForward={handleAutoCarryForward}
              catchUpNeeded={catchUpNeeded}
              onRequestCatchUp={() => setShowCatchUp(true)}
              onSetBumpReason={handleSetBumpReason}
            />
          )}
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {scheduler.activeJob ? (
          <div style={{ opacity: 0.9, transform: 'rotate(2deg)', pointerEvents: 'none' }}>
            <div style={{
              background: BENCH_COLORS[scheduler.activeJob.bench]?.bg || '#374151',
              border: `2px solid ${dragMode === 'urgent' ? '#ef4444' : BENCH_COLORS[scheduler.activeJob.bench]?.border || '#6b7280'}`,
              borderRadius: 8, padding: '8px 12px', minWidth: 180, maxWidth: 240,
              boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#e2e8f0' }}>#{scheduler.activeJob.job}</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>{scheduler.activeJob.mfr} {scheduler.activeJob.model}</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                {scheduler.activeJob.bench} · {scheduler.activeJob.hours}h
                {dragMode === 'urgent' && <span style={{ color: '#ef4444', marginLeft: 6 }}>🚨 URGENT</span>}
              </div>
            </div>
          </div>
        ) : null}
      </DragOverlay>

      <ConflictBanner
        events={conflictEvents}
        onDismiss={() => {
          setConflictEvents([]);
          if (isFirebaseConfigured()) clearConflictLog();
        }}
      />

      <RevenueReviewBanner
        items={pendingRevenueReview}
        onDone={handleRevenueReviewDone}
        onCancelled={handleRevenueReviewCancelled}
        top={conflictEvents.length > 0 ? 56 + 46 + conflictEvents.length * 20 : 56}
      />

      <Toast message={toast} onDismiss={() => setToast('')} />

      {editingJob && (
        isMobile ? (
          <MobileJobSheet
            job={editingJob}
            jobs={jobs}
            weekDays={schedulerWeekDays}
            onSchedule={scheduler.handleMobileSchedule}
            onSave={jobOps.handleSaveDrawer}
            onClose={() => setEditingJob(null)}
            onRemove={scheduler.unscheduleJob}
          />
        ) : (
          <JobDrawer
            job={editingJob}
            jobs={jobs}
            onClose={() => setEditingJob(null)}
            onSave={jobOps.handleSaveDrawer}
            weekDays={schedulerWeekDays}
            onSchedule={scheduler.handleMobileSchedule}
            onRemove={scheduler.unscheduleJob}
          />
        )
      )}

      {pomoJob && (
        <PomoDrawer
          job={pomoJob}
          onClose={() => setPomoJob(null)}
          onLogSession={session => jobOps.handleLogPomoSession(pomoJob.id, session)}
          onMarkDone={jobOps.handleMarkDone}
          onRemove={scheduler.unscheduleJob}
        />
      )}

      {showSummary && (
        <WeeklySummaryModal
          jobs={jobs}
          scheduledSlots={scheduledSlots}
          weekDays={weekDays}
          onClose={() => setShowSummary(false)}
        />
      )}

      {showSettings && (
        <SettingsModal
          changelog={changelog}
          onClose={() => setShowSettings(false)}
          isSignedIn={gcal.signedIn}
          onSignIn={gcal.handleSignIn}
          onSignOut={gcal.handleSignOut}
          isConfigured={isConfigured()}
          benchKeywords={benchKeywords}
          defaultBenchKeywords={DEFAULT_BENCH_KEYWORDS}
          onBenchKeywordsChange={kw => {
            setBenchKeywords(kw);
            localStorage.setItem('benchKeywords', JSON.stringify(kw));
            // Re-infer benches over the CURRENT jobs — never re-parse RAW_CSV
            // (a header-only stub: parseCSV returns [] and the debounced save
            // would wipe every job on every device). Skip split children
            // (bench chosen by the user or the split logic) and split parents
            // (changing their bench would drift auto-split child IDs and
            // orphan their scheduled slots).
            setJobs(prev => prev.map(j =>
              (j.parentId || j.isSplit || j.hasSubtasks)
                ? j
                : { ...j, bench: inferBench(j.desc, j.status, j.action, j.model, j.mfr, kw) }
            ));
          }}
          hourlyRate={hourlyRate}
          onHourlyRateChange={n => { setHourlyRate(n); localStorage.setItem('hourlyRate', String(n)); }}
          weeklyRevenueTarget={weeklyTarget}
          onWeeklyTargetChange={n => { setWeeklyTarget(n); localStorage.setItem('weeklyTarget', String(n)); }}
          benchHours={benchHours}
          onBenchHoursChange={bh => { setBenchHours(bh); localStorage.setItem('benchHours', JSON.stringify(bh)); }}
        />
      )}

      {showParts && (
        <PartsDrawer onClose={() => setShowParts(false)} />
      )}

      {showHelp && (
        <HelpDrawer onClose={() => setShowHelp(false)} />
      )}

      {showCloseDay && (
        <CloseDayModal
          bullets={(todayLog?.bullets || []).filter(b => !b.done)}
          onClose={migrations => {
            closeDay(migrations);
            setShowCloseDay(false);
          }}
        />
      )}

      {showCatchUp && catchUpNeeded && (
        <CatchUpInterview
          days={catchUpNeeded.days}
          logs={dailyLogs}
          onClose={resolutions => {
            if (resolutions) resolveStaleDays(resolutions);
            setShowCatchUp(false);
          }}
        />
      )}

      {bumpPrompt && (
        <BumpReasonModal
          job={bumpPrompt.job}
          fromSlot={bumpPrompt.fromSlot}
          toSlot={bumpPrompt.toSlot}
          onResolve={({ reason, reasonText }) => {
            const entry = {
              ts: Date.now(),
              reason,
              reasonText,
              fromSlot: bumpPrompt.fromSlot,
              toSlot: bumpPrompt.toSlot,
              source: 'manual',
            };
            setJobs(prev => prev.map(j =>
              j.id === bumpPrompt.job.id ? { ...j, bumpHistory: [...(j.bumpHistory || []), entry] } : j
            ));
            if (isFirebaseConfigured()) {
              appendConflictLog([{
                ts: entry.ts,
                jobNum: bumpPrompt.job.job,
                mfr: bumpPrompt.job.mfr,
                model: bumpPrompt.job.model,
                oldSlot: bumpPrompt.fromSlot,
                newSlot: bumpPrompt.toSlot,
                reason,
                reasonText,
              }]);
            }
            setBumpPrompt(null);
          }}
        />
      )}
    </DndContext>
  );
}
