export const RAW_CSV = `Job,Mfr,Model,Status,Days,Tag,Hours,Action,Desc,VB,BL`;

export function inferBench(desc = '', status = '') {
  if (status === 'Waiting') return 'Admin';
  const d = desc.toLowerCase();
  if (/refret|fret level|fret dress|fret polish/.test(d)) return 'Fretwork';
  if (/refret|fret|nut|saddle|bridge|crack|brace|reset|neck|pocket|top|lower bout|inlay|binding|finish|restoration/.test(d)) return 'Luthier';
  if (/power|output|tube|fuse|amp|recap|blown|no o\/p|doa|caps|opamp|voltage|solder|pcb|speaker|voice chip|calibrat|impedance|mute|phantom|preamp|mains|dc power|wire feed/.test(d)) return 'Electronics';
  if (/setup|stp|intonation|pups|pickup|wiring|strings|restring|jack|pot|switch|trem|saddle screw|string height/.test(d)) return 'Setup';
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
  const rows = [];
  let row = [], field = '', inQuote = false;
  const text = csvText.trim();
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
    const hours = parseFloat(obj.Hours) || 0;
    const schedulable = ['Active', 'Booked In'].includes(status);
    if (!schedulable && !['On Hold', 'Waiting', 'To Be Inv'].includes(status)) continue;
    if (hours === 0 && schedulable) continue;

    const bench = inferBench(obj.Desc, status);
    jobs.push({
      id: String(obj.Job),
      job: obj.Job,
      mfr: obj.Mfr,
      model: obj.Model,
      status,
      schedulable,
      days: parseInt(obj.Days) || 0,
      tag: obj.Tag || inferTag(hours),
      hours,
      hoursRange: hoursRange(hours),
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
