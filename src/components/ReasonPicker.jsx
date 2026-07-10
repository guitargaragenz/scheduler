export const REASONS = ['Interrupted', 'Ran out of time', 'Waiting on parts', 'Other'];

// Pure presentational reason-picker — button row + conditional "Other" text
// input. Extracted from CatchUpInterview.jsx so Problem 3's BumpReasonModal
// (and any future reason-capture UI) can reuse the exact same look/behavior
// instead of drifting into a second copy.
export default function ReasonPicker({ reason, reasonText, onSelectReason, onReasonTextChange, reasons = REASONS }) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        {reasons.map(r => (
          <button
            key={r}
            onClick={() => onSelectReason(r)}
            style={{
              background: reason === r ? '#1a2e1a' : '#0f0f0f',
              color: reason === r ? '#4a9e5a' : '#888',
              border: 'none', borderRadius: 6, padding: '6px 12px',
              fontSize: 12, fontWeight: 500, cursor: 'pointer',
              outline: reason === r ? '1px solid #4a9e5a' : 'none',
            }}
          >
            {r}
          </button>
        ))}
      </div>

      {reason === 'Other' && (
        <input
          type="text"
          value={reasonText}
          onChange={e => onReasonTextChange(e.target.value)}
          placeholder="why?"
          style={{
            width: '100%', boxSizing: 'border-box', marginBottom: 8,
            background: '#0f0f0f', border: '1px solid #252525', borderRadius: 6,
            padding: '7px 10px', fontSize: 12, color: '#ccc', outline: 'none',
            fontFamily: 'inherit',
          }}
        />
      )}
    </div>
  );
}
