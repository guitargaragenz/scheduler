import { useState, useEffect, useCallback, useRef } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  closestCenter,
} from '@dnd-kit/core';
import { parseCSV, RAW_CSV, BENCH_COLORS, DEFAULT_BENCH_KEYWORDS, createSubtasks } from './data/jobs.js';
import { getWeekDays, formatDateRange, slotKey, dayLabel, getWorkHours, isGapHour, isSaturday, isSunday, isLunchSlot } from './utils/calendar.js';
import { canPlace, scheduleUrgent, slotsNeeded, findAvailableSlots, nextHalfSlotKey } from './utils/scheduler.js';
import {
  initGoogleApi, requestAuth, isSignedIn, signOut, listEvents,
  createEvent, updateEvent, deleteEvent, parsePersonalBlocks, isConfigured,
} from './utils/googleCalendar.js';
import { isFirebaseConfigured, loadSchedule, saveSchedule, subscribeToSchedule, saveCompletedJobs, subscribeToCompletedJobs } from './utils/firebase.js';
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

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Re-expand split subtasks after Firebase load so hard refresh doesn't wipe them.
// Splits are derived from createSubtasks() on each job — not stored as raw Firebase entries.
// knownSlots: the scheduledSlots map, used to correctly mark splits as scheduled on first load.
function withSplitsExpanded(rawJobs, existingJobs = [], knownSlots = {}) {
  const existingById = Object.fromEntries(existingJobs.map(j => [j.id, j]));
  const scheduledIds = new Set(Object.values(knownSlots));
  const result = [];
  for (const job of rawJobs) {
    if (job.parentId) continue; // drop stale subtasks — regenerate below
    const subtasks = createSubtasks(job);
    if (subtasks && subtasks.length > 0) {
      result.push({ ...job, hasSubtasks: true, subtasks: subtasks.map(s => s.id) });
      for (const st of subtasks) {
        const prev = existingById[st.id];
        result.push({
          ...st,
          scheduled:    prev?.scheduled    ?? scheduledIds.has(st.id),
          calendarSlot: prev?.calendarSlot ?? null,
          gcalEventId:  prev?.gcalEventId  ?? null,
        });
      }
    } else {
      result.push({ ...job, hasSubtasks: false, subtasks: null, manualSplits: false });
    }
  }
  return result;
}

export default function App() {
  const [benchKeywords, setBenchKeywords] = useState(() => {
    try { return JSON.parse(localStorage.getItem('benchKeywords') || 'null') || {}; } catch { return {}; }
  });
  const [jobs, setJobs] = useState(() => {
    const stored = (() => { try { return JSON.parse(localStorage.getItem('benchKeywords') || 'null') || {}; } catch { return {}; } })();
    return parseCSV(RAW_CSV, stored);
  });
  const [scheduledSlots, setScheduledSlots] = useState({}); // slotKey -> jobId
  const [weekDays, setWeekDays] = useState(() => getWeekDays());
  const [dragMode, setDragMode] = useState('regular');
  const [activeJob, setActiveJob] = useState(null);
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
  const [googleInited, setGoogleInited] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [externalEvents, setExternalEvents] = useState([]);
  const [syncStatus, setSyncStatus] = useState('idle'); // idle | syncing | synced | error
  const [isDragging, setIsDragging] = useState(false);
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
  const [completedJobs, setCompletedJobs] = useState([]);
  const [doneJobIds, setDoneJobIds] = useState([]);
  const [weeklyTarget, setWeeklyTarget] = useState(() => Number(localStorage.getItem('weeklyTarget') || 2000));
  const [hourlyRate, setHourlyRate] = useState(() => Number(localStorage.getItem('hourlyRate') || 85));
  const [isMobile] = useState(() => window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768);
  const pollRef = useRef(null);
  const saveTimerRef = useRef(null);
  const externalEventsRef = useRef([]); // always-current ref — avoids stale closure in drag handlers
  const justSavedAt = useRef(0); // timestamp of our last save — used to suppress echo snapshots
  const scheduledSlotsRef = useRef({});
  const jobsRef = useRef([]);

  // Keep refs in sync with state so poll closure always sees current values
  useEffect(() => { externalEventsRef.current = externalEvents; }, [externalEvents]);
  useEffect(() => { scheduledSlotsRef.current = scheduledSlots; }, [scheduledSlots]);
  useEffect(() => { jobsRef.current = jobs; }, [jobs]);

  // Deep-link: ?job=XXXX opens that job's drawer on load
  // Uses a ref so it fires once jobs are confirmed loaded (CSV or Firebase)
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

  // Load from Firestore on startup, then subscribe to real-time updates from other devices
  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    loadSchedule().then(data => {
      if (data) {
        if (data.jobs) setJobs(prev => withSplitsExpanded(data.jobs, prev, data.scheduledSlots || {}));
        if (data.scheduledSlots) setScheduledSlots(data.scheduledSlots);
        if (data.updatedAt) setLastSyncedAt(data.updatedAt);
      }
      setFirebaseReady(true);
    });

    const unsub = subscribeToSchedule(data => {
      // Ignore snapshots triggered by our own saves (echo suppression — 5s window)
      if (Date.now() - justSavedAt.current < 5000) return;
      if (data.jobs) setJobs(prev => withSplitsExpanded(data.jobs, prev, data.scheduledSlots || {}));
      if (data.scheduledSlots) setScheduledSlots(data.scheduledSlots);
      if (data.updatedAt) setLastSyncedAt(data.updatedAt);
    });
    return () => unsub();
  }, []);

  // Subscribe to completed jobs / done IDs
  useEffect(() => {
    if (!isFirebaseConfigured()) return;
    const unsub = subscribeToCompletedJobs(data => {
      setCompletedJobs(data.records || []);
      setDoneJobIds(data.doneJobIds || []);
    });
    return () => unsub();
  }, []);

  // Debounced save to Firestore whenever jobs or scheduledSlots change
  useEffect(() => {
    if (!isFirebaseConfigured() || !firebaseReady) return;
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      justSavedAt.current = Date.now();
      saveSchedule(jobs, scheduledSlots);
    }, 1500);
    return () => clearTimeout(saveTimerRef.current);
  }, [jobs, scheduledSlots, firebaseReady]);

  // Init Google API
  useEffect(() => {
    if (!isConfigured()) return;
    initGoogleApi().then(ok => {
      setGoogleInited(ok);
      setSignedIn(isSignedIn());
    });
  }, []);

  // Poll calendar
  useEffect(() => {
    if (!signedIn) return;
    const poll = async () => {
      const start = new Date(weekDays[0]);
      start.setHours(0, 0, 0, 0);
      const end = new Date(weekDays[6]);
      end.setHours(23, 59, 59, 999);
      const events = await listEvents(start, end);
      // Only update if we got real results — guard against API hiccups wiping the display
      if (events && events.length > 0) {
        setExternalEvents(events);
        externalEventsRef.current = events; // keep ref in sync for drag handlers
      }

      // Bump any scheduled jobs that conflict with GCal appointments
      // Build the full blocked-slot set from the freshly-fetched events
      const appointmentBlocked = new Set();
      (events || []).forEach(ev => {
        if (ev.summary?.startsWith('#')) return; // scheduler-owned events
        const evStart = new Date(ev.start?.dateTime || ev.start?.date);
        const evEnd   = new Date(ev.end?.dateTime   || ev.end?.date);
        const dayIdx  = weekDays.findIndex(d => d.toDateString() === evStart.toDateString());
        if (dayIdx < 0) return;
        let h = evStart.getHours();
        let m = evStart.getMinutes() < 30 ? 0 : 30;
        const endMins = evEnd.getHours() * 60 + evEnd.getMinutes();
        while (h * 60 + m < endMins) {
          appointmentBlocked.add(slotKey(weekDays[dayIdx], h, m));
          if (m === 0) { m = 30; } else { m = 0; h++; }
        }
      });

      if (appointmentBlocked.size > 0) {
        // Use refs so we have current state without stale closure values
        const currentSlots = { ...scheduledSlotsRef.current };
        const currentJobs  = jobsRef.current;

        const conflicts = Object.entries(currentSlots).filter(([key]) => appointmentBlocked.has(key));
        if (conflicts.length > 0) {
          const nextSlots = { ...currentSlots };
          const jobMap    = Object.fromEntries(currentJobs.map(j => [j.id, j]));
          const updatedJobs = { ...jobMap };

          // Evict conflicting slots first so findAvailableSlots sees them as free
          const bumped = new Set();
          conflicts.forEach(([key, jobId]) => {
            delete nextSlots[key];
            bumped.add(jobId);
          });

          bumped.forEach(jobId => {
            const job = jobMap[jobId];
            if (!job) return;
            const needed = slotsNeeded(job);
            const newSlots = findAvailableSlots(0, 0, 0, needed, nextSlots, weekDays, appointmentBlocked);
            if (newSlots.length >= needed) {
              newSlots.forEach(({ dayIdx: d, hour: h, minute: m }) => {
                nextSlots[slotKey(weekDays[d], h, m)] = jobId;
              });
              const { hour: fh, minute: fm, dayIdx: fd } = newSlots[0];
              const newDay = weekDays[fd].toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric' });
              addChangelog(`Job #${job.job} bumped by appointment → moved to ${newDay} ${fh}:${String(fm).padStart(2,'0')}`);
              showToast(`Job #${job.job} bumped → rescheduled to ${newDay} ${fh}:${String(fm).padStart(2,'0')}`);
            } else {
              updatedJobs[jobId] = { ...job, scheduled: false, calendarSlot: null };
              addChangelog(`Job #${job.job} bumped by appointment — no room this week, reschedule manually`);
              showToast(`Job #${job.job} bumped by appointment — no room left this week`);
            }
          });

          setScheduledSlots(nextSlots);
          setJobs(currentJobs.map(j => updatedJobs[j.id] || j));
        }
      }
    };
    poll();
    pollRef.current = setInterval(poll, 30000);
    return () => clearInterval(pollRef.current);
  }, [signedIn, weekDays]);

  const showToast = useCallback((msg) => setToast(msg), []);
  const addChangelog = useCallback((msg) => {
    setChangelog(prev => [...prev, { ts: Date.now(), msg }]);
  }, []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function onDragStart({ active }) {
    const jobId = active.data?.current?.jobId ?? active.id;
    const job = jobs.find(j => j.id === jobId);
    setActiveJob(job || null);
    setIsDragging(true);
  }

  function onDragEnd({ active, over }) {
    setActiveJob(null);
    setIsDragging(false);

    // Calendar cards have id "jobId::slotKey" — extract real job id from data
    const jobId = active.data?.current?.jobId ?? active.id;
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    const source = active.data?.current?.source;
    const mode = active.data?.current?.dragMode || dragMode;

    // Dropped outside all droppable zones — leave job exactly where it was
    if (!over) return;

    // Dropped back on sidebar — unschedule from calendar
    if (over.id === 'sidebar') {
      if (source === 'calendar') unscheduleJob(job);
      return;
    }

    // Dropped on lunch block — always reject
    if (over.data?.current?.isLunch) {
      showToast('⚠ Lunch is locked 12–1 PM — pick another slot');
      return;
    }

    // Dropped on a calendar slot
    const { dayIdx, hour, minute = 0 } = over.data?.current || {};
    if (dayIdx === undefined || hour === undefined) return;

    if (mode === 'urgent') {
      handleUrgentDrop(job, dayIdx, hour, minute, source);
    } else {
      handleRegularDrop(job, dayIdx, hour, minute, source);
    }
  }

  // Build a set of slot keys blocked by Google Calendar external events
  // Uses ref (not state) so drag handlers always get current data, not stale closure
  function buildExternalBlockedSlots() {
    const blocked = new Set();
    externalEventsRef.current.forEach(ev => {
      if (ev.summary?.startsWith('#')) return;
      const start = new Date(ev.start?.dateTime || ev.start?.date);
      const end   = new Date(ev.end?.dateTime   || ev.end?.date);
      const dayIdx = weekDays.findIndex(d => d.toDateString() === start.toDateString());
      if (dayIdx < 0) return;
      let h = start.getHours();
      let m = start.getMinutes() < 30 ? 0 : 30;
      // Use exact end minutes — avoids rounding a 10:00–10:15 appt up to block 10:30 as well
      const endMins = end.getHours() * 60 + end.getMinutes();
      while (h * 60 + m < endMins) {
        blocked.add(slotKey(weekDays[dayIdx], h, m));
        if (m === 0) { m = 30; } else { m = 0; h++; }
      }
    });
    return blocked;
  }

  function handleRegularDrop(job, dayIdx, hour, minute, source) {
    justSavedAt.current = Date.now(); // suppress Firebase echo while we place this job
    const needed = slotsNeeded(job); // number of 30-min slots

    // Temp map without job's own slots (and orphaned buffer)
    const tempSlots = { ...scheduledSlots };
    if (source === 'calendar') {
      Object.keys(tempSlots).forEach(k => {
        if (tempSlots[k] === job.id) {
          delete tempSlots[k];
        }
      });
    }

    const date = weekDays[dayIdx];
    const { start, end } = getWorkHours(date);
    if (hour < start || hour >= end) {
      showToast('⚠ Outside work hours — pick a slot inside the work day');
      return;
    }

    const slots = findAvailableSlots(dayIdx, hour, minute, needed, tempSlots, weekDays, buildExternalBlockedSlots());
    if (slots.length < needed) {
      showToast(`⚠ Not enough space — only ${slots.length} of ${needed} half-slots free from here`);
      return;
    }

    const fmt = ({ dayIdx: d, hour: h, minute: m }) =>
      `${weekDays[d].toLocaleDateString('en-NZ', { weekday: 'short' })} ${h}:${m === 0 ? '00' : '30'}`;
    const spanDesc = slots[0].dayIdx === slots[slots.length - 1].dayIdx
      ? `${fmt(slots[0])}–${slots[slots.length-1].hour}:${slots[slots.length-1].minute === 0 ? '00' : '30'}`
      : `${fmt(slots[0])} → ${fmt(slots[slots.length - 1])}`;

    setScheduledSlots(prev => {
      const next = { ...prev };
      // Always clear ALL existing slots for this job before placing —
      // handles stale Firestore-loaded slots regardless of drag source
      Object.keys(next).forEach(k => {
        if (next[k] === job.id) {
          delete next[k];
        }
      });
      // Place job half-slots
      slots.forEach(({ dayIdx: d, hour: h, minute: m }) => {
        next[slotKey(weekDays[d], h, m)] = job.id;
      });
      return next;
    });

    setJobs(prev => prev.map(j =>
      j.id === job.id ? { ...j, scheduled: true, calendarSlot: slots[0] } : j
    ));
    showToast(`#${job.job} placed — ${spanDesc}`);
    addChangelog(`Scheduled #${job.job} ${job.mfr} ${job.model} — ${spanDesc}`);
  }

  function handleMobileSchedule(job, dayIdx, hour, minute) {
    handleRegularDrop(job, dayIdx, hour, minute, undefined);
  }

  function handleUrgentDrop(job, dayIdx, hour, minute, source) {
    const date = weekDays[dayIdx];
    const { start, end } = getWorkHours(date);
    const needed = slotsNeeded(job);
    const isWeekday = !isSaturday(date) && !isSunday(date);
    if (hour < start || hour >= end) {
      showToast('⚠ Cannot place urgent job — outside work hours');
      return;
    }

    const externalBlocked = buildExternalBlockedSlots();

    // Build temp map without this job's own slots
    const tempSlots = { ...scheduledSlots };
    if (source === 'calendar') {
      Object.keys(tempSlots).forEach(k => {
        if (tempSlots[k] === job.id) {
          delete tempSlots[k];
        }
      });
    }

    // Find N slots from drop point — skip lunch + appointments (auto-split around them)
    // but DO include slots occupied by other jobs (we'll displace those)
    const slots = [];
    for (let d = dayIdx; d < weekDays.length && slots.length < needed; d++) {
      const dayDate = weekDays[d];
      const { start: ds, end: de } = getWorkHours(dayDate);
      const dayIsWeekday = !isSaturday(dayDate) && !isSunday(dayDate);
      for (let h = ds; h < de && slots.length < needed; h++) {
        if (dayIsWeekday && isLunchSlot(h)) continue;
        if (isGapHour(h)) continue;
        for (const m of [0, 30]) {
          if (d === dayIdx && (h < hour || (h === hour && m < minute))) continue;
          const key = slotKey(dayDate, h, m);
          if (externalBlocked.has(key)) continue; // skip appointments
          slots.push({ dayIdx: d, hour: h, minute: m });
          if (slots.length >= needed) break;
        }
      }
    }

    if (slots.length < needed) {
      showToast(`⚠ Not enough space — only ${slots.length} of ${needed} slots free from here`);
      return;
    }

    // Collect any jobs displaced by the chosen slots
    const displaced = [];
    slots.forEach(({ dayIdx: d, hour: h, minute: m }) => {
      const occupant = tempSlots[slotKey(weekDays[d], h, m)];
      if (occupant && !displaced.includes(occupant)) displaced.push(occupant);
    });

    setScheduledSlots(prev => {
      const next = { ...prev };
      // Always clear ALL existing slots for this job — handles stale slots from any source
      Object.keys(next).forEach(k => {
        if (next[k] === job.id) {
          delete next[k];
        }
      });
      // Remove displaced jobs entirely
      displaced.forEach(bid => {
        Object.keys(next).forEach(k => { if (next[k] === bid) delete next[k]; });
      });
      // Place urgent job in chosen slots
      slots.forEach(({ dayIdx: d, hour: h, minute: m }) => {
        next[slotKey(weekDays[d], h, m)] = job.id;
      });
      return next;
    });

    if (displaced.length > 0) {
      setJobs(prev => prev.map(j =>
        displaced.includes(j.id) ? { ...j, scheduled: false, calendarSlot: null } : j
      ));
    }
    setJobs(prev => prev.map(j =>
      j.id === job.id ? { ...j, scheduled: true, calendarSlot: slots[0] } : j
    ));

    const first = slots[0];
    const firstDate = weekDays[first.dayIdx];
    const dayName = firstDate.toLocaleDateString('en-NZ', { weekday: 'short' });
    const timeStr = `${first.hour}:${first.minute === 0 ? '00' : '30'}`;
    const splitNote = slots[0].dayIdx !== slots[slots.length-1].dayIdx || externalBlocked.size > 0
      ? ' (split around appt/lunch)' : '';
    const msg = displaced.length > 0
      ? `🚨 #${job.job} forced to ${dayName} ${timeStr}${splitNote}. Moved ${displaced.map(id => `#${id}`).join(', ')} back.`
      : `🚨 #${job.job} scheduled ${dayName} ${timeStr}${splitNote}`;
    showToast(msg);
    addChangelog(msg);
  }

  function placeJob(job, dayIdx, hour, minute = 0) {
    const needed = slotsNeeded(job);
    const date = weekDays[dayIdx];
    const { end } = getWorkHours(date);
    setScheduledSlots(prev => {
      const next = { ...prev };
      let h = hour, m = minute;
      for (let i = 0; i < needed; i++) {
        next[slotKey(weekDays[dayIdx], h, m)] = job.id;
        if (m === 0) { m = 30; } else { m = 0; h++; }
      }
      return next;
    });
    setJobs(prev => prev.map(j =>
      j.id === job.id ? { ...j, scheduled: true, calendarSlot: { dayIdx, hour, minute } } : j
    ));
    const dayName = date.toLocaleDateString('en-NZ', { weekday: 'short' });
    addChangelog(`Scheduled #${job.job} ${job.mfr} ${job.model} — ${dayName} ${hour}:${minute === 0 ? '00' : '30'}`);
  }

  function unscheduleJob(job) {
    setScheduledSlots(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => {
        if (next[k] === job.id) {
          // Also clear the buffer slot that immediately follows this job slot
          delete next[k];
        }
      });
      return next;
    });
    setJobs(prev => prev.map(j =>
      j.id === job.id ? { ...j, scheduled: false, calendarSlot: null, gcalEventId: null } : j
    ));
    if (job.gcalEventId && signedIn) {
      deleteEvent(job.gcalEventId).catch(e => console.error('deleteEvent failed:', e));
    }
    addChangelog(`Unscheduled #${job.job} — moved back to sidebar`);
  }

  // Build scheduled job map for CalendarGrid
  const scheduledJobObjects = {};
  Object.entries(scheduledSlots).forEach(([key, jobId]) => {
    const job = jobs.find(j => j.id === jobId);
    if (job) scheduledJobObjects[key] = job;
  });

  async function handleSync() {
    if (!signedIn) {
      showToast('⚠ Not connected to Google Calendar. Open Settings to connect.');
      return;
    }
    setSyncStatus('syncing');
    const scheduled = jobs.filter(j => j.scheduled && j.calendarSlot);
    let ok = 0;
    const updatedJobs = [...jobs];
    for (const job of scheduled) {
      const { dayIdx, hour } = job.calendarSlot;
      const date = weekDays[dayIdx];
      try {
        let result;
        if (job.gcalEventId) {
          result = await updateEvent(job.gcalEventId, job, date, hour, slotsNeeded(job));
        } else {
          result = await createEvent(job, date, hour, slotsNeeded(job));
        }
        if (result?.id) {
          const idx = updatedJobs.findIndex(j => j.id === job.id);
          if (idx >= 0) updatedJobs[idx] = { ...updatedJobs[idx], gcalEventId: result.id };
        }
        ok++;
      } catch (e) {
        console.error(e);
      }
    }
    setJobs(updatedJobs);
    setSyncStatus(ok === scheduled.length ? 'synced' : 'error');
    showToast(`Synced ${ok}/${scheduled.length} jobs to Google Calendar`);
    addChangelog(`Synced ${ok} jobs to Google Calendar`);
    setTimeout(() => setSyncStatus('idle'), 4000);
  }

  async function handleSignIn() {
    try {
      await requestAuth();
      setSignedIn(true);
      showToast('Connected to Google Calendar');
    } catch (e) {
      showToast(`⚠ Auth failed: ${e.message}`);
    }
  }

  function handleSignOut() {
    signOut();
    setSignedIn(false);
    setExternalEvents([]);
  }

  function handleSaveDrawer(parentJob, rows) {
    const totalCards = rows.reduce((s, r) => s + r.sessions.length, 0);

    if (parentJob.isSubtask) {
      const row = rows[0];
      const sess = row.sessions[0];
      setJobs(prev => prev.map(j => j.id === parentJob.id
        ? { ...j, hours: Number(sess.hours), sessionNote: sess.note }
        : j
      ));
      return;
    }

    if (totalCards === 1) {
      const row = rows[0];
      const sess = row.sessions[0];
      setJobs(prev => prev.map(j => j.id === parentJob.id
        ? { ...j, bench: row.bench, hours: Number(sess.hours), sessionNote: sess.note }
        : j
      ));
      return;
    }

    const subtasks = [];
    rows.forEach(row => {
      row.sessions.forEach((sess, si) => {
        subtasks.push({
          ...parentJob,
          id: `${parentJob.id}_${row.bench}_${si}`,
          bench: row.bench,
          hours: Number(sess.hours),
          sessionIndex: si + 1,
          sessionTotal: row.sessions.length,
          sessionNote: sess.note || '',
          parentId: parentJob.id,
          isSubtask: true,
          scheduled: false,
          calendarSlot: null,
        });
      });
    });

    setJobs(prev => [
      ...prev.map(j => j.id === parentJob.id ? { ...j, isSplit: true } : j),
      ...subtasks,
    ]);
    setHighlightedJobId(parentJob.id);
    setSidebarOpen(true);
  }

  function handleMarkDone(job, amount) {
    const weekKey = getWeekDays()[0].toISOString().slice(0, 10);
    const record = {
      id: String(job.id), job: job.job, mfr: job.mfr, model: job.model,
      bench: job.bench, hours: job.hours, customer: job.customer || '',
      invoiceAmount: Number(amount) || 0,
      completedAt: new Date().toISOString(),
      weekKey,
    };
    const newRecords = [...completedJobs, record];
    const newDoneIds = [...doneJobIds, String(job.id)];
    setCompletedJobs(newRecords);
    setDoneJobIds(newDoneIds);
    // Mark done in-place — job stays on calendar for reference
    setJobs(prev => prev.map(j => j.id === job.id ? { ...j, done: true } : j));
    if (isFirebaseConfigured()) saveCompletedJobs(newRecords, newDoneIds);
    setPomoJob(null);
    showToast(`✓ ${job.mfr} ${job.model} — $${Number(amount).toFixed(0)} invoiced`);
  }

  function handleCsvUpload(csvText) {
    try {
      const newJobs = parseCSV(csvText, benchKeywords).filter(j => !doneJobIds.includes(String(j.id)));
      // Preserve pomoLog from existing jobs so timer history survives CSV refreshes
      const existingByJobNo = Object.fromEntries(jobs.map(j => [j.job, j]));
      const merged = newJobs.map(j => ({
        ...j,
        pomoLog: existingByJobNo[j.job]?.pomoLog || [],
        scheduled: existingByJobNo[j.job]?.scheduled || false,
        calendarSlot: existingByJobNo[j.job]?.calendarSlot || null,
      }));
      // Keep done jobs so they remain visible on calendar
      const doneJobs = jobs.filter(j => j.done);
      const allJobs = [...merged, ...doneJobs];
      const newJobIds = new Set(allJobs.map(j => j.id));
      const preservedSlots = Object.fromEntries(
        Object.entries(scheduledSlots).filter(([, jobId]) => newJobIds.has(jobId))
      );
      justSavedAt.current = Date.now();
      setJobs(allJobs);
      setScheduledSlots(preservedSlots);
      if (isFirebaseConfigured()) saveSchedule(merged, preservedSlots);
      const jobCount = merged.filter(j => !j.parentId).length;
      showToast(`Loaded ${jobCount} jobs from CSV`);
      addChangelog(`CSV uploaded — loaded ${jobCount} jobs`);
    } catch (e) {
      showToast(`⚠ CSV parse error: ${e.message}`);
    }
  }

  function handleOpenPomo(job) {
    setPomoJob(job);
  }

  function handleLogPomoSession(jobId, session) {
    setJobs(prev => prev.map(j => j.id === jobId
      ? { ...j, pomoLog: [...(j.pomoLog || []), session] }
      : j
    ));
    showToast(`Logged ${session.pomos} pomo${session.pomos !== 1 ? 's' : ''} for #${jobs.find(j => j.id === jobId)?.job ?? jobId}`);
  }

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
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        {/* Header */}
        <header style={{
          padding: '10px 20px', background: '#1e293b', borderBottom: '1px solid #334155',
          display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0,
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
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {/* Sync status dot — tooltip on hover shows full status */}
            <div title={signedIn ? 'Calendar connected' : 'Calendar disconnected'} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: syncColors[syncStatus],
                boxShadow: syncStatus === 'synced' ? '0 0 6px #22c55e' : 'none',
              }} />
            </div>

            {!signedIn ? (
              <button
                onClick={handleSignIn}
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
                onClick={handleSignOut}
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
              onClick={handleSync}
              style={{
                padding: '7px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
                background: '#166534', color: '#bbf7d0', fontSize: 12, fontWeight: 700,
                opacity: syncStatus === 'syncing' ? 0.7 : 1,
              }}
            >
              {syncLabels[syncStatus]}
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
              onClick={() => setShowSummary(true)}
              style={{
                padding: '7px 14px', borderRadius: 6, border: '1px solid #334155',
                background: '#1e293b', color: '#94a3b8', fontSize: 12, cursor: 'pointer',
              }}
            >
              Summary
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
          ) : showRunway ? (
            <RunwayPage jobs={jobs} />
          ) : (
            <>
              <CalendarGrid
                weekDays={weekDays}
                scheduledJobs={scheduledJobObjects}
                externalEvents={externalEvents}
                isDragging={isDragging}
                activeJobId={activeJob?.id ?? null}
                onJobClick={handleOpenPomo}
              />
              <Sidebar
                jobs={jobs}
                dragMode={dragMode}
                onDragModeChange={setDragMode}
                onCsvUpload={handleCsvUpload}
                highlightedJobId={highlightedJobId}
                onClearHighlight={() => { setHighlightedJobId(null); setSidebarOpen(false); }}
                onJobClick={setEditingJob}
                isOpen={sidebarOpen}
                onToggle={() => setSidebarOpen(o => !o)}
                lastSyncedAt={lastSyncedAt}
              />
            </>
          )}
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeJob ? (
          <div style={{ opacity: 0.9, transform: 'rotate(2deg)', pointerEvents: 'none' }}>
            <div style={{
              background: BENCH_COLORS[activeJob.bench]?.bg || '#374151',
              border: `2px solid ${dragMode === 'urgent' ? '#ef4444' : BENCH_COLORS[activeJob.bench]?.border || '#6b7280'}`,
              borderRadius: 8, padding: '8px 12px', minWidth: 180, maxWidth: 240,
              boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#e2e8f0' }}>#{activeJob.job}</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>{activeJob.mfr} {activeJob.model}</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                {activeJob.bench} · {activeJob.hours}h
                {dragMode === 'urgent' && <span style={{ color: '#ef4444', marginLeft: 6 }}>🚨 URGENT</span>}
              </div>
            </div>
          </div>
        ) : null}
      </DragOverlay>

      <Toast message={toast} onDismiss={() => setToast('')} />

      {editingJob && (
        isMobile ? (
          <MobileJobSheet
            job={editingJob}
            weekDays={weekDays}
            onSchedule={handleMobileSchedule}
            onSave={handleSaveDrawer}
            onClose={() => setEditingJob(null)}
            onRemove={unscheduleJob}
          />
        ) : (
          <JobDrawer
            job={editingJob}
            onClose={() => setEditingJob(null)}
            onSave={handleSaveDrawer}
            weekDays={weekDays}
            onSchedule={handleMobileSchedule}
          />
        )
      )}

      {pomoJob && (
        <PomoDrawer
          job={pomoJob}
          onClose={() => setPomoJob(null)}
          onLogSession={session => handleLogPomoSession(pomoJob.id, session)}
          onMarkDone={handleMarkDone}
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
          isSignedIn={signedIn}
          onSignIn={handleSignIn}
          onSignOut={handleSignOut}
          isConfigured={isConfigured()}
          benchKeywords={benchKeywords}
          defaultBenchKeywords={DEFAULT_BENCH_KEYWORDS}
          onBenchKeywordsChange={kw => {
            setBenchKeywords(kw);
            localStorage.setItem('benchKeywords', JSON.stringify(kw));
            setJobs(parseCSV(RAW_CSV, kw));
          }}
          hourlyRate={hourlyRate}
          onHourlyRateChange={n => { setHourlyRate(n); localStorage.setItem('hourlyRate', String(n)); }}
          weeklyRevenueTarget={weeklyTarget}
          onWeeklyTargetChange={n => { setWeeklyTarget(n); localStorage.setItem('weeklyTarget', String(n)); }}
        />
      )}

      {showParts && (
        <PartsDrawer onClose={() => setShowParts(false)} />
      )}

      {showHelp && (
        <HelpDrawer onClose={() => setShowHelp(false)} />
      )}
    </DndContext>
  );
}
