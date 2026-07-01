import { parseCSV } from '../data/jobs.js';
import { isFirebaseConfigured, saveSchedule, saveCompletedJobs } from '../utils/firebase.js';
import { getWeekDays } from '../utils/calendar.js';

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
          gcalEventId: null,
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
      let collisionCount = 0;
      const carriedSplits = [];

      merged.forEach(parent => {
        if (parent.parentId) return; // only top-level jobs can own manual splits
        const splits = manualSplitsByParentId[parent.id];
        if (!splits || splits.length === 0) return;

        if (autoSplitParentIds.has(parent.id)) {
          // Bench reclassification now also produces an auto-split for this parent —
          // keep the existing manual split (deliberate user intent), skip the duplicate.
          collisionCount++;
          return;
        }

        parent.isSplit = true;
        carriedSplits.push(...splits.map(s => ({ ...s, parentId: parent.id })));
      });

      if (collisionCount > 0) {
        showToast(`⚠ ${collisionCount} job${collisionCount > 1 ? 's' : ''} reclassified — kept existing manual split, skipped duplicate auto-split`);
      }

      const doneJobs = jobs.filter(j => j.done);
      const allJobs = [...merged, ...carriedSplits, ...doneJobs];
      const newJobIds = new Set(allJobs.map(j => j.id));
      const preservedSlots = Object.fromEntries(
        Object.entries(scheduledSlots).filter(([, jobId]) => newJobIds.has(jobId))
      );
      const jobCount = merged.filter(j => !j.parentId).length;

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
