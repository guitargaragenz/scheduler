import { useState } from 'react';
import { slotKey, getWorkHours, isLunchSlot, isSaturday, isSunday, isGapHour } from '../utils/calendar.js';
import { slotsNeeded, findAvailableSlots } from '../utils/scheduler.js';
import { deleteEvent } from '../utils/googleCalendar.js';
import { isSupabaseConfigured, batchWriteJobsState, saveScheduledSlotsBatch } from '../utils/supabase.js';
import { jobsStateFieldsFor } from '../data/joinJobs.js';

// Persists a calendar move. It's two INDEPENDENT Supabase writes — the
// scheduled_slots table and the jobs table — and Supabase can't run them as
// one transaction, so either can fail on its own. Returns:
//   'ok'           — both writes landed; the DB matches the screen.
//   'reverted'     — nothing is left persisted (both writes failed, OR one
//                    failed and we successfully undid the other), so the DB
//                    still holds the pre-move state. The caller can safely snap
//                    the UI back to where it was.
//   'inconsistent' — one write landed and the compensating undo ALSO failed, so
//                    the DB is genuinely half-moved and we could not fix it. The
//                    caller must tell the user to reload rather than trust what's
//                    on screen.
// This distinction is the Blocker-2 fix: the old code reverted the UI on ANY
// failure and always claimed "snapped back", even when one of the two writes
// had already succeeded — so the screen could show the old position while the
// DB held the new one, and the toast lied about it.
// The two writes are SEQUENCED, jobs first, deliberately — they used to run
// in Promise.all. `scheduled_slots.job_id` REFERENCES jobs(id), and a derived
// auto-split bench card has no `jobs` row at all until its first state write
// lands (that's the point of derived-not-stored). Racing the slot insert
// against the job upsert means the FK can be checked before the row exists,
// so the very first drag of a bench card onto the calendar fails. Stored
// manual children were never exposed to this because their rows already
// exist by split-save time. Costs one extra round-trip per move; correctness
// wins.
// Exported for tests only — the write ORDER here is load-bearing (FK), and a
// silent reordering would only show up as a failed first drag in production.
export async function persistMove({ addRecords, removedSlotKeys, undoSlotAdds, undoSlotRemoves, jobWrites, undoJobWrites }) {
  const jobResult = await batchWriteJobsState(jobWrites);
  if (!jobResult.ok) {
    // Nothing was attempted on the slots table, so the DB still holds the
    // pre-move state — no compensation needed.
    return 'reverted';
  }
  const slotsResult = await saveScheduledSlotsBatch(addRecords, removedSlotKeys);
  if (slotsResult.ok) return 'ok';
  // The job write landed but the slot write didn't — compensate so the DB
  // goes back to pre-move.
  const undo = await batchWriteJobsState(undoJobWrites);
  return undo.ok ? 'reverted' : 'inconsistent';
}

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
      // Surgical revert: touch ONLY this job's row and the exact slots this
      // move changed, never the whole jobs/slots snapshot. A blanket
      // setJobs(prevJobs) would also wipe out any UNRELATED change made while
      // this write was in flight (e.g. another job marked done) — Blocker 3.
      const revert = () => {
        setJobs(prev => prev.map(j =>
          j.id === job.id ? { ...j, scheduled: job.scheduled, calendarSlot: job.calendarSlot } : j
        ));
        setScheduledSlots(prev => {
          const next = { ...prev };
          addRecords.forEach(r => { if (next[r.slotId] === job.id) delete next[r.slotId]; });
          removedSlotKeys.forEach(k => { next[k] = prevSlots[k]; });
          return next;
        });
      };
      const outcome = await persistMove({
        addRecords, removedSlotKeys,
        undoSlotAdds: removedSlotKeys.map(k => ({ slotId: k, jobId: prevSlots[k], bench: prevJobs.find(j => j.id === prevSlots[k])?.bench })),
        undoSlotRemoves: addRecords.map(r => r.slotId),
        jobWrites: [{ id: job.id, data: jobsStateFieldsFor(updatedJob) }],
        undoJobWrites: [{ id: job.id, data: jobsStateFieldsFor(job) }],
      });
      if (outcome === 'ok') {
        justSavedAt.current = Date.now();
      } else if (outcome === 'reverted') {
        revert();
        showToast(`⚠ Save failed — #${job.job} snapped back, try again`);
        addChangelog(`Save failed scheduling #${job.job} — reverted to previous position`);
      } else {
        revert();
        showToast(`⚠ Save half-failed for #${job.job} and couldn't be undone — reload before continuing`);
        addChangelog(`Save INCONSISTENT scheduling #${job.job} — DB half-updated, reload required`);
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
      // Pre-move state for the moved job and every job it displaced — used both
      // to compensate a half-failed DB write and to surgically snap the UI back
      // (Blocker 3) without disturbing any unrelated job.
      const displacedPrev = prevJobs.filter(j => displaced.includes(j.id));
      const revert = () => {
        setJobs(prev => prev.map(j => {
          if (j.id === job.id) return { ...j, scheduled: job.scheduled, calendarSlot: job.calendarSlot };
          const p = displacedPrev.find(d => d.id === j.id);
          return p ? { ...j, scheduled: p.scheduled, calendarSlot: p.calendarSlot } : j;
        }));
        setScheduledSlots(prev => {
          const next = { ...prev };
          addRecords.forEach(r => { if (next[r.slotId] === job.id) delete next[r.slotId]; });
          removedSlotKeys.forEach(k => { next[k] = prevSlots[k]; });
          return next;
        });
      };
      const outcome = await persistMove({
        addRecords, removedSlotKeys,
        undoSlotAdds: removedSlotKeys.map(k => ({ slotId: k, jobId: prevSlots[k], bench: prevJobs.find(j => j.id === prevSlots[k])?.bench })),
        undoSlotRemoves: addRecords.map(r => r.slotId),
        jobWrites,
        undoJobWrites: [
          { id: job.id, data: jobsStateFieldsFor(job) },
          ...displacedPrev.map(j => ({ id: j.id, data: jobsStateFieldsFor(j) })),
        ],
      });
      if (outcome === 'ok') {
        justSavedAt.current = Date.now();
      } else if (outcome === 'reverted') {
        revert();
        showToast(`⚠ Save failed — #${job.job} and any bumped jobs snapped back, try again`);
        addChangelog(`Save failed on urgent drop of #${job.job} — reverted`);
      } else {
        revert();
        showToast(`⚠ Save half-failed for #${job.job} and couldn't be undone — reload before continuing`);
        addChangelog(`Save INCONSISTENT on urgent drop of #${job.job} — DB half-updated, reload required`);
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
      // Surgical revert: restore only this job's row and the slots it freed,
      // never the whole snapshot, so a concurrent unrelated change survives
      // a failed unschedule (Blocker 3).
      const revert = () => {
        setJobs(prev => prev.map(j =>
          j.id === job.id
            ? { ...j, scheduled: job.scheduled, calendarSlot: job.calendarSlot, gcalEventId: job.gcalEventId, gcalEventIds: job.gcalEventIds }
            : j
        ));
        setScheduledSlots(prev => {
          const next = { ...prev };
          removedSlotKeys.forEach(k => { next[k] = prevSlots[k]; });
          return next;
        });
      };
      const outcome = await persistMove({
        addRecords: [], removedSlotKeys,
        undoSlotAdds: removedSlotKeys.map(k => ({ slotId: k, jobId: prevSlots[k], bench: prevJobs.find(j => j.id === prevSlots[k])?.bench })),
        undoSlotRemoves: [],
        jobWrites: [{ id: job.id, data: jobsStateFieldsFor(updatedJob) }],
        undoJobWrites: [{ id: job.id, data: jobsStateFieldsFor(job) }],
      });
      if (outcome === 'inconsistent') {
        revert();
        showToast(`⚠ Save half-failed for #${job.job} and couldn't be undone — reload before continuing`);
        addChangelog(`Save INCONSISTENT unscheduling #${job.job} — DB half-updated, reload required`);
        return;
      }
      if (outcome === 'reverted') {
        revert();
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
