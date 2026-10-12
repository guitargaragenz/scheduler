// A job's Multitrack action (DG, GTS, WP …) as a small read-only label on the
// Daily and Weekly Logs. Trevor, 2026-10-13: he couldn't see the card chips'
// actions on the logs. Display only — setting and clearing stays on the cards
// and the sheet. Drawn like a lit card chip (ActionChips in JobCard.jsx) so it
// reads as the same thing. Blank action draws nothing.
//
// Callers keep this OUTSIDE the ellipsis-clipped name, fixed-size, so a long
// name can never hide it — and never fold it into the row's name or label,
// which feed aria-labels, tooltips and the Remove question.
export default function ActionLabel({ action }) {
  if (!action) return null;
  return (
    <span
      data-testid="action-label"
      style={{
        flex: 'none', display: 'inline-block', whiteSpace: 'nowrap',
        background: 'rgba(248,113,113,0.25)', border: '1px solid #f87171',
        borderRadius: 3, padding: '0 4px', fontSize: 9, fontWeight: 700,
        lineHeight: '14px', color: '#fecaca',
      }}
    >
      {action}
    </span>
  );
}
