// A job's DG or WP action as a small read-only label on the Daily and Weekly
// Logs — DG green ("good to go"), WP red ("something's holding it up"); every
// other action draws nothing (Trevor, 2026-10-13, after the first build). Trevor, 2026-10-13: he couldn't see the card chips'
// actions on the logs. Display only — setting and clearing stays on the cards
// and the sheet.
//
// Callers keep this OUTSIDE the ellipsis-clipped name, fixed-size, so a long
// name can never hide it — and never fold it into the row's name or label,
// which feed aria-labels, tooltips and the Remove question.
const LABEL_COLORS = {
  DG: { bg: 'rgba(74,222,128,0.25)', border: '#4ade80', text: '#bbf7d0' },
  WP: { bg: 'rgba(248,113,113,0.25)', border: '#f87171', text: '#fecaca' },
};

export default function ActionLabel({ action }) {
  const c = LABEL_COLORS[action];
  if (!c) return null;
  return (
    <span
      data-testid="action-label"
      style={{
        flex: 'none', display: 'inline-block', whiteSpace: 'nowrap',
        background: c.bg, border: `1px solid ${c.border}`,
        borderRadius: 3, padding: '0 4px', fontSize: 9, fontWeight: 700,
        lineHeight: '14px', color: c.text,
      }}
    >
      {action}
    </span>
  );
}
