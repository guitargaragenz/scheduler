import { createPortal } from 'react-dom';

// "These jobs need a bench" — the only place the app asks for one.
//
// Why a popup and not a marker on the card (Trevor, 2026-09-11): he works out
// of week view and day view, and only opens the bench board to add benches. A
// signal that lives on the board, or on a card he is not looking at, lets a
// freshly imported unplaced job sit there for days. This renders from App.jsx,
// on top of whatever page is open, so it reaches him wherever he is.
//
// It never decides anything itself. App.jsx passes the jobs; every row just
// opens that job's drawer, where the bench actually gets picked.
export default function NeedsBenchPopup({ jobs = [], onOpenJob, onDismiss }) {
  if (jobs.length === 0) return null;

  return createPortal(
    <div style={{
      position: 'fixed', right: 16, bottom: 16, zIndex: 1200,
      width: 320, maxHeight: '60vh', display: 'flex', flexDirection: 'column',
      background: '#1e293b', border: '1px solid #f59e0b', borderRadius: 12,
      boxShadow: '0 20px 48px rgba(0,0,0,0.6)',
    }}>
      <div style={{
        padding: '12px 14px', borderBottom: '1px solid #334155',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{ flex: 1, fontSize: 13, fontWeight: 800, color: '#fbbf24' }}>
          {jobs.length} job{jobs.length === 1 ? '' : 's'} need{jobs.length === 1 ? 's' : ''} a bench
        </div>
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0 }}
        >×</button>
      </div>

      <div style={{ padding: '8px 14px 4px', fontSize: 11, color: '#94a3b8' }}>
        Nothing in the description matched a bench, so they are parked on Admin.
        Tap one to file it.
      </div>

      <div style={{ overflowY: 'auto', padding: '6px 8px 10px' }}>
        {jobs.map(job => (
          <button
            key={job.id}
            onClick={() => onOpenJob(job)}
            style={{
              display: 'block', width: '100%', textAlign: 'left',
              background: '#0f172a', border: '1px solid #334155', borderRadius: 8,
              padding: '8px 10px', marginTop: 4, cursor: 'pointer', color: '#e2e8f0',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700 }}>
              #{job.job}{job.customer ? ` · ${job.customer}` : ''}
            </div>
            <div style={{
              fontSize: 11, color: '#94a3b8', marginTop: 2,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {job.desc || 'No description'}
            </div>
          </button>
        ))}
      </div>
    </div>,
    document.body
  );
}
