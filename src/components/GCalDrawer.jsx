import { useState, useEffect } from 'react';
import { BENCH_COLORS } from '../data/jobs.js';
import { BENCH_COLOR_ID } from '../utils/googleCalendar.js';

const DRAWER_WIDTH = 360;
const BENCHES = ['Luthier', 'Electronics', 'Setup', 'Fretwork', 'Wiring', 'Admin'];

const COLOR_ID_TO_BENCH = { '10': 'Luthier', '9': 'Electronics', '6': 'Setup', '3': 'Fretwork', '2': 'Luthier' };

// Returns an array of benches e.g. ['Luthier', 'Fretwork']
function parseBenches(event) {
  const match = event.description?.match(/^Bench:\s*(.+)$/m);
  if (match) {
    const benches = match[1].split(',').map(b => b.trim()).filter(b => BENCHES.includes(b));
    if (benches.length > 0) return benches;
  }
  const fromColor = COLOR_ID_TO_BENCH[event.colorId];
  return fromColor ? [fromColor] : ['Admin'];
}

function parseUserDesc(event) {
  return (event.description || '')
    .replace(/^Bench:.*$/m, '')
    .replace(/^Hours:.*$/m, '')
    .replace(/^Status:.*$/m, '')
    .replace(/^Tag:.*$/m, '')
    .replace(/^Split:.*$/m, '')
    .replace(/^\n+/, '')
    .trim();
}

export default function GCalDrawer({ event, onClose, onSave, onDrawerMouseEnter, onDrawerMouseLeave }) {
  const [displayEvent, setDisplayEvent] = useState(null);
  const [visible, setVisible]           = useState(false);
  const [editSummary, setEditSummary]   = useState('');
  const [editBenches, setEditBenches]   = useState(['Admin']);
  const [editDesc, setEditDesc]         = useState('');
  const [saving, setSaving]             = useState(false);
  const [error, setError]               = useState(null);

  useEffect(() => {
    if (event) {
      setDisplayEvent(event);
      setEditSummary(event.summary || '');
      setEditBenches(parseBenches(event));
      setEditDesc(parseUserDesc(event));
      setError(null);
      setSaving(false);
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
      const t = setTimeout(() => setDisplayEvent(null), 320);
      return () => clearTimeout(t);
    }
  }, [event]);

  if (!displayEvent) return null;

  // Primary bench drives the header colour; fallback to Admin
  const primaryBench = editBenches[0] || 'Admin';
  const colors       = BENCH_COLORS[primaryBench] || BENCH_COLORS.Admin;

  function toggleBench(b) {
    setEditBenches(prev =>
      prev.includes(b)
        ? prev.length > 1 ? prev.filter(x => x !== b) : prev // keep at least one
        : [...prev, b]
    );
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await onSave({ summary: editSummary, benches: editBenches, description: editDesc });
      onClose();
    } catch (e) {
      setError('Save failed — please try again');
      setSaving(false);
    }
  }

  const timeLabel = (() => {
    const start = new Date(displayEvent.start?.dateTime || displayEvent.start?.date);
    const end   = new Date(displayEvent.end?.dateTime   || displayEvent.end?.date);
    const fmt = d => d.toLocaleTimeString('en-NZ', { hour: 'numeric', minute: '2-digit', hour12: true });
    return `${start.toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' })} · ${fmt(start)} – ${fmt(end)}`;
  })();

  return (
    <>
      {/* Backdrop — non-blocking so calendar stays interactive */}
      <div style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.3)',
        zIndex: 1000,
        opacity: visible ? 1 : 0,
        transition: 'opacity 300ms ease',
        pointerEvents: 'none',
      }} />

      {/* Drawer */}
      <div
        onMouseEnter={onDrawerMouseEnter}
        onMouseLeave={onDrawerMouseLeave}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0,
          width: DRAWER_WIDTH,
          background: '#0f172a',
          borderLeft: '1px solid #334155',
          zIndex: 1001,
          display: 'flex', flexDirection: 'column',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.6)',
          overflowY: 'auto',
          transform: visible ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 300ms ease',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 18px', borderBottom: '1px solid #1e293b',
          background: colors.bg,
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 11, color: colors.text, opacity: 0.7, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
              Edit GCal Event
            </div>
            <div style={{ fontSize: 13, color: colors.text, opacity: 0.85 }}>
              {timeLabel}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 6,
              color: colors.text, cursor: 'pointer', fontSize: 16,
              width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}
          >✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 18px', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Title */}
          <div>
            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>
              Title
            </div>
            <input
              value={editSummary}
              onChange={e => setEditSummary(e.target.value)}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: '#1e293b', border: '1px solid #334155', borderRadius: 6,
                color: '#e2e8f0', fontSize: 13, padding: '8px 10px',
                outline: 'none',
              }}
            />
          </div>

          {/* Bench selector — multi-select */}
          <div>
            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
              Benches (select all that apply)
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {BENCHES.map(b => {
                const c      = BENCH_COLORS[b];
                const active = editBenches.includes(b);
                return (
                  <label key={b} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '7px 10px',
                    background: active ? c.bg : '#1e293b',
                    border: `1px solid ${active ? c.border : '#334155'}`,
                    borderRadius: 6, cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}>
                    <input
                      type="checkbox"
                      checked={active}
                      onChange={() => toggleBench(b)}
                      style={{ width: 16, height: 16, cursor: 'pointer', accentColor: c.border }}
                    />
                    <span style={{ color: active ? c.text : '#94a3b8', fontWeight: active ? 700 : 400, fontSize: 13 }}>
                      {b}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Description */}
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>
              Description
            </div>
            <textarea
              value={editDesc}
              onChange={e => setEditDesc(e.target.value)}
              rows={5}
              style={{
                width: '100%', boxSizing: 'border-box',
                background: '#1e293b', border: '1px solid #334155', borderRadius: 6,
                color: '#cbd5e1', fontSize: 12, padding: '8px 10px',
                lineHeight: 1.5, resize: 'vertical', outline: 'none',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {error && (
            <div style={{ fontSize: 12, color: '#fca5a5', background: '#7f1d1d',
              borderRadius: 6, padding: '8px 10px' }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 18px', borderTop: '1px solid #1e293b',
          display: 'flex', gap: 8, flexShrink: 0,
        }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 1, padding: '10px 0',
              background: saving ? '#166534' : '#22c55e',
              color: '#000', border: 'none', borderRadius: 6,
              fontWeight: 700, fontSize: 13, cursor: saving ? 'wait' : 'pointer',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '10px 0', background: 'transparent', color: '#94a3b8',
              border: '1px solid #334155', borderRadius: 6, fontSize: 13, cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}
