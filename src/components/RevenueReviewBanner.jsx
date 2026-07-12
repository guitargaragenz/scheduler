import { useState } from 'react';

function ReviewRow({ item, onDone, onCancelled }) {
  const [openAction, setOpenAction] = useState(null); // 'done' | 'cancelled' | null
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 0', borderTop: '1px solid #78350f' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12, color: '#fde68a', flex: 1, minWidth: 160 }}>
          <span style={{ fontWeight: 700 }}>#{item.job ?? item.id}</span> {item.mfr} {item.model}
          {item.parentId && <span style={{ color: '#fcd34d' }}> (split piece)</span>}
          {item.customer && <span style={{ color: '#fcd34d' }}> — {item.customer}</span>}
        </div>
        <button
          onClick={() => setOpenAction(openAction === 'done' ? null : 'done')}
          style={{
            background: openAction === 'done' ? '#166534' : 'none', border: '1px solid #22c55e',
            borderRadius: 6, color: '#bbf7d0', fontSize: 11, fontWeight: 700, padding: '4px 10px', cursor: 'pointer',
          }}
        >
          Done + invoiced
        </button>
        <button
          onClick={() => setOpenAction(openAction === 'cancelled' ? null : 'cancelled')}
          style={{
            background: openAction === 'cancelled' ? '#7f1d1d' : 'none', border: '1px solid #ef4444',
            borderRadius: 6, color: '#fca5a5', fontSize: 11, fontWeight: 700, padding: '4px 10px', cursor: 'pointer',
          }}
        >
          Cancelled
        </button>
      </div>

      {openAction === 'done' && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingLeft: 4 }}>
          <input
            type="number"
            autoFocus
            placeholder="Invoice amount, ex-GST ($)"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            style={{
              background: '#1e293b', border: '1px solid #334155', borderRadius: 6,
              color: '#e2e8f0', fontSize: 12, padding: '5px 8px', width: 140,
            }}
          />
          <button
            onClick={() => { if (amount !== '' && !isNaN(Number(amount))) onDone(item, amount); }}
            style={{
              background: '#22c55e', border: 'none', borderRadius: 6, color: '#052e16',
              fontSize: 11, fontWeight: 700, padding: '5px 12px', cursor: 'pointer',
            }}
          >
            Confirm
          </button>
        </div>
      )}

      {openAction === 'cancelled' && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingLeft: 4 }}>
          <input
            type="text"
            autoFocus
            placeholder="Why? (e.g. customer went quiet after invoice)"
            value={note}
            onChange={e => setNote(e.target.value)}
            style={{
              background: '#1e293b', border: '1px solid #334155', borderRadius: 6,
              color: '#e2e8f0', fontSize: 12, padding: '5px 8px', flex: 1, minWidth: 200,
            }}
          />
          <button
            onClick={() => onCancelled(item, note)}
            style={{
              background: '#ef4444', border: 'none', borderRadius: 6, color: '#450a0a',
              fontSize: 11, fontWeight: 700, padding: '5px 12px', cursor: 'pointer',
            }}
          >
            Confirm
          </button>
        </div>
      )}
    </div>
  );
}

export default function RevenueReviewBanner({ items, onDone, onCancelled, top = 56 }) {
  const [hidden, setHidden] = useState(false);
  const entries = Object.values(items || {});
  if (entries.length === 0 || hidden) return null;

  return (
    <div style={{
      position: 'fixed', top, left: 0, right: 0, zIndex: 999,
      background: '#78350f', borderBottom: '2px solid #f59e0b',
      padding: '10px 20px', display: 'flex', alignItems: 'flex-start', gap: 12,
    }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>$</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 700, color: '#fde68a', fontSize: 13, marginBottom: 4 }}>
          {entries.length === 1 ? '1 job disappeared' : `${entries.length} jobs disappeared`} from a sync — mark done + invoiced, or cancelled
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {entries.map(item => (
            <ReviewRow key={item.id} item={item} onDone={onDone} onCancelled={onCancelled} />
          ))}
        </div>
      </div>
      <button
        onClick={() => setHidden(true)}
        style={{
          background: 'none', border: '1px solid #f59e0b', borderRadius: 6,
          color: '#fde68a', fontSize: 12, padding: '4px 10px', cursor: 'pointer', flexShrink: 0,
        }}
      >
        Hide
      </button>
    </div>
  );
}
