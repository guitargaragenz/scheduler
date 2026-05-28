import { useState, useEffect, useRef } from 'react';
import {
  getAllParts, getAllStorages, getPartLots,
  totalStock, isLowStock, stockByStorage,
  addStock, removeStock,
} from '../utils/partsbox.js';

const DRAWER_WIDTH = 440;

export default function PartsDrawer({ onClose }) {
  const [parts, setParts] = useState([]);
  const [storages, setStorages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showLowOnly, setShowLowOnly] = useState(false);
  const [action, setAction] = useState(null); // { partId, type, qty, storageId, comment, lots? }
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const searchRef = useRef(null);

  useEffect(() => {
    searchRef.current?.focus();
    Promise.all([getAllParts(), getAllStorages()])
      .then(([p, s]) => {
        setParts(p);
        setStorages(s);
        setLoading(false);
      })
      .catch(e => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  const storageMap = Object.fromEntries(storages.map(s => [s['storage/id'], s['storage/name']]));

  // Parse terms: space-split, but "quoted phrases" stay together. -word or -"phrase" excludes.
  function parseTerms(raw) {
    const tokens = [];
    const re = /(-?"[^"]*"|-?\S+)/g;
    let m;
    while ((m = re.exec(raw)) !== null) {
      let tok = m[1];
      const negate = tok.startsWith('-');
      if (negate) tok = tok.slice(1);
      if (tok.startsWith('"') && tok.endsWith('"')) tok = tok.slice(1, -1);
      if (tok) tokens.push({ term: tok.toLowerCase(), negate });
    }
    return tokens;
  }
  const tokens = parseTerms(search);
  const positive = tokens.filter(t => !t.negate);
  const negative = tokens.filter(t => t.negate);

  function matchesTerm(p, t) {
    return (
      p['part/name']?.toLowerCase().includes(t) ||
      p['part/description']?.toLowerCase().includes(t) ||
      p['part/mpn']?.toLowerCase().includes(t) ||
      (p['part/tags'] || []).some(tag => tag.toLowerCase().includes(t)) ||
      (p['part/stock'] || []).some(s =>
        (storageMap[s['stock/storage-id']] || '').toLowerCase().includes(t)
      )
    );
  }

  const filtered = parts
    .filter(p => {
      if (showLowOnly && !isLowStock(p)) return false;
      if (tokens.length === 0) return true;
      if (positive.length > 0 && !positive.every(({ term }) => matchesTerm(p, term))) return false;
      if (negative.some(({ term }) => matchesTerm(p, term))) return false;
      return true;
    })
    .sort((a, b) => (a['part/name'] || '').localeCompare(b['part/name'] || ''));

  async function confirmAction() {
    if (!action) return;
    const { partId, type, qty, storageId, comment } = action;
    if (!storageId) { setToast('Pick a storage location'); return; }
    if (!qty || qty < 1) { setToast('Quantity must be at least 1'); return; }
    setSaving(true);
    try {
      if (type === 'add') {
        await addStock(partId, storageId, qty, comment);
      } else {
        await removeStock(partId, storageId, qty, comment);
      }
      // Refresh just the affected part
      const fresh = await getAllParts();
      setParts(fresh);
      setToast(type === 'add' ? `Added ${qty} to stock` : `Removed ${qty} from stock`);
      setAction(null);
    } catch (e) {
      setToast(`Error: ${e.message}`);
    }
    setSaving(false);
  }

  async function openAction(partId, type) {
    if (type === 'remove') {
      // Fetch real per-lot quantities so we cap correctly
      setAction({ partId, type, qty: 1, storageId: '', comment: '', lots: null });
      try {
        const lots = await getPartLots(partId);
        const available = lots.filter(l => l['source/quantity'] > 0);
        const first = available[0];
        setAction({
          partId, type, qty: 1,
          storageId: first?.['source/storage-id'] || '',
          comment: '',
          lots: available,
        });
      } catch {
        setAction(null);
        setToast('Could not load stock lots');
      }
    } else {
      setAction({ partId, type, qty: 1, storageId: storages[0]?.['storage/id'] || '', comment: '', lots: null });
    }
  }

  return (
    <div style={{
      position: 'fixed', top: 0, right: 0, width: DRAWER_WIDTH, height: '100vh',
      background: '#0f1a2e', borderLeft: '1px solid #1e3a5f',
      display: 'flex', flexDirection: 'column', zIndex: 200,
      fontFamily: 'system-ui, sans-serif',
      boxShadow: '-8px 0 32px rgba(0,0,0,0.6)',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 18px 12px', borderBottom: '1px solid #1e3a5f',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 800, color: '#e2e8f0', letterSpacing: -0.3 }}>
            Parts Inventory
          </div>
          {!loading && !error && (
            <div style={{ fontSize: 11, color: '#475569', marginTop: 1 }}>
              {filtered.length} of {parts.length} parts
              {showLowOnly && <span style={{ color: '#f59e0b', marginLeft: 6 }}>· low stock filter on</span>}
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none', color: '#64748b', fontSize: 20,
            cursor: 'pointer', lineHeight: 1, padding: '2px 6px',
          }}
        >×</button>
      </div>

      {/* Search + filter */}
      <div style={{ padding: '12px 18px', borderBottom: '1px solid #1e3a5f', flexShrink: 0 }}>
        <input
          ref={searchRef}
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder='cap 10uF -SMD  ·  "PTS-BIN 4" for exact location'
          style={{
            width: '100%', boxSizing: 'border-box',
            background: '#1e293b', border: '1px solid #334155',
            borderRadius: 6, padding: '8px 12px', fontSize: 13,
            color: '#e2e8f0', outline: 'none',
          }}
        />
        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowLowOnly(false)}
            style={{
              fontSize: 11, padding: '4px 10px', borderRadius: 5, cursor: 'pointer', border: 'none',
              background: !showLowOnly ? '#1d4ed8' : '#1e293b',
              color: !showLowOnly ? '#bfdbfe' : '#64748b',
              fontWeight: !showLowOnly ? 700 : 400,
            }}
          >All parts</button>
          <button
            onClick={() => setShowLowOnly(true)}
            style={{
              fontSize: 11, padding: '4px 10px', borderRadius: 5, cursor: 'pointer', border: 'none',
              background: showLowOnly ? '#92400e' : '#1e293b',
              color: showLowOnly ? '#fcd34d' : '#64748b',
              fontWeight: showLowOnly ? 700 : 400,
            }}
          >Low stock</button>
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
        {loading && (
          <div style={{ padding: 24, textAlign: 'center', color: '#475569', fontSize: 13 }}>
            Loading inventory...
          </div>
        )}
        {error && (
          <div style={{ padding: 24, color: '#ef4444', fontSize: 13 }}>
            {error}
          </div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: '#475569', fontSize: 13 }}>
            No parts match
          </div>
        )}
        {!loading && filtered.map(part => {
          const pid = part['part/id'];
          const name = part['part/name'] || '—';
          const desc = part['part/description'] || '';
          const total = totalStock(part);
          const low = isLowStock(part);
          const locs = stockByStorage(part);
          const isActing = action?.partId === pid;
          const partTags = part['part/tags'] || [];

          return (
            <div
              key={pid}
              style={{
                padding: '10px 18px',
                borderBottom: '1px solid #0f1e35',
                background: isActing ? '#0d2040' : 'transparent',
              }}
            >
              {/* Part row */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13, fontWeight: 700, color: '#cbd5e1',
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {name}
                  </div>
                  {desc && (
                    <div style={{
                      fontSize: 11, color: '#475569', marginTop: 1,
                      overflow: 'hidden', textOverflow: 'ellipsis',
                      display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                    }}>
                      {desc}
                    </div>
                  )}
                  {/* Storage breakdown */}
                  {locs.length > 0 && (
                    <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {locs.map(({ sid, qty }) => (
                        <span key={sid} style={{
                          fontSize: 10, background: '#1e293b', border: '1px solid #334155',
                          borderRadius: 4, padding: '1px 6px', color: '#94a3b8',
                        }}>
                          {storageMap[sid] || sid}: {qty}
                        </span>
                      ))}
                    </div>
                  )}
                  {/* Tags — PB* = physical location (amber), others = category (slate) */}
                  {partTags.length > 0 && (
                    <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {partTags.map(tag => {
                        const isPB = /^PB\d/i.test(tag);
                        return (
                          <button
                            key={tag}
                            onClick={() => setSearch(isPB ? `"${tag}"` : tag)}
                            title={isPB ? `Filter to ${tag} · Parts Bin ${tag.slice(2,3)}, Row ${tag.slice(3,4)}, Col ${tag.slice(4)}` : `Filter to tag: ${tag}`}
                            style={{
                              fontSize: 10, padding: '1px 6px', borderRadius: 4,
                              cursor: 'pointer', border: 'none',
                              background: isPB ? '#451a03' : '#1e293b',
                              color: isPB ? '#fbbf24' : '#64748b',
                              fontWeight: isPB ? 700 : 400,
                            }}
                          >
                            {tag}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div style={{ flexShrink: 0, textAlign: 'right' }}>
                  <div style={{
                    fontSize: 18, fontWeight: 800,
                    color: low ? '#f59e0b' : '#22c55e',
                    lineHeight: 1,
                  }}>
                    {total}
                  </div>
                  {low && (
                    <div style={{ fontSize: 9, color: '#f59e0b', fontWeight: 700, marginTop: 1 }}>
                      LOW
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 4, marginTop: 6, justifyContent: 'flex-end' }}>
                    <button
                      onClick={() => isActing && action.type === 'add' ? setAction(null) : openAction(pid, 'add')}
                      style={{
                        fontSize: 11, padding: '3px 8px', borderRadius: 4, cursor: 'pointer',
                        border: '1px solid #166534',
                        background: isActing && action.type === 'add' ? '#166534' : '#0f2d1f',
                        color: '#86efac',
                      }}
                    >+ Add</button>
                    <button
                      onClick={() => isActing && action.type === 'remove' ? setAction(null) : openAction(pid, 'remove')}
                      disabled={total <= 0}
                      style={{
                        fontSize: 11, padding: '3px 8px', borderRadius: 4, cursor: total <= 0 ? 'not-allowed' : 'pointer',
                        border: '1px solid #7f1d1d',
                        background: isActing && action.type === 'remove' ? '#7f1d1d' : '#1c0a0a',
                        color: total <= 0 ? '#4b2020' : '#fca5a5',
                        opacity: total <= 0 ? 0.5 : 1,
                      }}
                    >− Use</button>
                  </div>
                </div>
              </div>

              {/* Inline action form */}
              {isActing && (
                <div style={{
                  marginTop: 10, padding: '10px 12px',
                  background: '#0a1628', borderRadius: 6, border: '1px solid #1e3a5f',
                }}>
                  <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8, fontWeight: 600 }}>
                    {action.type === 'add' ? 'Add stock' : 'Use / remove stock'}
                  </div>

                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ fontSize: 10, color: '#64748b', display: 'block', marginBottom: 3 }}>
                        Qty{action.type === 'remove' && action.lots && (() => {
                          const lot = action.lots.find(l => l['source/storage-id'] === action.storageId);
                          return lot ? ` (max ${lot['source/quantity']})` : '';
                        })()}
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={action.type === 'remove' && action.lots
                          ? (action.lots.find(l => l['source/storage-id'] === action.storageId)?.['source/quantity'] || 999)
                          : undefined}
                        value={action.qty}
                        onChange={e => {
                          const val = parseInt(e.target.value) || 1;
                          const lot = action.lots?.find(l => l['source/storage-id'] === action.storageId);
                          const max = lot?.['source/quantity'] || 999;
                          setAction(a => ({ ...a, qty: Math.min(val, max) }));
                        }}
                        style={{
                          width: '100%', boxSizing: 'border-box',
                          background: '#1e293b', border: '1px solid #334155',
                          borderRadius: 4, padding: '5px 8px', fontSize: 13,
                          color: '#e2e8f0', outline: 'none',
                        }}
                      />
                    </div>
                    <div style={{ flex: 2 }}>
                      <label style={{ fontSize: 10, color: '#64748b', display: 'block', marginBottom: 3 }}>Location</label>
                      {action.type === 'remove' && !action.lots ? (
                        <div style={{ fontSize: 12, color: '#475569', padding: '6px 0' }}>Loading lots…</div>
                      ) : (
                        <select
                          value={action.storageId}
                          onChange={e => {
                            const sid = e.target.value;
                            const lot = action.lots?.find(l => l['source/storage-id'] === sid);
                            setAction(a => ({
                              ...a,
                              storageId: sid,
                              qty: Math.min(a.qty, lot?.['source/quantity'] || 1),
                            }));
                          }}
                          style={{
                            width: '100%', boxSizing: 'border-box',
                            background: '#1e293b', border: '1px solid #334155',
                            borderRadius: 4, padding: '5px 8px', fontSize: 12,
                            color: '#e2e8f0', outline: 'none',
                          }}
                        >
                          {action.type === 'add'
                            ? storages.map(s => (
                                <option key={s['storage/id']} value={s['storage/id']}>
                                  {s['storage/name']}
                                </option>
                              ))
                            : (action.lots || []).map(l => {
                                const sid = l['source/storage-id'];
                                return (
                                  <option key={sid} value={sid}>
                                    {storageMap[sid] || sid} ({l['source/quantity']} available)
                                  </option>
                                );
                              })
                          }
                        </select>
                      )}
                    </div>
                  </div>

                  <div style={{ marginBottom: 8 }}>
                    <label style={{ fontSize: 10, color: '#64748b', display: 'block', marginBottom: 3 }}>Note (optional)</label>
                    <input
                      type="text"
                      value={action.comment}
                      onChange={e => setAction(a => ({ ...a, comment: e.target.value }))}
                      placeholder={action.type === 'remove' ? 'e.g. Job 456 Fender Strat' : 'e.g. Restocked from supplier'}
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        background: '#1e293b', border: '1px solid #334155',
                        borderRadius: 4, padding: '5px 8px', fontSize: 12,
                        color: '#e2e8f0', outline: 'none',
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={confirmAction}
                      disabled={saving}
                      style={{
                        flex: 1, padding: '7px 0', borderRadius: 5, border: 'none',
                        background: action.type === 'add' ? '#166534' : '#7f1d1d',
                        color: action.type === 'add' ? '#bbf7d0' : '#fecaca',
                        fontSize: 12, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
                        opacity: saving ? 0.6 : 1,
                      }}
                    >
                      {saving ? 'Saving...' : action.type === 'add' ? 'Add to stock' : 'Remove from stock'}
                    </button>
                    <button
                      onClick={() => setAction(null)}
                      style={{
                        padding: '7px 14px', borderRadius: 5, border: '1px solid #334155',
                        background: '#1e293b', color: '#64748b', fontSize: 12, cursor: 'pointer',
                      }}
                    >Cancel</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          background: '#1e293b', border: '1px solid #334155',
          borderRadius: 8, padding: '8px 16px', fontSize: 12, color: '#e2e8f0',
          whiteSpace: 'nowrap', pointerEvents: 'none',
          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        }}>
          {toast}
        </div>
      )}
    </div>
  );
}
