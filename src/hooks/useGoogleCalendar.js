import { useState, useEffect, useRef } from 'react';
import {
  initGoogleApi, requestAuth, isSignedIn, signOut, listEvents,
  createEvent, updateEvent, deleteEvent, isConfigured,
} from '../utils/googleCalendar.js';
import { slotKey } from '../utils/calendar.js';
import { findAvailableSlots, slotsNeeded } from '../utils/scheduler.js';
import { isFirebaseConfigured, appendConflictLog } from '../utils/firebase.js';

export function useGoogleCalendar({
  weekDays,
  jobs,
  scheduledSlots,
  scheduledSlotsRef,
  jobsRef,
  setJobs,
  setScheduledSlots,
  showToast,
  addChangelog,
}) {
  const [googleInited, setGoogleInited] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [externalEvents, setExternalEvents] = useState([]);
  const [syncStatus, setSyncStatus] = useState('idle');
  const externalEventsRef = useRef([]);
  const pollRef = useRef(null);

  useEffect(() => { externalEventsRef.current = externalEvents; }, [externalEvents]);

  // Init Google API
  useEffect(() => {
    if (!isConfigured()) return;
    initGoogleApi().then(ok => {
      setGoogleInited(ok);
      setSignedIn(isSignedIn());
    });
  }, []);

  // Build the set of slot keys blocked by external GCal appointments.
  // Uses ref so drag handlers always see current events without stale closures.
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
      const endMins = end.getHours() * 60 + end.getMinutes();
      while (h * 60 + m < endMins) {
        blocked.add(slotKey(weekDays[dayIdx], h, m));
        if (m === 0) { m = 30; } else { m = 0; h++; }
      }
    });
    return blocked;
  }

  // Poll GCal every 30s — fetch events and bump conflicting scheduled jobs
  useEffect(() => {
    if (!signedIn) return;
    const poll = async () => {
      const start = new Date(weekDays[0]);
      start.setHours(0, 0, 0, 0);
      const end = new Date(weekDays[6]);
      end.setHours(23, 59, 59, 999);
      const events = await listEvents(start, end);
      if (events && events.length > 0) {
        setExternalEvents(events);
        externalEventsRef.current = events;
      }

      // Build blocked slots from freshly fetched events
      const appointmentBlocked = new Set();
      (events || []).forEach(ev => {
        if (ev.summary?.startsWith('#')) return;
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
        const currentSlots = { ...scheduledSlotsRef.current };
        const currentJobs  = jobsRef.current;
        const conflicts = Object.entries(currentSlots).filter(([key]) => appointmentBlocked.has(key));
        if (conflicts.length > 0) {
          const nextSlots = { ...currentSlots };
          const jobMap    = Object.fromEntries(currentJobs.map(j => [j.id, j]));
          const updatedJobs = { ...jobMap };

          const bumped = new Set();
          conflicts.forEach(([key, jobId]) => {
            delete nextSlots[key];
            bumped.add(jobId);
          });

          const bumpLogEntries = [];
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
              const msg = `#${job.job} ${job.mfr} ${job.model} bumped by GCal appointment → moved to ${newDay} ${fh}:${String(fm).padStart(2,'0')}`;
              addChangelog(msg);
              showToast(`Job #${job.job} bumped → rescheduled to ${newDay} ${fh}:${String(fm).padStart(2,'0')}`);
              bumpLogEntries.push({ ts: new Date().toISOString(), jobNum: job.job, mfr: job.mfr, model: job.model, newSlot: `${newDay} ${fh}:${String(fm).padStart(2,'0')}`, unscheduled: false });
            } else {
              updatedJobs[jobId] = { ...job, scheduled: false, calendarSlot: null };
              const msg = `#${job.job} ${job.mfr} ${job.model} bumped by GCal appointment — no room this week, reschedule manually`;
              addChangelog(msg);
              showToast(`Job #${job.job} bumped by appointment — no room left this week`);
              bumpLogEntries.push({ ts: new Date().toISOString(), jobNum: job.job, mfr: job.mfr, model: job.model, newSlot: null, unscheduled: true });
            }
          });
          if (bumpLogEntries.length > 0 && isFirebaseConfigured()) {
            appendConflictLog(bumpLogEntries);
          }

          setScheduledSlots(nextSlots);
          setJobs(currentJobs.map(j => updatedJobs[j.id] || j));
        }
      }
    };
    poll();
    pollRef.current = setInterval(poll, 30000);
    return () => clearInterval(pollRef.current);
  }, [signedIn, weekDays]); // eslint-disable-line react-hooks/exhaustive-deps

  // Groups a job's scheduled slots into contiguous time blocks (split around lunch etc).
  // Returns [{date, hour, minute, durationHours}] — one entry per continuous block.
  function getJobBlocks(jobId) {
    const slots = Object.entries(scheduledSlots)
      .filter(([, id]) => id === jobId)
      .map(([key]) => {
        const parts = key.split('-');
        const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
        const h = Number(parts[3]);
        const m = Number(parts[4]);
        const ts = date.getTime() + h * 3600000 + m * 60000;
        return { date, hour: h, minute: m, ts };
      })
      .sort((a, b) => a.ts - b.ts);

    if (!slots.length) return [];

    const blocks = [];
    let start = slots[0];
    let count = 1;
    for (let i = 1; i < slots.length; i++) {
      if (slots[i].ts - slots[i - 1].ts === 1800000) {
        count++;
      } else {
        blocks.push({ date: start.date, hour: start.hour, minute: start.minute, durationHours: count * 0.5 });
        start = slots[i];
        count = 1;
      }
    }
    blocks.push({ date: start.date, hour: start.hour, minute: start.minute, durationHours: count * 0.5 });
    return blocks;
  }

  async function handleSync() {
    if (!signedIn) {
      showToast('⚠ Not connected to Google Calendar. Open Settings to connect.');
      return;
    }
    setSyncStatus('syncing');
    const scheduled = jobs.filter(j => j.scheduled && j.calendarSlot && !j.isSplit);
    let ok = 0;
    const updatedJobs = [...jobs];
    for (const job of scheduled) {
      try {
        const blocks = getJobBlocks(job.id);
        if (!blocks.length) continue;

        // Existing event IDs in order — support old single gcalEventId and new array
        const existingIds = job.gcalEventIds?.length
          ? job.gcalEventIds
          : job.gcalEventId ? [job.gcalEventId] : [];

        const newIds = [];
        for (let i = 0; i < blocks.length; i++) {
          const { date, hour, durationHours } = blocks[i];
          const result = existingIds[i]
            ? await updateEvent(existingIds[i], job, date, hour, durationHours)
            : await createEvent(job, date, hour, durationHours);
          if (result?.id) newIds.push(result.id);
        }

        // Delete any GCal events from blocks that no longer exist
        for (let i = blocks.length; i < existingIds.length; i++) {
          await deleteEvent(existingIds[i]).catch(() => {});
        }

        const idx = updatedJobs.findIndex(j => j.id === job.id);
        if (idx >= 0) {
          updatedJobs[idx] = { ...updatedJobs[idx], gcalEventIds: newIds, gcalEventId: newIds[0] || null };
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

  return {
    googleInited,
    signedIn,
    externalEvents,
    externalEventsRef,
    syncStatus,
    buildExternalBlockedSlots,
    handleSync,
    handleSignIn,
    handleSignOut,
  };
}
