// Shared between JobShelf.jsx (desktop) and DailyLogPage.jsx's mobile LogJobCard —
// a deferred checklist sub-step needs to stay visible on whichever job list Trevor
// is actually looking at, or he forgets it exists.
export default function DeferredItemsList({ items, onPullBackIn }) {
  if (!items.length) return null;
  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{ borderTop: '1px solid #334155', paddingTop: 7, marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 6 }}
    >
      {items.map(item => (
        <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, justifyContent: 'space-between' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>⏸ {item.text}</div>
            {item.reason && (
              <div style={{ fontSize: 10, color: '#64748b', fontStyle: 'italic', marginTop: 1 }}>
                {item.reason}
              </div>
            )}
          </div>
          {onPullBackIn && (
            <button
              onClick={() => onPullBackIn(item.id)}
              style={{
                flexShrink: 0, fontSize: 10, padding: '3px 8px', borderRadius: 6,
                border: '1px solid #334155', background: 'none', color: '#38bdf8',
                cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              pull back in
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
