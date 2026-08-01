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
export function buildPartPayload({ description, category, neededForJob } = {}) {
  const desc = (description ?? '').trim();
  if (!desc) return null;

  const cat = (category ?? '').trim();
  const job = (neededForJob ?? '').trim();

  const payload = { description: desc };
  if (cat) payload.category = cat;
  payload.neededForJob = job || null;
  return payload;
}
