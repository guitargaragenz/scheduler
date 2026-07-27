export const RAW_CSV = `Job,Mfr,Model,Status,Days,Tag,Hours,Action,Desc,VB,BL,Customer`;

export const DEFAULT_BENCH_KEYWORDS = {
  Fretwork:    ['refret', 'fret level', 'fret dress', 'fret polish'],
  Luthier:     ['bridge(?!\\s*pup|\\s*pickup)', '\\bcrack\\b', 'brace', '\\breset\\b', '\\btop\\b', 'lower bout', 'inlay', 'binding', 'refinish', 'restoration', '\\bsplit\\b', 'lifting', 'lifted', 'broken neck', 'broken headstock', 'broken brace', 'broken bridge'],
  Electronics: ['power', 'output', 'input', 'tube', 'fuse', 'amp', 'recap', 'blown', 'doa', 'caps', 'opamp', 'voltage', 'pcb', 'speaker', 'voice chip', 'calibrate', 'impedance', 'mute', 'phantom', 'preamp', 'mains', 'dc power', 'wire feed', 'keyboard', '\\bkeys?\\b', 'synth', 'mixer', 'console', 'interface', 'desk', 'rack', 'valve', '\\bhead\\b', 'combo', 'bias', 'jack', 'pot', 'wiring', 'scratchy'],
  Setup:       ['setup', 'stp', 'intonation', 'pups', 'pickup', 'wiring', '\\bstring\\b', 'strings', 'restring', 'switch', 'trem', 'nut', 'saddle', 'string height'],
};

// `backlog` is the 7th positional parameter (settled at council 2026-07-27) and
// is the raw boolean, not 'Y'/'N'. It exists only so this function can ask
// blockedPile the question properly: On Hold + BL=Y + GTS ("parts arrived, good
// to start") is NOT blocked, and without the backlog flag we cannot tell it
// apart from a genuinely-on-hold job.
//
// No live job matches that combination today (checked 2026-07-27 — job 1175 was
// thought to, but its GTS turned out to be a stale CSV value; it is really CI).
// Keep the parameter anyway: without it, the first real ready-to-start job would
// lose its bench here while Sidebar.jsx simultaneously listed it under READY TO
// START. Two screens, one job, opposite answers — that is the bug being closed.
export function inferBench(desc = '', status = '', action = '', model = '', mfr = '', keywords = DEFAULT_BENCH_KEYWORDS, backlog = false) {
  // Blocked work gets NO bench. Deliberately delegated to blockedPile rather
  // than re-testing the status strings here: a second copy of the rule is how
  // jobs 393 and 693 (Booked In + INC) ended up sitting in the Planning pile
  // while still carrying an Electronics bench from the manufacturer regexes
  // below. One rule, one function, every screen agrees.
  if (blockedPile({ status, action, backlog: backlog === true })) return null;

  const d = (desc + ' ' + model).toLowerCase();
  const m = mfr.toLowerCase();

  const kw = { ...DEFAULT_BENCH_KEYWORDS, ...keywords };
  const rx = bench => new RegExp(kw[bench].join('|'));

  if (rx('Fretwork').test(d)) return 'Fretwork';
  if (rx('Luthier').test(d)) return 'Luthier';
  // "setup", "stp", or "restring" take priority over Electronics keywords like "pot" —
  // the Setup split logic in createSubtasks will then separate the wiring component out
  if (/\bsetup\b|\bstp\b|\brestring\b/.test(d)) return 'Setup';
  if (rx('Electronics').test(d)) return 'Electronics';
  if (rx('Setup').test(d)) return 'Setup';

  if (/passport|pa\s*\d/.test(d)) return 'Electronics';
  if (/db tech|rcf|turbosound|allen|hughes|behringer|ampeg|roland|marshall|matchless|casio|yamaha|trident|m audio|dynaudio|peavey|mackie|qsc|crown|crest|electro.voice|jbl|bose|bossweld|subtle noise|beesneez/.test(m)) return 'Electronics';
  if (/fender|gibson|martin|taylor|maton|cole clark|takamine|aria|cort|hofner|solar|samick|suzuki|alegria|ibanez|epiphone|gretsch|rickenbacker|guild|larrivee|seagull/.test(m)) return 'Setup';

  // Couldn't classify it. Returns null, not 'Admin' — Admin is a real bench for
  // real admin work, not the bin for "nothing else matched". An unclassified
  // job gets the amber "needs a bench" chip instead, so it's visible and
  // fixable rather than silently mis-filed.
  return null;
}

// Job age from the CSV's `Days` column. A blank cell means Multitrack does not
// know how old the job is — that is NOT the same as "zero days old", and the
// old `parseInt(obj.Days) || 0` collapsed the two into an identical `0`, so a
// guitar booked in this morning and a guitar of unknown age both read "0d".
// Blank (and any non-numeric junk) stays `null` so every downstream reader can
// tell "unknown" from "brand new" and render nothing rather than a wrong number.
export function parseDays(raw) {
  const s = (raw == null ? '' : String(raw)).trim();
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? null : n;
}

// A blank job age never overwrites an age we already know.
//
// Multitrack intermittently exports an empty `Days` cell for a job that
// definitely has an age (jobs 1708 and 1710 on the 2026-07-27 file). The CSV
// path is upsert-only, so without this a single bad export writes null over a
// real age and it is gone — MT won't send it again.
//
// Matched on job NUMBER, not id: the id of a top-level job is its job number,
// but matching on `job` says out loud that this is about the same physical
// guitar across two imports, not about row identity.
//
// A *changed* populated value still wins. This only defends against blanks —
// if MT says the job is now 300 days old, it is.
//
// Lives here rather than inside upsertJobsBatch because the batch cannot fix
// it: a Supabase array upsert sends the union of all rows' keys and NULL-fills
// any row missing one, so "just leave `days` off the blank rows" would write
// the nulls anyway. It has to be merged before the write, where both the
// incoming row and the current in-memory job are visible.
export function preserveKnownDays(parsedTopLevel = [], existingJobs = []) {
  const prevByJobNo = {};
  existingJobs.forEach(j => {
    if (j && !j.parentId && j.days != null) prevByJobNo[j.job] = j.days;
  });
  return parsedTopLevel.map(j => (
    j.days == null && prevByJobNo[j.job] != null
      ? { ...j, days: prevByJobNo[j.job] }
      : j
  ));
}

// Which quiet pile a blocked job belongs in, or null if it is workable today.
//
// SINGLE SOURCE OF TRUTH. Sidebar, JobsPage, JobShelf, CalendarGrid and
// inferBench all read this one function rather than each keeping its own copy
// of "is this job blocked" — four copies drifting apart is exactly how the
// current three-locked-sections sprawl happened, and it is what makes a job
// show up as blocked on one screen and workable on another.
//
// 'planning' is `INC` alone, deliberately status-independent (settled at
// council 2026-07-27). On the live data the only two INC jobs are 393 and 693,
// both `Booked In`, so gating on `Waiting + INC` as the spec originally said
// would have matched zero jobs and shipped an empty pile. INC is the action
// code MT uses to mean "Incubating" — the job is still turning over in
// Trevor's head, nowhere near planning or quoting yet — whatever the status
// column says, so a future `Active + INC` job leaving the active list is
// intended, not a regression.
//
// `readyToStart` (On Hold + BL=Y + GTS — parts arrived, good to start) is NOT
// blocked: it is the one On Hold case that is genuinely schedulable.
//
// On Hold wins over everything below it, including CI (action code) — Trevor
// paused the job on purpose, so it stays 'hold' even if the customer is also
// being chased (2026-07-27 council).
export function blockedPile(job) {
  if (!job) return null;
  const act = (job.action || '').trim().toUpperCase();
  if (act === 'INC') return 'planning';

  const status = job.status || '';
  const { readyToStart } = deriveJobStatusFlags(status, job.action, job.backlog === true);
  if (readyToStart) return null;

  if (status === 'On Hold') return 'hold';
  if (status === 'In Transit') return 'transit';
  if (status === 'Waiting Parts') return 'waiting';
  return null;
}

// Plain English for why a job isn't moving. Pure — no data access, no lookups,
// just the job row. Returns null for anything workable today.
//
// The fallback matters more than the table. Jobs 1268, 1679 and 1705 are all
// `Waiting` + `GTS`, which matches no row below, and a blocked job with no
// reason at all reads like a bug. "waiting — see Multitrack" is honest: the app
// knows it's stuck, doesn't know why, and points at the system that does.
export function blockedReason(job) {
  const pile = blockedPile(job);
  if (!pile) return null;

  const act = (job?.action || '').trim().toUpperCase();
  const status = job?.status || '';

  // CI (waiting on the customer) takes priority over the status column,
  // regardless of what status the job happens to carry. Job 1175 is
  // On Hold + CI — checking status === 'On Hold' first used to report
  // "on hold", which just restates the status column. "waiting on the
  // customer" tells Trevor who to chase, so CI is checked ahead of status.
  if (act === 'INC') return 'planning';
  if (act === 'CI') return 'waiting on the customer';
  if (status === 'In Transit') return 'in transit';
  if (status === 'On Hold') return 'on hold';
  return 'waiting — see Multitrack';
}

// A job the app couldn't classify: not blocked (blocked jobs have no bench on
// purpose), but no bench either. Drives the amber "needs a bench" chip.
export function needsBench(job) {
  if (!job) return false;
  if (job.bench) return false;
  return blockedPile(job) === null;
}

export function inferTag(h) {
  if (!h || h <= 0) return 'EZ';
  if (h <= 1.5) return 'EZ';
  if (h <= 3)   return 'T';
  if (h <= 5.5) return 'M';
  return 'H';
}

export function hoursRange(h) {
  if (!h || h <= 0) return '—';
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  return lo === hi ? String(h) : `${lo}-${hi}`;
}

// Status-derived flags shared by the CSV importer (parseCSV below) and any
// other reader that has to reconstruct them from a stored job row that only
// carries status/action/backlog (e.g. scripts/board_meeting_export.mjs,
// which reads Supabase rows rather than freshly-parsed CSV lines). Pulled out
// as its own function so both places derive readyToStart/awaiting/inTransit/
// schedulable from the exact same rule, rather than a second ad-hoc copy
// silently drifting from this one over time.
//
// `backlog` here is already a boolean (obj.BL === 'Y' at CSV-parse time, or
// the `bl` column read back as 'Y'/'N' from Supabase) — not the raw 'Y'/'N'
// string.
export function deriveJobStatusFlags(status, action, backlog) {
  const act = (action || '').trim().toUpperCase();
  // On Hold + BL=Y + GTS → graduated to schedulable (parts arrived / good to start)
  const readyToStart = status === 'On Hold' && backlog === true && act === 'GTS';
  // Waiting Parts + INC or CI → awaiting customer/incubating (visible but locked)
  const awaiting = status === 'Waiting Parts' && ['INC', 'CI'].includes(act);
  // In Transit → visible but locked
  const inTransit = status === 'In Transit';
  const schedulable = ['Active', 'Booked In'].includes(status) || readyToStart;
  return { readyToStart, awaiting, inTransit, schedulable };
}

export function createSubtasks(job, benchHours = {}) {
  const d = (job.desc || '').toLowerCase();

  // Default fixed hours — overridden by Settings benchHours
  const fixedLuthier  = benchHours.Luthier   || 1.5;
  const fixedSetup    = benchHours.Setup      || 1.5;
  const fixedFinish   = benchHours.Finishing  || 1.5;

  // ── Luthier bench ──────────────────────────────────────────────────────────
  if (job.bench === 'Luthier') {
    const hasSetup    = /\bsetup\b|\bstp\b|\brestring\b/.test(d);
    const hasFinish   = /refinish|\bfinish\b/.test(d);

    if (!hasSetup && !hasFinish) return null;

    const cards = [];
    let deduct = 0;
    if (hasSetup)  deduct += fixedSetup;
    if (hasFinish) deduct += fixedFinish;
    const luthierHours = Math.max(Math.round((job.hours - deduct) * 2) / 2, 0.5);

    cards.push({ ...job, id: `${job.id}-LU`, bench: 'Luthier',   hours: luthierHours, hoursRange: hoursRange(luthierHours), label: 'Luthier work', parentId: job.id, pieceDone: false });
    if (hasFinish) cards.push({ ...job, id: `${job.id}-FN`, bench: 'Finishing', hours: fixedFinish, hoursRange: hoursRange(fixedFinish), label: 'Finishing',    parentId: job.id, pieceDone: false });
    if (hasSetup)  cards.push({ ...job, id: `${job.id}-S`,  bench: 'Setup',     hours: fixedSetup,  hoursRange: hoursRange(fixedSetup),  label: 'Setup',        parentId: job.id, pieceDone: false });

    return cards.length >= 2 ? cards : null;
  }

  // ── Setup bench ────────────────────────────────────────────────────────────
  if (job.bench === 'Setup') {
    const hasWiring = /\bpickup\b|\bpups?\b|\bwiring\b|\bswitch\b|\bpot\b|\bjack\b|\bscratchy\b/.test(d);
    const hasSetup  = /\bsetup\b|\bstp\b|\brestring\b|\bstrings?\b|\bnut\b|\bsaddle\b|\bintonation\b|\bstring height\b|\btrem\b/.test(d);
    if (!hasWiring || !hasSetup) return null;
    const half = Math.max(Math.round(job.hours / 2 * 2) / 2, 0.5);
    return [
      { ...job, id: `${job.id}-ST`, bench: 'Setup',  hours: half, hoursRange: hoursRange(half), label: 'Setup',  parentId: job.id, pieceDone: false },
      { ...job, id: `${job.id}-WR`, bench: 'Wiring', hours: half, hoursRange: hoursRange(half), label: 'Wiring', parentId: job.id, pieceDone: false },
    ];
  }

  // ── Fretwork bench — additive card logic ───────────────────────────────────
  if (job.bench === 'Fretwork') {
    const hasRefret  = /refret/.test(d);
    const hasLevel   = !hasRefret && /fret level|fret dress|fret polish/.test(d);
    // Tightened: use specific phrases instead of bare 'broken', 'finish', 'top', 'split'
    const hasLuthier = /restoration|neck pocket|\bcrack\b|brace|\breset\b|binding|refinish|headstock|inlay|lower bout|\btop\b|bridge(?!\s*pup|\s*pickup)|lifting|lifted|broken neck|broken headstock|broken brace/.test(d);
    const hasSetup   = /\bsetup\b|\bstp\b|\brestring\b|\bstrings\b/.test(d);
    const hasWiring  = /\brewire\b|\bpickup\b|\bpups?\b|\bwiring\b|\bswitch\b|\bpot\b|\bjack\b/.test(d);

    if (!hasRefret && !hasLevel) return null;

    const fixedWiring = benchHours.Wiring || 1.5;
    const deduct = (hasLuthier ? fixedLuthier : 0) + (hasSetup ? fixedSetup : 0) + (hasWiring ? fixedWiring : 0);
    const fretworkHours = Math.max(job.hours - deduct, 1);

    const cards = [];

    if (hasRefret) {
      // 50/50 split between Refret and Level/Crown/Polish
      const half = Math.max(Math.round(fretworkHours / 2 * 2) / 2, 0.5);
      cards.push({ ...job, id: `${job.id}-R`,  bench: 'Fretwork', hours: half, hoursRange: hoursRange(half), label: 'Refret',                parentId: job.id, pieceDone: false });
      cards.push({ ...job, id: `${job.id}-LC`, bench: 'Fretwork', hours: half, hoursRange: hoursRange(half), label: 'Level, Crown & Polish', parentId: job.id, pieceDone: false });
    } else {
      cards.push({ ...job, id: `${job.id}-LC`, bench: 'Fretwork', hours: fretworkHours, hoursRange: hoursRange(fretworkHours), label: 'Level, Crown & Polish', parentId: job.id, pieceDone: false });
    }

    if (hasLuthier) cards.push({ ...job, id: `${job.id}-LU`, bench: 'Luthier',   hours: fixedLuthier, hoursRange: hoursRange(fixedLuthier), label: 'Luthier work',     parentId: job.id, pieceDone: false });
    if (hasSetup)   cards.push({ ...job, id: `${job.id}-SU`, bench: 'Setup',     hours: fixedSetup,   hoursRange: hoursRange(fixedSetup),   label: 'Setup / Restring', parentId: job.id, pieceDone: false });
    if (hasWiring)  cards.push({ ...job, id: `${job.id}-WR`, bench: 'Wiring',    hours: fixedWiring,  hoursRange: hoursRange(fixedWiring),  label: 'Wiring',           parentId: job.id, pieceDone: false });

    return cards.length >= 2 ? cards : null;
  }

  return null;
}

export function parseCSV(csvText, keywords = {}, benchHours = {}) {
  // Proper RFC-4180 parser: handles quoted fields with commas and embedded newlines
  // Lines starting with # are treated as comments (e.g. action key) and skipped
  const rows = [];
  let row = [], field = '', inQuote = false;
  const text = csvText.trim().split('\n').filter(l => !l.trimStart().startsWith('#')).join('\n');
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuote) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') { inQuote = false; }
      else { field += ch; }
    } else if (ch === '"') {
      inQuote = true;
    } else if (ch === ',') {
      row.push(field.trim()); field = '';
    } else if (ch === '\n') {
      row.push(field.trim()); rows.push(row); row = []; field = '';
    } else if (ch !== '\r') {
      field += ch;
    }
  }
  if (field || row.length) { row.push(field.trim()); rows.push(row); }
  if (rows.length < 2) return [];

  const headers = rows[0];
  const jobs = [];

  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i];
    if (cells.length < 2) continue;
    const obj = {};
    headers.forEach((h, idx) => { obj[h] = cells[idx] || ''; });

    const status = obj.Status || '';
    const hours  = parseFloat(obj.Hours) || 0;

    const { readyToStart, awaiting, inTransit, schedulable } =
      deriveJobStatusFlags(status, obj.Action, obj.BL === 'Y');

    const accepted = ['On Hold', 'Waiting Parts', 'To Be Inv', 'In Transit'];
    if (!schedulable && !accepted.includes(status)) continue;
    // Don't drop schedulable jobs just because hours aren't set yet — default to 1h
    const effectiveHours = (hours === 0 && schedulable) ? 1 : hours;

    const bench = inferBench(obj.Desc, status, obj.Action, obj.Model, obj.Mfr, keywords, obj.BL === 'Y');
    const baseJob = {
      id: String(obj.Job),
      job: obj.Job,
      mfr: obj.Mfr,
      model: obj.Model,
      status,
      schedulable,
      readyToStart,
      awaiting,
      inTransit,
      days: parseDays(obj.Days),
      tag: obj.Tag || inferTag(effectiveHours),
      hours: effectiveHours,
      hoursRange: hoursRange(effectiveHours),
      action: obj.Action,
      desc: obj.Desc,
      customer: obj.Customer || '',
      vb: obj.VB === 'Y',
      backlog: obj.BL === 'Y',
      project: obj.PJ === 'Y',
      bench,
      scheduled: false,
      calendarSlot: null,
      parentId: null,
      subtasks: null,
      hasSubtasks: false,
      pieceDone: false,
    };

    const subtasks = createSubtasks(baseJob, benchHours);
    if (subtasks && subtasks.length > 0) {
      jobs.push({ ...baseJob, subtasks: subtasks.map(st => st.id), hasSubtasks: true });
      subtasks.forEach(st => jobs.push({ ...st, scheduled: false, calendarSlot: null }));
    } else {
      jobs.push(baseJob);
    }
  }

  // Oldest first. `?? -1` rather than `?? 0`: a job of unknown age sorts BELOW
  // a genuine 0-day job, so blanks land at the newest end instead of being
  // shuffled in among the jobs booked in today. Rows loaded back from Supabase
  // can carry a real null here too, not just freshly-parsed CSV rows.
  return jobs.sort((a, b) => (b.days ?? -1) - (a.days ?? -1));
}

// Full bench breakdown for a job — a single entry for a plain job, or one
// entry per sibling for an auto-split (hasSubtasks/subtasks) or manual-split
// (isSplit/parentId) job. Same branching Sidebar.jsx uses for its expand toggle.
function splitSummary(j) {
  return {
    bench: j.bench, hours: j.hours,
    sessionNote: j.sessionNote, label: j.label,
    sessionIndex: j.sessionIndex, sessionTotal: j.sessionTotal,
    splitDesc: j.splitDesc, desc: j.desc,
  };
}

export function getJobSplits(job, jobs) {
  if (!job) return [];
  if (job.hasSubtasks && job.subtasks?.length > 0) {
    return jobs.filter(j => job.subtasks.includes(j.id)).map(splitSummary);
  }
  if (job.isSplit) {
    const children = jobs.filter(j => j.parentId === job.id);
    if (children.length > 0) return children.map(splitSummary);
  }
  return [splitSummary(job)];
}

// For a bullet whose job has vanished from jobs[] entirely (no live record,
// no completedJobs record either) — builds a synthetic job good enough for
// handleMarkDone to invoice against, so manually entering an amount here
// doesn't require the real job object. bullet.text is always built as
// "customer — mfr model" by upsertScheduledBullet (useDailyLog.js).
export function buildManualInvoiceJob(bullet) {
  const [first, ...rest] = (bullet.text || '').split(' — ');
  return {
    id: bullet.jobId, job: null, bench: null, hours: null,
    customer: rest.length ? first : '',
    mfr: rest.length ? rest.join(' — ') : first,
    model: '',
  };
}

export const BENCH_COLORS = {
  Luthier:     { bg: '#166534', border: '#15803d', text: '#bbf7d0' },
  Electronics: { bg: '#1e3a5f', border: '#2563eb', text: '#bfdbfe' },
  Setup:       { bg: '#7c2d12', border: '#ea580c', text: '#fed7aa' },
  Fretwork:    { bg: '#4c1d95', border: '#7c3aed', text: '#ddd6fe' },
  Wiring:      { bg: '#134e4a', border: '#0d9488', text: '#99f6e4' },
  Finishing:   { bg: '#92400e', border: '#d97706', text: '#fef3c7' },
  Admin:       { bg: '#374151', border: '#6b7280', text: '#e5e7eb' },
};

// For a job with no bench. Deliberately NOT Admin's grey-on-grey: every
// `BENCH_COLORS[job.bench] || BENCH_COLORS.Admin` fallback in the app used to
// paint an unclassified job in Admin colours, which is exactly the silent
// mis-filing this change exists to stop. This is dimmer and outlined, so a
// bench-less card reads as "no bench" at a glance instead of "Admin bench".
export const NO_BENCH_COLORS = { bg: '#0f172a', border: '#334155', text: '#64748b' };

// The one place that answers "what colour is this job's bench chip". Use it
// instead of `BENCH_COLORS[job.bench] || BENCH_COLORS.Admin`.
export function benchColors(bench) {
  return BENCH_COLORS[bench] || NO_BENCH_COLORS;
}

export function canInvoiceJob(job, jobs) {
  if (!job) return false;

  // If this is a split child, check the parent
  if (job.parentId) {
    const parent = jobs.find(j => j.id === job.parentId);
    return canInvoiceJob(parent, jobs);
  }

  // This is a top-level job
  if (job.hasSubtasks || job.isSplit) {
    // Get all split pieces
    const children = job.hasSubtasks
      ? jobs.filter(j => job.subtasks?.includes(j.id))
      : jobs.filter(j => j.parentId === job.id);
    return children.every(c => c.pieceDone === true);
  }

  // Non-split job
  return job.pieceDone === true;
}

export function getUndonePieces(job, jobs) {
  if (!job) return [];

  // If this is a split child, get parent's undone pieces
  if (job.parentId) {
    const parent = jobs.find(j => j.id === job.parentId);
    return getUndonePieces(parent, jobs);
  }

  // This is a top-level job
  if (job.hasSubtasks || job.isSplit) {
    const children = job.hasSubtasks
      ? jobs.filter(j => job.subtasks?.includes(j.id))
      : jobs.filter(j => j.parentId === job.id);
    return children.filter(c => !c.pieceDone);
  }

  // Non-split job
  return job.pieceDone ? [] : [job];
}

export const HOURS_BUCKETS = [
  { label: '< 1hr',  key: 'lt1',  test: h => h > 0 && h < 1 },
  { label: '1–2hr',  key: '1to2', test: h => h >= 1 && h < 2 },
  { label: '2–4hr',  key: '2to4', test: h => h >= 2 && h < 4 },
  { label: '4hr+',   key: 'gt4',  test: h => h >= 4 },
];
