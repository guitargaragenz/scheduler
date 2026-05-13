import { useState, useEffect, useCallback, useRef } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  closestCenter,
} from '@dnd-kit/core';
import { parseCSV, RAW_CSV, BENCH_COLORS } from './data/jobs.js';
import { getWeekDays, formatDateRange, slotKey, dayLabel, getWorkHours } from './utils/calendar.js';
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
    const { dayIdx, hour } = over.data?.current || {};
    if (dayIdx === undefined || hour === undefined) return;

    if (mode === 'urgent') {
      handleUrgentDrop(job, dayIdx, hour, source);
    } else {
      handleRegularDrop(job, dayIdx, hour, source);
    }
  }

  // Find N available 1-hr slots from startDay/startHour onwards, skipping occupied & blocked
  function findAvailableSlots(startDayIdx, startHour, needed, tempSlots) {
    const found = [];
    for (let d = startDayIdx; d < weekDays.length && found.length < needed; d++) {
      const date = weekDays[d];
      const { start, end } = getWorkHours(date);
      const sat = date.getDay() === 6;
      const startH = d === startDayIdx ? Math.max(startHour, start) : start;
      for (let h = startH; h < end && found.length < needed; h++) {
        if (!sat && h === 12) continue; // skip lunch
        if (!tempSlots[slotKey(d, h)]) found.push({ dayIdx: d, hour: h });
      }
    }
    return found;
  }

  function handleRegularDrop(job, dayIdx, hour, source) {
    const current = scheduledSlots;
    // Round to nearest whole hour — 2.5h → 3 slots, 1.8h → 2 slots
    const totalHours = Math.round(job.hours);

    // Temp slots without job's own current position
    const tempSlots = { ...current };
    if (source === 'calendar') {
      Object.keys(tempSlots).forEach(k => { if (tempSlots[k] === job.id) delete tempSlots[k]; });
    }

    // Validate the drop point isn't a hard-blocked area (lunch/outside hours)
    const date = weekDays[dayIdx];
    const { start, end } = getWorkHours(date);
    if (hour < start || hour >= end) {
      showToast('⚠ Outside work hours — pick a slot inside the work day');
      return;
    }

    // Find available slots starting from the drop point
    const slots = findAvailableSlots(dayIdx, hour, totalHours, tempSlots);
    if (slots.length < totalHours) {
      showToast(`⚠ Not enough space — only ${slots.length} of ${totalHours} hours free from here to end of week`);
      return;
    }

    // Describe placement in a friendly way
    const firstDay = weekDays[slots[0].dayIdx].toLocaleDateString('en-NZ', { weekday: 'short' });
    const lastDay  = weekDays[slots[slots.length - 1].dayIdx].toLocaleDateString('en-NZ', { weekday: 'short' });
    const spanDesc = slots[0].dayIdx === slots[slots.length - 1].dayIdx
      ? `${firstDay} ${slots[0].hour}:00–${slots[slots.length - 1].hour + 1}:00`
      : `${firstDay} ${slots[0].hour}:00 → ${lastDay} ${slots[slots.length - 1].hour + 1}:00`;

    // Atomically clear old slots and write new ones
    setScheduledSlots(prev => {
      const next = { ...prev };
      if (source === 'calendar') {
        Object.keys(next).forEach(k => { if (next[k] === job.id) delete next[k]; });
      }
      slots.forEach(({ dayIdx: d, hour: h }) => { next[slotKey(d, h)] = job.id; });
      return next;
    });
    setJobs(prev => prev.map(j =>
      j.id === job.id ? { ...j, scheduled: true, calendarSlot: slots[0] } : j
    ));
    showToast(`#${job.job} placed — ${spanDesc}`);
    addChangelog(`Scheduled #${job.job} ${job.mfr} ${job.model} — ${spanDesc}`);
  }

  function handleUrgentDrop(job, dayIdx, hour, source) {
    const current = scheduledSlots;
    const tempSlots = { ...current };
    // Remove job's own slots from consideration
    if (source === 'calendar') {
      Object.keys(tempSlots).forEach(k => { if (tempSlots[k] === job.id) delete tempSlots[k]; });
    }

    const date = weekDays[dayIdx];
    const { start, end } = getWorkHours(date);
    const needed = Math.min(Math.ceil(job.hours), 3); // max 3hr continuous block
    if (hour < start || hour + needed > end) {
      showToast('⚠ Cannot place urgent job — outside work hours');
      return;
    }

    // Collect jobs in the target slots
    const displaced = [];
    for (let h = hour; h < hour + needed; h++) {
      const occupant = tempSlots[slotKey(dayIdx, h)];
      if (occupant && !displaced.includes(occupant)) displaced.push(occupant);
    }

    // Atomically: clear old, clear displaced, place urgent job
    setScheduledSlots(prev => {
      const next = { ...prev };
      if (source === 'calendar') {
        Object.keys(next).forEach(k => { if (next[k] === job.id) delete next[k]; });
      }
      displaced.forEach(bid => {
        Object.keys(next).forEach(k => { if (next[k] === bid) delete next[k]; });
      });
      for (let h = hour; h < hour + needed; h++) next[slotKey(dayIdx, h)] = job.id;
      return next;
    });

    // Mark displaced jobs as unscheduled (back to sidebar)
    if (displaced.length > 0) {
      setJobs(prev => prev.map(j =>
        displaced.includes(j.id) ? { ...j, scheduled: false, calendarSlot: null } : j
      ));
    }

    // Place the urgent job and mark it scheduled
    setJobs(prev => prev.map(j =>
      j.id === job.id ? { ...j, scheduled: true, calendarSlot: { dayIdx, hour } } : j
    ));

    const d = weekDays[dayIdx];
    const dayName = d.toLocaleDateString('en-NZ', { weekday: 'short' });
    const msg = displaced.length > 0
      ? `🚨 #${job.job} forced to ${dayName} ${hour}:00. Moved ${displaced.map(id => `#${id}`).join(', ')} back to sidebar.`
      : `🚨 #${job.job} scheduled ${dayName} ${hour}:00–${hour + needed}:00`;
    showToast(msg);
    addChangelog(msg);
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
    // Clear ALL slots for this job — it may be split across non-consecutive slots
    setScheduledSlots(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => { if (next[k] === job.id) delete next[k]; });
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
