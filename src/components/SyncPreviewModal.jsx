// Dry-run preview for the Google Calendar sync. Same modal chrome as
// BumpReasonModal.jsx. Shows exactly what a real sync would write — the plan is
// computed once in useGoogleCalendar.previewSync() and this only displays it —
// and nothing hits the calendar until Trevor clicks Confirm. The leftover list
// is surfaced for his eye only; the sync never touches those events.

function formatBlock(date, hour, minute) {
  const dayStr = date.toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' });
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const ampm = hour < 12 ? 'AM' : 'PM';
  const mins = minute === 0 ? '' : `:${String(minute).padStart(2, '0')}`;
  return `${dayStr} · ${hour12}${mins} ${ampm}`;
}

function formatStart(startISO) {
  if (!startISO) return '';
  const d = new Date(startISO);
  if (isNaN(d)) return '';
  return formatBlock(d, d.getHours(), d.getMinutes());
}

const ACTION_LABEL = {
  create: 'Create new event',
  update: 'Update existing event',
  skip: 'Skip',
};
const ACTION_COLOR = {
  create: '#4a9e5a',
  update: '#7dd3fc',
  skip: '#666',
};

export default function SyncPreviewModal({ plan, onConfirm, onCancel }) {
  const { jobPlans, leftovers } = plan;

  const creates = jobPlans.reduce((n, jp) => n + jp.blocks.filter(b => b.action === 'create').length, 0);
  const updates = jobPlans.reduce((n, jp) => n + jp.blocks.filter(b => b.action === 'update').length, 0);
  const deletes = jobPlans.reduce((n, jp) => n + jp.deleteIds.length, 0);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: 520, maxWidth: '92vw',
        background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 14,
        padding: 28, display: 'flex', flexDirection: 'column', gap: 16,
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#eee', marginBottom: 4 }}>
            Preview calendar sync
          </div>
          <div style={{ fontSize: 13, color: '#666' }}>
            {creates} new · {updates} update{updates === 1 ? '' : 's'}
            {deletes > 0 ? ` · ${deletes} removed` : ''}. Nothing is written until you confirm.
          </div>
        </div>

        <div style={{ background: '#161616', border: '1px solid #252525', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {jobPlans.length === 0 && (
            <div style={{ fontSize: 12, color: '#555' }}>No scheduled jobs to sync this week.</div>
          )}
          {jobPlans.map(jp => (
            <div key={jp.jobId}>
              <div style={{ fontSize: 13, color: '#ccc', fontWeight: 600, marginBottom: 4 }}>
                {jp.jobLabel}
              </div>
              {jp.blocks.map((b, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#888', padding: '1px 0' }}>
                  <span style={{ color: ACTION_COLOR[b.action] }}>{ACTION_LABEL[b.action]}</span>
                  <span>{formatBlock(b.date, b.hour, b.minute)}</span>
                </div>
              ))}
              {jp.deleteIds.length > 0 && (
                <div style={{ fontSize: 11, color: '#a15', padding: '1px 0' }}>
                  Remove {jp.deleteIds.length} old event{jp.deleteIds.length === 1 ? '' : 's'} (block no longer scheduled)
                </div>
              )}
            </div>
          ))}
        </div>

        {leftovers.length > 0 && (
          <div style={{ background: '#1a1410', border: '1px solid #3a2a15', borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 12, color: '#c88a3a', fontWeight: 600, marginBottom: 6 }}>
              Possible leftover — not touched, review / delete
            </div>
            <div style={{ fontSize: 11, color: '#8a6a3a', marginBottom: 8 }}>
              #-tagged calendar events this sync didn’t match to a job. They may be old copies from
              a moved, renamed or split job. The sync leaves them alone — check them by hand.
            </div>
            {leftovers.map(lo => (
              <div key={lo.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#a88', padding: '1px 0' }}>
                <span>{lo.summary}</span>
                <span>{formatStart(lo.start)}</span>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={onConfirm}
          disabled={jobPlans.length === 0}
          style={{
            width: '100%', background: '#1a2e1a', color: '#4a9e5a', border: 'none',
            borderRadius: 8, padding: '10px 0', fontSize: 13, fontWeight: 600,
            cursor: jobPlans.length === 0 ? 'default' : 'pointer',
            opacity: jobPlans.length === 0 ? 0.5 : 1,
          }}
        >
          Confirm &amp; sync
        </button>

        <div
          onClick={onCancel}
          style={{ fontSize: 11, color: '#444', textAlign: 'center', cursor: 'pointer' }}
        >
          cancel
        </div>
      </div>
    </div>
  );
}
