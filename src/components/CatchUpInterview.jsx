import { useState, useMemo } from 'react';
import { dayLabel } from '../utils/calendar.js';
import ReasonPicker from './ReasonPicker.jsx';

// Steps through each stale day's unresolved bullets one at a time. Reason
// picker UI is shared with Problem 3's BumpReasonModal via ReasonPicker.jsx.
export default function CatchUpInterview({ days = [], logs = {}, onClose }) {
  const steps = useMemo(() => {
    const out = [];
    days.forEach(dateKey => {
      const day = logs[dateKey];
      if (!day) return;
      day.bullets.forEach(b => {
        const hasChecklist = Array.isArray(b.checklist) && b.checklist.length > 0;
        const unresolved = hasChecklist
          ? b.checklist.some(i => i.status === 'todo')
          : !b.done && b.migration == null;
        if (unresolved) out.push({ dateKey, bullet: b });
      });
    });
    return out;
  }, [days, logs]);

  const [index, setIndex] = useState(0);
  const [resolutions, setResolutions] = useState({});
  const [reason, setReason] = useState(null);
  const [reasonText, setReasonText] = useState('');

  const step = steps[index];
  const atEnd = index >= steps.length;

  function recordAndAdvance(action) {
    if (step) {
      setResolutions(prev => ({
        ...prev,
        [step.dateKey]: {
          ...(prev[step.dateKey] || {}),
          [step.bullet.id]: { action, reason, reasonText: reason === 'Other' ? reasonText : undefined },
        },
      }));
    }
    setReason(null);
    setReasonText('');
    setIndex(i => i + 1);
  }

  function handleCarry() {
    recordAndAdvance('carry');
  }

  function handleSkip() {
    recordAndAdvance('skip');
  }

  // "Simple close" — marks the item done and stops the nag-loop. Doesn't touch
  // revenue: bullet.jobId is carried in the resolution so a future pass can
  // route this through the real Done+invoiced flow (usePendingRevenueReview /
  // handleMarkDone) instead of a plain done-stamp.
  function handleComplete() {
    recordAndAdvance('complete');
  }

  function handleFinish() {
    onClose(resolutions);
  }

  function handleCancel() {
    onClose(null);
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: 480, maxWidth: '90vw',
        background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 14,
        padding: 28, display: 'flex', flexDirection: 'column', gap: 16,
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#eee', marginBottom: 4 }}>
            Catch-up
          </div>
          <div style={{ fontSize: 13, color: '#666' }}>
            {steps.length === 0
              ? 'Nothing unresolved.'
              : atEnd
                ? 'All done — ready to carry forward.'
                : `${index + 1} of ${steps.length}`}
          </div>
        </div>

        {!atEnd && step && (
          <div style={{ background: '#161616', border: '1px solid #252525', borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 11, color: '#555', marginBottom: 6 }}>
              {dayLabel(new Date(step.dateKey + 'T00:00:00'))}
            </div>
            <div style={{ fontSize: 14, color: '#bbb', marginBottom: 14 }}>
              {step.bullet.text}
            </div>

            <ReasonPicker
              reason={reason}
              reasonText={reasonText}
              onSelectReason={setReason}
              onReasonTextChange={setReasonText}
            />

            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                onClick={handleCarry}
                disabled={reason === 'Other' && !reasonText.trim()}
                style={{
                  flex: 1, background: '#1a2e1a', color: '#4a9e5a', border: 'none',
                  borderRadius: 8, padding: '9px 0', fontSize: 13, fontWeight: 600,
                  cursor: reason === 'Other' && !reasonText.trim() ? 'default' : 'pointer',
                  opacity: reason === 'Other' && !reasonText.trim() ? 0.5 : 1,
                }}
              >
                Carry forward
              </button>
              <button
                onClick={handleSkip}
                style={{
                  flex: 1, background: '#2a2a2a', color: '#888', border: 'none',
                  borderRadius: 8, padding: '9px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Skip
              </button>
              <button
                onClick={handleComplete}
                style={{
                  flex: 1, background: '#1a2536', color: '#5b9bd5', border: 'none',
                  borderRadius: 8, padding: '9px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}
              >
                Job complete
              </button>
            </div>
          </div>
        )}

        {(atEnd || steps.length === 0) && (
          <button
            onClick={handleFinish}
            style={{
              background: '#2a2a2a', color: '#888', border: 'none',
              borderRadius: 8, padding: '10px 20px', width: '100%',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#333'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#2a2a2a'; }}
          >
            Carry forward selected
          </button>
        )}

        <div
          onClick={handleCancel}
          style={{ fontSize: 11, color: '#444', textAlign: 'center', cursor: 'pointer' }}
        >
          cancel
        </div>
      </div>
    </div>
  );
}
