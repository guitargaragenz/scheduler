export const DEFAULT_BENCH_KEYWORDS = {
  Fretwork:    ['refret', 'fret level', 'fret dress', 'fret polish'],
  Luthier:     ['bridge(?!\\s*pup|\\s*pickup)', '\\bcrack\\b', 'brace', '\\breset\\b', '\\btop\\b', 'lower bout', 'inlay', 'binding', 'refinish', 'restoration', '\\bsplit\\b', 'lifting', 'lifted', 'broken neck', 'broken headstock', 'broken brace', 'broken bridge'],
  Electronics: ['power', 'output', 'input', 'tube', 'fuse', 'amp', 'recap', 'blown', 'doa', 'caps', 'opamp', 'voltage', 'pcb', 'speaker', 'voice chip', 'calibrate', 'impedance', 'mute', 'phantom', 'preamp', 'mains', 'dc power', 'wire feed', 'keyboard', '\\bkeys?\\b', 'synth', 'mixer', 'console', 'interface', 'desk', 'rack', 'valve', '\\bhead\\b', 'combo', 'bias', 'jack', 'pot', 'wiring', 'scratchy'],
  Setup:       ['setup', 'stp', 'intonation', 'pups', 'pickup', 'wiring', '\\bstring\\b', 'strings', 'restring', 'switch', 'trem', 'nut', 'saddle', 'string height'],
};

// `backlog` is the 7th positional parameter and `vb` the 8th. Both are raw
// booleans, not 'Y'/'N'. They exist so this function can ask blockedPile the
// question properly — BL and VB are both blocking conditions and neither can be
// read off status/action alone.
export function inferBench(desc = '', status = '', action = '', model = '', mfr = '', keywords = DEFAULT_BENCH_KEYWORDS, backlog = false, vb = false) {
  // Blocked work carries the ADMIN bench. Trevor's ruling, 2026-08-04:
  // "if something's blocked and hits a bench then that's falsely saying it's
  // GTS." A bench is a promise you can work the job; Admin is the honest answer
  // for work that is his to sort out rather than his to build. This is what the
  // app did before Supabase and what he asked for at the time.
  //
  // This replaces an earlier comment here arguing the opposite ("returns null,
  // not 'Admin' — Admin is a real bench for real admin work"). That decision was
  // made against the request and produced the bug Trevor found on 2026-08-04:
  // nine live jobs with no bench on the outside, all showing Luthier inside the
  // drawer because a <select> with an unmatched value displays its first option.
  // Do not revert this to null on the strength of the old comment.
  //
  // Admin does NOT make a blocked job look workable. blockedPile() stays the
  // one discriminator everywhere — JobShelf's bench counts and lists, JobCard's
  // drag-disable, and useSupabase's `schedulable` all gate on it, not on the
  // bench string. Anything new must do the same.
  //
  // Deliberately delegated to blockedPile rather than re-testing the status
  // strings here: a second copy of the rule is how jobs 393 and 693 (Booked In +
  // INC) ended up sitting in the Planning pile while still carrying an
  // Electronics bench from the manufacturer regexes below. One rule, one
  // function, every screen agrees.
  if (blockedPile({ status, action, backlog: backlog === true, vb: vb === true })) return 'Admin';

  // Description only. `model` used to be folded in here and `mfr` matched against
  // manufacturer regexes below — both gone, Trevor's ruling 2026-09-03: the brand
  // of an instrument says nothing about the work being done on it. A Fender could
  // be a refret or a rewire. Description keywords are now the only auto-allocator;
  // `mfr` and `model` stay in the signature for callers, unused for bench choice.
  const d = desc.toLowerCase();

  // A bench with an EMPTY keyword list falls back to its defaults, and this is
  // a safety rule, not tidiness. The old `{ ...DEFAULT, ...keywords }` merged at
  // the bench level, so `{ Fretwork: [] }` survived the merge intact and
  // `[].join('|')` produced `new RegExp('')` — which matches every string, so
  // every job on the board went to that one bench. Reachable before this in
  // Settings by deleting every chip; reachable in more ways now that keywords
  // arrive over the network (partial load, failed fetch, another device's
  // write). Anything that is not a non-empty array means "no entry".
  const kw = { ...DEFAULT_BENCH_KEYWORDS };
  for (const [bench, list] of Object.entries(keywords || {})) {
    if (Array.isArray(list) && list.length > 0) kw[bench] = list;
  }
  const rx = bench => new RegExp(kw[bench].join('|'));

  if (rx('Fretwork').test(d)) return 'Fretwork';
  if (rx('Luthier').test(d)) return 'Luthier';
  // "setup", "stp", or "restring" take priority over Electronics keywords like "pot" —
  // the Setup split logic in createSubtasks will then separate the wiring component out
  if (/\bsetup\b|\bstp\b|\brestring\b/.test(d)) return 'Setup';
  if (rx('Electronics').test(d)) return 'Electronics';
  if (rx('Setup').test(d)) return 'Setup';

  // Couldn't classify it, and it is NOT blocked — so this is not the Admin case
  // above. Still null: a workable job the regexes can't place needs a human to
  // pick the bench, and filing it under Admin would hide that. JobDrawer's
  // "Needs a bench" option is what catches it (it refuses to save on that
  // option), which is why that guard is still needed even though blocked work
  // now gets Admin.
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

// preserveKnownDays() lived here until Brief H, Build 2b. It guarded the CSV
// import against Multitrack's intermittently-blank `Days` cell overwriting an
// age the app already knew. Both halves of the problem are gone: the CSV import
// went with Build 2a, and the app no longer stores an age at all — it computes
// it from the booked-in date on every load (src/utils/jobAge.js).

// Which quiet pile a blocked job belongs in, or null if it is workable today.
//
// SINGLE SOURCE OF TRUTH. Sidebar, JobsPage, JobShelf, CalendarGrid and
// inferBench all read this one function rather than each keeping its own copy
// of "is this job blocked" — four copies drifting apart is exactly how the
// current three-locked-sections sprawl happened, and it is what makes a job
// show up as blocked on one screen and workable on another.
//
// 'planning' is `INC`, `RS`, `RS-C` or `DG` alone, deliberately status-independent
// (settled at council 2026-07-27, RS/RS-C added 2026-07-28, DG 2026-08-05). On the live data
// the only two INC jobs are 393 and 693, both `Booked In`, so gating on
// `Waiting + INC` as the spec originally said would have matched zero jobs and
// shipped an empty pile. INC is the action code MT uses to mean "Incubating" —
// the job is still turning over in Trevor's head, nowhere near planning or
// quoting yet. RS (Research) and RS-C (Research with Claude) are the same
// still-figuring-it-out phase — whatever the status column says, so a future
// `Active + INC/RS/RS-C/DG` job leaving the active list is intended, not a
// regression. `DG` (To be Diagnosed) joined them 2026-08-05: ProjectsPage.jsx
// has always grouped all four together under "Needs Thinking" while this
// function listed only three, so the two screens disagreed. They now match.
//
// There is no longer a `readyToStart` exemption. It modelled On Hold + BL=Y +
// GTS ("parts arrived, good to start"), which Trevor ruled on 2026-08-04 "would
// never happen" — it never matched a live job, and it was the one rule that
// fought the BL clause below. Deleted rather than left dormant.
//
// VB and BL are read off the job, not derived from status/action:
//   - VB (Virtual Booking) — the customer still has the instrument, so the job
//     cannot be worked whatever else it says. Checked AFTER the status piles so
//     a VB job that is also On Hold reads 'hold', the more useful answer; a VB
//     job with a workable status falls to 'waiting', which is honest — what it
//     is waiting for is the guitar arriving.
//   - BL (Backlog) — old work still on the books, and belt-and-braces: all ten
//     live BL=Y jobs on 2026-08-05 were already blocked by their status or
//     action, so this clause moves nothing today. It lands in 'hold' rather
//     than a new pile on purpose — a pile with no chip in JobShelf's PILES row
//     is a job that counts nowhere and disappears off the shelf entirely.
//
// On Hold wins over everything below it, including CI (action code) — Trevor
// paused the job on purpose, so it stays 'hold' even if the customer is also
// being chased (2026-07-27 council).
export function blockedPile(job) {
  if (!job) return null;
  const act = (job.action || '').trim().toUpperCase();
  if (['INC', 'RS', 'RS-C', 'DG'].includes(act)) return 'planning';

  const status = job.status || '';
  if (status === 'On Hold') return 'hold';
  if (status === 'In Transit') return 'transit';
  if (status === 'Waiting') return 'waiting';

  if (job.vb === true) return 'waiting';
  if (job.backlog === true) return 'hold';
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
  // All four still-figuring-it-out codes read 'planning', matching the pile
  // above and the Projects page's "Needs Thinking" group. Only INC was listed
  // here before, so RS/RS-C jobs sat in the planning pile while reporting
  // "waiting — see Multitrack" as the reason.
  if (['INC', 'RS', 'RS-C', 'DG'].includes(act)) return 'planning';
  if (act === 'CI') return 'waiting on the customer';
  if (status === 'In Transit') return 'in transit';
  if (status === 'On Hold') return 'on hold';
  // Reached only when the status column says nothing is wrong, so the flag on
  // the job is the whole reason. Says what is actually stopping it.
  if (job?.vb === true) return 'customer still has the instrument';
  if (job?.backlog === true) return 'backlog';
  return 'waiting — see Multitrack';
}

// A job Trevor tagged WP (Waiting Parts) that Multitrack no longer calls stuck.
//
// WP is his own marker — Multitrack does not print an action code, so the PDF
// import cannot clear it (PDF_IMPORT_FIELDS, supabase.js). The tag therefore
// outlives the hold: the status flips back to Active on the next drop and the WP
// sits there until he deletes it in the Jobs Sheet. While it does, the job reads
// as parts-blocked when he is picking the week's work and quietly never gets
// chosen — his words, 2026-08-03: "I could miss jobs that come free".
//
// This only reports the disagreement. Nothing anywhere may use it to clear the
// tag: the import's inability to reach his hand-kept columns is what stops one
// bad drop blanking the whole workshop's tags.
//
// Question mark in the UI label is deliberate. The app knows Multitrack stopped
// saying "waiting"; it does not know the parts actually arrived.
export function partsMayHaveArrived(job) {
  if (!job) return false;
  if ((job.action || '').trim().toUpperCase() !== 'WP') return false;
  return blockedPile(job) === null;
}

// needsBench() lived here until 2026-08-05. It was exported and called from
// nowhere, and the amber "needs a bench" chip its comment described was never
// built. JobDrawer's "Needs a bench" option is the real guard now.

// Difficulty bands. EZ → Medium → Tricky → Hard, in that order.
//
// Corrected 2026-07-29 (Brief G, Build 1b): M and T were the wrong way round
// here and in the help text — both said T ≤3h, M ≤5.5h, which called the
// SHORTER job the trickier one. The bands themselves are unchanged; only
// which letter sits on which band.
export function inferTag(h) {
  if (!h || h <= 0) return 'EZ';
  if (h <= 1.5) return 'EZ';
  if (h <= 3)   return 'M';
  if (h <= 5.5) return 'T';
  return 'H';
}

export function hoursRange(h) {
  if (!h || h <= 0) return '—';
  const lo = Math.floor(h);
  const hi = Math.ceil(h);
  return lo === hi ? String(h) : `${lo}-${hi}`;
}

// Status-derived flags shared by the PDF importer (pdfImportPlan.js) and any
// other reader that has to reconstruct them from a stored job row that only
// carries status/action/backlog (e.g. scripts/board_meeting_export.mjs and
// useSupabase.js's normalise step, which read Supabase rows). Pulled out
// as its own function so both places derive awaiting/inTransit/schedulable
// from the exact same rule, rather than a second ad-hoc copy silently drifting
// from this one over time.
//
// `backlog` here is already a boolean (obj.BL === 'Y' at CSV-parse time, or
// the `bl` column read back as 'Y'/'N' from Supabase) — not the raw 'Y'/'N'
// string. It is no longer read: the `readyToStart` flag that needed it (On Hold
// + BL=Y + GTS) was deleted 2026-08-05 per Trevor — "that would never happen".
// The parameter stays so every existing caller keeps working unchanged.
export function deriveJobStatusFlags(status, action, backlog) { // eslint-disable-line no-unused-vars
  const act = (action || '').trim().toUpperCase();
  // Waiting + INC or CI → awaiting customer/incubating (visible but locked)
  const awaiting = status === 'Waiting' && ['INC', 'CI'].includes(act);
  // In Transit → visible but locked
  const inTransit = status === 'In Transit';
  const schedulable = ['Active', 'Booked In'].includes(status);
  return { awaiting, inTransit, schedulable };
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
    id: bullet.jobId, job: jobNumberFromId(bullet.jobId), bench: null, hours: null,
    customer: rest.length ? first : '',
    mfr: rest.length ? rest.join(' — ') : first,
    model: '',
  };
}

// This path used to hard-code `job: null`, and that is why the one surviving
// revenue row in the live database has a null job_number — nothing could
// reconcile it back to Multitrack. The number is recoverable: every job id
// starts with it, whether it's a top-level job ("1712"), a manual split child
// ("1520_Luthier_0") or a derived bench card ("2000-ST"). Anything that doesn't
// begin with digits has no number to carry, and still returns null.
export function jobNumberFromId(jobId) {
  const match = String(jobId ?? '').match(/^(\d+)/);
  return match ? match[1] : null;
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
