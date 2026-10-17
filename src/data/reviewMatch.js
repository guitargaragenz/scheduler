// Does a job's customer appear in the Google review list? Pure, no I/O.
// Names never match perfectly, so the answer is soft: 'yes' | 'no' | 'unknown'.
// Matching rules (council, 2026-10-17): fold case and accents, drop punctuation and
// anything in brackets, then both names need 2+ words and the SAME set of words
// (order ignored). Single words and business names can't be judged -> 'unknown'.

const BUSINESS_WORDS = new Set([
  'ltd', 'limited', 'music', 'studio', 'studios', 'church', 'school', 'band', 'trust', 'co',
]);

function words(name) {
  return String(name ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\([^)]*\)|\[[^\]]*\]|\{[^}]*\}/g, ' ')
    .replace(/['\u2018\u2019`]/g, '')       // O'Neil -> oneil
    .replace(/[^a-z0-9\s]/g, ' ')             // Mary-Jane -> mary jane
    .split(/\s+/)
    .filter(Boolean);
}

function key(ws) {
  return [...ws].sort().join(' ');
}

export function hasReviewed(customer, names) {
  const ws = words(customer);
  if (ws.length < 2 || ws.some(w => BUSINESS_WORDS.has(w))) return 'unknown';
  const want = key(ws);
  for (const n of names ?? []) {
    const nw = words(n);
    if (nw.length >= 2 && key(nw) === want) return 'yes';
  }
  return 'no';
}
