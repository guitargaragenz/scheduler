import { useState } from 'react';
import ReasonPicker from './ReasonPicker.jsx';

function formatSlotLine(slot) {
  if (typeof slot !== 'string') return null;
  const parts = slot.split('-').map(Number);
  if (parts.length < 5 || parts.some(isNaN)) return null;
  const [y, mo, d, h, m] = parts;
  const date = new Date(y, mo - 1, d);
  const dayStr = date.toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' });
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const ampm = h < 12 ? 'AM' : 'PM';
  const mins = m === 0 ? '' : `:${String(m).padStart(2, '0')}`;
  return `${dayStr} · ${hour12}${mins} ${ampm}`;
}

// Same modal chrome as CloseDayModal.jsx/CatchUpInterview.jsx — prompts for a
// reason the moment a job gets dragged to a different day. Dismissing (skip)
// still resolves with { reason: 'unspecified' } so the bump entry never hangs
// unresolved.
export default function BumpReasonModal({ job, fromSlot, toSlot, onResolve }) {
  const [reason, setReason] = useState(null);
  const [reasonText, setReasonText] = useState('');

  const fromLabel = formatSlotLine(fromSlot);
  const toLabel = formatSlotLine(toSlot);
  const disabled = reason === 'Other' && !reasonText.trim();

  function handleConfirm() {
    onResolve({ reason, reasonText: reason === 'Other' ? reasonText : undefined });
  }

  function handleSkip() {
    onResolve({ reason: 'unspecified' });
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: 420, maxWidth: '90vw',
        background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 14,
        padding: 28, display: 'flex', flexDirection: 'column', gap: 16,
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#eee', marginBottom: 4 }}>
            Job bumped
          </div>
          <div style={{ fontSize: 13, color: '#666' }}>
            Why did #{job.job} {job.mfr} {job.model} move day?
          </div>
        </div>

        <div style={{ background: '#161616', border: '1px solid #252525', borderRadius: 10, padding: 14 }}>
          {(fromLabel || toLabel) && (
            <div style={{ fontSize: 11, color: '#555', marginBottom: 10 }}>
              {fromLabel || '?'} → {toLabel || '?'}
            </div>
          )}

          <ReasonPicker
            reason={reason}
            reasonText={reasonText}
            onSelectReason={setReason}
            onReasonTextChange={setReasonText}
          />

          <button
            onClick={handleConfirm}
            disabled={disabled}
            style={{
              width: '100%', marginTop: 4, background: '#1a2e1a', color: '#4a9e5a', border: 'none',
              borderRadius: 8, padding: '9px 0', fontSize: 13, fontWeight: 600,
              cursor: disabled ? 'default' : 'pointer',
              opacity: disabled ? 0.5 : 1,
            }}
          >
            Confirm
          </button>
        </div>

        <div
          onClick={handleSkip}
          style={{ fontSize: 11, color: '#444', textAlign: 'center', cursor: 'pointer' }}
        >
          skip
        </div>
      </div>
    </div>
  );
}
