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
    try {
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
      if (isFirebaseConfigured()) saveCompletedJobs(newRecords, newDoneIds).catch(() => {});
      setPomoJob(null);
      showToast(`✓ ${job.mfr} ${job.model} — $${Number(amount).toFixed(0)} invoiced`);
    } catch (e) {
      showToast(`⚠ mark done error: ${e.message}`);
    }
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
      const doneJobs = jobs.filter(j => j.done);
      const allJobs = [...merged, ...doneJobs];
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
        if (isFirebaseConfigured()) saveSchedule(merged, scheduledSlots);
        addChangelog(`CSV uploaded — ${jobCount} jobs, schedule preserved (ID drift detected)`);
        return;
      }

      justSavedAt.current = Date.now();
      setJobs(allJobs);
      setScheduledSlots(preservedSlots);
      if (isFirebaseConfigured()) saveSchedule(merged, preservedSlots);
      showToast(`Loaded ${jobCount} jobs from CSV`);
      addChangelog(`CSV uploaded — loaded ${jobCount} jobs`);
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
