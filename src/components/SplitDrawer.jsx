import { useState, useEffect } from 'react';
import { detectBenches, BENCH_COLORS } from '../data/jobs.js';

const DRAWER_WIDTH = 360;
const ALL_BENCHES = ['Luthier', 'Electronics', 'Setup', 'Fretwork', 'Admin'];

export default function SplitDrawer({ job, onClose, onConfirm, onDrawerMouseEnter, onDrawerMouseLeave }) {
  const [displayJob, setDisplayJob] = useState(null);
  const [visible, setVisible]       = useState(false);
  // benchHours: [{bench, hours}] — one entry per selected bench
  const [benchHours, setBenchHours] = useState([]);

  useEffect(() => {
    if (job) {
      setDisplayJob(job);
      const detected = detectBenches(job.desc);
      const n        = detected.length || 1;
      const defaultH = Math.round((job.hours / n) * 2) / 2;
      setBenchHours(detected.map(b => ({ bench: b, hours: defaultH })));
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
      const t = setTimeout(() => setDisplayJob(null), 320);
      return () => clearTimeout(t);
    }
  }, [job]);

  if (!displayJob) return null;
  if (displayJob.bench !== 'Luthier') return null;

  const total    = benchHours.reduce((s, bh) => s + Number(bh.hours), 0);
  const original = displayJob.hours;
  const diff     = Math.round((total - original) * 10) / 10;
  const diffOk   = Math.abs(diff) < 0.1;

  function toggleBench(bench) {
    setBenchHours(prev => {
      if (prev.some(bh => bh.bench === bench)) {
        if (prev.length === 1) return prev; // keep at least one
        return prev.filter(bh => bh.bench !== bench);
      }
      // Default new bench hours to whatever is unallocated, min 0.5
      const used      = prev.reduce((s, bh) => s + Number(bh.hours), 0);
      const remaining = Math.max(0.5, Math.round((original - used) * 2) / 2);
      return [...prev, { bench, hours: remaining }];
    });
  }

  function setHours(bench, val) {
    const h = Math.max(0.5, Math.round(Number(val) * 2) / 2); // snap to 0.5h
    setBenchHours(prev => prev.map(bh => bh.bench === bench ? { ...bh, hours: h } : bh));
  }

  return (
    <>
      {/* Backdrop */}
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
          background: '#166534',
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#bbf7d0' }}>
              Split #{displayJob.job}
            </div>
            <div style={{ fontSize: 12, color: '#bbf7d0', opacity: 0.8, marginTop: 2 }}>
              {displayJob.mfr} {displayJob.model} · {original}h total
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 6,
              color: '#bbf7d0', cursor: 'pointer', fontSize: 16,
              width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 18px', flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Description */}
          <div>
            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>
              Description
            </div>
            <div style={{
              fontSize: 12, color: '#cbd5e1', lineHeight: 1.5,
              background: '#1e293b', borderRadius: 6, padding: '8px 10px',
            }}>
              {displayJob.desc || '—'}
            </div>
          </div>

          {/* Bench + hours grid */}
          <div>
            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 8 }}>
              Benches &amp; hours
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {ALL_BENCHES.map(bench => {
                const colors   = BENCH_COLORS[bench] || BENCH_COLORS.Admin;
                const entry    = benchHours.find(bh => bh.bench === bench);
                const selected = Boolean(entry);
                return (
                  <div key={bench} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '7px 10px',
                    background: selected ? colors.bg : '#1e293b',
                    border: `1px solid ${selected ? colors.border : '#334155'}`,
                    borderRadius: 6, transition: 'all 0.15s',
                  }}>
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggleBench(bench)}
                      style={{ width: 16, height: 16, cursor: 'pointer', accentColor: colors.border, flexShrink: 0 }}
                    />
                    {/* Bench name */}
                    <span
                      onClick={() => toggleBench(bench)}
                      style={{
                        flex: 1, fontSize: 13, cursor: 'pointer',
                        color: selected ? colors.text : '#64748b',
                        fontWeight: selected ? 700 : 400,
                      }}
                    >
                      {bench}
                    </span>
                    {/* Hours input — only active when selected */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                      <button
                        disabled={!selected}
                        onClick={() => selected && setHours(bench, (entry.hours - 0.5))}
                        style={{
                          width: 22, height: 22, border: 'none', borderRadius: 4,
                          background: selected ? 'rgba(255,255,255,0.1)' : 'transparent',
                          color: selected ? colors.text : '#334155',
                          cursor: selected ? 'pointer' : 'default',
                          fontSize: 14, fontWeight: 700, lineHeight: 1,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >−</button>
                      <input
                        type="number"
                        min="0.5"
                        step="0.5"
                        disabled={!selected}
                        value={selected ? entry.hours : ''}
                        onChange={e => selected && setHours(bench, e.target.value)}
                        placeholder="—"
                        style={{
                          width: 44, textAlign: 'center',
                          background: selected ? 'rgba(0,0,0,0.25)' : 'transparent',
                          border: `1px solid ${selected ? colors.border : '#1e293b'}`,
                          borderRadius: 4, color: selected ? colors.text : '#334155',
                          fontSize: 13, fontWeight: 700, padding: '2px 4px',
                          outline: 'none',
                        }}
                      />
                      <button
                        disabled={!selected}
                        onClick={() => selected && setHours(bench, (entry.hours + 0.5))}
                        style={{
                          width: 22, height: 22, border: 'none', borderRadius: 4,
                          background: selected ? 'rgba(255,255,255,0.1)' : 'transparent',
                          color: selected ? colors.text : '#334155',
                          cursor: selected ? 'pointer' : 'default',
                          fontSize: 14, fontWeight: 700, lineHeight: 1,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >+</button>
                      <span style={{ fontSize: 11, color: selected ? colors.text : '#334155',
                        opacity: 0.7, minWidth: 12 }}>h</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Hours summary */}
          <div style={{
            background: '#1e293b', borderRadius: 6, padding: '10px 14px',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{ fontSize: 12, color: '#94a3b8' }}>
              {benchHours.length} bench{benchHours.length !== 1 ? 'es' : ''} ·{' '}
              <span style={{ color: '#e2e8f0', fontWeight: 700 }}>{total}h</span> allocated
            </div>
            <div style={{
              fontSize: 12, fontWeight: 700,
              color: diffOk ? '#22c55e' : diff > 0 ? '#f87171' : '#fbbf24',
            }}>
              {diffOk
                ? '✓ matches job total'
                : diff > 0
                  ? `+${diff}h over`
                  : `${Math.abs(diff)}h unallocated`}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 18px', borderTop: '1px solid #1e293b',
          display: 'flex', gap: 8, flexShrink: 0,
        }}>
          <button
            disabled={benchHours.length === 0}
            onClick={() => { onConfirm(displayJob, benchHours); onClose(); }}
            style={{
              flex: 1, padding: '10px 0',
              background: benchHours.length === 0 ? '#166534' : '#22c55e',
              color: '#000', border: 'none', borderRadius: 6,
              fontWeight: 700, fontSize: 13,
              cursor: benchHours.length === 0 ? 'not-allowed' : 'pointer',
              opacity: benchHours.length === 0 ? 0.5 : 1,
            }}
          >
            Confirm Split
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
