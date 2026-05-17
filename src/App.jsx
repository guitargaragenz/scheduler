import { useState, useEffect, useCallback, useRef } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  closestCenter,
} from '@dnd-kit/core';
import { parseCSV, RAW_CSV, BENCH_COLORS } from './data/jobs.js';
import { getWeekDays, formatDateRange, slotKey, dayLabel, getWorkHours, isGapHour, isSaturday, isSunday, isLunchSlot } from './utils/calendar.js';
import { canPlace, scheduleUrgent, slotsNeeded } from './utils/scheduler.js';
import {
  initGoogleApi, requestAuth, isSignedIn, signOut, listEvents,
  createEvent, updateEvent, deleteEvent, parsePersonalBlocks, isConfigured,
} from './utils/googleCalendar.js';
import { isFirebaseConfigured, loadSchedule, saveSchedule, subscribeToSchedule } from './utils/firebase.js';
import CalendarGrid from './components/CalendarGrid.jsx';
import Sidebar from './components/Sidebar.jsx';
import Toast from './components/Toast.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import JobCard from './components/JobCard.jsx';
import JobDrawer from './components/JobDrawer.jsx';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// Returns the slot key for the half-slot immediately after `key`
function nextHalfSlotKey(key) {
  const parts = key.split('-');
  const h = parseInt(parts[3]);
  const m = parseInt(parts[4]);
  const nM = m === 0 ? 30 : 0;
  const nH = m === 0 ? h : h + 1;
  return `${parts[0]}-${parts[1]}-${parts[2]}-${nH}-${nM}`;
}

export default function App() {
  const [jobs, setJobs] = useState(() => parseCSV(RAW_CSV));
  const [scheduledSlots, setScheduledSlots] = useState({}); // slotKey -> jobId
  const [weekDays, setWeekDays] = useState(() => getWeekDays());
  const [dragMode, setDragMode] = useState('regular');
  const [activeJob, setActiveJob] = useState(null);
  const [toast, setToast] = useState('');
  const [changelog, setChangelog] = useState([]);
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
  const pollRef = useRef(null);
  const saveTimerRef = useRef(null);
  const justSavedAt = useRef(0); // timestamp of our last save — used to suppress echo snapshots

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
        if (data.jobs) setJobs(data.jobs);
        if (data.scheduledSlots) setScheduledSlots(data.scheduledSlots);
      }
      setFirebaseReady(true);
    });

    const unsub = subscribeToSchedule(data => {
      // Ignore snapshots triggered by our own saves (echo suppression — 5s window)
      if (Date.now() - justSavedAt.current < 5000) return;
      if (data.jobs) setJobs(data.jobs);
      if (data.scheduledSlots) setScheduledSlots(data.scheduledSlots);
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
      setExternalEvents(events);

      // Handle #PERSONAL blocks
      const personalBlocks = parsePersonalBlocks(events, weekDays);
      if (personalBlocks.length > 0) {
        personalBlocks.forEach(({ dayIdx, hour }) => {
          const key = slotKey(weekDays[dayIdx], hour);
          setScheduledSlots(prev => {
            if (prev[key]) {
              const jobId = prev[key];
              const next = { ...prev };
              delete next[key];
              addChangelog(`Auto-moved job #${jobId} to accommodate #PERSONAL event`);
              showToast(`Job #${jobId} moved — #PERSONAL block detected`);
              setJobs(js => js.map(j => j.id === jobId ? { ...j, scheduled: false, calendarSlot: null } : j));
              return next;
            }
            return prev;
          });
        });
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

  // Build a set of slot keys blocked by Google Calendar external events (both :00 and :30)
  function buildExternalBlockedSlots() {
    const blocked = new Set();
    externalEvents.forEach(ev => {
      if (ev.summary?.startsWith('#')) return;
      const start = new Date(ev.start?.dateTime || ev.start?.date);
      const end   = new Date(ev.end?.dateTime   || ev.end?.date);
      const dayIdx = weekDays.findIndex(d => d.toDateString() === start.toDateString());
      if (dayIdx < 0) return;
      let h = start.getHours();
      let m = start.getMinutes() < 30 ? 0 : 30;
      const endH = end.getHours() + (end.getMinutes() > 0 ? 1 : 0);
      while (h < endH) {
        blocked.add(slotKey(weekDays[dayIdx], h, m));
        if (m === 0) { m = 30; } else { m = 0; h++; }
      }
    });
    return blocked;
  }

  // Find N available 30-min slots from startDay/startHour/startMinute onwards
  function findAvailableSlots(startDayIdx, startHour, startMinute, needed, tempSlots) {
    const externalBlocked = buildExternalBlockedSlots();
    const found = [];
    for (let d = startDayIdx; d < weekDays.length && found.length < needed; d++) {
      const date = weekDays[d];
      const { start, end } = getWorkHours(date);
      const sat = isSaturday(date);
      const sun = isSunday(date);
      const isWeekday = !sat && !sun;
      for (let h = start; h < end && found.length < needed; h++) {
        if (isWeekday && isLunchSlot(h)) continue;
        if (isGapHour(h)) continue;
        for (const m of [0, 30]) {
          // Skip slots before the drop point on the first day
          if (d === startDayIdx && (h < startHour || (h === startHour && m < startMinute))) continue;
          const key = slotKey(weekDays[d], h, m);
          if (tempSlots[key]) continue;
          if (externalBlocked.has(key)) continue;
          found.push({ dayIdx: d, hour: h, minute: m });
          if (found.length >= needed) break;
        }
      }
    }
    return found;
  }

  function handleRegularDrop(job, dayIdx, hour, minute, source) {
    const needed = slotsNeeded(job); // number of 30-min slots

    // Temp map without job's own slots (and orphaned buffer)
    const tempSlots = { ...scheduledSlots };
    if (source === 'calendar') {
      Object.keys(tempSlots).forEach(k => {
        if (tempSlots[k] === job.id) {
          const nk = nextHalfSlotKey(k);
          if (tempSlots[nk] === '__buffer__') delete tempSlots[nk];
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

    const slots = findAvailableSlots(dayIdx, hour, minute, needed, tempSlots);
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
      // Clear old position (and its buffer)
      if (source === 'calendar') {
        Object.keys(next).forEach(k => {
          if (next[k] === job.id) {
            const nk = nextHalfSlotKey(k);
            if (next[nk] === '__buffer__') delete next[nk];
            delete next[k];
          }
        });
      }
      // Place job half-slots
      slots.forEach(({ dayIdx: d, hour: h, minute: m }) => {
        next[slotKey(weekDays[d], h, m)] = job.id;
      });
      // Place 30-min buffer after last slot
      const last = slots[slots.length - 1];
      const bufM = last.minute === 0 ? 30 : 0;
      const bufH = last.minute === 0 ? last.hour : last.hour + 1;
      const bufDate = weekDays[last.dayIdx];
      const { end: dayEnd } = getWorkHours(bufDate);
      const isBufWeekday = !isSaturday(bufDate) && !isSunday(bufDate);
      if (bufH < dayEnd && !isGapHour(bufH) && !(isBufWeekday && isLunchSlot(bufH))) {
        const bufKey = slotKey(bufDate, bufH, bufM);
        if (!next[bufKey]) next[bufKey] = '__buffer__';
      }
      return next;
    });

    setJobs(prev => prev.map(j =>
      j.id === job.id ? { ...j, scheduled: true, calendarSlot: slots[0] } : j
    ));
    showToast(`#${job.job} placed — ${spanDesc}`);
    addChangelog(`Scheduled #${job.job} ${job.mfr} ${job.model} — ${spanDesc}`);
  }

  function handleUrgentDrop(job, dayIdx, hour, minute, source) {
    const date = weekDays[dayIdx];
    const { start, end } = getWorkHours(date);
    const needed = slotsNeeded(job); // 30-min slots
    if (hour < start || hour >= end) {
      showToast('⚠ Cannot place urgent job — outside work hours');
      return;
    }

    const tempSlots = { ...scheduledSlots };
    if (source === 'calendar') {
      Object.keys(tempSlots).forEach(k => { if (tempSlots[k] === job.id) delete tempSlots[k]; });
    }

    // Collect displaced jobs in target half-slots
    const displaced = [];
    let ch = hour, cm = minute;
    for (let i = 0; i < needed; i++) {
      if (ch >= end || isGapHour(ch)) break;
      const occupant = tempSlots[slotKey(weekDays[dayIdx], ch, cm)];
      if (occupant && occupant !== '__buffer__' && !displaced.includes(occupant)) displaced.push(occupant);
      if (cm === 0) { cm = 30; } else { cm = 0; ch++; }
    }

    setScheduledSlots(prev => {
      const next = { ...prev };
      if (source === 'calendar') {
        Object.keys(next).forEach(k => {
          if (next[k] === job.id) {
            const nk = nextHalfSlotKey(k);
            if (next[nk] === '__buffer__') delete next[nk];
            delete next[k];
          }
        });
      }
      displaced.forEach(bid => {
        Object.keys(next).forEach(k => { if (next[k] === bid) delete next[k]; });
      });
      // Place urgent job
      let ph = hour, pm = minute;
      for (let i = 0; i < needed; i++) {
        if (ph >= end || isGapHour(ph)) break;
        next[slotKey(weekDays[dayIdx], ph, pm)] = job.id;
        if (pm === 0) { pm = 30; } else { pm = 0; ph++; }
      }
      // Buffer after
      const isBufWeekday = !isSaturday(date) && !isSunday(date);
      if (ph < end && !isGapHour(ph) && !(isBufWeekday && isLunchSlot(ph))) {
        const bufKey = slotKey(date, ph, pm);
        if (!next[bufKey]) next[bufKey] = '__buffer__';
      }
      return next;
    });

    if (displaced.length > 0) {
      setJobs(prev => prev.map(j =>
        displaced.includes(j.id) ? { ...j, scheduled: false, calendarSlot: null } : j
      ));
    }
    setJobs(prev => prev.map(j =>
      j.id === job.id ? { ...j, scheduled: true, calendarSlot: { dayIdx, hour, minute } } : j
    ));

    const dayName = date.toLocaleDateString('en-NZ', { weekday: 'short' });
    const timeStr = `${hour}:${minute === 0 ? '00' : '30'}`;
    const msg = displaced.length > 0
      ? `🚨 #${job.job} forced to ${dayName} ${timeStr}. Moved ${displaced.map(id => `#${id}`).join(', ')} back.`
      : `🚨 #${job.job} scheduled ${dayName} ${timeStr}`;
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
      const isBufWeekday = !isSaturday(date) && !isSunday(date);
      if (h < end && !isGapHour(h) && !(isBufWeekday && isLunchSlot(h))) {
        const bufKey = slotKey(date, h, m);
        if (!next[bufKey]) next[bufKey] = '__buffer__';
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
          const nk = nextHalfSlotKey(k);
          if (next[nk] === '__buffer__') delete next[nk];
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

  // Build scheduled job map and buffer key set for CalendarGrid
  const scheduledJobObjects = {};
  const bufferSlotKeys = new Set();
  Object.entries(scheduledSlots).forEach(([key, jobId]) => {
    if (jobId === '__buffer__') {
      bufferSlotKeys.add(key);
    } else {
      const job = jobs.find(j => j.id === jobId);
      if (job) scheduledJobObjects[key] = job;
    }
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

  function handleCsvUpload(csvText) {
    try {
      const newJobs = parseCSV(csvText);
      justSavedAt.current = Date.now();
      setJobs(newJobs);
      setScheduledSlots({});
      // Save immediately so Firebase has fresh data before any echo arrives
      if (isFirebaseConfigured()) saveSchedule(newJobs, {});
      showToast(`Loaded ${newJobs.length} jobs from CSV`);
      addChangelog(`CSV uploaded — loaded ${newJobs.length} jobs`);
    } catch (e) {
      showToast(`⚠ CSV parse error: ${e.message}`);
    }
  }

  const syncColors = { idle: '#64748b', syncing: '#fbbf24', synced: '#22c55e', error: '#ef4444' };
  const syncLabels = { idle: 'Sync', syncing: 'Syncing…', synced: 'Synced ✓', error: 'Sync Error' };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
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
            {/* Sync status dot */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: syncColors[syncStatus],
                boxShadow: syncStatus === 'synced' ? '0 0 6px #22c55e' : 'none',
              }} />
              <span style={{ fontSize: 11, color: '#64748b' }}>
                {signedIn ? 'Calendar connected' : 'Calendar disconnected'}
              </span>
            </div>

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
          <CalendarGrid
            weekDays={weekDays}
            scheduledJobs={scheduledJobObjects}
            bufferSlotKeys={bufferSlotKeys}
            externalEvents={externalEvents}
            isDragging={isDragging}
            onJobClick={setEditingJob}
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
          />
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
        <JobDrawer
          job={editingJob}
          onClose={() => setEditingJob(null)}
          onSave={handleSaveDrawer}
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
        />
      )}
    </DndContext>
  );
}
