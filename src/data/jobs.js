export const RAW_CSV = `Job,Mfr,Model,Status,Days,Tag,Hours,Action,Desc,VB,BL`;

export function inferBench(desc = '', status = '', action = '', model = '', mfr = '') {
  const act = (action || '').trim().toUpperCase();
  // In Transit — always Admin (nothing to bench until it arrives)
  if (status === 'In Transit') return 'Admin';
  // Waiting — Admin unless Incubating (INC) or Customer Input (CI)
  if (status === 'Waiting' && !['INC', 'CI'].includes(act)) return 'Admin';

  // Check desc first, then model, then manufacturer
  const d = (desc + ' ' + model).toLowerCase();
  const m = mfr.toLowerCase();

  if (/refret|fret level|fret dress|fret polish/.test(d)) return 'Fretwork';
  if (/fret|nut|saddle|bridge|crack|brace|reset|neck|pocket|top|lower bout|inlay|binding|finish|restoration|acoustic|classical|archtop/.test(d)) return 'Luthier';
  if (/power|output|tube|fuse|amp|recap|blown|no o\/p|doa|caps|opamp|voltage|solder|pcb|speaker|voice chip|calibrat|impedance|mute|phantom|preamp|mains|dc power|wire feed|keyboard|synth|mixer|console|interface|desk|rack|valve|head|combo/.test(d)) return 'Electronics';
  if (/setup|stp|intonation|pups|pickup|wiring|strings|restring|jack|pot|switch|trem|saddle screw|string height|guitar|bass|ukulele|mandolin|banjo/.test(d)) return 'Setup';

  // Model-name overrides for brands that make both instruments AND electronics
  if (/passport|pa\s*\d/.test(d)) return 'Electronics';
  // Manufacturer fallback — known electronics brands
  if (/db tech|rcf|turbosound|allen|hughes|behringer|ampeg|roland|marshall|matchless|casio|yamaha|trident|m audio|dynaudio|peavey|mackie|qsc|crown|crest|electro.voice|jbl|bose|bossweld|subtle noise/.test(m)) return 'Electronics';
  // Known guitar/stringed instrument brands → Setup (luthier work detected above via desc)
  if (/fender|gibson|martin|taylor|maton|cole clark|takamine|aria|cort|hofner|solar|samick|suzuki|alegria|beesneez|ibanez|epiphone|gretsch|rickenbacker|guild|larrivee|seagull/.test(m)) return 'Setup';

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

export function parseCSV(csvText) {
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

    const bench = inferBench(obj.Desc, status, obj.Action, obj.Model, obj.Mfr);
    jobs.push({
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
      vb: obj.VB === 'Y',
      backlog: obj.BL === 'Y',
      bench,
      scheduled: false,
      calendarSlot: null,
    });
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
