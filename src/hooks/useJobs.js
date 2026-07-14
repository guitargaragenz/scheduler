import { parseCSV, canInvoiceJob } from '../data/jobs.js';
import { pickMasterFields, jobsStateFieldsFor } from '../data/joinJobs.js';
import { isFirebaseConfigured, saveCompletedJobs, saveJobsMasterBatch, batchWriteJobsState, saveJobMaster } from '../utils/firebase.js';
import { getWeekDays, localDateKey } from '../utils/calendar.js';
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
      const updated = { hours: Number(sess.hours), sessionNote: sess.note };
      setJobs(prev => prev.map(j => j.id === parentJob.id ? { ...j, ...updated } : j));
      if (isFirebaseConfigured()) {
        justSavedAt.current = Date.now();
        batchWriteJobsState([{ id: parentJob.id, data: jobsStateFieldsFor({ ...parentJob, ...updated }) }]);
      }
      return;
    }

    // Existing children — union of manual-split (isSubtask) AND auto-split
    // (parentId only, from createSubtasks()/the jobsMaster+jobsState join)
    // children. Auto-split children never carry isSubtask, so a filter that
    // only matched isSubtask left them behind: both sets ended up in state
    // together, parent.hasSubtasks/subtasks stayed stale, and their
    // scheduledSlots leaked into Firestore permanently. All of this parent's
    // children — however they were produced — are "existing" and must be
    // replaced or deleted, never left to coexist with a fresh manual split.
    const existingChildren = jobs.filter(j => j.parentId === parentJob.id);

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
      const parentUpdate = {
        bench: row.bench, hours: Number(sess.hours), sessionNote: sess.note,
        isSplit: false, hasSubtasks: false, subtasks: null,
        // noAutoSplit persists the "user deliberately un-split this" signal —
        // createSubtasks() derives purely from bench/desc/hours (unchanged by
        // this action), so without a stored marker the join layer has no way
        // to tell "never split" from "un-split" and would silently
        // regenerate the auto-split on the next reload/subscription update.
        // Leave the existing flag alone (don't force false) when this
        // wasn't actually an un-split.
        ...(wasSplit ? { noAutoSplit: true } : {}),
      };

      // True un-split: delete ALL of this job's children (manual or
      // auto-split), free their slots, clear isSplit + the auto-split
      // pointers so the parent doesn't double-book the hours and the join
      // layer can't regenerate the auto-split on next load. `bench` is
      // CSV-owned in the new schema, but a drawer-driven bench change on a
      // job that's being collapsed to one card is a deliberate app-side
      // override — same exception as the bench-keyword re-infer handler
      // (App.jsx design decision #2) — so it goes to jobsMaster explicitly,
      // alongside the atomic jobsState batch for the un-split itself.
      setJobs(prev => prev
        .filter(j => j.parentId !== parentJob.id)
        .map(j => j.id === parentJob.id ? { ...j, ...parentUpdate } : j));
      releaseSlots(new Set(existingChildren.map(j => j.id)));
      cleanupGcalEvents(existingChildren);

      if (isFirebaseConfigured()) {
        justSavedAt.current = Date.now();
        const mergedParent = { ...parentJob, ...parentUpdate };
        const writes = [
          { id: parentJob.id, data: jobsStateFieldsFor(mergedParent) },
          ...existingChildren.map(c => ({ id: c.id, delete: true })),
        ];
        batchWriteJobsState(writes); // atomic: parent's un-split state + all child deletes together
        // `bench` is CSV-owned in the new schema, but a drawer-driven
        // un-split can carry a deliberate bench override (the drawer lets
        // the tech reassign the bench when collapsing a split back to one
        // card) — same exception as the bench-keyword re-infer handler in
        // App.jsx (design decision #2), so it goes to jobsMaster directly.
        if (row.bench !== parentJob.bench) {
          saveJobMaster(parentJob.id, pickMasterFields(mergedParent));
        }
      }
      return;
    }

    const existingById = Object.fromEntries(existingChildren.map(j => [j.id, j]));
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
          // Children whose id survives the re-save keep their scheduling and piece-done state
          scheduled: prevChild?.scheduled ?? false,
          calendarSlot: prevChild?.calendarSlot ?? null,
          gcalEventId: prevChild?.gcalEventId ?? null,
          gcalEventIds: prevChild?.gcalEventIds ?? [],
          pieceDone: prevChild?.pieceDone ?? false,
        });
      });
    });

    // Replace, never append: drop ALL existing children for this parent
    // (manual AND auto-split), then insert the new set — re-saving a split
    // can no longer create duplicates or leave a stale auto-split behind.
    const keptIds = new Set(subtasks.map(s => s.id));
    const parentUpdate = { isSplit: true, hasSubtasks: false, subtasks: null, noAutoSplit: false };
    setJobs(prev => [
      ...prev
        .filter(j => j.parentId !== parentJob.id)
        // Re-splitting is a fresh deliberate choice, not an un-split — clear
        // any stale noAutoSplit from a prior collapse so a future CSV
        // re-upload or bench-keyword change doesn't treat this job as
        // permanently un-splittable.
        .map(j => j.id === parentJob.id ? { ...j, ...parentUpdate } : j),
      ...subtasks,
    ]);
    const removedChildren = existingChildren.filter(j => !keptIds.has(j.id));
    releaseSlots(new Set(removedChildren.map(j => j.id)));
    cleanupGcalEvents(removedChildren);
    setHighlightedJobId(parentJob.id);
    setSidebarOpen(true);

    if (isFirebaseConfigured()) {
      justSavedAt.current = Date.now();
      const mergedParent = { ...parentJob, ...parentUpdate };
      // ALL creates/updates/deletes for this split-set change land in one
      // writeBatch() — non-negotiable per architecture brief design decision
      // #5. A killed app/dropped network here must never leave 2 of 3 new
      // split children saved and the 3rd missing, or the parent's own state
      // update landing without its children (or vice versa).
      const writes = [
        { id: parentJob.id, data: jobsStateFieldsFor(mergedParent) },
        ...subtasks.map(s => ({ id: s.id, data: jobsStateFieldsFor(s) })),
        ...removedChildren.map(c => ({ id: c.id, delete: true })),
      ];
      batchWriteJobsState(writes);
    }
  }

  function handleMarkDone(job, amount) {
    // localDateKey, not toISOString() — the latter converts to UTC first,
    // which rolls Monday-local-midnight back to Sunday for timezones ahead
    // of UTC (NZ, UTC+12/+13), stamping the record into the previous week.
    const weekKey = localDateKey(getWeekDays()[0]);
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

  // Pure per-job upsert to jobsMaster — no carry-forward, no collision
  // logic, nothing to preserve. In the old single-array model, a CSV upload
  // had to carefully re-append manually-split children and noAutoSplit
  // markers or they'd silently vanish (that carry-forward logic is exactly
  // what orphaned #1520/#1175's split data when it missed an edge case).
  // In this schema the CSV writer never touches jobsState at all, so
  // there's nothing left to carry forward — scheduling/split/pomodoro state
  // simply isn't part of what this function writes, and the join layer
  // reattaches it from jobsState automatically on the next snapshot.
  function handleCsvUpload(csvText) {
    try {
      const parsed = parseCSV(csvText, benchKeywords, benchHours);
      const topLevel = parsed.filter(j => !j.parentId);
      const masterByJobNo = Object.fromEntries(topLevel.map(j => [j.job, j]));

      // Optimistic local merge for immediate UI feedback: CSV-owned fields
      // refresh from the fresh parse; app-owned fields on existing jobs are
      // left untouched (they live in jobsState and the join layer will
      // reattach them from the next jobsMaster/jobsState snapshot regardless
      // of what happens here). Split-child rows (parentId set) are left
      // alone entirely — they're regenerated/restored by the join layer,
      // never written directly by the CSV path.
      setJobs(prev => {
        const prevTopLevelJobNos = new Set(prev.filter(j => !j.parentId).map(j => j.job));
        const updatedExisting = prev.map(j => {
          if (j.parentId) return j;
          const fresh = masterByJobNo[j.job];
          return fresh ? { ...j, ...pickMasterFields(fresh) } : j;
        });
        const brandNew = topLevel.filter(j => !prevTopLevelJobNos.has(j.job));
        return [...updatedExisting, ...brandNew];
      });

      if (isFirebaseConfigured()) {
        justSavedAt.current = Date.now();
        saveJobsMasterBatch(topLevel.map(j => ({ id: j.id, ...pickMasterFields(j) })));
      }

      showToast(`Loaded ${topLevel.length} jobs from CSV`);
      addChangelog(`CSV uploaded — ${topLevel.length} jobs`);
    } catch (e) {
      showToast(`⚠ CSV parse error: ${e.message}`);
    }
  }

  function handleOpenPomo(job) {
    setPomoJob(job);
  }

  function handleLogPomoSession(jobId, session) {
    let mergedJob = null;
    setJobs(prev => prev.map(j => {
      if (j.id !== jobId) return j;
      mergedJob = { ...j, pomoLog: [...(j.pomoLog || []), session] };
      return mergedJob;
    }));
    if (isFirebaseConfigured() && mergedJob) {
      justSavedAt.current = Date.now();
      batchWriteJobsState([{ id: jobId, data: jobsStateFieldsFor(mergedJob) }]);
    }
    const jobRef = jobs.find(j => j.id === jobId);
    showToast(`Logged ${session.pomos} pomo${session.pomos !== 1 ? 's' : ''} for #${jobRef?.job ?? jobId}`);
  }

  function handleMarkPieceDone(parentJobId, childJobId, pieceDone, onAllPiecesDone) {
    let updatedChild = null;
    let parentJob = null;
    let allChildrenDone = false;
    let children = [];

    // Compute the child update, parent lookup, and all-children-done check
    // all from the SAME fresh array (`next`) inside one updater call. Doing
    // the all-children check against the outer `jobs` closure instead (as a
    // previous version did) is a real race: `jobs` is the array from this
    // hook's last render, which is stale if two pieces get marked in quick
    // succession (faster than a React re-render round-trip) — e.g. clicking
    // through several split pieces back to back. That stale read can make
    // the very-last piece's completion check see the previous piece as
    // still not-done, silently skipping the invoice prompt. Reading
    // everything from `next` eliminates the race regardless of click timing.
    setJobs(prev => {
      const next = prev.map(j => {
        if (j.id === childJobId) {
          updatedChild = { ...j, pieceDone };
          return updatedChild;
        }
        return j;
      });
      parentJob = next.find(j => j.id === parentJobId) || null;
      if (parentJob && pieceDone) {
        children = parentJob.hasSubtasks
          ? next.filter(j => parentJob.subtasks?.includes(j.id))
          : next.filter(j => j.parentId === parentJob.id);
        allChildrenDone = children.length > 0 && children.every(c => c.pieceDone);
      }
      return next;
    });

    if (!updatedChild || !parentJob) return;

    // Persist to Firestore
    if (isFirebaseConfigured()) {
      justSavedAt.current = Date.now();
      batchWriteJobsState([{ id: childJobId, data: jobsStateFieldsFor(updatedChild) }]);
    }

    if (allChildrenDone) {
      // Auto-complete the parent — trigger invoicing flow
      const benchNames = children.map(j => j.bench).join(' + ');
      showToast(`✓ #${parentJob.job} (${benchNames}) complete — ready to invoice`);
      // Call the callback so App.jsx can open the invoice dialog
      if (onAllPiecesDone) onAllPiecesDone(parentJob);
    }
  }

  return {
    handleSaveDrawer,
    handleMarkDone,
    handleCsvUpload,
    handleOpenPomo,
    handleLogPomoSession,
    handleMarkPieceDone,
  };
}
