import { useState, useEffect, useCallback } from 'react';
import { loadParkingLot, saveParkingLot, subscribeToParkingLot } from '../utils/supabase.js';
import { isSupabaseConfigured } from '../utils/supabase.js';

const SESSIONS = [
  '2026-06-13', '2026-06-15', '2026-06-17',
];

const INITIAL_ITEMS = [
  { id: 'pk-001', date: '2026-06-13', title: 'Online session journal', details: 'Build a journal to log sessions online — web-based editable version of parking-lot.md. Readable and editable from any device (iPhone too). Can add ideas, add detail to existing items. More details = quicker comms with Claude, less stuck in brain.', status: 'open' },
  { id: 'pk-002', date: '2026-06-13', title: 'Sunday board meeting with Claude + agents', details: 'Weekly planning session with agent "board members" to review projects and plan the week. LMM Council approach — multiple AI perspectives on decisions.', status: 'open' },
  { id: 'pk-003', date: '2026-06-13', title: 'Explore Claude Dispatch (beta)', details: 'Investigate using Dispatch in sessions.', status: 'open' },
  { id: 'pk-004', date: '2026-06-15', title: 'Cascade reschedule toggle (Settings)', details: 'When a job gets bumped by a GCal appointment and lands in a slot occupied by another job, cascade the bump: each displaced job pushes the next one down the queue until everything fits or we run out of week. Make it opt-in via a toggle in Settings (default off) so the schedule doesn\'t silently reshuffle itself.', status: 'open' },
  { id: 'pk-005', date: '2026-06-17', title: 'Desktop JobDrawer — schedule section not working', details: 'Added day picker + time + Place on Calendar to desktop drawer, pushed but didn\'t work. Needs investigation.', status: 'open' },
  { id: 'pk-006', date: '2026-06-17', title: 'Pomodoro timer alarm sound not working', details: 'Alarm not firing at end of session.', status: 'open' },
  { id: 'pk-007', date: '2026-06-17', title: 'Mobile — remove job from calendar', details: 'Added Remove from Calendar button to MobileJobSheet for scheduled jobs (can\'t DnD back to sidebar on mobile). Pushed but not verified working on device.', status: 'open' },
  { id: 'pk-008', date: '2026-06-17', title: 'Printable schedule / quick wins view', details: 'Live view of current week schedule + quick wins list. Print via Cmd+P → PDF. Could be part of this journal page.', status: 'open' },
];

function genId() {
  return 'pk-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function groupByDate(items) {
  const groups = {};
  items.forEach(item => {
    const d = item.date || 'Undated';
    if (!groups[d]) groups[d] = [];
    groups[d].push(item);
  });
  return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
}

export default function ParkingLotPage({ onBack }) {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState('open');
  const [expandedId, setExpandedId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDetails, setNewDetails] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10));
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  // Load from Firebase or seed with initial items
  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setItems(INITIAL_ITEMS);
      setLoaded(true);
      return;
    }
    loadParkingLot().then(data => {
      if (data.length === 0) {
        // First load — seed with existing parking lot items
        saveParkingLot(INITIAL_ITEMS);
        setItems(INITIAL_ITEMS);
      } else {
        setItems(data);
      }
      setLoaded(true);
    });
    const unsub = subscribeToParkingLot(data => setItems(data));
    return () => unsub();
  }, []);

  const persist = useCallback((updated) => {
    setItems(updated);
    if (isSupabaseConfigured()) {
      setSaving(true);
      saveParkingLot(updated).then(() => setSaving(false));
    }
  }, []);

  function toggleStatus(id) {
    persist(items.map(i => i.id === id ? { ...i, status: i.status === 'done' ? 'open' : 'done' } : i));
  }

  function updateDetails(id, details) {
    persist(items.map(i => i.id === id ? { ...i, details } : i));
  }

  function updateTitle(id, title) {
    persist(items.map(i => i.id === id ? { ...i, title } : i));
  }

  function deleteItem(id) {
    persist(items.filter(i => i.id !== id));
  }

  function addItem() {
    if (!newTitle.trim()) return;
    const item = { id: genId(), date: newDate, title: newTitle.trim(), details: newDetails.trim(), status: 'open' };
    const updated = [item, ...items];
    persist(updated);
    setNewTitle('');
    setNewDetails('');
    setNewDate(new Date().toISOString().slice(0, 10));
    setAdding(false);
    setExpandedId(item.id);
  }

  const filtered = filter === 'all' ? items : items.filter(i => i.status === filter);
  const groups = groupByDate(filtered);
  const openCount = items.filter(i => i.status === 'open').length;
  const doneCount = items.filter(i => i.status === 'done').length;

  return (
    <div style={{
      minHeight: '100vh', background: '#0d1117', color: '#e2e8f0',
      fontFamily: "'Courier New', monospace",
    }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: '#0d1117', borderBottom: '1px solid #1e293b',
        padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <button onClick={onBack} style={{
          background: 'none', border: '1px solid #334155', borderRadius: 6,
          color: '#64748b', fontSize: 13, padding: '5px 12px', cursor: 'pointer',
        }}>← Scheduler</button>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#f1f5f9' }}>Parking Lot</div>
          <div style={{ fontSize: 11, color: '#475569' }}>Guitar Garage NZ — ideas & deferred tasks</div>
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {saving && <span style={{ fontSize: 11, color: '#475569' }}>saving…</span>}
          {['open', 'done', 'all'].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              background: filter === f ? '#1e293b' : 'transparent',
              border: `1px solid ${filter === f ? '#4f46e5' : '#334155'}`,
              borderRadius: 6, color: filter === f ? '#a5b4fc' : '#64748b',
              fontSize: 11, padding: '4px 10px', cursor: 'pointer', textTransform: 'capitalize',
            }}>
              {f === 'open' ? `Open (${openCount})` : f === 'done' ? `Done (${doneCount})` : 'All'}
            </button>
          ))}
          <button onClick={() => { setAdding(true); setExpandedId(null); }} style={{
            background: '#1e3a5f', border: '1px solid #1d4ed8', borderRadius: 6,
            color: '#93c5fd', fontSize: 12, fontWeight: 700, padding: '5px 14px', cursor: 'pointer',
          }}>+ Add</button>
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px 16px' }}>

        {/* Add form */}
        {adding && (
          <div style={{
            background: '#111827', border: '1px solid #4f46e5', borderRadius: 10,
            padding: 16, marginBottom: 20,
          }}>
            <div style={{ fontSize: 12, color: '#6366f1', marginBottom: 10, fontWeight: 700 }}>NEW ITEM</div>
            <input
              autoFocus
              placeholder="Title…"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addItem()}
              style={{
                width: '100%', background: '#0d1117', border: '1px solid #334155',
                borderRadius: 6, padding: '8px 10px', color: '#f1f5f9', fontSize: 13,
                marginBottom: 8, boxSizing: 'border-box',
              }}
            />
            <textarea
              placeholder="Details (optional)…"
              value={newDetails}
              onChange={e => setNewDetails(e.target.value)}
              rows={3}
              style={{
                width: '100%', background: '#0d1117', border: '1px solid #334155',
                borderRadius: 6, padding: '8px 10px', color: '#94a3b8', fontSize: 12,
                marginBottom: 8, boxSizing: 'border-box', resize: 'vertical',
                fontFamily: 'inherit',
              }}
            />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="date" value={newDate}
                onChange={e => setNewDate(e.target.value)}
                style={{
                  background: '#0d1117', border: '1px solid #334155', borderRadius: 6,
                  padding: '5px 8px', color: '#64748b', fontSize: 11,
                }}
              />
              <div style={{ flex: 1 }} />
              <button onClick={() => setAdding(false)} style={{
                background: 'none', border: '1px solid #334155', borderRadius: 6,
                color: '#64748b', fontSize: 12, padding: '5px 14px', cursor: 'pointer',
              }}>Cancel</button>
              <button onClick={addItem} style={{
                background: '#4f46e5', border: 'none', borderRadius: 6,
                color: '#fff', fontSize: 12, fontWeight: 700, padding: '5px 16px', cursor: 'pointer',
              }}>Add</button>
            </div>
          </div>
        )}

        {!loaded && (
          <div style={{ color: '#475569', fontSize: 13, textAlign: 'center', padding: 40 }}>Loading…</div>
        )}

        {loaded && filtered.length === 0 && (
          <div style={{ color: '#475569', fontSize: 13, textAlign: 'center', padding: 40 }}>
            {filter === 'done' ? 'Nothing done yet.' : 'Nothing parked. Hit + Add to capture an idea.'}
          </div>
        )}

        {groups.map(([date, groupItems]) => (
          <div key={date} style={{ marginBottom: 28 }}>
            <div style={{
              fontSize: 10, color: '#334155', fontWeight: 700, letterSpacing: '.1em',
              textTransform: 'uppercase', marginBottom: 8, paddingBottom: 6,
              borderBottom: '1px solid #1e293b',
            }}>
              {date === 'Undated' ? 'Undated' : new Date(date + 'T12:00:00').toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>

            {groupItems.map(item => (
              <div key={item.id} style={{
                background: '#111827', borderRadius: 8, marginBottom: 8,
                border: `1px solid ${item.status === 'done' ? '#1e293b' : '#1e3a5f'}`,
                opacity: item.status === 'done' ? 0.5 : 1,
              }}>
                {/* Item header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
                  <input
                    type="checkbox"
                    checked={item.status === 'done'}
                    onChange={() => toggleStatus(item.id)}
                    style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#4f46e5', flexShrink: 0 }}
                  />
                  <input
                    value={item.title}
                    onChange={e => updateTitle(item.id, e.target.value)}
                    onBlur={e => updateTitle(item.id, e.target.value)}
                    style={{
                      flex: 1, background: 'transparent', border: 'none', outline: 'none',
                      color: item.status === 'done' ? '#475569' : '#f1f5f9',
                      fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                      textDecoration: item.status === 'done' ? 'line-through' : 'none',
                    }}
                  />
                  <button
                    onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                    style={{
                      background: 'none', border: 'none', color: '#475569', fontSize: 16,
                      cursor: 'pointer', padding: '0 4px', lineHeight: 1,
                    }}
                  >{expandedId === item.id ? '▲' : '▼'}</button>
                  <button
                    onClick={() => deleteItem(item.id)}
                    style={{
                      background: 'none', border: 'none', color: '#374151', fontSize: 14,
                      cursor: 'pointer', padding: '0 4px', lineHeight: 1,
                    }}
                    title="Delete"
                  >✕</button>
                </div>

                {/* Expanded details */}
                {expandedId === item.id && (
                  <div style={{ padding: '0 14px 12px 40px' }}>
                    <textarea
                      value={item.details}
                      onChange={e => updateDetails(item.id, e.target.value)}
                      placeholder="Add details, context, or next steps…"
                      rows={4}
                      style={{
                        width: '100%', background: '#0d1117', border: '1px solid #1e293b',
                        borderRadius: 6, padding: '8px 10px', color: '#94a3b8', fontSize: 12,
                        boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit',
                        lineHeight: 1.6,
                      }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
