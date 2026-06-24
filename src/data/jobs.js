export const RAW_CSV = `Job,Mfr,Model,Status,Days,Tag,Hours,Action,Desc,VB,BL,Customer`;

export const DEFAULT_BENCH_KEYWORDS = {
  Fretwork:    ['refret', 'fret level', 'fret dress', 'fret polish'],
  Luthier:     ['bridge(?!\\s*pup|\\s*pickup)', '\\bcrack\\b', 'brace', '\\breset\\b', '\\btop\\b', 'lower bout', 'inlay', 'binding', 'refinish', 'restoration', '\\bsplit\\b', 'lifting', 'lifted', 'broken neck', 'broken headstock', 'broken brace', 'broken bridge'],
  Electronics: ['power', 'output', 'input', 'tube', 'fuse', 'amp', 'recap', 'blown', 'doa', 'caps', 'opamp', 'voltage', 'pcb', 'speaker', 'voice chip', 'calibrate', 'impedance', 'mute', 'phantom', 'preamp', 'mains', 'dc power', 'wire feed', 'keyboard', 'synth', 'mixer', 'console', 'interface', 'desk', 'rack', 'valve', '\\bhead\\b', 'combo', 'bias', 'jack', 'pot', 'wiring'],
  Setup:       ['setup', 'stp', 'intonation', 'pups', 'pickup', 'wiring', '\\bstring\\b', 'strings', 'restring', 'switch', 'trem', 'nut', 'saddle', 'string height'],
};

export function inferBench(desc = '', status = '', action = '', model = '', mfr = '', keywords = DEFAULT_BENCH_KEYWORDS) {
  const act = (action || '').trim().toUpperCase();
  if (status === 'In Transit') return 'Admin';
  if (status === 'Waiting' && !['INC', 'CI'].includes(act)) return 'Admin';

  const d = (desc + ' ' + model).toLowerCase();
  const m = mfr.toLowerCase();

  const kw = { ...DEFAULT_BENCH_KEYWORDS, ...keywords };
  const rx = bench => new RegExp(kw[bench].join('|'));

  if (rx('Fretwork').test(d)) return 'Fretwork';
  if (rx('Luthier').test(d)) return 'Luthier';
  if (rx('Electronics').test(d)) return 'Electronics';
  if (rx('Setup').test(d)) return 'Setup';

  if (/passport|pa\s*\d/.test(d)) return 'Electronics';
  if (/db tech|rcf|turbosound|allen|hughes|behringer|ampeg|roland|marshall|matchless|casio|yamaha|trident|m audio|dynaudio|peavey|mackie|qsc|crown|crest|electro.voice|jbl|bose|bossweld|subtle noise|beesneez/.test(m)) return 'Electronics';
  if (/fender|gibson|martin|taylor|maton|cole clark|takamine|aria|cort|hofner|solar|samick|suzuki|alegria|ibanez|epiphone|gretsch|rickenbacker|guild|larrivee|seagull/.test(m)) return 'Setup';

  return 'Admin';
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

    cards.push({ ...job, id: `${job.id}-LU`, bench: 'Luthier',   hours: luthierHours, hoursRange: hoursRange(luthierHours), label: 'Luthier work', parentId: job.id });
    if (hasFinish) cards.push({ ...job, id: `${job.id}-FN`, bench: 'Finishing', hours: fixedFinish, hoursRange: hoursRange(fixedFinish), label: 'Finishing',    parentId: job.id });
    if (hasSetup)  cards.push({ ...job, id: `${job.id}-S`,  bench: 'Setup',     hours: fixedSetup,  hoursRange: hoursRange(fixedSetup),  label: 'Setup',        parentId: job.id });

    return cards.length >= 2 ? cards : null;
  }

  // ── Setup bench ────────────────────────────────────────────────────────────
  if (job.bench === 'Setup') {
    const hasWiring = /\bpickup\b|\bpups?\b|\bwiring\b|\bswitch\b|\bpot\b|\bjack\b/.test(d);
    const hasSetup  = /\bsetup\b|\bstp\b|\bnut\b|\bsaddle\b|\bintonation\b|\bstring height\b|\btrem\b/.test(d);
    if (!hasWiring || !hasSetup) return null;
    const half = Math.max(Math.round(job.hours / 2 * 2) / 2, 0.5);
    return [
      { ...job, id: `${job.id}-ST`, bench: 'Setup',  hours: half, hoursRange: hoursRange(half), label: 'Setup',  parentId: job.id },
      { ...job, id: `${job.id}-WR`, bench: 'Wiring', hours: half, hoursRange: hoursRange(half), label: 'Wiring', parentId: job.id },
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
      cards.push({ ...job, id: `${job.id}-R`,  bench: 'Fretwork', hours: half, hoursRange: hoursRange(half), label: 'Refret',                parentId: job.id });
      cards.push({ ...job, id: `${job.id}-LC`, bench: 'Fretwork', hours: half, hoursRange: hoursRange(half), label: 'Level, Crown & Polish', parentId: job.id });
    } else {
      cards.push({ ...job, id: `${job.id}-LC`, bench: 'Fretwork', hours: fretworkHours, hoursRange: hoursRange(fretworkHours), label: 'Level, Crown & Polish', parentId: job.id });
    }

    if (hasLuthier) cards.push({ ...job, id: `${job.id}-LU`, bench: 'Luthier',   hours: fixedLuthier, hoursRange: hoursRange(fixedLuthier), label: 'Luthier work',     parentId: job.id });
    if (hasSetup)   cards.push({ ...job, id: `${job.id}-SU`, bench: 'Setup',     hours: fixedSetup,   hoursRange: hoursRange(fixedSetup),   label: 'Setup / Restring', parentId: job.id });
    if (hasWiring)  cards.push({ ...job, id: `${job.id}-WR`, bench: 'Wiring',    hours: fixedWiring,  hoursRange: hoursRange(fixedWiring),  label: 'Wiring',           parentId: job.id });

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
    const act    = (obj.Action || '').trim().toUpperCase();
    const hours  = parseFloat(obj.Hours) || 0;

    // On Hold + BL=Y + GTS → graduated to schedulable (parts arrived / good to start)
    const readyToStart = status === 'On Hold' && obj.BL === 'Y' && act === 'GTS';
    // Waiting + INC or CI → awaiting customer/incubating (visible but locked)
    const awaiting     = status === 'Waiting' && ['INC', 'CI'].includes(act);
    // In Transit → visible but locked
    const inTransit    = status === 'In Transit';

    const schedulable  = ['Active', 'Booked In'].includes(status) || readyToStart;

    const accepted = ['On Hold', 'Waiting', 'To Be Inv', 'In Transit'];
    if (!schedulable && !accepted.includes(status)) continue;
    // Don't drop schedulable jobs just because hours aren't set yet — default to 1h
    const effectiveHours = (hours === 0 && schedulable) ? 1 : hours;

    const bench = inferBench(obj.Desc, status, obj.Action, obj.Model, obj.Mfr, keywords);
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
      days: parseInt(obj.Days) || 0,
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
    };

    const subtasks = createSubtasks(baseJob, benchHours);
    if (subtasks && subtasks.length > 0) {
      jobs.push({ ...baseJob, subtasks: subtasks.map(st => st.id), hasSubtasks: true });
      subtasks.forEach(st => jobs.push({ ...st, scheduled: false, calendarSlot: null }));
    } else {
      jobs.push(baseJob);
    }
  }

  return jobs.sort((a, b) => b.days - a.days);
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
