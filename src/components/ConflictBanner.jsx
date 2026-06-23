export default function ConflictBanner({ events, onDismiss }) {
  if (!events || events.length === 0) return null;

  return (
    <div style={{
      position: 'fixed', top: 56, left: 0, right: 0, zIndex: 1000,
      background: '#7c2d12', borderBottom: '2px solid #ef4444',
      padding: '10px 20px', display: 'flex', alignItems: 'flex-start', gap: 12,
    }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>⚠</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, color: '#fecaca', fontSize: 13, marginBottom: 4 }}>
          {events.length === 1 ? '1 job was moved' : `${events.length} jobs were moved`} by a Google Calendar appointment while you were away
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {events.map((e, i) => (
            <div key={i} style={{ fontSize: 12, color: '#fca5a5' }}>
              {e.unscheduled
                ? `#${e.jobNum} ${e.mfr} ${e.model} — removed from calendar, no room left this week`
                : `#${e.jobNum} ${e.mfr} ${e.model} → moved to ${e.newSlot}`
              }
              <span style={{ color: '#f87171', marginLeft: 8, fontSize: 11 }}>
                {new Date(e.ts).toLocaleString('en-NZ', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
              </span>
            </div>
          ))}
        </div>
      </div>
      <button
        onClick={onDismiss}
        style={{
          background: 'none', border: '1px solid #ef4444', borderRadius: 6,
          color: '#fca5a5', fontSize: 12, padding: '4px 10px', cursor: 'pointer', flexShrink: 0,
        }}
      >
        Dismiss
      </button>
    </div>
  );
}
