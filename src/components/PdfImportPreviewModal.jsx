// Brief G, Build 1a — the screen Trevor sees before a PDF import writes
// anything. Same modal chrome as SyncPreviewModal.jsx.
//
// Mandatory: the import handler builds the plan and stops here. Nothing
// reaches the database until Confirm is clicked.
//
// Three counts and two lists, deliberately no more. This is not a field-level
// diff — a wall of "customer changed from X to Y" for forty jobs is exactly
// the kind of dense screen that gets clicked through without being read. The
// two things worth Trevor's attention are which jobs are new, and which jobs
// have quietly dropped off the printout.

export default function PdfImportPreviewModal({ plan, onConfirm, onCancel, busy = false }) {
  const { filename, newLabels, existingCount, missing } = plan;
  const newCount = newLabels.length;

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
            Import jobs from Multitrack
          </div>
          <div style={{ fontSize: 13, color: '#666' }}>
            {newCount} new · {existingCount} already here · {missing.length} not in this one.
            Nothing is written until you confirm.
          </div>
          {filename && (
            <div style={{ fontSize: 11, color: '#444', marginTop: 4 }}>{filename}</div>
          )}
        </div>

        <div style={{ background: '#161616', border: '1px solid #252525', borderRadius: 10, padding: 14 }}>
          <div style={{ fontSize: 12, color: '#4a9e5a', fontWeight: 600, marginBottom: 6 }}>
            New jobs ({newCount})
          </div>
          {newCount === 0 ? (
            <div style={{ fontSize: 12, color: '#555' }}>Nothing new — every job on this printout is already here.</div>
          ) : (
            newLabels.map(n => (
              <div key={n.id} style={{ fontSize: 12, color: '#aaa', padding: '1px 0' }}>{n.label}</div>
            ))
          )}
        </div>

        {missing.length > 0 && (
          <div style={{ background: '#1a1410', border: '1px solid #3a2a15', borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 12, color: '#c88a3a', fontWeight: 600, marginBottom: 6 }}>
              On the board but not on this printout ({missing.length})
            </div>
            <div style={{ fontSize: 11, color: '#8a6a3a', marginBottom: 8 }}>
              Usually these have been finished or invoiced in Multitrack. This import leaves them
              exactly as they are — nothing is deleted or marked done. Check them by hand.
            </div>
            {missing.map(m => (
              <div key={m.id} style={{ fontSize: 12, color: '#a88', padding: '1px 0' }}>{m.label}</div>
            ))}
          </div>
        )}

        <div style={{ fontSize: 11, color: '#555', lineHeight: 1.5 }}>
          Your Tag, Hours, Action, VB and BL stay exactly as you left them — the Multitrack
          printout doesn’t carry them, so this import can’t change them.
        </div>

        <button
          onClick={onConfirm}
          disabled={busy}
          style={{
            width: '100%', background: '#1a2e1a', color: '#4a9e5a', border: 'none',
            borderRadius: 8, padding: '10px 0', fontSize: 13, fontWeight: 600,
            cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1,
          }}
        >
          {busy ? 'Importing…' : 'Import'}
        </button>

        <div
          onClick={busy ? undefined : onCancel}
          style={{ fontSize: 11, color: '#444', textAlign: 'center', cursor: busy ? 'default' : 'pointer' }}
        >
          cancel
        </div>
      </div>
    </div>
  );
}
