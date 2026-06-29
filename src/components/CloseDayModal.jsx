import { useState, useEffect, useCallback } from 'react';

const ACTIONS = ['kept', 'dropped', 'deferred'];

const ACTION_STYLES = {
  kept:     { background: '#1a2e1a', color: '#4a9e5a' },
  dropped:  { background: '#2a1a1a', color: '#9e4a4a' },
  deferred: { background: '#1a1a2e', color: '#4a5a9e' },
};

const ACTION_LABELS = {
  kept:     'Keep',
  dropped:  'Drop',
  deferred: 'Defer',
};

const ACTION_EXPLANATIONS = {
  kept:     "appears at top of tomorrow's log",
  dropped:  'stays in history, gone from view',
  deferred: 'returns to job shelf',
};

export default function CloseDayModal({ bullets = [], onClose }) {
  const [selections, setSelections] = useState(() => {
    const init = {};
    bullets.forEach(b => { init[b.id] = null; });
    return init;
  });

  const allResolved = bullets.length === 0 || bullets.every(b => selections[b.id] !== null);

  const select = useCallback((bulletId, action) => {
    setSelections(prev => ({ ...prev, [bulletId]: action }));
  }, []);

  useEffect(() => {
    const handleKey = e => {
      const row = document.activeElement?.closest('[data-bullet-id]');
      if (!row) return;
      const bulletId = row.dataset.bulletId;
      if (e.key === 'k' || e.key === 'K') select(bulletId, 'kept');
      if (e.key === 'd' || e.key === 'D') select(bulletId, 'dropped');
      if (e.key === 'f' || e.key === 'F') select(bulletId, 'deferred');
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [select]);

  const unresolvedCount = bullets.filter(b => selections[b.id] === null).length;

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
            End of day
          </div>
          <div style={{ fontSize: 13, color: '#666' }}>
            {unresolvedCount > 0
              ? `${unresolvedCount} unresolved — decide on each`
              : 'All resolved — ready to lock'}
          </div>
        </div>

        <div>
          {bullets.map(bullet => {
            const selected = selections[bullet.id];
            return (
              <div
                key={bullet.id}
                data-bullet-id={bullet.id}
                tabIndex={0}
                style={{
                  background: '#161616', border: '1px solid #252525',
                  borderRadius: 10, padding: 14, marginBottom: 10, outline: 'none',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = '#3a3a3a'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#252525'; }}
              >
                <div style={{ fontSize: 14, color: '#bbb', marginBottom: 12 }}>
                  {bullet.text}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {ACTIONS.map(action => {
                    const isSelected = selected === action;
                    return (
                      <button
                        key={action}
                        onClick={() => select(bullet.id, action)}
                        style={{
                          ...ACTION_STYLES[action],
                          border: 'none', borderRadius: 6, padding: '6px 14px',
                          fontSize: 13, fontWeight: 500, cursor: 'pointer',
                          opacity: selected === null || isSelected ? 1 : 0.4,
                          transition: 'opacity 0.15s',
                          outline: isSelected ? `1px solid ${ACTION_STYLES[action].color}` : 'none',
                        }}
                      >
                        {ACTION_LABELS[action]}
                      </button>
                    );
                  })}
                </div>
                {selected && (
                  <div style={{ fontSize: 11, color: '#555', marginTop: 8 }}>
                    {ACTION_EXPLANATIONS[selected]}
                  </div>
                )}
              </div>
            );
          })}

          {bullets.length === 0 && (
            <div style={{ fontSize: 14, color: '#555', textAlign: 'center', padding: '20px 0' }}>
              No unresolved bullets.
            </div>
          )}
        </div>

        {allResolved && (
          <button
            onClick={() => onClose(selections)}
            style={{
              background: '#2a2a2a', color: '#888', border: 'none',
              borderRadius: 8, padding: '10px 20px', width: '100%',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#333'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#2a2a2a'; }}
          >
            Lock day
          </button>
        )}

        <div style={{ fontSize: 11, color: '#333', textAlign: 'center' }}>
          🔒 Today's log locks when you close it. No editing after.
        </div>
      </div>
    </div>
  );
}
