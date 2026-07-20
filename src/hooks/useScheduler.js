import { useState } from 'react';
import { slotKey, getWorkHours, isLunchSlot, isSaturday, isSunday, isGapHour } from '../utils/calendar.js';
import { slotsNeeded, findAvailableSlots } from '../utils/scheduler.js';
import { deleteEvent } from '../utils/googleCalendar.js';
import { isSupabaseConfigured, batchWriteJobsState, saveScheduledSlotsBatch } from '../utils/supabase.js';
import { jobsStateFieldsFor } from '../data/joinJobs.js';

export function useScheduler({
  jobs,
  setJobs,
  scheduledSlots,
  setScheduledSlots,
  weekDays,
  externalEventsRef,
  justSavedAt,
  signedIn,
  showToast,
  addChangelog,
  upsertScheduledBullet,
  onBumpDetected,
}) {
  const [activeJob, setActiveJob] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  function isToday(date) {
    return date.toDateString() === new Date().toDateString();
  }

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

  function onDragStart({ active }) {
    const jobId = active.data?.current?.jobId ?? active.id;
    const job = jobs.find(j => j.id === jobId);
    setActiveJob(job || null);
    setIsDragging(true);
  }

  function onDragEnd({ active, over }, dragMode) {
    setActiveJob(null);
    setIsDragging(false);

    const jobId = active.data?.current?.jobId ?? active.id;
    const job = jobs.find(j => j.id === jobId);
    if (!job) return;
    const source = active.data?.current?.source;
    const mode = active.data?.current?.dragMode || dragMode;

    if (!over) return;

    if (over.id === 'sidebar') {
      if (source === 'calendar') unscheduleJob(job);
      return;
    }

    if (over.data?.current?.isLunch) {
      showToast('⚠ Lunch is locked 12–1 PM — pick another slot');
      return;
    }

    const { dayIdx, hour, minute = 0 } = over.data?.current || {};
    if (dayIdx === undefined || hour === undefined) return;

    if (mode === 'urgent') {
      handleUrgentDrop(job, dayIdx, hour, minute, source);
    } else {
      handleRegularDrop(job, dayIdx, hour, minute, source);
    }
  }

  async function handleRegularDrop(job, dayIdx, hour, minute, source) {
    justSavedAt.current = Date.now();
    const needed = slotsNeeded(job);

    // Pre-move snapshots. The UI updates optimistically below; if the DB
    // write then fails we restore these so what's on screen matches what's
    // actually stored, rather than leaving a placement that only exists
    // in this tab. Slots this job currently holds are captured here because
    // the optimistic update clears them before the write runs.
    const prevSlots = scheduledSlots;
    const prevJobs = jobs;
    const removedSlotKeys = Object.keys(scheduledSlots).filter(k => scheduledSlots[k] === job.id);

    const tempSlots = { ...scheduledSlots };
    if (source === 'calendar') {
      Object.keys(tempSlots).forEach(k => {
        if (tempSlots[k] === job.id) delete tempSlots[k];
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

    const newCalendarSlot = slotKey(weekDays[slots[0].dayIdx], slots[0].hour, slots[0].minute);

    // Genuine day-to-day bump detection — read-only, using the job's PRE-move
    // calendarSlot (captured here before setJobs overwrites it below) vs the
    // new slot's date portion. slotKey() format is "YYYY-MM-DD-H-M", so the
    // date is always the first 3 dash-separated segments. This excludes
    // first-time scheduling (calendarSlot == null) and same-day time nudges
    // by construction — only a scheduled job whose day actually changes
    // counts. Fires after the placement below; never affects it.
    const previousSlot = job.calendarSlot;
    const isGenuineBump = job.scheduled && typeof previousSlot === 'string' &&
      previousSlot.split('-').slice(0, 3).join('-') !== newCalendarSlot.split('-').slice(0, 3).join('-');

    setScheduledSlots(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => { if (next[k] === job.id) delete next[k]; });
      slots.forEach(({ dayIdx: d, hour: h, minute: m }) => {
        next[slotKey(weekDays[d], h, m)] = job.id;
      });
      return next;
    });

    setJobs(prev => prev.map(j =>
      j.id === job.id ? { ...j, scheduled: true, calendarSlot: newCalendarSlot } : j
    ));
    showToast(`#${job.job} placed — ${spanDesc}`);
    addChangelog(`Scheduled #${job.job} ${job.mfr} ${job.model} — ${spanDesc}`);

    const firstSlot = slots[0];
    const firstDate = weekDays[firstSlot.dayIdx];
    if (upsertScheduledBullet && isToday(firstDate)) {
      upsertScheduledBullet(job, firstSlot.hour, firstSlot.minute);
    }

    if (isGenuineBump) {
      onBumpDetected?.({ job, fromSlot: previousSlot, toSlot: newCalendarSlot });
    }

    if (isSupabaseConfigured()) {
      const addRecords = slots.map(({ dayIdx: d, hour: h, minute: m }) => ({
        slotId: slotKey(weekDays[d], h, m),
        jobId: job.id,
        bench: job.bench,
      }));
      const updatedJob = { ...job, scheduled: true, calendarSlot: newCalendarSlot };
      const [slotsResult, jobResult] = await Promise.all([
        saveScheduledSlotsBatch(addRecords, removedSlotKeys),
        batchWriteJobsState([{ id: job.id, data: jobsStateFieldsFor(updatedJob) }]),
      ]);
      if (!slotsResult.ok || !jobResult.ok) {
        setScheduledSlots(prevSlots);
        setJobs(prevJobs);
        showToast(`⚠ Save failed — #${job.job} snapped back, try again`);
        addChangelog(`Save failed scheduling #${job.job} — reverted to previous position`);
      } else {
        justSavedAt.current = Date.now();
      }
    }
  }

  function handleMobileSchedule(job, dayIdx, hour, minute) {
    handleRegularDrop(job, dayIdx, hour, minute, undefined);
  }

  async function handleUrgentDrop(job, dayIdx, hour, minute, source) {
    justSavedAt.current = Date.now();
    // See handleRegularDrop for why these snapshots exist.
    const prevSlots = scheduledSlots;
    const prevJobs = jobs;
    const date = weekDays[dayIdx];
    const { start, end } = getWorkHours(date);
    const needed = slotsNeeded(job);
    if (hour < start || hour >= end) {
      showToast('⚠ Cannot place urgent job — outside work hours');
      return;
    }

    const externalBlocked = buildExternalBlockedSlots();
    const tempSlots = { ...scheduledSlots };
    if (source === 'calendar') {
      Object.keys(tempSlots).forEach(k => { if (tempSlots[k] === job.id) delete tempSlots[k]; });
    }

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
          if (externalBlocked.has(key)) continue;
          slots.push({ dayIdx: d, hour: h, minute: m });
          if (slots.length >= needed) break;
        }
      }
    }

    if (slots.length < needed) {
      showToast(`⚠ Not enough space — only ${slots.length} of ${needed} slots free from here`);
      return;
    }

    const displaced = [];
    slots.forEach(({ dayIdx: d, hour: h, minute: m }) => {
      const occupant = tempSlots[slotKey(weekDays[d], h, m)];
      if (occupant && !displaced.includes(occupant)) displaced.push(occupant);
    });

    setScheduledSlots(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => { if (next[k] === job.id) delete next[k]; });
      displaced.forEach(bid => {
        Object.keys(next).forEach(k => { if (next[k] === bid) delete next[k]; });
      });
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
      j.id === job.id ? { ...j, scheduled: true, calendarSlot: slotKey(weekDays[slots[0].dayIdx], slots[0].hour, slots[0].minute) } : j
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

    if (upsertScheduledBullet && isToday(firstDate)) {
      upsertScheduledBullet(job, first.hour, first.minute);
    }
    addChangelog(msg);

    if (isSupabaseConfigured()) {
      const newCalendarSlot = slotKey(weekDays[first.dayIdx], first.hour, first.minute);
      const addRecords = slots.map(({ dayIdx: d, hour: h, minute: m }) => ({
        slotId: slotKey(weekDays[d], h, m),
        jobId: job.id,
        bench: job.bench,
      }));
      // Slots freed by this move: the ones this job held, plus every slot
      // held by a job it bumped off the calendar.
      const removedSlotKeys = Object.keys(prevSlots).filter(k =>
        prevSlots[k] === job.id || displaced.includes(prevSlots[k])
      );
      // The moved job and everything it displaced go in ONE write. Splitting
      // them risks the urgent job landing while the jobs it kicked out stay
      // marked as scheduled in the DB, double-booking those slots.
      const jobWrites = [
        { id: job.id, data: jobsStateFieldsFor({ ...job, scheduled: true, calendarSlot: newCalendarSlot }) },
        ...prevJobs
          .filter(j => displaced.includes(j.id))
          .map(j => ({ id: j.id, data: jobsStateFieldsFor({ ...j, scheduled: false, calendarSlot: null }) })),
      ];
      const [slotsResult, jobsResult] = await Promise.all([
        saveScheduledSlotsBatch(addRecords, removedSlotKeys),
        batchWriteJobsState(jobWrites),
      ]);
      if (!slotsResult.ok || !jobsResult.ok) {
        setScheduledSlots(prevSlots);
        setJobs(prevJobs);
        showToast(`⚠ Save failed — #${job.job} and any bumped jobs snapped back, try again`);
        addChangelog(`Save failed on urgent drop of #${job.job} — reverted`);
      } else {
        justSavedAt.current = Date.now();
      }
    }
  }

  function unscheduleJob(job) {
    justSavedAt.current = Date.now();
    // See handleRegularDrop for why these snapshots exist.
    const prevSlots = scheduledSlots;
    const prevJobs = jobs;
    const removedSlotKeys = Object.keys(scheduledSlots).filter(k => scheduledSlots[k] === job.id);

    setScheduledSlots(prev => {
      const next = { ...prev };
      Object.keys(next).forEach(k => { if (next[k] === job.id) delete next[k]; });
      return next;
    });
    setJobs(prev => prev.map(j =>
      j.id === job.id ? { ...j, scheduled: false, calendarSlot: null, gcalEventId: null, gcalEventIds: [] } : j
    ));
    addChangelog(`Unscheduled #${job.job} — moved back to sidebar`);

    const idsToDelete = job.gcalEventIds?.length ? job.gcalEventIds : job.gcalEventId ? [job.gcalEventId] : [];
    const deleteGcalEvents = () => {
      if (!signedIn) return;
      idsToDelete.forEach(id => deleteEvent(id).catch(e => console.error('deleteEvent failed:', e)));
    };

    if (!isSupabaseConfigured()) {
      deleteGcalEvents();
      return;
    }

    // Not awaited — the drag-end caller is synchronous. Calendar events are
    // deleted only once the unschedule has actually persisted: a deleted
    // event can't be restored, so we don't destroy one for a write that
    // failed and got rolled back.
    (async () => {
      const updatedJob = { ...job, scheduled: false, calendarSlot: null, gcalEventId: null, gcalEventIds: [] };
      const [slotsResult, jobResult] = await Promise.all([
        saveScheduledSlotsBatch([], removedSlotKeys),
        batchWriteJobsState([{ id: job.id, data: jobsStateFieldsFor(updatedJob) }]),
      ]);
      if (!slotsResult.ok || !jobResult.ok) {
        setScheduledSlots(prevSlots);
        setJobs(prevJobs);
        showToast(`⚠ Save failed — #${job.job} is still scheduled, try again`);
        addChangelog(`Save failed unscheduling #${job.job} — reverted`);
        return;
      }
      justSavedAt.current = Date.now();
      deleteGcalEvents();
    })();
  }

  return {
    activeJob,
    isDragging,
    onDragStart,
    onDragEnd,
    handleRegularDrop,
    handleMobileSchedule,
    handleUrgentDrop,
    unscheduleJob,
  };
}
