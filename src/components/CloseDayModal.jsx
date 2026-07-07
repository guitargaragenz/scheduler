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

function ActionRow({ selected, reason, onSelect, onReasonChange }) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 8 }}>
        {ACTIONS.map(action => {
          const isSelected = selected === action;
          return (
            <button
              key={action}
              onClick={() => onSelect(action)}
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
      {selected === 'deferred' && onReasonChange && (
        <input
          type="text"
          value={reason || ''}
          onChange={e => onReasonChange(e.target.value)}
          placeholder="why? (e.g. waiting on advice from Sam)"
          style={{
            marginTop: 8, width: '100%', boxSizing: 'border-box',
            background: '#0f0f0f', border: '1px solid #252525', borderRadius: 6,
            padding: '7px 10px', fontSize: 12, color: '#ccc', outline: 'none',
            fontFamily: 'inherit',
          }}
        />
      )}
    </div>
  );
}

export default function CloseDayModal({ bullets = [], onClose }) {
  // Split bullets into whole-bullet resolution (no checklist, or empty checklist)
  // vs per-item resolution (checklist bullets — only their unresolved 'todo' items need a decision).
  const wholeBullets = bullets.filter(b => !Array.isArray(b.checklist) || b.checklist.length === 0);
  const checklistBullets = bullets
    .filter(b => Array.isArray(b.checklist) && b.checklist.length > 0)
    .map(b => ({ ...b, unresolvedItems: b.checklist.filter(i => i.status === 'todo') }))
    .filter(b => b.unresolvedItems.length > 0);

  const [selections, setSelections] = useState(() => {
    const init = {};
    wholeBullets.forEach(b => { init[b.id] = null; });
    return init;
  });

  // { [bulletId]: { [itemId]: { action, reason } } }
  const [itemSelections, setItemSelections] = useState(() => {
    const init = {};
    checklistBullets.forEach(b => {
      init[b.id] = {};
      b.unresolvedItems.forEach(item => { init[b.id][item.id] = { action: null, reason: '' }; });
    });
    return init;
  });

  const select = useCallback((bulletId, action) => {
    setSelections(prev => ({ ...prev, [bulletId]: action }));
  }, []);

  const selectItem = useCallback((bulletId, itemId, action) => {
    setItemSelections(prev => ({
      ...prev,
      [bulletId]: { ...prev[bulletId], [itemId]: { ...prev[bulletId][itemId], action } },
    }));
  }, []);

  const setItemReason = useCallback((bulletId, itemId, reason) => {
    setItemSelections(prev => ({
      ...prev,
      [bulletId]: { ...prev[bulletId], [itemId]: { ...prev[bulletId][itemId], reason } },
    }));
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

  const wholeBulletsResolved = wholeBullets.every(b => selections[b.id] !== null);
  const checklistItemsResolved = checklistBullets.every(b =>
    b.unresolvedItems.every(item => {
      const sel = itemSelections[b.id]?.[item.id];
      if (!sel || !sel.action) return false;
      if (sel.action === 'deferred' && !sel.reason?.trim()) return false;
      return true;
    })
  );

  const allResolved = wholeBulletsResolved && checklistItemsResolved;
  const totalCount = wholeBullets.length + checklistBullets.reduce((n, b) => n + b.unresolvedItems.length, 0);
  const unresolvedCount =
    wholeBullets.filter(b => selections[b.id] === null).length +
    checklistBullets.reduce((n, b) => n + b.unresolvedItems.filter(item => {
      const sel = itemSelections[b.id]?.[item.id];
      return !sel || !sel.action || (sel.action === 'deferred' && !sel.reason?.trim());
    }).length, 0);

  function handleLock() {
    const migrations = { ...selections, checklist: {} };
    checklistBullets.forEach(b => {
      migrations.checklist[b.id] = {};
      b.unresolvedItems.forEach(item => {
        const sel = itemSelections[b.id][item.id];
        migrations.checklist[b.id][item.id] = { action: sel.action, reason: sel.reason };
      });
    });
    onClose(migrations);
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
            End of day
          </div>
          <div style={{ fontSize: 13, color: '#666' }}>
            {unresolvedCount > 0
              ? `${unresolvedCount} unresolved — decide on each`
              : 'All resolved — ready to lock'}
          </div>
        </div>

        <div>
          {wholeBullets.map(bullet => {
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
                <ActionRow
                  selected={selected}
                  onSelect={action => select(bullet.id, action)}
                />
              </div>
            );
          })}

          {checklistBullets.map(bullet => (
            <div
              key={bullet.id}
              style={{
                background: '#161616', border: '1px solid #252525',
                borderRadius: 10, padding: 14, marginBottom: 10,
              }}
            >
              <div style={{ fontSize: 14, color: '#bbb', marginBottom: 12 }}>
                {bullet.text}
              </div>
              {bullet.unresolvedItems.map((item, idx) => {
                const sel = itemSelections[bullet.id][item.id];
                return (
                  <div
                    key={item.id}
                    style={{
                      marginLeft: 12, paddingTop: idx > 0 ? 12 : 0,
                      marginTop: idx > 0 ? 12 : 0,
                      borderTop: idx > 0 ? '1px solid #1e1e1e' : 'none',
                    }}
                  >
                    <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>· {item.text}</div>
                    <ActionRow
                      selected={sel.action}
                      reason={sel.reason}
                      onSelect={action => selectItem(bullet.id, item.id, action)}
                      onReasonChange={reason => setItemReason(bullet.id, item.id, reason)}
                    />
                  </div>
                );
              })}
            </div>
          ))}

          {totalCount === 0 && (
            <div style={{ fontSize: 14, color: '#555', textAlign: 'center', padding: '20px 0' }}>
              No unresolved bullets.
            </div>
          )}
        </div>

        {allResolved && (
          <button
            onClick={handleLock}
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
