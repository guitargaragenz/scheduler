// Exact-amount display — no rounding to whole dollars. A whole-dollar
// invoice shows as "260"; anything with cents shows them, so "273.48"
// reads back exactly as typed, never "273".
export function formatMoney(n) {
  const v = Number(n || 0);
  return Number.isInteger(v) ? v.toString() : v.toFixed(2);
}
