import { useState, useEffect, useCallback, useRef } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  closestCenter,
} from '@dnd-kit/core';
import { benchColors, DEFAULT_BENCH_KEYWORDS, inferBench } from './data/jobs.js';
import { getWeekDays, formatDateRange, localDateKey } from './utils/calendar.js';
import { isSupabaseConfigured, loadConflictLog, clearConflictLog, appendConflictLog, saveJob, deleteJob } from './utils/supabase.js';
import { pickMasterFields } from './data/joinJobs.js';
import { noticeJobs, pruneDismissed, dismissAll } from './data/partsArrivedNotice.js';
import { applySheetEdits } from './data/jobsSheet.js';
import { previewBenchChanges, isReinferable } from './data/benchKeywordPreview.js';
import CalendarGrid from './components/CalendarGrid.jsx';
import Sidebar from './components/Sidebar.jsx';
import Toast from './components/Toast.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import JobCard from './components/JobCard.jsx';
import JobDrawer from './components/JobDrawer.jsx';
import PomoDrawer from './components/PomoDrawer.jsx';
import WeeklySummaryModal from './components/WeeklySummaryModal.jsx';
import PartsDrawer from './components/PartsDrawer.jsx';
import HelpDrawer from './components/HelpDrawer.jsx';
// The Projects nav button now opens the tab strip, not the old page directly.
// WorkshopProjectsPage renders ProjectsPage itself, as the pinned "Project
// Jobs" tab at the far right.
import WorkshopProjectsPage from './components/WorkshopProjectsPage.jsx';
import PartsToOrderPage from './components/PartsToOrderPage.jsx';
import MobileJobSheet from './components/MobileJobSheet.jsx';
import ParkingLotPage from './components/ParkingLotPage.jsx';
import DailyLogPage from './components/DailyLogPage.jsx';
import JobsPage from './components/JobsPage.jsx';
import JobsSheetPage from './components/JobsSheetPage.jsx';
import BenchBoardPage from './components/BenchBoardPage.jsx';
import BenchWeekPage from './components/BenchWeekPage.jsx';
import DailyLogPanel, { weekCellJobId } from './components/DailyLogPanel.jsx';
import { useWeekMarks } from './hooks/useWeekMarks.js';
import { useDayMarks } from './hooks/useDayMarks.js';
import CloseDayModal from './components/CloseDayModal.jsx';
import CatchUpInterview from './components/CatchUpInterview.jsx';
import BumpReasonModal from './components/BumpReasonModal.jsx';
import KeywordChangePreviewModal from './components/KeywordChangePreviewModal.jsx';
import SyncPreviewModal from './components/SyncPreviewModal.jsx';
import PdfImportPreviewModal from './components/PdfImportPreviewModal.jsx';
import ConflictBanner from './components/ConflictBanner.jsx';
import RevenueReviewBanner from './components/RevenueReviewBanner.jsx';
import PartsArrivedBanner from './components/PartsArrivedBanner.jsx';
import RevenueBreakdown from './components/RevenueBreakdown.jsx';
import { useSupabase } from './hooks/useSupabase.js';
import { useGoogleCalendar } from './hooks/useGoogleCalendar.js';
import { useScheduler } from './hooks/useScheduler.js';
import { useJobs } from './hooks/useJobs.js';
import { useDailyLog } from './hooks/useDailyLog.js';
import { useAdHocTasks } from './hooks/useAdHocTasks.js';
import { useFocusList } from './hooks/useFocusList.js';
import { useAppSettings } from './hooks/useAppSettings.js';
import { useSuppliers } from './hooks/useSuppliers.js';
import { usePendingRevenueReview } from './hooks/usePendingRevenueReview.js';

export default function App() {
  // --- Core state ---
  // Bench keywords, bench hours, weekly target and hourly rate now live in the
  // shared settings store instead of this browser's localStorage, so all three
  // devices agree. See src/hooks/useAppSettings.js.
  const {
    ready: settingsReady, saveError: settingsSaveError,
    benchKeywords, setBenchKeywords,
    benchHours, setBenchHours,
    weeklyTarget, setWeeklyTarget,
    hourlyRate, setHourlyRate,
    partsArrivedDismissed, setPartsArrivedDismissed,
  } = useAppSettings();

  // The managed supplier list — edited in Settings, offered on the Parts to
  // Order add form. Loaded here so both screens read the same one list.
  const {
    suppliers, error: supplierError,
    add: addSupplier, rename: renameSupplier, remove: removeSupplier,
  } = useSuppliers();

  // Starts empty. Jobs arrive from Supabase on the first snapshot; there is no
  // seed data baked into the bundle. (Until Build 2a this called
  // parseCSV(RAW_CSV, …), which returned [] anyway — RAW_CSV had been a bare
  // header line for months.)
  const [jobs, setJobs] = useState([]);
  const [scheduledSlots, setScheduledSlots] = useState({});
  const [weekDays, setWeekDays] = useState(() => getWeekDays());
  const [displayedDate, setDisplayedDate] = useState(() =>
    getWeekDays().find(d => d.toDateString() === new Date().toDateString()) || new Date()
  );
  const [dragMode, setDragMode] = useState('regular');
  const [toast, setToast] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [highlightedJobId, setHighlightedJobId] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [supabaseReady, setFirebaseReady] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState(null);
  const [pomoJob, setPomoJob] = useState(null);
  const [showSummary, setShowSummary] = useState(false);
  const [showRevenueBreakdown, setShowRevenueBreakdown] = useState(false);
  // showParts is the PartsBox inventory DRAWER (PartsDrawer.jsx) — a different
  // system entirely. showPartsToOrder below is the parts-to-order chase list page.
  const [showParts, setShowParts] = useState(false);
  // What the parts drawer should open already searched for. Set by the Parts to
  // Order page's "check stock" control; '' every other way the drawer opens.
  const [partsDrawerSearch, setPartsDrawerSearch] = useState('');
  const [showPartsToOrder, setShowPartsToOrder] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showProjects, setShowProjects] = useState(false);
  const [showParkingLot, setShowParkingLot] = useState(() => window.location.hash === '#parking-lot');
  const [showWeekView, setShowWeekView] = useState(false);
  const [showJobs, setShowJobs] = useState(false);
  // Brief G, Build 1b — the Jobs Sheet: the one screen where Trevor edits the
  // six columns the app now owns (Tag, Hours, Action, VB, BL, PJ).
  const [showJobsSheet, setShowJobsSheet] = useState(false);
  // The Bench board. Named "Bench", not "Board" — "Board" is already this app's
  // name for the calendar, and two pages called Board would be unusable.
  const [showBench, setShowBench] = useState(false);
  // The week page (bench view, Build 1). Its own flag and its own page — the
  // Bench board is a different screen and the two must not collide.
  const [showWeekPage, setShowWeekPage] = useState(false);
  // The Daily Log. Its own flag because on a phone the two logs are seen one at
  // a time; on a desktop either flag shows both, side by side.
  const [showDayPage, setShowDayPage] = useState(false);
  const [showCloseDay, setShowCloseDay] = useState(false);
  const [showCatchUp, setShowCatchUp] = useState(false);
  const [bumpPrompt, setBumpPrompt] = useState(null); // { job, fromSlot, toSlot } | null
  // A keyword edit waiting on Trevor's confirmation: { kw, moves }. While this
  // is set NOTHING has been written — not the jobs, not the saved keyword list.
  // The modal is the only way through to a write, same shape as pdfPlan above.
  const [keywordChange, setKeywordChange] = useState(null);
  // Multitrack PDF drop: the parsed plan waiting on Trevor's confirmation.
  // While this is set, nothing has been written — the modal is the only way
  // through to a write.
  const [pdfPlan, setPdfPlan] = useState(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [completedJobs, setCompletedJobs] = useState([]);
  const [doneJobIds, setDoneJobIds] = useState([]);
  const [isMobile] = useState(() => window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768);
  const [conflictEvents, setConflictEvents] = useState([]);

  const revenueTriggerRef = useRef(null);

  // Shared refs — written by multiple hooks; must live here to avoid split ownership
  const justSavedAt = useRef(0);
  const scheduledSlotsRef = useRef({});
  const jobsRef = useRef([]);
  const externalEventsRef = useRef([]);

  useEffect(() => { scheduledSlotsRef.current = scheduledSlots; }, [scheduledSlots]);
  useEffect(() => { jobsRef.current = jobs; }, [jobs]);

  // Load unread conflict bump events on startup
  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    loadConflictLog().then(events => {
      if (events.length > 0) setConflictEvents(events);
    });
  }, []);

  const showToast = useCallback((msg) => setToast(msg), []);
  // The in-app Changelog screen is gone (it had not been updated since June and
  // the git history is the real changelog). This stays as a deliberate no-op so
  // that useGoogleCalendar and useScheduler, which both call it, need no edits —
  // those are calendar-sync files and not worth touching for a screen deletion.
  const addChangelog = useCallback(() => {}, []);

  // --- Hooks ---
  const { pendingRevenueReview, addDisappearedJobs, resolveItem: resolvePendingRevenueReviewItem } = usePendingRevenueReview();

  // Captured for its loadJobs — the PDF import needs a full re-read after a
  // departure or a return, neither of which can be applied to the on-screen
  // board by hand. Nothing else about this call changed.
  const supabaseOps = useSupabase({
    jobs, scheduledSlots, setJobs, setScheduledSlots,
    setFirebaseReady, setLastSyncedAt,
    setCompletedJobs, setDoneJobIds,
    justSavedAt, supabaseReady,
    onJobsDisappeared: addDisappearedJobs,
    // Union-join semantics (architecture brief design decision #1): a
    // jobsState split-child doc whose jobsMaster parent has vanished is
    // never silently dropped — it's surfaced here via the same
    // pendingRevenueReview mechanism as a disappeared job, so Trevor sees it
    // instead of it being erased on the next save (the exact #1520/#1175 bug).
    onSplitOrphansFound: addDisappearedJobs,
    benchHours,
    // Jobs are not loaded until the shared settings have arrived. benchHours
    // decides how big each auto-split bench card is, so loading jobs first would
    // size every split card off a placeholder and then leave it that way.
    settingsReady,
  });

  const gcal = useGoogleCalendar({
    weekDays, jobs, scheduledSlots, scheduledSlotsRef, jobsRef,
    setJobs, setScheduledSlots, showToast, addChangelog,
  });

  // Keep externalEventsRef in sync for useScheduler (reads it directly)
  useEffect(() => { externalEventsRef.current = gcal.externalEvents; }, [gcal.externalEvents]);

  const {
    todayLog, addBullet, removeBullet, toggleDone, closeDay, upsertScheduledBullet,
    deferredItems, addChecklistItem, toggleChecklistItem, pullBackIn,
    logs: dailyLogs, catchUpNeeded, autoCarryForward, resolveStaleDays,
  } = useDailyLog();
  // Stamps a `source: 'auto-carry'` bump-history entry (reason left null —
  // filled in later via handleSetBumpReason) on a job whose Daily Log bullet
  // just silently migrated to today via autoCarryForward. Auto-carry has no
  // real calendar slot (it's a log-day migration, not a scheduling move), so
  // fromSlot/toSlot hold bare YYYY-MM-DD date-keys here, not slotKey() strings.
  const handleJobAutoCarryBumped = useCallback((jobId, { fromDateKey, toDateKey }) => {
    const entry = {
      ts: Date.now(),
      reason: null,
      reasonText: undefined,
      fromSlot: fromDateKey,
      toSlot: toDateKey,
      source: 'auto-carry',
    };
    setJobs(prev => prev.map(j =>
      j.id === jobId ? { ...j, bumpHistory: [...(j.bumpHistory || []), entry] } : j
    ));
  }, [setJobs]);

  const handleAutoCarryForward = useCallback(() => {
    autoCarryForward(handleJobAutoCarryBumped);
  }, [autoCarryForward, handleJobAutoCarryBumped]);

  // Retroactively fills in a reason on a previously-unresolved auto-carry bump
  // entry — called from DailyLogPage's CarriedReasonPicker, correlated by the
  // bullet's `carriedFrom` date-key matching the entry's `fromSlot`.
  const handleSetBumpReason = useCallback((jobId, carriedFrom, { reason, reasonText }) => {
    setJobs(prev => prev.map(j => {
      if (j.id !== jobId) return j;
      const bumpHistory = (j.bumpHistory || []).map(entry =>
        entry.source === 'auto-carry' && entry.fromSlot === carriedFrom && !entry.reason
          ? { ...entry, reason, reasonText: reason === 'Other' ? reasonText : undefined }
          : entry
      );
      return { ...j, bumpHistory };
    }));
  }, [setJobs]);

  // The Jobs Sheet has already written to Supabase by the time this runs; all
  // that is left is to bring the board in memory into line. It has to be done
  // here rather than waiting for the realtime echo, because our own writes mute
  // that echo for five seconds — applySheetEdits also re-derives the pile flags,
  // so a job Trevor marks INC leaves the Ready pile the moment he commits.
  const handleJobsSheetSaved = useCallback((updates) => {
    setJobs(prev => prev.map(j => (updates[j.id] ? applySheetEdits(j, updates[j.id]) : j)));
  }, []);

  // Lifted out of the Settings JSX when Settings became a page — same handler,
  // same behaviour, just no longer written inline in a prop.
  //
  // This is now the APPLY half only. It is not wired to Settings directly:
  // requestBenchKeywordsChange below holds the edit up for confirmation first,
  // and this runs only once Trevor has said go ahead.
  const applyBenchKeywordsChange = useCallback((kw) => {
    setBenchKeywords(kw);
    // Re-infer benches over the CURRENT jobs, in place — this handler
    // never rebuilds the jobs array from a source file.
    // Skip split children (bench chosen by the
    // user or the split logic) and split parents (changing their
    // bench would drift auto-split child IDs and orphan their
    // scheduled slots). That filter is isReinferable(), shared with the
    // preview so the two can never disagree about which jobs are in play.
    //
    // `bench` is CSV/Sheet-owned in the new jobsMaster/jobsState
    // schema (architecture brief design decision #2) — this handler
    // is the one deliberate app-side exception, so it writes the
    // updated bench straight to each affected job's jobsMaster doc
    // explicitly, rather than relying on the generic jobsState
    // diff-save (which never touches jobsMaster fields at all).
    const reinferred = [];
    setJobs(prev => prev.map(j => {
      if (!isReinferable(j)) return j;
      const bench = inferBench(j.desc, j.status, j.action, j.model, j.mfr, kw, j.backlog === true, j.vb === true);
      if (bench !== j.bench) reinferred.push({ ...j, bench });
      return { ...j, bench };
    }));
    if (isSupabaseConfigured() && reinferred.length > 0) {
      justSavedAt.current = Date.now();
      reinferred.forEach(j => saveJob(j.id, pickMasterFields(j)));
    }
  }, [setBenchKeywords, setJobs, justSavedAt]);

  // What Settings now calls instead. It writes nothing at all: it works out
  // which jobs the proposed keyword list would move and parks the whole edit
  // in state for the confirmation modal. Cancel drops it and both the jobs and
  // the saved keyword list are untouched, because neither was written.
  const requestBenchKeywordsChange = useCallback((kw) => {
    setKeywordChange({ kw, moves: previewBenchChanges(jobsRef.current, kw) });
  }, []);

  // Deliberately reads state and calls apply outside the setState updater —
  // React runs updaters twice in development, and applying the change from
  // inside one would save every moved job twice.
  const confirmBenchKeywordsChange = useCallback(() => {
    if (!keywordChange) return;
    applyBenchKeywordsChange(keywordChange.kw);
    setKeywordChange(null);
  }, [keywordChange, applyBenchKeywordsChange]);

  // The body renders the first of these flags that is true, in a fixed order,
  // so they only ever behaved as one exclusive page selection. The buttons were
  // independent toggles, though: with the Sheet open, clicking Projects set
  // showProjects but left showJobsSheet set, and the Sheet — earlier in the
  // chain — kept rendering. Nothing appeared to happen, and the page had to be
  // closed before another would open.
  //
  // Selecting a page clears the others — the buttons are plain switches, not
  // toggles. `null` means the Board, which is what renders when no page flag is
  // set; the Board has its own header button rather than being reached by
  // clicking the lit-up page button a second time.
  //
  // showWeekView is deliberately not in here: it is the calendar's own mode,
  // not a page, and must survive switching pages and coming back.
  const selectPage = useCallback((page) => {
    setShowJobsSheet(page === 'jobsSheet');
    setShowBench(page === 'bench');
    setShowWeekPage(page === 'weekPage');
    setShowDayPage(page === 'dayPage');
    setShowJobs(page === 'jobs');
    setShowProjects(page === 'projects');
    setShowPartsToOrder(page === 'partsToOrder');
    setShowParts(page === 'parts');
    setShowHelp(page === 'help');
    setShowSettings(page === 'settings');
    // Leaving the Parts page drops the search the Parts to Order page seeded it
    // with, so re-opening it plainly doesn't come back still filtered.
    if (page !== 'parts') setPartsDrawerSearch('');
    // The Parking Lot is reached by #parking-lot, so leaving it has to clear the
    // hash too, or a reload drops straight back into it.
    setShowParkingLot(false);
    if (window.location.hash === '#parking-lot') window.history.replaceState(null, '', '#');
  }, []);

  // The week page's marks. Its own table, loaded whether or not the page is
  // open so switching to it doesn't show a blank week for a moment.
  const weekMarks = useWeekMarks();

  // The Daily Log's picks. Its own table, loaded the same way and for the same
  // reason — the day shouldn't flash empty on the way in.
  const dayMarks = useDayMarks();

  const { adHocTasks, scheduleAdHocTask, removeAdHocTask } = useAdHocTasks();
  const { focusList, setFocusList } = useFocusList();

  // Pure add/remove of a job ID in the focus list array — the hook handles
  // debounce, persistence, and failure recovery. IDs are kept in whatever
  // type they already are (matching saveFocusList's raw job_id storage);
  // comparisons elsewhere in the app already coerce with String().
  const toggleFocusJob = useCallback((jobId) => {
    setFocusList(prev => {
      const idStr = String(jobId);
      const exists = prev.some(id => String(id) === idStr);
      return exists ? prev.filter(id => String(id) !== idStr) : [...prev, jobId];
    });
  }, [setFocusList]);

  const schedulerWeekDays = showWeekView ? weekDays : [displayedDate];

  const handleBumpDetected = useCallback(({ job, fromSlot, toSlot }) => {
    setBumpPrompt({ job, fromSlot, toSlot });
  }, []);

  const scheduler = useScheduler({
    jobs, setJobs, scheduledSlots, setScheduledSlots,
    weekDays: schedulerWeekDays, externalEventsRef, justSavedAt,
    signedIn: gcal.signedIn, showToast, addChangelog,
    upsertScheduledBullet,
    onBumpDetected: handleBumpDetected,
  });

  // When all pieces of a split job are done, open the invoice-amount prompt
  // for that exact job — PomoDrawer already renders a "Job done? Invoice
  // amount" input for any job without a parentId (isIdle || isDone state),
  // so opening it on the parent job gives a direct invoicing prompt instead
  // of routing through Close Day, which only shows today's bullet-journal
  // entries and has no notion of "this specific job".
  const handleAllPiecesDone = useCallback((parentJob) => {
    setPomoJob(parentJob);
  }, []);

  const jobOps = useJobs({
    jobs, setJobs, scheduledSlots, setScheduledSlots,
    doneJobIds, completedJobs, setCompletedJobs, setDoneJobIds,
    benchKeywords, benchHours, justSavedAt,
    setPomoJob, setHighlightedJobId, setSidebarOpen,
    showToast, addChangelog,
    // For the PDF import only: a job closed on the week page this week is held
    // back from departing until the week rolls over. useWeekMarks() already has
    // these loaded and live, so they are passed down rather than re-read.
    weekMarks: weekMarks.marks,
    reloadJobs: supabaseOps.loadJobs,
  });

  // Dropping a Multitrack PDF only ever gets as far as the preview screen.
  // The write lives behind that modal's Import button, so there is no path
  // from picking a file to changing job data without Trevor seeing the counts.
  const handlePdfUpload = useCallback(async (file) => {
    const plan = await jobOps.preparePdfImport(file);
    if (plan) setPdfPlan(plan);
  }, [jobOps]);

  // Wrapper for handleMarkPieceDone that includes the invoicing callback
  const handleMarkPieceDoneWithInvoicing = useCallback((parentJobId, childJobId, pieceDone) => {
    jobOps.handleMarkPieceDone(parentJobId, childJobId, pieceDone, handleAllPiecesDone);
  }, [jobOps, handleAllPiecesDone]);

  // A split-piece orphan (item.parentId set — surfaced by the jobsMaster/
  // jobsState union-join when its parent's bench/desc changed and no longer
  // regenerates this exact child id) has no live meaning once resolved
  // either way. Resolving the review item alone used to leave its jobsState
  // doc behind indefinitely — if the parent's bench ever happened to
  // regenerate this same child id again later, that stale doc could get
  // silently re-claimed as if it were current. Deleting it on resolution
  // closes that off for good instead of just dismissing the notification.
  function cleanupResolvedOrphan(item) {
    if (item.parentId && isSupabaseConfigured()) {
      justSavedAt.current = Date.now();
      deleteJob(item.id);
    }
  }

  const handleRevenueReviewDone = useCallback((item, amount) => {
    jobOps.handleMarkDone(item, amount);
    resolvePendingRevenueReviewItem(item.id);
    cleanupResolvedOrphan(item);
  }, [jobOps, resolvePendingRevenueReviewItem]);

  const handleRevenueReviewCancelled = useCallback((item, note) => {
    addChangelog(`#${item.job ?? item.id} ${item.mfr ?? ''} ${item.model ?? ''} — cancelled${note ? `: ${note}` : ''}`);
    resolvePendingRevenueReviewItem(item.id);
    cleanupResolvedOrphan(item);
  }, [addChangelog, resolvePendingRevenueReviewItem]);

  // Deep-link: ?job=XXXX opens that job's drawer on load
  const deepLinkJobNum = useRef(new URLSearchParams(window.location.search).get('job'));
  const deepLinkApplied = useRef(false);
  useEffect(() => {
    if (deepLinkApplied.current || !deepLinkJobNum.current || jobs.length === 0) return;
    const found = jobs.find(j => String(j.job) === deepLinkJobNum.current || j.id === deepLinkJobNum.current);
    if (found) {
      deepLinkApplied.current = true;
      setEditingJob(found);
      setSidebarOpen(true);
    }
  }, [jobs]);

  // --- "Parts may have arrived" banner ---
  //
  // Worked out from the jobs on screen and the dismissed list, not remembered
  // from the import that raised it. That is deliberate: after a page reload
  // there is no import result left to remember, only the jobs and the list. One
  // piece of stored state gives both "survives a reload" and "don't nag me
  // twice about the same job" without two flags that could disagree.
  const partsArrivedNotice = noticeJobs(jobs, partsArrivedDismissed);

  // Drop dismissals that have nothing left to suppress. This is the mechanism
  // behind "a job that re-blocks and later comes free notifies again" — the
  // dismissal goes away the moment Multitrack puts the job back on Waiting, so
  // the next arrival is news again.
  //
  // Guarded on settingsReady and a non-empty board: before the first snapshot
  // lands, `jobs` is [] and EVERY dismissal would look stale. Pruning then
  // would wipe the list on every page load and re-nag him about everything.
  useEffect(() => {
    if (!settingsReady || jobs.length === 0) return;
    const pruned = pruneDismissed(partsArrivedDismissed, jobs);
    // pruneDismissed returns the same array instance when nothing was dropped,
    // so this cannot loop or write on every render.
    if (pruned !== partsArrivedDismissed) setPartsArrivedDismissed(pruned);
  }, [jobs, partsArrivedDismissed, setPartsArrivedDismissed, settingsReady]);

  const handleDismissPartsArrived = useCallback(() => {
    setPartsArrivedDismissed(dismissAll(jobs, partsArrivedDismissed));
  }, [jobs, partsArrivedDismissed, setPartsArrivedDismissed]);

  // Same jump as the ?job= deep link: open the drawer on that job.
  const handleOpenNoticeJob = useCallback((job) => {
    setEditingJob(job);
    setSidebarOpen(true);
  }, []);

  // Auto-close focus mode once all split cards are scheduled
  useEffect(() => {
    if (!highlightedJobId) return;
    const subtasks = jobs.filter(j => j.parentId === highlightedJobId);
    if (subtasks.length > 0 && subtasks.every(j => j.scheduled)) {
      setHighlightedJobId(null);
      setSidebarOpen(false);
    }
  }, [jobs, highlightedJobId]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Build scheduled job map for CalendarGrid
  const scheduledJobObjects = {};
  Object.entries(scheduledSlots).forEach(([key, jobId]) => {
    const job = jobs.find(j => j.id === jobId);
    if (job) scheduledJobObjects[key] = job;
  });
  // Merge in ad-hoc maintenance tasks (never touch `jobs`/`scheduledSlots` —
  // kept in their own store so CSV drift-detection can't see them).
  adHocTasks.forEach(task => {
    const pseudoJob = {
      id: task.id, job: null, mfr: 'Maintenance', model: task.text,
      bench: 'Admin', hours: task.hours, desc: task.text, customer: '',
      calendarSlot: task.calendarSlot, isAdHoc: true, done: false,
    };
    task.slotKeys.forEach(k => { if (!scheduledJobObjects[k]) scheduledJobObjects[k] = pseudoJob; });
  });

  // Attempt to schedule a bujo note as an ad-hoc calendar task. Returns
  // { ok, reason } — DailyLogPage shows the reason inline on failure.
  const handleScheduleAdHocNote = useCallback((text, date, hour, minute, hours) => {
    const result = scheduleAdHocTask({
      text, date, hour, minute, hours,
      occupiedKeys: new Set(Object.keys(scheduledSlotsRef.current)),
    });
    if (result.ok) {
      addBullet(text, null, {
        isAdHoc: true, hoursRange: hours,
        scheduledDateKey: localDateKey(date), hour, minute,
      });
    }
    return result;
  }, [scheduleAdHocTask, addBullet]);

  const syncColors = { idle: '#64748b', syncing: '#fbbf24', synced: '#22c55e', error: '#ef4444' };
  const syncLabels = { idle: 'Sync', syncing: 'Syncing…', synced: 'Synced ✓', error: 'Sync Error' };

  // No page flag set means the Board is what the body is rendering. Kept in step
  // with the page chain below — a new page needs adding here too, or the Board
  // button will read as lit while that page is open.
  const onBoard = !showParkingLot && !showJobsSheet && !showJobs && !showProjects
    && !showPartsToOrder && !showParts && !showHelp && !showSettings && !showBench
    && !showWeekPage && !showDayPage;

  // localDateKey, not toISOString() — see useJobs.js handleMarkDone for why
  // the UTC conversion drifts a day off local date for NZ timezones.
  const currentWeekKey = weekDays[0] ? localDateKey(weekDays[0]) : undefined;
  const weekRevenueRecords = completedJobs.filter(r => r.weekKey === currentWeekKey);
  const weekRevenue = weekRevenueRecords.reduce((s, r) => s + (Number(r.invoiceAmount) || 0), 0);
  const revenueRatio = weeklyTarget > 0 ? weekRevenue / weeklyTarget : 0;
  const revenueColor = revenueRatio >= 0.8 ? '#4ade80' : revenueRatio >= 0.5 ? '#fbbf24' : '#f87171';

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={scheduler.onDragStart}
      onDragEnd={(e) => scheduler.onDragEnd(e, dragMode)}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
        {/* Header */}
        <header style={{
          padding: '10px 20px', background: '#1e293b', borderBottom: '1px solid #334155',
          display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0,
          overflowX: 'auto',
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

          <div style={{ textAlign: 'center', lineHeight: 1.3, flexShrink: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>
              <span
                ref={revenueTriggerRef}
                style={{ color: revenueColor, cursor: 'pointer' }}
                title="Click to see invoices making up this total"
                onClick={() => setShowRevenueBreakdown(v => !v)}
              >${weekRevenue.toLocaleString()}</span>
              <span style={{ color: '#334155' }}> / </span>
              <span
                style={{ color: '#475569', cursor: 'pointer' }}
                title="Click to change weekly target"
                onClick={() => {
                  const v = window.prompt('Weekly revenue target ($):', weeklyTarget);
                  // setWeeklyTarget saves to the shared store itself. The
                  // localStorage write that used to sit here is gone from all
                  // three of these places on purpose — leaving even one behind
                  // would mean the target lived in two stores at once.
                  if (v !== null && !isNaN(Number(v))) setWeeklyTarget(Number(v));
                }}
              >${weeklyTarget.toLocaleString()}</span>
            </div>
            <div style={{ fontSize: 9, color: '#334155', textTransform: 'uppercase', letterSpacing: '.08em' }}>week revenue</div>
            {showRevenueBreakdown && (
              <RevenueBreakdown records={weekRevenueRecords} anchorRef={revenueTriggerRef} onClose={() => setShowRevenueBreakdown(false)} />
            )}
          </div>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <button
              onClick={() => setWeekDays(getWeekDays(new Date(weekDays[0].getTime() - 7 * 86400000)))}
              style={{ background: 'none', border: '1px solid #334155', borderRadius: 6, color: '#94a3b8', fontSize: 16, width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >‹</button>
            <span style={{ fontSize: 12, color: '#94a3b8', minWidth: 160, textAlign: 'center' }}>{formatDateRange(weekDays)}</span>
            <button
              onClick={() => setWeekDays(getWeekDays(new Date(weekDays[0].getTime() + 7 * 86400000)))}
              style={{ background: 'none', border: '1px solid #334155', borderRadius: 6, color: '#94a3b8', fontSize: 16, width: 28, height: 28, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >›</button>
            <button
              onClick={() => setWeekDays(getWeekDays())}
              style={{ background: 'none', border: '1px solid #2563eb', borderRadius: 6, color: '#60a5fa', fontSize: 11, fontWeight: 600, padding: '0 8px', height: 28, cursor: 'pointer' }}
            >Today</button>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div title={gcal.signedIn ? 'Calendar connected' : 'Calendar disconnected'} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%',
                background: syncColors[gcal.syncStatus],
                boxShadow: gcal.syncStatus === 'synced' ? '0 0 6px #22c55e' : 'none',
              }} />
            </div>

            {!gcal.signedIn ? (
              <button
                onClick={gcal.handleSignIn}
                style={{
                  padding: '7px 14px', borderRadius: 6, border: '1px solid #1d4ed8',
                  background: '#1e3a8a', color: '#bfdbfe', fontSize: 12, fontWeight: 700,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Connect Google
              </button>
            ) : (
              <button
                onClick={gcal.handleSignOut}
                title="Disconnect Google Calendar"
                style={{
                  padding: '7px 14px', borderRadius: 6, border: '1px solid #334155',
                  background: '#1e293b', color: '#4ade80', fontSize: 12, fontWeight: 700,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Google ✓
              </button>
            )}

            <button
              onClick={gcal.previewSync}
              style={{
                padding: '7px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
                background: '#166534', color: '#bbf7d0', fontSize: 12, fontWeight: 700,
                opacity: gcal.syncStatus === 'syncing' ? 0.7 : 1,
              }}
            >
              {syncLabels[gcal.syncStatus]}
            </button>

            {/* The week page: what actually happened at the bench this week,
                one line per job. Marking it is a record, not a booking. Sits
                ahead of the day/week calendar toggle — it's the page Trevor
                starts from now, so it shouldn't be hunted for further along. */}
            <button
              onClick={() => selectPage('weekPage')}
              style={{
                padding: '7px 14px', borderRadius: 6, border: `1px solid ${showWeekPage ? '#0369a1' : '#334155'}`,
                background: showWeekPage ? '#0c4a6e' : '#1e293b',
                color: showWeekPage ? '#7dd3fc' : '#94a3b8',
                fontSize: 12, cursor: 'pointer', fontWeight: showWeekPage ? 700 : 400,
              }}
            >
              W Log
            </button>

            {/* The Daily Log. On a desktop this shows the same two-page spread
                as the pill beside it, opened on the day rather than the week;
                on a phone it's the day on its own. Short label because the pill
                row has no room for "Daily Log". */}
            <button
              onClick={() => selectPage('dayPage')}
              style={{
                padding: '7px 14px', borderRadius: 6, border: `1px solid ${showDayPage ? '#0369a1' : '#334155'}`,
                background: showDayPage ? '#0c4a6e' : '#1e293b',
                color: showDayPage ? '#7dd3fc' : '#94a3b8',
                fontSize: 12, cursor: 'pointer', fontWeight: showDayPage ? 700 : 400,
              }}
            >
              D Log
            </button>

            <button
              onClick={() => setShowWeekView(w => !w)}
              style={{
                padding: '7px 14px', borderRadius: 6, border: `1px solid ${showWeekView ? '#065f46' : '#334155'}`,
                background: showWeekView ? '#022c22' : '#1e293b',
                color: showWeekView ? '#6ee7b7' : '#94a3b8',
                fontSize: 12, cursor: 'pointer', fontWeight: showWeekView ? 700 : 400,
              }}
            >
              {/* The view you are looking at, not the one the click would switch
                  to — reading "Week View" while looking at a single day was
                  backwards. */}
              {showWeekView ? 'Week View' : 'Day View'}
            </button>

            {/* The Board is a page selection like any other, it just happens to
                be the one that renders when no page flag is set. Without this
                button the only way back was clicking the lit-up page button
                again, which made every page button a toggle. */}
            <button
              onClick={() => selectPage(null)}
              style={{
                padding: '7px 14px', borderRadius: 6, border: `1px solid ${onBoard ? '#0369a1' : '#334155'}`,
                background: onBoard ? '#0c4a6e' : '#1e293b',
                color: onBoard ? '#7dd3fc' : '#94a3b8',
                fontSize: 12, cursor: 'pointer', fontWeight: onBoard ? 700 : 400,
              }}
            >
              Board
            </button>

            {isMobile && (
              <button
                onClick={() => selectPage('jobs')}
                style={{
                  padding: '7px 14px', borderRadius: 6, border: `1px solid ${showJobs ? '#0369a1' : '#334155'}`,
                  background: showJobs ? '#0c4a6e' : '#1e293b',
                  color: showJobs ? '#7dd3fc' : '#94a3b8',
                  fontSize: 12, cursor: 'pointer', fontWeight: showJobs ? 700 : 400,
                }}
              >
                Jobs
              </button>
            )}

            <button
              onClick={() => selectPage('jobsSheet')}
              style={{
                padding: '7px 14px', borderRadius: 6, border: `1px solid ${showJobsSheet ? '#4f46e5' : '#334155'}`,
                background: showJobsSheet ? '#1e1b4b' : '#1e293b',
                color: showJobsSheet ? '#a5b4fc' : '#94a3b8',
                fontSize: 12, cursor: 'pointer', fontWeight: showJobsSheet ? 700 : 400,
              }}
            >
              Sheet
            </button>

            {/* Sits beside the calendar rather than replacing anything: the
                calendar asks you to promise when, the Bench board only asks
                what's stopping a card. */}
            <button
              onClick={() => selectPage('bench')}
              style={{
                padding: '7px 14px', borderRadius: 6, border: `1px solid ${showBench ? '#0369a1' : '#334155'}`,
                background: showBench ? '#0c4a6e' : '#1e293b',
                color: showBench ? '#7dd3fc' : '#94a3b8',
                fontSize: 12, cursor: 'pointer', fontWeight: showBench ? 700 : 400,
              }}
            >
              Bench
            </button>

            <button
              onClick={() => selectPage('projects')}
              style={{
                padding: '7px 14px', borderRadius: 6, border: `1px solid ${showProjects ? '#4f46e5' : '#334155'}`,
                background: showProjects ? '#1e1b4b' : '#1e293b',
                color: showProjects ? '#a5b4fc' : '#94a3b8',
                fontSize: 12, cursor: 'pointer', fontWeight: showProjects ? 700 : 400,
              }}
            >
              Projects
            </button>

            {/* Deliberately not sitting beside the "Parts" button further down:
                that one opens the PartsBox inventory drawer, this one opens the
                parts-to-order chase list. Two different things. */}
            <button
              onClick={() => selectPage('partsToOrder')}
              style={{
                padding: '7px 14px', borderRadius: 6, border: `1px solid ${showPartsToOrder ? '#b45309' : '#334155'}`,
                background: showPartsToOrder ? '#451a03' : '#1e293b',
                color: showPartsToOrder ? '#fcd34d' : '#94a3b8',
                fontSize: 12, cursor: 'pointer', fontWeight: showPartsToOrder ? 700 : 400,
              }}
            >
              Parts to Order
            </button>

            <button
              onClick={() => selectPage('parts')}
              style={{
                padding: '7px 14px', borderRadius: 6, border: '1px solid #334155',
                background: showParts ? '#1e3a5f' : '#1e293b',
                color: showParts ? '#93c5fd' : '#94a3b8',
                fontSize: 12, cursor: 'pointer',
              }}
            >
              Parts
            </button>

            <button
              onClick={() => selectPage('help')}
              style={{
                padding: '7px 12px', borderRadius: 6, border: '1px solid #334155',
                background: showHelp ? '#1e3a5f' : '#1e293b',
                color: showHelp ? '#93c5fd' : '#94a3b8',
                fontSize: 13, cursor: 'pointer', fontWeight: 600,
              }}
            >
              ?
            </button>

            <button
              onClick={() => selectPage('settings')}
              style={{
                padding: '7px 14px', borderRadius: 6, border: `1px solid ${showSettings ? '#4f46e5' : '#334155'}`,
                background: showSettings ? '#1e1b4b' : '#1e293b',
                color: showSettings ? '#a5b4fc' : '#94a3b8',
                fontSize: 12, cursor: 'pointer', fontWeight: showSettings ? 700 : 400,
              }}
            >
              ⚙ Settings
            </button>
          </div>
        </header>

        {/* Body */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {showParkingLot ? (
            <ParkingLotPage onBack={() => {
              setShowParkingLot(false);
              window.history.replaceState(null, '', '#');
            }} />
          ) : showJobsSheet ? (
            <JobsSheetPage
              jobs={jobs}
              isMobile={isMobile}
              onBack={() => setShowJobsSheet(false)}
              onSaved={handleJobsSheetSaved}
            />
          ) : showJobs ? (
            <JobsPage
              jobs={jobs}
              onJobClick={job => { setEditingJob(job); }}
            />
          ) : (showWeekPage || showDayPage) ? (
            /* The two logs are one spread, like the paper journal: week on the
               left, day on the right. On a desktop both are always shown and
               the pill only decides which one was asked for; on a phone there
               is no room for two, so the pill picks one. */
            <div style={{
              flex: 1, display: 'flex', flexDirection: 'row',
              overflow: 'hidden', minHeight: 0,
            }}>
              {(!isMobile || showWeekPage) && (
                <BenchWeekPage
                  jobs={jobs}
                  weekDays={weekDays}
                  marks={weekMarks.marks}
                  ready={weekMarks.ready}
                  saveError={weekMarks.saveError}
                  setMark={weekMarks.setMark}
                  clearJobKeys={weekMarks.clearJobKeys}
                  isMobile={isMobile}
                  showToast={showToast}
                  /* Closing a job off opens the existing invoice prompt. This
                     is the only place the Daily/Weekly Log touches job state,
                     and it goes through the same call the rest of the app
                     already uses — there is no second way to finish a job. */
                  onCloseJob={(job) => setPomoJob(job)}
                  /* Booking a job onto a day clears any "keep it off this day"
                     note the Daily Log left there, so a removal can never
                     outlive the booking that follows it. Only 'hidden' items
                     go — a job put on the day by hand is left alone. */
                  onBookedOnDay={(jobId, dateKey) => {
                    const onDay = dayMarks.dayItems?.[dateKey] || {};
                    Object.entries(onDay).forEach(([itemId, v]) => {
                      if (v?.kind !== 'hidden') return;
                      if (weekCellJobId(itemId, jobs) !== String(jobId)) return;
                      dayMarks.removeItem(dateKey, itemId);
                    });
                  }}
                />
              )}
              {!isMobile && (
                <div style={{ width: 1, background: '#1e293b', flexShrink: 0 }} />
              )}
              {(!isMobile || showDayPage) && (
                <DailyLogPanel
                  jobs={jobs}
                  weekDays={weekDays}
                  marks={weekMarks.marks}
                  dayItems={dayMarks.dayItems}
                  ready={dayMarks.ready}
                  saveError={dayMarks.saveError}
                  addItem={dayMarks.addItem}
                  removeItem={dayMarks.removeItem}
                  /* The Weekly Log half of a mark: its own save gate, its own
                     writer. Kept separate from dayMarks.ready above — they are
                     two tables with two failure counters, and one flag standing
                     for both would let a mark save into one log only. */
                  weekReady={weekMarks.ready}
                  setWeekMark={weekMarks.setMark}
                  /* Raw handleMarkPieceDone, NOT the ...WithInvoicing wrapper:
                     a cross in the Daily Log means "this piece is finished,
                     waiting on the Weekly Log's closing ×". It must never raise
                     the invoice prompt. That stays Trevor's tap in the Weekly
                     Log's last column, and the only thing that invoices. */
                  onMarkPieceDone={jobOps.handleMarkPieceDone}
                  isMobile={isMobile}
                  showToast={showToast}
                />
              )}
            </div>
          ) : showBench ? (
            <BenchBoardPage jobs={jobs} />
          ) : showProjects ? (
            <WorkshopProjectsPage jobs={jobs} />
          ) : showPartsToOrder ? (
            <PartsToOrderPage
              suppliers={suppliers}
              onCheckStock={term => {
                setPartsDrawerSearch(term || '');
                selectPage('parts');
              }}
            />
          ) : showParts ? (
            // Keyed on the seeded search so arriving from "check stock" with a
            // different part remounts the page and re-runs its initial search,
            // rather than keeping whatever was typed last time.
            <PartsDrawer key={partsDrawerSearch} initialSearch={partsDrawerSearch} />
          ) : showHelp ? (
            <HelpDrawer />
          ) : showSettings ? (
            <SettingsModal
              saveError={settingsSaveError}
              suppliers={suppliers}
              supplierError={supplierError}
              onAddSupplier={addSupplier}
              onRenameSupplier={renameSupplier}
              onRemoveSupplier={removeSupplier}
              benchKeywords={benchKeywords}
              defaultBenchKeywords={DEFAULT_BENCH_KEYWORDS}
              onBenchKeywordsChange={requestBenchKeywordsChange}
              hourlyRate={hourlyRate}
              onHourlyRateChange={setHourlyRate}
              weeklyRevenueTarget={weeklyTarget}
              onWeeklyTargetChange={setWeeklyTarget}
              benchHours={benchHours}
              onBenchHoursChange={setBenchHours}
              onOpenSummary={() => { setShowSettings(false); setShowSummary(true); }}
              onOpenParkingLot={() => {
                setShowSettings(false);
                setShowParkingLot(true);
                window.history.replaceState(null, '', '#parking-lot');
              }}
            />
          ) : showWeekView ? (
            <>
              <CalendarGrid
                weekDays={weekDays}
                scheduledJobs={scheduledJobObjects}
                externalEvents={gcal.externalEvents}
                isDragging={scheduler.isDragging}
                activeJobId={scheduler.activeJob?.id ?? null}
                onJobClick={jobOps.handleOpenPomo}
                onRemoveAdHocTask={removeAdHocTask}
                onMarkPieceDone={handleMarkPieceDoneWithInvoicing}
                jobs={jobs}
              />
              <Sidebar
                jobs={jobs}
                dragMode={dragMode}
                onDragModeChange={setDragMode}
                onPdfUpload={handlePdfUpload}
                highlightedJobId={highlightedJobId}
                onClearHighlight={() => { setHighlightedJobId(null); setSidebarOpen(false); }}
                onJobClick={setEditingJob}
                isOpen={sidebarOpen}
                onToggle={() => setSidebarOpen(o => !o)}
                lastSyncedAt={lastSyncedAt}
                focusList={focusList}
                onToggleFocus={toggleFocusJob}
              />
            </>
          ) : (
            <DailyLogPage
              jobs={jobs}
              scheduledSlots={scheduledSlots}
              weekDays={weekDays}
              displayedDate={displayedDate}
              onDisplayedDateChange={setDisplayedDate}
              scheduledJobs={scheduledJobObjects}
              externalEvents={gcal.externalEvents}
              isDragging={scheduler.isDragging}
              activeJobId={scheduler.activeJob?.id ?? null}
              onCalendarJobClick={jobOps.handleOpenPomo}
              onRemoveAdHocTask={removeAdHocTask}
              onMarkPieceDone={handleMarkPieceDoneWithInvoicing}
              onScheduleAdHocNote={handleScheduleAdHocNote}
              dragMode={dragMode}
              onDragModeChange={setDragMode}
              onPdfUpload={handlePdfUpload}
              highlightedJobId={highlightedJobId}
              onClearHighlight={() => { setHighlightedJobId(null); setSidebarOpen(false); }}
              onJobClick={setEditingJob}
              lastSyncedAt={lastSyncedAt}
              todayLog={todayLog}
              onAddBullet={addBullet}
              onToggleDone={toggleDone}
              onRemoveBullet={removeBullet}
              onAddChecklistItem={addChecklistItem}
              onToggleChecklistItem={toggleChecklistItem}
              deferredItems={deferredItems}
              onPullBackIn={pullBackIn}
              onBulletJobClick={jobId => {
                const j = jobs.find(job => job.id === jobId);
                if (j) setEditingJob(j);
              }}
              onRequestCloseDay={() => setShowCloseDay(true)}
              focusList={focusList}
              onToggleFocus={toggleFocusJob}
              onAutoCarryForward={handleAutoCarryForward}
              catchUpNeeded={catchUpNeeded}
              onRequestCatchUp={() => setShowCatchUp(true)}
              onSetBumpReason={handleSetBumpReason}
            />
          )}
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {scheduler.activeJob ? (
          <div style={{ opacity: 0.9, transform: 'rotate(2deg)', pointerEvents: 'none' }}>
            <div style={{
              background: benchColors(scheduler.activeJob.bench).bg,
              border: `2px solid ${dragMode === 'urgent' ? '#ef4444' : benchColors(scheduler.activeJob.bench).border}`,
              borderRadius: 8, padding: '8px 12px', minWidth: 180, maxWidth: 240,
              boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#e2e8f0' }}>#{scheduler.activeJob.job}</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>{scheduler.activeJob.mfr} {scheduler.activeJob.model}</div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                {scheduler.activeJob.bench} · {scheduler.activeJob.hours}h
                {dragMode === 'urgent' && <span style={{ color: '#ef4444', marginLeft: 6 }}>🚨 URGENT</span>}
              </div>
            </div>
          </div>
        ) : null}
      </DragOverlay>

      <ConflictBanner
        events={conflictEvents}
        onDismiss={() => {
          setConflictEvents([]);
          if (isSupabaseConfigured()) clearConflictLog();
        }}
      />

      {/* Sits directly under the conflict banner, above the revenue review, and
          is one line high — which is why the revenue banner below can offset by
          a flat 44 rather than measuring anything. */}
      <PartsArrivedBanner
        jobs={partsArrivedNotice}
        onJobClick={handleOpenNoticeJob}
        onDismiss={handleDismissPartsArrived}
        top={conflictEvents.length > 0 ? 56 + 46 + conflictEvents.length * 20 : 56}
      />

      <RevenueReviewBanner
        items={pendingRevenueReview}
        onDone={handleRevenueReviewDone}
        onCancelled={handleRevenueReviewCancelled}
        top={(conflictEvents.length > 0 ? 56 + 46 + conflictEvents.length * 20 : 56)
          + (partsArrivedNotice.length > 0 ? 44 : 0)}
      />

      <Toast message={toast} onDismiss={() => setToast('')} />

      {editingJob && (
        isMobile ? (
          <MobileJobSheet
            job={editingJob}
            jobs={jobs}
            weekDays={schedulerWeekDays}
            onSchedule={scheduler.handleMobileSchedule}
            onSave={jobOps.handleSaveDrawer}
            onClose={() => setEditingJob(null)}
            onRemove={scheduler.unscheduleJob}
            isFocused={focusList.some(id => String(id) === String(editingJob.id))}
            onToggleFocus={() => toggleFocusJob(editingJob.id)}
          />
        ) : (
          <JobDrawer
            job={editingJob}
            jobs={jobs}
            onClose={() => setEditingJob(null)}
            onSave={jobOps.handleSaveDrawer}
            weekDays={schedulerWeekDays}
            onSchedule={scheduler.handleMobileSchedule}
            onRemove={scheduler.unscheduleJob}
            isFocused={focusList.some(id => String(id) === String(editingJob.id))}
            onToggleFocus={() => toggleFocusJob(editingJob.id)}
          />
        )
      )}

      {pomoJob && (() => {
        const currentJob = jobs.find(j => j.id === pomoJob.id) || pomoJob;
        return (
          <PomoDrawer
            job={currentJob}
            parentJob={currentJob.parentId ? jobs.find(j => j.id === currentJob.parentId) : null}
            onClose={() => setPomoJob(null)}
            onLogSession={session => jobOps.handleLogPomoSession(currentJob.id, session)}
            onMarkDone={jobOps.handleMarkDone}
            onMarkPieceDone={handleMarkPieceDoneWithInvoicing}
            onRemove={scheduler.unscheduleJob}
          />
        );
      })()}

      {showSummary && (
        <WeeklySummaryModal
          jobs={jobs}
          scheduledSlots={scheduledSlots}
          weekDays={weekDays}
          invoicedRevenue={weekRevenue}
          weeklyRevenueTarget={weeklyTarget}
          onTargetChange={setWeeklyTarget}
          onClose={() => setShowSummary(false)}
        />
      )}

      {showCloseDay && (
        <CloseDayModal
          bullets={(todayLog?.bullets || []).filter(b => !b.done)}
          jobs={jobs}
          completedJobs={completedJobs}
          onJobComplete={(job, amount) => jobOps.handleMarkDone(job, amount)}
          onMarkPieceDone={handleMarkPieceDoneWithInvoicing}
          onClose={migrations => {
            closeDay(migrations);
            setShowCloseDay(false);
          }}
        />
      )}

      {showCatchUp && catchUpNeeded && (
        <CatchUpInterview
          days={catchUpNeeded.days}
          logs={dailyLogs}
          jobs={jobs}
          completedJobs={completedJobs}
          onJobComplete={(job, amount) => jobOps.handleMarkDone(job, amount)}
          onClose={resolutions => {
            if (resolutions) resolveStaleDays(resolutions);
            setShowCatchUp(false);
          }}
        />
      )}

      {keywordChange && (
        <KeywordChangePreviewModal
          moves={keywordChange.moves}
          onConfirm={confirmBenchKeywordsChange}
          onCancel={() => setKeywordChange(null)}
        />
      )}

      {bumpPrompt && (
        <BumpReasonModal
          job={bumpPrompt.job}
          fromSlot={bumpPrompt.fromSlot}
          toSlot={bumpPrompt.toSlot}
          onResolve={({ reason, reasonText }) => {
            const entry = {
              ts: Date.now(),
              reason,
              reasonText,
              fromSlot: bumpPrompt.fromSlot,
              toSlot: bumpPrompt.toSlot,
              source: 'manual',
            };
            setJobs(prev => prev.map(j =>
              j.id === bumpPrompt.job.id ? { ...j, bumpHistory: [...(j.bumpHistory || []), entry] } : j
            ));
            if (isSupabaseConfigured()) {
              appendConflictLog([{
                ts: entry.ts,
                jobNum: bumpPrompt.job.job,
                mfr: bumpPrompt.job.mfr,
                model: bumpPrompt.job.model,
                oldSlot: bumpPrompt.fromSlot,
                newSlot: bumpPrompt.toSlot,
                reason,
                reasonText,
              }]);
            }
            setBumpPrompt(null);
          }}
        />
      )}

      {gcal.syncPlan && (
        <SyncPreviewModal
          plan={gcal.syncPlan}
          onConfirm={gcal.confirmSync}
          onCancel={gcal.cancelSync}
        />
      )}

      {pdfPlan && (
        <PdfImportPreviewModal
          plan={pdfPlan}
          busy={pdfBusy}
          onConfirm={async () => {
            setPdfBusy(true);
            try {
              await jobOps.commitPdfImport(pdfPlan);
            } finally {
              setPdfBusy(false);
              setPdfPlan(null);
            }
          }}
          onCancel={() => setPdfPlan(null)}
        />
      )}
    </DndContext>
  );
}
