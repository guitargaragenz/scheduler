// "🔧 2 jobs may have parts now — #1679, #1705   ✕"
//
// The Week View sidebar already has a PARTS ARRIVED? group. Trevor's verdict on
// seeing it live, 2026-08-03: "it's too easy to miss" — it sits in a panel that
// is closed by default, on a view he is not in most of the day. So this bar is
// rendered at App level, above every screen, and is the same bar wherever he is.
//
// No timer and no auto-dismiss, on purpose ("stay until I toggle it"). The only
// thing that takes it off screen is ✕ — or the jobs genuinely stopping
// qualifying, which is not dismissal, it is the news changing.
export default function PartsArrivedBanner({ jobs = [], onJobClick, onDismiss, top = 56 }) {
  if (jobs.length === 0) return null;

  return (
    <div style={{
      position: 'fixed', top, left: 0, right: 0, zIndex: 1000,
      background: '#14532d', borderBottom: '2px solid #22c55e',
      padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>🔧</span>
      <div style={{ flex: 1, fontSize: 13, color: '#bbf7d0', lineHeight: 1.5 }}>
        <span style={{ fontWeight: 700 }}>
          {jobs.length === 1 ? '1 job may have parts now' : `${jobs.length} jobs may have parts now`}
        </span>
        {' — '}
        {jobs.map((job, i) => (
          <span key={job.id}>
            {i > 0 && ', '}
            <span
              onClick={() => onJobClick && onJobClick(job)}
              title={`${job.mfr || ''} ${job.model || ''}`.trim() || 'Open this job'}
              style={{
                color: '#86efac', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline',
              }}
            >#{job.job}</span>
          </span>
        ))}
        {/* The app knows Multitrack stopped saying "waiting". It does NOT know
            the parts turned up, and it must never imply otherwise — WP is
            Trevor's own tag and only he clears it, in the Jobs Sheet. */}
        <span style={{ color: '#4ade80', marginLeft: 8, fontSize: 11 }}>
          still tagged WP, but Multitrack no longer says waiting
        </span>
      </div>
      <button
        onClick={onDismiss}
        title="Dismiss — these jobs won't be raised again unless they get stuck and come free again"
        style={{
          background: 'none', border: '1px solid #22c55e', borderRadius: 6,
          color: '#bbf7d0', fontSize: 14, lineHeight: 1, padding: '5px 11px',
          cursor: 'pointer', flexShrink: 0,
        }}
      >✕</button>
    </div>
  );
}
