import { parseCSV } from '../data/jobs.js';
import { isFirebaseConfigured, saveSchedule, saveCompletedJobs } from '../utils/firebase.js';
import { getWeekDays } from '../utils/calendar.js';
import { deleteEvent } from '../utils/googleCalendar.js';

// Split children carry their own GCal event(s) once synced. Deleting a child
// locally (un-split, or re-split dropping it) must also delete its calendar
// event, or the appointment orphans on the user's real Google Calendar forever.
function cleanupGcalEvents(removedChildren) {
  removedChildren.forEach(child => {
    const ids = child.gcalEventIds?.length ? child.gcalEventIds : (child.gcalEventId ? [child.gcalEventId] : []);
    ids.forEach(id => deleteEvent(id));
  });
}

export function useJobs({
  jobs,
  setJobs,
  scheduledSlots,
  setScheduledSlots,
  doneJobIds,
  completedJobs,
  setCompletedJobs,
  setDoneJobIds,
  benchKeywords,
  benchHours,
  justSavedAt,
  setPomoJob,
  setHighlightedJobId,
  setSidebarOpen,
  showToast,
  addChangelog,
}) {
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

    // Existing children — union of manual-split (isSubtask) AND auto-split
    // (parentId only, from createSubtasks()/withSplitsExpanded) children.
    // Auto-split children never carry isSubtask, so a filter that only
    // matched isSubtask left them behind: both sets ended up in state
    // together, parent.hasSubtasks/subtasks stayed stale, and their
    // scheduledSlots leaked into Firestore permanently. All of this parent's
    // children — however they were produced — are "existing" and must be
    // replaced or deleted, never left to coexist with a fresh manual split.
    const existingChildren = jobs.filter(j => j.parentId === parentJob.id);
    const existingById = Object.fromEntries(existingChildren.map(j => [j.id, j]));

    // Free the calendar slots held by children that no longer exist
    function releaseSlots(removedIds) {
      if (removedIds.size === 0) return;
      setScheduledSlots(prev => {
        const next = { ...prev };
        Object.keys(next).forEach(k => { if (removedIds.has(next[k])) delete next[k]; });
        return next;
      });
    }

    if (totalCards === 1) {
      const row = rows[0];
      const sess = row.sessions[0];
      // Only a real un-split (collapsing a job that WAS auto- or
      // manually-split down to one card) should mark noAutoSplit. A routine
      // single-card save on a job that was never split (JobDrawer's initRows
      // defaults every non-split job to one row) must not set it — doing so
      // unconditionally would permanently suppress a legitimate future
      // auto-split for a job that was simply edited, not un-split.
      const wasSplit = parentJob.hasSubtasks || parentJob.isSplit;
      // True un-split: delete ALL of this job's children (manual or
      // auto-split), free their slots, clear isSplit + the auto-split
      // pointers so the parent doesn't double-book the hours and
      // withSplitsExpanded can't regenerate the auto-split on next load.
      setJobs(prev => prev
        .filter(j => j.parentId !== parentJob.id)
        .map(j => j.id === parentJob.id
          ? {
              ...j, bench: row.bench, hours: Number(sess.hours), sessionNote: sess.note,
              isSplit: false, hasSubtasks: false, subtasks: null,
              // noAutoSplit persists the "user deliberately un-split this" signal —
              // createSubtasks() derives purely from bench/desc/hours (unchanged by
              // this action), so without a stored marker withSplitsExpanded has no
              // way to tell "never split" from "un-split" and would silently
              // regenerate the auto-split on the next reload/subscription update.
              // Leave the existing flag alone (don't force false) when this
              // wasn't actually an un-split.
              ...(wasSplit ? { noAutoSplit: true } : {}),
            }
          : j
        ));
      releaseSlots(new Set(existingChildren.map(j => j.id)));
      cleanupGcalEvents(existingChildren);
      return;
    }

    const subtasks = [];
    rows.forEach(row => {
      row.sessions.forEach((sess, si) => {
        const id = `${parentJob.id}_${row.bench}_${si}`;
        const prevChild = existingById[id];
        subtasks.push({
          ...parentJob,
          id,
          bench: row.bench,
          hours: Number(sess.hours),
          sessionIndex: si + 1,
          sessionTotal: row.sessions.length,
          sessionNote: sess.note || '',
          parentId: parentJob.id,
          isSubtask: true,
          // Children whose id survives the re-save keep their scheduling
          scheduled: prevChild?.scheduled ?? false,
          calendarSlot: prevChild?.calendarSlot ?? null,
          gcalEventId: prevChild?.gcalEventId ?? null,
          gcalEventIds: prevChild?.gcalEventIds ?? [],
        });
      });
    });

    // Replace, never append: drop ALL existing children for this parent
    // (manual AND auto-split), then insert the new set — re-saving a split
    // can no longer create duplicates or leave a stale auto-split behind.
    const keptIds = new Set(subtasks.map(s => s.id));
    setJobs(prev => [
      ...prev
        .filter(j => j.parentId !== parentJob.id)
        // Re-splitting is a fresh deliberate choice, not an un-split — clear
        // any stale noAutoSplit from a prior collapse so a future CSV
        // re-upload or bench-keyword change doesn't treat this job as
        // permanently un-splittable.
        .map(j => j.id === parentJob.id ? { ...j, isSplit: true, hasSubtasks: false, subtasks: null, noAutoSplit: false } : j),
      ...subtasks,
    ]);
    const removedChildren = existingChildren.filter(j => !keptIds.has(j.id));
    releaseSlots(new Set(removedChildren.map(j => j.id)));
    cleanupGcalEvents(removedChildren);
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
    setJobs(prev => prev.map(j => j.id === job.id ? { ...j, done: true } : j));
    if (isFirebaseConfigured()) saveCompletedJobs(newRecords, newDoneIds);
    setPomoJob(null);
    showToast(`✓ ${job.mfr} ${job.model} — $${Number(amount).toFixed(0)} invoiced`);
  }

  function handleCsvUpload(csvText) {
    try {
      const newJobs = parseCSV(csvText, benchKeywords, benchHours).filter(j => !doneJobIds.includes(String(j.id)));
      const existingByJobNo = Object.fromEntries(jobs.map(j => [j.job, j]));
      const merged = newJobs.map(j => ({
        ...j,
        pomoLog: existingByJobNo[j.job]?.pomoLog || [],
        scheduled: existingByJobNo[j.job]?.scheduled || false,
        calendarSlot: existingByJobNo[j.job]?.calendarSlot || null,
      }));

      // Carry forward manually-split jobs (JobDrawer splits) — parseCSV() has no
      // knowledge of these; without this they silently vanish on every CSV upload,
      // taking their scheduledSlots with them (drift-guard false positive).
      const manualSplitsByParentId = {};
      jobs.filter(j => j.isSubtask === true && j.parentId).forEach(j => {
        (manualSplitsByParentId[j.parentId] ||= []).push(j);
      });

      const autoSplitParentIds = new Set(merged.filter(j => j.parentId).map(j => j.parentId));
      const collidedParentIds = new Set();
      const carriedSplits = [];

      merged.forEach(parent => {
        if (parent.parentId) return; // only top-level jobs can own manual splits
        const splits = manualSplitsByParentId[parent.id];
        if (!splits || splits.length === 0) return;

        if (autoSplitParentIds.has(parent.id)) {
          // Bench reclassification now also produces an auto-split for this parent —
          // keep the existing manual split (deliberate user intent). The duplicate
          // auto-split children are dropped below, and the parent's auto-split
          // pointers are cleared so withSplitsExpanded can't regenerate them.
          collidedParentIds.add(parent.id);
          parent.hasSubtasks = false;
          parent.subtasks = null;
        }

        parent.isSplit = true;
        carriedSplits.push(...splits.map(s => ({ ...s, parentId: parent.id })));
      });

      // Carry forward noAutoSplit ("user deliberately un-split this job") —
      // parseCSV() has no knowledge of it and will happily re-auto-split a job
      // whose bench/desc still qualify. Without this, re-uploading the CSV
      // undoes the un-split exactly like a stale withSplitsExpanded would.
      const noAutoSplitParentIds = new Set();
      merged.forEach(parent => {
        if (parent.parentId) return;
        if (existingByJobNo[parent.job]?.noAutoSplit) {
          parent.noAutoSplit = true;
          parent.hasSubtasks = false;
          parent.subtasks = null;
          noAutoSplitParentIds.add(parent.id);
        }
      });

      // Drop the duplicate auto-split children of collided parents (manual
      // split wins) and of noAutoSplit parents (un-split wins) — either
      // parent's own children were already excluded above.
      const dropAutoChildrenParentIds = new Set([...collidedParentIds, ...noAutoSplitParentIds]);
      const keptJobs = merged.filter(j => !(j.parentId && dropAutoChildrenParentIds.has(j.parentId)));
      const collisionCount = collidedParentIds.size;

      if (collisionCount > 0) {
        showToast(`⚠ ${collisionCount} job${collisionCount > 1 ? 's' : ''} reclassified — kept existing manual split, skipped duplicate auto-split`);
      }

      const doneJobs = jobs.filter(j => j.done);
      const allJobs = [...keptJobs, ...carriedSplits, ...doneJobs];
      const newJobIds = new Set(allJobs.map(j => j.id));
      const preservedSlots = Object.fromEntries(
        Object.entries(scheduledSlots).filter(([, jobId]) => newJobIds.has(jobId))
      );
      const jobCount = keptJobs.filter(j => !j.parentId).length;

      // Safety guard — if CSV wipes >50% of scheduled slots, warn and abort the save.
      // This catches ID drift from bench reclassification silently clearing the schedule.
      const prevCount = Object.keys(scheduledSlots).length;
      const nextCount = Object.keys(preservedSlots).length;
      if (prevCount > 0 && nextCount < prevCount * 0.5) {
        showToast(`⚠ CSV upload would clear ${prevCount - nextCount} scheduled slots — schedule preserved. Check job IDs.`);
        setJobs(allJobs);
        if (isFirebaseConfigured()) saveSchedule(allJobs, scheduledSlots);
        addChangelog(`CSV uploaded — ${jobCount} jobs, schedule preserved (ID drift detected)`);
        return;
      }

      justSavedAt.current = Date.now();
      setJobs(allJobs);
      setScheduledSlots(preservedSlots);
      if (isFirebaseConfigured()) saveSchedule(allJobs, preservedSlots);

      const droppedCount = prevCount - nextCount;
      if (droppedCount > 0) {
        showToast(`⚠ Loaded ${jobCount} jobs — ${droppedCount} scheduled slot${droppedCount > 1 ? 's' : ''} dropped (job ID no longer matched). Check calendar.`);
        addChangelog(`CSV uploaded — ${jobCount} jobs, ${droppedCount} scheduled slots dropped (ID mismatch)`);
      } else {
        showToast(`Loaded ${jobCount} jobs from CSV`);
        addChangelog(`CSV uploaded — loaded ${jobCount} jobs`);
      }
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
    const jobRef = jobs.find(j => j.id === jobId);
    showToast(`Logged ${session.pomos} pomo${session.pomos !== 1 ? 's' : ''} for #${jobRef?.job ?? jobId}`);
  }

  return {
    handleSaveDrawer,
    handleMarkDone,
    handleCsvUpload,
    handleOpenPomo,
    handleLogPomoSession,
  };
}
