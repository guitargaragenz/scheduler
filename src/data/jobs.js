export const RAW_CSV = `Job,Mfr,Model,Status,Days,Tag,Hours,Action,Desc,VB,BL,Customer`;

export const DEFAULT_BENCH_KEYWORDS = {
  Fretwork:    ['refret', 'fret level', 'fret dress', 'fret polish'],
  Luthier:     ['bridge', 'crack', 'brace', 'reset', 'top', 'lower bout', 'inlay', 'binding', 'finish', 'restoration', 'split', 'lifting', 'lifted', 'broken'],
  Electronics: ['power', 'output', 'tube', 'fuse', 'amp', 'recap', 'blown', 'doa', 'caps', 'opamp', 'voltage', 'pcb', 'speaker', 'voice chip', 'calibrate', 'impedance', 'mute', 'phantom', 'preamp', 'mains', 'dc power', 'wire feed', 'keyboard', 'synth', 'mixer', 'console', 'interface', 'desk', 'rack', 'valve', '\\bhead\\b', 'combo', 'bias', 'jack', 'pot', 'wiring'],
  Setup:       ['setup', 'stp', 'intonation', 'pups', 'pickup', 'wiring', 'strings', 'restring', 'switch', 'trem', 'nut', 'saddle', 'string height'],
};

export function inferBench(desc = '', status = '', action = '', model = '', mfr = '', keywords = DEFAULT_BENCH_KEYWORDS) {
  const act = (action || '').trim().toUpperCase();
  if (status === 'In Transit') return 'Admin';
  if (status === 'Waiting' && !['INC', 'CI'].includes(act)) return 'Admin';

  const d = (desc + ' ' + model).toLowerCase();
  const m = mfr.toLowerCase();

  const kw = { ...DEFAULT_BENCH_KEYWORDS, ...keywords };
  const rx = bench => {
    const list = kw[bench] || [];
    if (list.length === 0) return { test: () => false };
    return new RegExp(list.join('|'));
  };

  if (rx('Fretwork').test(d)) return 'Fretwork';
  if (/(noise|pot|jack|switch|wiring|trem|pickup)/.test(d) && /setup|stp|restring|strings/.test(d)) return 'Setup';
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

export function createSubtasks(job) {
  const d = (job.desc || '').toLowerCase();

  // Fret level + setup combo — detect by desc keywords so splits generate even if
  // the job was reassigned to a different bench via the drawer.
  const hasFretLevel = /fret.?level|fret.?dress/.test(d);
  const hasSetupWork = /\bsetup\b|\bstp\b/.test(d);
  // Also match Fretwork bench + "level" + "setup" without an explicit "fret" prefix in desc
  const isFretLevelJob = (hasFretLevel && hasSetupWork)
    || (job.bench === 'Fretwork' && hasSetupWork && /level/.test(d) && !/refret/.test(d));
  if (isFretLevelJob) {
    const hasLuthier = /restoration|neck pocket|crack|brace|reset|binding|finish|headstock|inlay|lower bout|top|bridge|lifting|lifted|broken|split/.test(d);
    const luthierHours = 1;
    const remaining = hasLuthier ? Math.max(job.hours - luthierHours, 1) : job.hours;
    const subtasks = [
      { ...job, id: `${job.id}-L`, bench: 'Fretwork', hours: Math.round(remaining * 0.6 * 2) / 2, hoursRange: hoursRange(Math.round(remaining * 0.6 * 2) / 2), label: 'Level & Polish', parentId: job.id },
      { ...job, id: `${job.id}-S`, bench: 'Setup',    hours: Math.round(remaining * 0.4 * 2) / 2, hoursRange: hoursRange(Math.round(remaining * 0.4 * 2) / 2), label: 'Setup',          parentId: job.id },
    ];
    if (hasLuthier) subtasks.unshift(
      { ...job, id: `${job.id}-LU`, bench: 'Luthier', hours: luthierHours, hoursRange: hoursRange(luthierHours), label: 'Luthier work', parentId: job.id }
    );
    return subtasks;
  }

  // Refret — detect if there's also Luthier work in the description
  if (job.bench === 'Fretwork' && /refret/.test(d)) {
    const hasLuthier = /restoration|neck pocket|crack|brace|reset|binding|finish|headstock|inlay|lower bout|top|bridge|lifting|lifted|broken|split/.test(d);
    const luthierHours = 1.5;
    if (hasLuthier) {
      // 3 cards: single Fretwork (refret+polish combined), Luthier, Setup
      const fwHours = Math.max(job.hours - 1.5 - luthierHours, 0.5);
      return [
        { ...job, id: `${job.id}-R`,  bench: 'Fretwork', hours: Math.round(fwHours * 2) / 2, hoursRange: hoursRange(Math.round(fwHours * 2) / 2), label: 'Refret & Polish', parentId: job.id },
        { ...job, id: `${job.id}-LU`, bench: 'Luthier',  hours: luthierHours,                hoursRange: hoursRange(luthierHours),                 label: 'Luthier work',   parentId: job.id },
        { ...job, id: `${job.id}-SU`, bench: 'Setup',    hours: 1.5,                         hoursRange: hoursRange(1.5),                           label: 'Setup / Restring', parentId: job.id },
      ];
    }
    // No Luthier — keep Refret + Level/Polish as separate Fretwork cards
    const baseHours = Math.max(job.hours - 1.5, 0.5);
    return [
      { ...job, id: `${job.id}-R`,  bench: 'Fretwork', hours: Math.round(baseHours * 0.8 * 2) / 2, hoursRange: hoursRange(Math.round(baseHours * 0.8 * 2) / 2), label: 'Refret',                parentId: job.id },
      { ...job, id: `${job.id}-LC`, bench: 'Fretwork', hours: Math.round(baseHours * 0.2 * 2) / 2, hoursRange: hoursRange(Math.round(baseHours * 0.2 * 2) / 2), label: 'Level, Crown & Polish', parentId: job.id },
      { ...job, id: `${job.id}-SU`, bench: 'Setup',    hours: 1.5,                                  hoursRange: hoursRange(1.5),                                  label: 'Setup / Restring',      parentId: job.id },
    ];
  }

  return null;
}

export function parseCSV(csvText, keywords = {}) {
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

    const subtasks = createSubtasks(baseJob);
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
  Admin:       { bg: '#374151', border: '#6b7280', text: '#e5e7eb' },
};
