// Pure logic for the Parts to Order page (Brief: a Parts to Order page, 2026-08-01).
//
// Kept out of the component on purpose so it can be tested without a DOM. The
// component does loading, error text and layout; everything decidable from data
// lives here.

/**
 * Split the map returned by loadPartsToOrder() into the two lists the page
 * shows: the active chase list, and the dimmed "already sorted" section below it.
 *
 * Sorted newest-first by added_at. loadPartsToOrder() already asks the database
 * for that order, but it hands back an object rather than an array, so the
 * ordering is only as reliable as JS key ordering. Re-sorting here makes it
 * explicit rather than incidental.
 */
export function partitionParts(itemsById) {
  const all = Object.values(itemsById || {});
  const byNewest = [...all].sort((a, b) => {
    const at = a?.addedAt ? Date.parse(a.addedAt) : 0;
    const bt = b?.addedAt ? Date.parse(b.addedAt) : 0;
    return (Number.isNaN(bt) ? 0 : bt) - (Number.isNaN(at) ? 0 : at);
  });
  return {
    active: byNewest.filter(p => !p.resolved),
    resolved: byNewest.filter(p => Boolean(p.resolved)),
  };
}

/**
 * Build the one item addPartsToOrderItems() expects from what was typed in the
 * add form. Returns null when there is nothing worth saving — a description is
 * the only required field.
 *
 * Two deliberate details:
 * - `category` is OMITTED when blank rather than sent as ''. addPartsToOrderItems
 *   falls back to 'part' with `item.category || 'part'`, and an empty string would
 *   take that fallback anyway, but omitting keeps the payload honest.
 * - `neededForJob` is free text and is NOT checked against the jobs list. The
 *   column is deliberately nullable and deliberately not a foreign key — a part
 *   can be for a job that no longer exists, or for no job at all (shop stock).
 *   See the comment above the functions in src/utils/supabase.js.
 */
export function buildPartPayload({ description, category, neededForJob, partNumber } = {}) {
  const desc = (description ?? '').trim();
  if (!desc) return null;

  const cat = (category ?? '').trim();
  const job = (neededForJob ?? '').trim();
  const pn = (partNumber ?? '').trim();

  const payload = { description: desc };
  if (cat) payload.category = cat;
  payload.neededForJob = job || null;
  // Nullable on purpose. Most parts are typed at the bench with no number to
  // hand, and the page must never refuse a part because a number is missing.
  payload.partNumber = pn || null;
  return payload;
}

// ============ GROUPING BY JOB (round 2) ============

const SHOP_STOCK_KEY = '';

/**
 * Group the parts of one list under their job number, for display only.
 * Nothing about the database changes — `needed_for_job` is still free text and
 * is still not checked against `jobs`.
 *
 * The key is trimmed HERE rather than trusting the write-time trim in
 * buildPartPayload above. Rows written before that trim existed, or edited
 * straight in the Supabase dashboard, would otherwise split one job across two
 * headings that look identical on screen — a duplicate that isn't one.
 *
 * Groups come back ordered by their newest part, so the job just added to sits
 * at the top. Parts inside a group keep the order they arrived in, which is
 * newest-first when fed from partitionParts(). Shop stock (no job number) is
 * ordered by the same rule as everything else — it is not pinned anywhere.
 */
export function groupPartsByJob(parts) {
  const groups = new Map();

  for (const part of parts || []) {
    const key = (part?.neededForJob ?? '').trim();
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        label: key === SHOP_STOCK_KEY ? 'Shop stock' : `Job ${key}`,
        parts: [],
        newestAt: 0,
      });
    }
    const group = groups.get(key);
    group.parts.push(part);

    const t = part?.addedAt ? Date.parse(part.addedAt) : 0;
    if (!Number.isNaN(t) && t > group.newestAt) group.newestAt = t;
  }

  return [...groups.values()].sort((a, b) => b.newestAt - a.newestAt);
}

// ============ PARTSBOX STOCK CHECK (round 2) ============
//
// Advisory only. Nothing here can refuse a save, remove a part from the list or
// tick one off, and nothing here writes to PartsBox. It answers one question:
// "does this look like something already on the shelf?"
//
// parseTerms below is the SAME parser PartsDrawer.jsx uses — it is imported
// there so there is one copy of the search grammar. matchesPart, though, is
// deliberately a SEPARATE four-field matcher: the drawer keeps its own
// five-field version that also searches the storage-location name, because
// searching the drawer for a bin name is a feature there. On this page it would
// be a bug — a part must not flag as in-stock because a shelf happens to be
// named "amp parts".

/**
 * Parse a search string: space-split, but "quoted phrases" stay together, and
 * -word or -"phrase" excludes. Lifted unchanged from PartsDrawer.jsx.
 */
export function parseTerms(raw) {
  const tokens = [];
  const re = /(-?"[^"]*"|-?\S+)/g;
  let m;
  while ((m = re.exec(raw ?? '')) !== null) {
    let tok = m[1];
    const negate = tok.startsWith('-');
    if (negate) tok = tok.slice(1);
    if (tok.startsWith('"') && tok.endsWith('"')) tok = tok.slice(1, -1);
    if (tok) tokens.push({ term: tok.toLowerCase(), negate });
  }
  return tokens;
}

/**
 * Does one PartsBox part match one lowercase term, across the four content
 * fields? Plain substring matching — no typo tolerance, no plural tolerance,
 * no fuzziness. That is deliberate: a fuzzy match that quietly says "you have
 * one of these" when you don't causes the exact failure this page exists to
 * prevent, which is a part not getting ordered.
 */
export function matchesPart(part, term) {
  return Boolean(
    part?.['part/name']?.toLowerCase().includes(term) ||
    part?.['part/description']?.toLowerCase().includes(term) ||
    part?.['part/mpn']?.toLowerCase().includes(term) ||
    (part?.['part/tags'] || []).some(tag => String(tag).toLowerCase().includes(term))
  );
}

function sumStock(part) {
  return (part?.['part/stock'] || []).reduce((sum, s) => sum + (s?.['stock/quantity'] || 0), 0);
}

/**
 * Look for what was typed in the PartsBox inventory.
 *
 * Returns null when there is nothing worth saying, otherwise:
 *   { part, quantity, certain, terms }
 *
 * `certain` is true ONLY for an exact manufacturer-part-number match — that is
 * the one case where the two systems genuinely name the same object, so it is
 * the one case the screen is allowed to state as a fact. Every keyword match
 * comes back with certain:false and must be worded as a maybe.
 *
 * Parts with no stock on hand are ignored. "You may already have this" about a
 * part sitting at zero is noise that trains the tech to ignore the flag.
 *
 * `searchText` is what the "check stock" control should hand the drawer.
 */
export function findStockMatch(inventory, { description, partNumber } = {}) {
  const parts = (inventory || []).filter(p => sumStock(p) > 0);
  if (parts.length === 0) return null;

  const pn = (partNumber ?? '').trim();
  const desc = (description ?? '').trim();

  // 1. Exact part-number match — the only certainty on offer.
  if (pn) {
    const needle = pn.toLowerCase();
    const exact = parts.find(p => (p['part/mpn'] ?? '').trim().toLowerCase() === needle);
    if (exact) {
      return {
        part: exact,
        quantity: sumStock(exact),
        certain: true,
        matchedTermCount: 1,
        searchText: pn,
      };
    }
  }

  // 2. Otherwise a plain keyword search of everything that was typed.
  const raw = [pn, desc].filter(Boolean).join(' ');
  const tokens = parseTerms(raw);
  const positive = tokens.filter(t => !t.negate);
  const negative = tokens.filter(t => t.negate);
  if (positive.length === 0) return null;

  const hit = parts.find(p =>
    positive.every(({ term }) => matchesPart(p, term)) &&
    !negative.some(({ term }) => matchesPart(p, term))
  );
  if (!hit) return null;

  return {
    part: hit,
    quantity: sumStock(hit),
    certain: false,
    // How many words had to line up. One word matching is a thin reason to
    // believe anything, so the page softens it further.
    matchedTermCount: positive.length,
    searchText: raw,
  };
}
