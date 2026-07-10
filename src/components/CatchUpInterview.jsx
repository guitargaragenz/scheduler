import { useState, useMemo } from 'react';
import { dayLabel } from '../utils/calendar.js';

const REASONS = ['Interrupted', 'Ran out of time', 'Waiting on parts', 'Other'];

// New, standalone here — not shared with Problem 3's bump-reason UI (not built
// yet). Steps through each stale day's unresolved bullets one at a time.
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

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              {REASONS.map(r => (
                <button
                  key={r}
                  onClick={() => setReason(r)}
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
                onChange={e => setReasonText(e.target.value)}
                placeholder="why?"
                style={{
                  width: '100%', boxSizing: 'border-box', marginBottom: 8,
                  background: '#0f0f0f', border: '1px solid #252525', borderRadius: 6,
                  padding: '7px 10px', fontSize: 12, color: '#ccc', outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
            )}

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
                Skip / leave as-is
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
