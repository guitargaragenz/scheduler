import { useState, useEffect, useRef } from 'react';
import {
  initGoogleApi, requestAuth, isSignedIn, signOut, listEvents,
  createEvent, updateEvent, deleteEvent, isConfigured,
} from '../utils/googleCalendar.js';
import { slotKey } from '../utils/calendar.js';
import { findAvailableSlots, slotsNeeded } from '../utils/scheduler.js';
import { isSupabaseConfigured, appendConflictLog, batchWriteJobsState } from '../utils/supabase.js';
import { jobsStateFieldsFor } from '../data/joinJobs.js';

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
  // The dry-run plan awaiting Trevor's approval. null = no preview open.
  // Computed ONCE by previewSync() from a snapshot of jobs/slots/calendar and
  // then executed verbatim by executePlan() — the preview and the write share
  // the exact same plan so the preview can never lie about what gets written.
  const [syncPlan, setSyncPlan] = useState(null);
  const externalEventsRef = useRef([]);
  const pollRef = useRef(null);
  const lastEventSigRef = useRef('');

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
        const sig = events.map(e => `${e.id}:${e.updated}`).sort().join(',');
        if (sig !== lastEventSigRef.current) {
          lastEventSigRef.current = sig;
          setExternalEvents(events);
          externalEventsRef.current = events;
        }
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
          if (bumpLogEntries.length > 0 && isSupabaseConfigured()) {
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

  // The exact title createEvent()/updateEvent() write for a job event
  // (googleCalendar.js:177). Kept in lockstep with that helper — the
  // content-match below compares against this string, so if the event summary
  // format ever changes there, it must change here too or matching silently
  // stops finding pre-existing events and duplication returns.
  function jobEventSummary(job) {
    return `#${job.job} • ${job.mfr} ${job.model}`;
  }

  // Looks on the fetched calendar for an event that is this job's block but has
  // no saved id yet (the pre-fix events that cause first-sync duplicates).
  // Matches on job identity (summary) + LOCAL start time — same getHours/
  // getMinutes basis the poller uses (lines 84-89), NOT raw ISO, so a TZ shift
  // can't make an identical appointment look like a different slot. `consumed`
  // guards multi-block jobs: two blocks share a summary and are told apart only
  // by start time, and a match already claimed by an earlier block/id is skipped.
  function findMatchingEvent(events, job, date, hour, minute, consumed) {
    const wantSummary = jobEventSummary(job);
    return events.find(ev => {
      if (consumed.has(ev.id)) return false;
      if (ev.summary !== wantSummary) return false;
      const evStart = new Date(ev.start?.dateTime || ev.start?.date);
      return evStart.toDateString() === date.toDateString()
        && evStart.getHours() === hour
        && evStart.getMinutes() === minute;
    });
  }

  // PLAN phase — computes, but does NOT write, exactly what a real sync would
  // do, then hands it to the preview modal for Trevor to approve. Nothing
  // touches the calendar here.
  async function previewSync() {
    if (!signedIn) {
      showToast('⚠ Not connected to Google Calendar. Open Settings to connect.');
      return;
    }
    setSyncStatus('syncing');

    // Fetch the week's real calendar state once — the plan (and the content
    // match) is built against this single snapshot.
    const start = new Date(weekDays[0]);
    start.setHours(0, 0, 0, 0);
    const end = new Date(weekDays[6]);
    end.setHours(23, 59, 59, 999);
    const events = await listEvents(start, end);

    const scheduled = jobs.filter(j => j.scheduled && j.calendarSlot && !j.isSplit);
    // Every event id the plan lays a claim to — by saved id, by content match,
    // or as a to-be-deleted removed block. Anything #-tagged left over after
    // this becomes a "possible leftover" line rather than being touched.
    const consumed = new Set();
    const jobPlans = [];

    for (const job of scheduled) {
      const blocks = getJobBlocks(job.id);
      if (!blocks.length) {
        console.warn(`Sync: #${job.job} (${job.id}) is marked scheduled but has no matching scheduledSlots entries — skipping`);
        continue;
      }

      // Existing event IDs in order — support old single gcalEventId and new array
      const existingIds = job.gcalEventIds?.length
        ? job.gcalEventIds
        : job.gcalEventId ? [job.gcalEventId] : [];

      const planBlocks = [];
      for (let i = 0; i < blocks.length; i++) {
        const { date, hour, minute, durationHours } = blocks[i];
        let action, matchedEventId = null;
        if (existingIds[i]) {
          // Already tagged as ours — a plain update, no dup risk.
          action = 'update';
          matchedEventId = existingIds[i];
          consumed.add(existingIds[i]);
        } else {
          // No saved id: adopt a matching untagged event if one exists, else
          // create. This is the load-bearing anti-duplication step.
          const match = findMatchingEvent(events, job, date, hour, minute, consumed);
          if (match) {
            action = 'update';
            matchedEventId = match.id;
            consumed.add(match.id);
          } else {
            action = 'create';
          }
        }
        planBlocks.push({ action, matchedEventId, date, hour, minute, durationHours });
      }

      // Saved events for blocks that no longer exist get deleted on execute
      // (matches the old handleSync behaviour). They count as consumed so they
      // aren't also reported as leftovers.
      const deleteIds = [];
      for (let i = blocks.length; i < existingIds.length; i++) {
        deleteIds.push(existingIds[i]);
        consumed.add(existingIds[i]);
      }

      jobPlans.push({
        jobId: job.id,
        jobNum: job.job,
        jobLabel: `#${job.job} ${job.mfr} ${job.model}`,
        job,          // snapshot passed straight to create/updateEvent on execute
        blocks: planBlocks,
        deleteIds,
      });
    }

    // Leftovers = app-shaped job events ("#<num> • ...") the plan didn't claim.
    // Only that pattern, so a personal #PERSONAL block (or any hand-made
    // #-note) is never flagged for deletion. Surfaced for Trevor's eye only —
    // never auto-touched.
    const leftovers = events
      .filter(ev => ev.summary && /^#\d+\s*•/.test(ev.summary) && !consumed.has(ev.id))
      .map(ev => ({
        id: ev.id,
        summary: ev.summary,
        start: ev.start?.dateTime || ev.start?.date || null,
      }));

    setSyncStatus('idle');

    if (!jobPlans.length && !leftovers.length) {
      showToast('Nothing to sync — no scheduled jobs this week');
      return;
    }

    setSyncPlan({ jobPlans, leftovers });
  }

  // EXECUTE phase — writes the already-approved plan verbatim. Does NOT re-read
  // live jobs/slots/calendar; the plan is the snapshot. Preserves the existing
  // id-persistence path (stateWrites → batchWriteJobsState) and failure handling.
  async function executePlan(plan) {
    if (!plan) return;
    const { jobPlans } = plan;
    setSyncStatus('syncing');

    let ok = 0;
    let failed = 0;
    let authExpired = false;
    // Write ids back onto the current jobs (jobsRef, not the plan snapshot) so a
    // concurrent edit elsewhere isn't clobbered — only the gcalEventIds change.
    const updatedJobs = [...jobsRef.current];
    const stateWrites = [];

    for (const jp of jobPlans) {
      if (authExpired) break;

      const newIds = [];
      let jobFailed = false;
      for (let i = 0; i < jp.blocks.length; i++) {
        const { action, matchedEventId, date, hour, minute, durationHours } = jp.blocks[i];
        try {
          const result = action === 'update' && matchedEventId
            ? await updateEvent(matchedEventId, jp.job, date, hour, durationHours, minute)
            : await createEvent(jp.job, date, hour, durationHours, minute);
          if (result?.id) newIds.push(result.id);
        } catch (e) {
          jobFailed = true;
          if (e?.status === 401) { authExpired = true; break; }
          console.error(`Sync: failed to sync #${jp.jobNum} block ${i}:`, e);
        }
      }

      // A failed job keeps its existing gcalEventIds untouched — overwriting
      // them with the partial newIds here would orphan the real GCal event
      // and cause the next sync to create a duplicate instead of updating it.
      if (jobFailed) {
        failed++;
        continue;
      }

      // Delete any GCal events from blocks that no longer exist
      for (const id of jp.deleteIds) {
        await deleteEvent(id).catch(() => {});
      }

      const idx = updatedJobs.findIndex(j => j.id === jp.jobId);
      if (idx >= 0) {
        updatedJobs[idx] = { ...updatedJobs[idx], gcalEventIds: newIds, gcalEventId: newIds[0] || null };
        stateWrites.push({ id: jp.jobId, data: jobsStateFieldsFor(updatedJobs[idx]) });
      }
      ok++;
    }
    setJobs(updatedJobs);

    if (isSupabaseConfigured() && stateWrites.length > 0) {
      const result = await batchWriteJobsState(stateWrites);
      if (!result.ok) {
        // Deliberately no UI rollback here: the GCal events genuinely exist,
        // so keeping the ids on screen is more accurate than dropping them.
        // The next sync will re-link rather than duplicate as long as this
        // tab stays open; a reload before a successful write loses the link.
        showToast('⚠ Synced to Google, but saving the event links failed — sync again');
        addChangelog('Google Calendar sync succeeded but event links failed to save');
      }
    }

    if (authExpired) {
      setSignedIn(false);
      setSyncStatus('error');
      showToast('⚠ Google Calendar session expired — reconnect in Settings and sync again.');
      addChangelog('Sync stopped — Google Calendar auth expired');
    } else {
      setSyncStatus(failed === 0 ? 'synced' : 'error');
      showToast(failed === 0
        ? `Synced ${ok}/${jobPlans.length} jobs to Google Calendar`
        : `Synced ${ok}/${jobPlans.length} jobs — ${failed} failed, check console`);
      addChangelog(`Synced ${ok} jobs to Google Calendar${failed ? `, ${failed} failed` : ''}`);
    }
    setTimeout(() => setSyncStatus('idle'), 4000);
  }

  // Trevor approved the preview → run that exact plan. Close the modal first so
  // it can't be double-submitted.
  function confirmSync() {
    if (!syncPlan) return;
    const plan = syncPlan;
    setSyncPlan(null);
    executePlan(plan);
  }

  function cancelSync() {
    setSyncPlan(null);
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
    syncPlan,
    buildExternalBlockedSlots,
    previewSync,
    confirmSync,
    cancelSync,
    handleSignIn,
    handleSignOut,
  };
}
