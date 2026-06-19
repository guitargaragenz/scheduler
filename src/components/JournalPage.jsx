import { useState, useEffect, useCallback } from 'react';
import { loadJournal, saveJournal, subscribeToJournal, isFirebaseConfigured } from '../utils/firebase.js';

const SEED_ENTRY = {
  id: 'jnl-seed-001',
  date: '2026-06-20',
  title: 'Friday meeting — weekly workload summary',
  body: `STARTING NEXT WEEK
• #1505 Fender Princeton 112 Plus — Trident High School (1.5h) QUICK WIN — install fets, bias and test output. $300inc agreed.
• #1586 Yamaha Dynamic 040 — John McGovern (3h, GTS) — cracked top x3, stiff tuners, new strap buttons, restring
• #1637 Martin DCPA5 — Tawera Simpson-Rangi (3h, GTS) — loose finger brace, crack in body, restring SIC
• #1671 Fender Princeton 112 Plus — Richard Allen (1.5h) — diagnose first, then pots and jacks

SCHEDULED THIS WEEK
• #1520 Ampeg SVT 6 Pro — Pete Johanson
• #1619 Matchless DC30 — Sheep as Chips Ltd
• #1682–1690 Papamoa College — 8x ukuleles + Medelli keys

IN PROGRESS
• #1628 Martin 000-16 GT — Nick Newman (GTS, 3h) — split in side 300mm, pickup fallen off mount

ACTION ITEMS
• #1448 Gibson Hummingbird Pro — Annette Papuni — call customer, email drafted. 312 days. Not giving up.
• #1513 Behringer S32 Stage Box — Freedom Center — start ASAP, checklist in Tech Docs
• #1544 BeesNeez Lulu Fet — Te Pukenga / Toi Ohomai — start ASAP, checklist in Tech Docs
• #1635 Epiphone Les Paul Ultra — Adam Barrett — BLOCKED, need 3D printer (in storage, renovations)
• #1649 Casio CDP-S100 — Theo Zentgraf — find DC jack info, order part

WAITING / ON HOLD
• Parts (4): #1582 Roland Juno 106, #1632 Hofner 455/S, #1647 Marshall Haze 40, #1691 Schecter Diamond Series
• Customer (3): #1604 Dynaudio Air 15, #1616 Solar Flying Vee, #1626 Taylor 114CE
• Quote needed (3): #1609 QTX 2.1 Live Set, #1659 Maton EM225C, #1679 Eko Ranger XII

VB — VERBALLY BOOKED
• #1672 G&L ASAT Classic — Carolyn O'Neil
• #1676 Fender Blues Deluxe — Tony Procter
• #1693 Taylor 214CE-SB — Keith Thompson
• #1694 Takamine EF34-JC — Doug Dillon
• #1695 Fender Strat 89 — Doug Dillon
• #1696 Gibson Les Paul Custom — Doug Dillon`,
};

function genId() {
  return 'jnl-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function fmtDate(iso) {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-NZ', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });
}

function groupByDate(entries) {
  const groups = {};
  entries.forEach(e => {
    const d = e.date || 'Undated';
    if (!groups[d]) groups[d] = [];
    groups[d].push(e);
  });
  return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
}

export default function JournalPage({ onBack }) {
  const [entries, setEntries] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newBody, setNewBody] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setEntries([SEED_ENTRY]);
      setLoaded(true);
      return;
    }
    loadJournal().then(data => {
      if (data.length === 0) {
        saveJournal([SEED_ENTRY]);
        setEntries([SEED_ENTRY]);
        setExpandedId(SEED_ENTRY.id);
      } else {
        setEntries(data);
      }
      setLoaded(true);
    });
    const unsub = subscribeToJournal(data => setEntries(data));
    return () => unsub();
  }, []);

  const persist = useCallback((updated) => {
    setEntries(updated);
    if (isFirebaseConfigured()) {
      setSaving(true);
      saveJournal(updated).then(() => setSaving(false));
    }
  }, []);

  function addEntry() {
    if (!newTitle.trim()) return;
    const entry = { id: genId(), date: newDate, title: newTitle.trim(), body: newBody.trim() };
    const updated = [entry, ...entries];
    persist(updated);
    setNewTitle('');
    setNewBody('');
    setNewDate(new Date().toISOString().slice(0, 10));
    setAdding(false);
    setExpandedId(entry.id);
  }

  function updateBody(id, body) {
    persist(entries.map(e => e.id === id ? { ...e, body } : e));
  }

  function updateTitle(id, title) {
    persist(entries.map(e => e.id === id ? { ...e, title } : e));
  }

  function deleteEntry(id) {
    if (!confirm('Delete this entry?')) return;
    persist(entries.filter(e => e.id !== id));
  }

  function handlePrint() {
    window.print();
  }

  const groups = groupByDate(entries);

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', color: '#e2e8f0', fontFamily: "'Courier New', monospace" }}>
      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
          .journal-entry { border: 1px solid #ccc !important; background: white !important; color: black !important; page-break-inside: avoid; }
          .journal-body { color: #333 !important; }
        }
      `}</style>

      {/* Header */}
      <div className="no-print" style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: '#0d1117', borderBottom: '1px solid #1e293b',
        padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 16,
      }}>
        <button onClick={onBack} style={{
          background: 'none', border: '1px solid #334155', borderRadius: 6,
          color: '#64748b', fontSize: 13, padding: '5px 12px', cursor: 'pointer',
        }}>← Scheduler</button>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#f1f5f9' }}>Journal</div>
          <div style={{ fontSize: 11, color: '#475569' }}>Guitar Garage NZ — weekly notes & summaries</div>
        </div>

        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {saving && <span style={{ fontSize: 11, color: '#475569' }}>saving…</span>}
          <button onClick={handlePrint} style={{
            background: 'none', border: '1px solid #334155', borderRadius: 6,
            color: '#64748b', fontSize: 12, padding: '5px 12px', cursor: 'pointer',
          }}>Print</button>
          <button onClick={() => { setAdding(true); setExpandedId(null); }} style={{
            background: '#1e3a5f', border: '1px solid #1d4ed8', borderRadius: 6,
            color: '#93c5fd', fontSize: 12, fontWeight: 700, padding: '5px 14px', cursor: 'pointer',
          }}>+ New entry</button>
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '20px 16px' }}>

        {/* Add form */}
        {adding && (
          <div className="no-print" style={{
            background: '#111827', border: '1px solid #4f46e5', borderRadius: 10,
            padding: 16, marginBottom: 20,
          }}>
            <div style={{ fontSize: 12, color: '#6366f1', marginBottom: 10, fontWeight: 700 }}>NEW ENTRY</div>
            <input
              autoFocus
              placeholder="Title…"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              style={{
                width: '100%', background: '#0d1117', border: '1px solid #334155',
                borderRadius: 6, padding: '8px 10px', color: '#f1f5f9', fontSize: 13,
                marginBottom: 8, boxSizing: 'border-box', fontFamily: 'inherit',
              }}
            />
            <textarea
              placeholder="Notes…"
              value={newBody}
              onChange={e => setNewBody(e.target.value)}
              rows={6}
              style={{
                width: '100%', background: '#0d1117', border: '1px solid #334155',
                borderRadius: 6, padding: '8px 10px', color: '#94a3b8', fontSize: 12,
                marginBottom: 8, boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit',
                lineHeight: 1.7,
              }}
            />
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="date" value={newDate}
                onChange={e => setNewDate(e.target.value)}
                style={{
                  background: '#0d1117', border: '1px solid #334155', borderRadius: 6,
                  padding: '5px 8px', color: '#64748b', fontSize: 11, fontFamily: 'inherit',
                }}
              />
              <div style={{ flex: 1 }} />
              <button onClick={() => setAdding(false)} style={{
                background: 'none', border: '1px solid #334155', borderRadius: 6,
                color: '#64748b', fontSize: 12, padding: '5px 14px', cursor: 'pointer',
              }}>Cancel</button>
              <button onClick={addEntry} style={{
                background: '#4f46e5', border: 'none', borderRadius: 6,
                color: '#fff', fontSize: 12, fontWeight: 700, padding: '5px 16px', cursor: 'pointer',
              }}>Save</button>
            </div>
          </div>
        )}

        {!loaded && (
          <div style={{ color: '#475569', fontSize: 13, textAlign: 'center', padding: 40 }}>Loading…</div>
        )}

        {loaded && entries.length === 0 && (
          <div style={{ color: '#475569', fontSize: 13, textAlign: 'center', padding: 40 }}>
            No entries yet. Hit + New entry to start.
          </div>
        )}

        {groups.map(([date, groupEntries]) => (
          <div key={date} style={{ marginBottom: 28 }}>
            <div style={{
              fontSize: 10, color: '#334155', fontWeight: 700, letterSpacing: '.1em',
              textTransform: 'uppercase', marginBottom: 8, paddingBottom: 6,
              borderBottom: '1px solid #1e293b',
            }}>
              {date === 'Undated' ? 'Undated' : fmtDate(date)}
            </div>

            {groupEntries.map(entry => (
              <div key={entry.id} className="journal-entry" style={{
                background: '#111827', borderRadius: 8, marginBottom: 10,
                border: '1px solid #1e3a5f',
              }}>
                {/* Entry header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
                  <input
                    value={entry.title}
                    onChange={e => updateTitle(entry.id, e.target.value)}
                    onBlur={e => updateTitle(entry.id, e.target.value)}
                    style={{
                      flex: 1, background: 'transparent', border: 'none', outline: 'none',
                      color: '#f1f5f9', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                    }}
                  />
                  <button
                    className="no-print"
                    onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                    style={{
                      background: 'none', border: 'none', color: '#475569',
                      fontSize: 16, cursor: 'pointer', padding: '0 4px',
                    }}
                  >{expandedId === entry.id ? '▲' : '▼'}</button>
                  <button
                    className="no-print"
                    onClick={() => deleteEntry(entry.id)}
                    style={{
                      background: 'none', border: 'none', color: '#374151',
                      fontSize: 14, cursor: 'pointer', padding: '0 4px',
                    }}
                    title="Delete"
                  >✕</button>
                </div>

                {/* Body */}
                {expandedId === entry.id && (
                  <div style={{ padding: '0 14px 12px' }}>
                    <textarea
                      className="journal-body"
                      value={entry.body}
                      onChange={e => updateBody(entry.id, e.target.value)}
                      placeholder="Add notes…"
                      rows={Math.max(6, (entry.body || '').split('\n').length + 2)}
                      style={{
                        width: '100%', background: '#0d1117', border: '1px solid #1e293b',
                        borderRadius: 6, padding: '10px 12px', color: '#94a3b8', fontSize: 12,
                        boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit',
                        lineHeight: 1.7,
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
