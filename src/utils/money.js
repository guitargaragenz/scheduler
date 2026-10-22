// Exact-amount display — no rounding to whole dollars. A whole-dollar
// invoice shows as "260"; anything with cents shows them, so "273.48"
// reads back exactly as typed, never "273".
export function formatMoney(n) {
  const v = Number(n || 0);
  return Number.isInteger(v) ? v.toString() : v.toFixed(2);
}

// NZ GST. Invoices are typed GST-inclusive (what's on the Multitrack invoice);
// revenue is stored and shown ex-GST, because the weekly target is ex-GST.
export const GST_RATE = 0.15;

// Incl-GST -> ex-GST, rounded to the cent. Called in exactly one place:
// handleMarkDone in src/hooks/useJobs.js. No component converts.
export function exGstFromIncl(x) {
  return Math.round(x / (1 + GST_RATE) * 100) / 100;
}
