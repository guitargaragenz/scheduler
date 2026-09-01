// The confirmation step between a keyword edit and the jobs actually moving.
//
// Nothing has been saved by the time this appears — not the jobs and not the
// keyword list itself. Cancel throws the whole edit away; "Go ahead" is the
// only path to a write. Same modal chrome as BumpReasonModal.jsx.
export default function KeywordChangePreviewModal({ moves = [], onConfirm, onCancel }) {
  const nothingMoves = moves.length === 0;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: 460, maxWidth: '90vw',
        background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 14,
        padding: 28, display: 'flex', flexDirection: 'column', gap: 16,
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#eee', marginBottom: 4 }}>
            Check this before it happens
          </div>
          <div style={{ fontSize: 13, color: '#888', lineHeight: 1.5 }}>
            {nothingMoves
              ? 'This keyword change moves no jobs. Every job stays on the bench it is on now.'
              : moves.length === 1
                ? 'This keyword change moves 1 job to a different bench:'
                : `This keyword change moves ${moves.length} jobs to a different bench:`}
          </div>
        </div>

        {!nothingMoves && (
          <div style={{
            background: '#161616', border: '1px solid #252525', borderRadius: 10,
            padding: 14, display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            {moves.map(m => (
              <div key={m.id} style={{ fontSize: 13, color: '#ddd' }}>
                <strong>#{m.job}</strong>
                <span style={{ color: '#888' }}>
                  {' — '}{m.from || 'no bench'} → {m.to || 'no bench'}
                </span>
              </div>
            ))}
          </div>
        )}

        <div style={{ fontSize: 12, color: '#666', lineHeight: 1.5 }}>
          Cancel leaves both the jobs and the keyword list exactly as they are now.
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{
            padding: '8px 16px', background: 'none', border: '1px solid #3a3a3a',
            borderRadius: 8, color: '#aaa', fontSize: 13, cursor: 'pointer',
          }}>Cancel</button>
          <button onClick={onConfirm} style={{
            padding: '8px 16px', background: '#1e3a5f', border: '1px solid #2563eb',
            borderRadius: 8, color: '#bfdbfe', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>Go ahead</button>
        </div>
      </div>
    </div>
  );
}
