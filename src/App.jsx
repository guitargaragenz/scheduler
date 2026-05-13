import { useState, useEffect, useCallback, useRef } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  closestCenter,
} from '@dnd-kit/core';
import { parseCSV, RAW_CSV, BENCH_COLORS } from './data/jobs.js';
import { getWeekDays, formatDateRange, slotKey, dayLabel } from './utils/calendar.js';
import { canPlace, scheduleUrgent, slotsNeeded } from './utils/scheduler.js';
import {
  initGoogleApi, requestAuth, isSignedIn, signOut, listEvents,
  createEvent, parsePersonalBlocks, isConfigured,
} from './utils/googleCalendar.js';
import CalendarGrid from './components/CalendarGrid.jsx';
import Sidebar from './components/Sidebar.jsx';
import Toast from './components/Toast.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import JobCard from './components/JobCard.jsx';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function App() {
  const [jobs, setJobs] = useState(() => parseCSV(RAW_CSV));
  const [scheduledSlots, setScheduledSlots] = useState({}); // slotKey -> jobId
  const scheduledSlotsRef = useRef({});  // always-current mirror for drag handlers
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
  const pollRef = useRef(null);

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
      const end = new Date(weekDays[5]);
      end.setHours(23, 59, 59, 999);
      const events = await listEvents(start, end);
      setExternalEvents(events);

      // Handle #PERSONAL blocks
      const personalBlocks = parsePersonalBlocks(events, weekDays);
      if (personalBlocks.length > 0) {
        personalBlocks.forEach(({ dayIdx, hour }) => {
          const key = slotKey(dayIdx, hour);
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

  // Keep ref in sync so drag handlers always read current slot state
  useEffect(() => { scheduledSlotsRef.current = scheduledSlots; }, [scheduledSlots]);

  const showToast = useCallback((msg) => setToast(msg), []);
  const addChangelog = useCallback((msg) => {
    setChangelog(prev => [...prev, { ts: Date.now(), msg }]);
  }, []);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  function onDragStart({ active }) {
    const job = jobs.find(j => j.id === active.id);
    setActiveJob(job || null);
    setIsDragging(true);
  }

  function onDragEnd({ active, over }) {
    setActiveJob(null);
    setIsDragging(false);

    const job = jobs.find(j => j.id === active.id);
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

    // Dropped on a calendar slot
    const { dayIdx, hour } = over.data?.current || {};
    if (dayIdx === undefined || hour === undefined) return;

    if (mode === 'urgent') {
      handleUrgentDrop(job, dayIdx, hour, source);
    } else {
      handleRegularDrop(job, dayIdx, hour, source);
    }
  }

  function handleRegularDrop(job, dayIdx, hour, source) {
    // Use ref for current slots — avoids stale closure from async state updates
    const current = scheduledSlotsRef.current;
    const tempSlots = { ...current };
    if (source === 'calendar' && job.calendarSlot) {
      const { dayIdx: od, hour: oh } = job.calendarSlot;
      const needed = slotsNeeded(job);
      for (let h = oh; h < oh + needed; h++) delete tempSlots[slotKey(od, h)];
    }

    const check = canPlace(dayIdx, hour, job, weekDays, tempSlots);
    if (!check.ok) {
      showToast(`⚠ Can't place here — ${check.reason}`);
      return; // nothing mutated — job stays put
    }

    // Valid — clear old slots then write new ones atomically
    setScheduledSlots(prev => {
      const next = { ...prev };
      if (source === 'calendar' && job.calendarSlot) {
        const { dayIdx: od, hour: oh } = job.calendarSlot;
        const needed = slotsNeeded(job);
        for (let h = oh; h < oh + needed; h++) delete next[slotKey(od, h)];
      }
      const needed = slotsNeeded(job);
      for (let h = hour; h < hour + needed; h++) next[slotKey(dayIdx, h)] = job.id;
      return next;
    });
    setJobs(prev => prev.map(j =>
      j.id === job.id ? { ...j, scheduled: true, calendarSlot: { dayIdx, hour } } : j
    ));
    const d = weekDays[dayIdx];
    addChangelog(`Scheduled #${job.job} ${job.mfr} ${job.model} — ${d.toLocaleDateString('en-NZ', { weekday: 'short' })} ${hour}:00`);
  }

  function handleUrgentDrop(job, dayIdx, hour, source) {
    const current = scheduledSlotsRef.current;
    const tempSlots = { ...current };
    if (source === 'calendar' && job.calendarSlot) {
      const { dayIdx: od, hour: oh } = job.calendarSlot;
      const needed = slotsNeeded(job);
      for (let h = oh; h < oh + needed; h++) delete tempSlots[slotKey(od, h)];
    }
    const result = scheduleUrgent(job, dayIdx, hour, weekDays, tempSlots, {});
    if (!result) {
      showToast(`⚠ Can't place urgent job — outside work hours`);
      return;
    }

    const { moved } = result;
    setScheduledSlots(prev => {
      const next = { ...prev };
      // Remove displaced jobs from their slots
      moved.forEach(movedId => {
        Object.keys(next).forEach(k => { if (next[k] === movedId) delete next[k]; });
      });
      // Clear old slots for job being moved from calendar
      if (source === 'calendar' && job.calendarSlot) {
        const { dayIdx: od, hour: oh } = job.calendarSlot;
        const needed = slotsNeeded(job);
        for (let h = oh; h < oh + needed; h++) delete next[slotKey(od, h)];
      }
      return next;
    });

    if (moved.length > 0) {
      setJobs(prev => prev.map(j =>
        moved.includes(j.id) ? { ...j, scheduled: false, calendarSlot: null } : j
      ));
      const movedNames = moved.map(id => `#${id}`).join(', ');
      const d = weekDays[dayIdx];
      const dayName = d.toLocaleDateString('en-NZ', { weekday: 'short' });
      const msg = `Job #${job.job} scheduled ${dayName} ${hour}:00–${hour + slotsNeeded(job)}:00. Moved ${movedNames} back to sidebar.`;
      showToast(msg);
      addChangelog(msg);
    }

    placeJob(job, dayIdx, hour);
  }

  function placeJob(job, dayIdx, hour) {
    const needed = slotsNeeded(job);
    setScheduledSlots(prev => {
      const next = { ...prev };
      for (let h = hour; h < hour + needed; h++) next[slotKey(dayIdx, h)] = job.id;
      return next;
    });
    setJobs(prev => prev.map(j =>
      j.id === job.id ? { ...j, scheduled: true, calendarSlot: { dayIdx, hour } } : j
    ));
    const d = weekDays[dayIdx];
    const dayName = d.toLocaleDateString('en-NZ', { weekday: 'short' });
    addChangelog(`Scheduled #${job.job} ${job.mfr} ${job.model} — ${dayName} ${hour}:00`);
  }

  function unscheduleJob(job) {
    if (!job.calendarSlot) return;
    const { dayIdx, hour } = job.calendarSlot;
    const needed = slotsNeeded(job);
    setScheduledSlots(prev => {
      const next = { ...prev };
      for (let h = hour; h < hour + needed; h++) delete next[slotKey(dayIdx, h)];
      return next;
    });
    setJobs(prev => prev.map(j =>
      j.id === job.id ? { ...j, scheduled: false, calendarSlot: null } : j
    ));
    addChangelog(`Unscheduled #${job.job} — moved back to sidebar`);
  }

  // Build scheduled job map for CalendarGrid: slotKey -> job object
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
    for (const job of scheduled) {
      const { dayIdx, hour } = job.calendarSlot;
      const date = weekDays[dayIdx];
      try {
        await createEvent(job, date, hour, slotsNeeded(job));
        ok++;
      } catch (e) {
        console.error(e);
      }
    }
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

  function handleCsvUpload(csvText) {
    try {
      const newJobs = parseCSV(csvText);
      setJobs(newJobs);
      setScheduledSlots({});
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

          <div style={{ flex: 1, textAlign: 'center', fontSize: 12, color: '#94a3b8' }}>
            {formatDateRange(weekDays)}
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
            externalEvents={externalEvents}
            isDragging={isDragging}
          />
          <Sidebar
            jobs={jobs}
            dragMode={dragMode}
            onDragModeChange={setDragMode}
            onCsvUpload={handleCsvUpload}
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
