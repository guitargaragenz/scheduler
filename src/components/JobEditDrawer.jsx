import { useState, useEffect } from 'react';
import { BENCH_COLORS } from '../data/jobs.js';

const DRAWER_WIDTH = 340;

export default function JobEditDrawer({ job, onClose, onSave, onUnschedule }) {
  const [displayJob, setDisplayJob] = useState(null);
  const [visible, setVisible]       = useState(false);
  const [hours, setHours]           = useState(0);

  useEffect(() => {
    if (job) {
      setDisplayJob(job);
      setHours(job.hours);
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
      const t = setTimeout(() => setDisplayJob(null), 320);
      return () => clearTimeout(t);
    }
  }, [job]);

  if (!displayJob) return null;

  const colors  = BENCH_COLORS[displayJob.bench] || BENCH_COLORS.Admin;
  const rounded = Math.max(0.5, Math.round(hours * 2) / 2);
  const changed = rounded !== displayJob.hours;

  function step(delta) {
    setHours(h => Math.max(0.5, Math.round((h + delta) * 2) / 2));
  }

  function handleSave() {
    if (changed) onSave(displayJob, rounded);
    onClose();
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
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: DRAWER_WIDTH,
        background: '#0f172a',
        borderLeft: '1px solid #334155',
        zIndex: 1001,
        display: 'flex', flexDirection: 'column',
        boxShadow: '-8px 0 32px rgba(0,0,0,0.6)',
        transform: visible ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 300ms ease',
      }}>

        {/* Header */}
        <div style={{
          padding: '16px 18px', borderBottom: '1px solid #1e293b',
          background: colors.bg,
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 11, color: colors.text, opacity: 0.7,
              fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 }}>
              {displayJob.bench}
            </div>
            <div style={{ fontSize: 17, fontWeight: 800, color: colors.text }}>
              #{displayJob.job} · {displayJob.mfr} {displayJob.model}
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
        <div style={{ padding: '20px 18px', flex: 1, display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Description */}
          {displayJob.desc && (
            <div>
              <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>
                Description
              </div>
              <div style={{
                fontSize: 12, color: '#cbd5e1', lineHeight: 1.6,
                background: '#1e293b', borderRadius: 6, padding: '8px 10px',
              }}>
                {displayJob.desc}
              </div>
            </div>
          )}

          {/* Hours editor */}
          <div>
            <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 12 }}>
              Hours
            </div>

            {/* Original vs current */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
              <div style={{
                flex: 1, background: '#1e293b', borderRadius: 6, padding: '8px 12px',
                border: '1px solid #334155',
              }}>
                <div style={{ fontSize: 10, color: '#475569', fontWeight: 600,
                  textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 }}>
                  Estimated
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: '#64748b' }}>
                  {displayJob.hours}h
                </div>
              </div>
              <div style={{ fontSize: 18, color: '#334155' }}>→</div>
              <div style={{
                flex: 1, background: changed ? 'rgba(251,191,36,0.08)' : '#1e293b',
                borderRadius: 6, padding: '8px 12px',
                border: `1px solid ${changed ? '#fbbf24' : '#334155'}`,
              }}>
                <div style={{ fontSize: 10, color: changed ? '#fbbf24' : '#475569',
                  fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 }}>
                  Actual
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: changed ? '#fbbf24' : '#94a3b8' }}>
                  {rounded}h
                </div>
              </div>
            </div>

            {/* Stepper */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {[-1, -0.5].map(d => (
                <button key={d} onClick={() => step(d)} style={{
                  flex: 1, padding: '10px 0', borderRadius: 6, border: '1px solid #334155',
                  background: '#1e293b', color: '#94a3b8', cursor: 'pointer',
                  fontSize: 14, fontWeight: 700,
                }}>
                  {d}h
                </button>
              ))}
              <input
                type="number"
                min="0.5"
                step="0.5"
                value={hours}
                onChange={e => setHours(parseFloat(e.target.value) || 0)}
                style={{
                  width: 64, textAlign: 'center',
                  background: '#1e293b', border: '1px solid #475569',
                  borderRadius: 6, color: '#e2e8f0',
                  fontSize: 16, fontWeight: 700, padding: '9px 6px',
                  outline: 'none',
                }}
              />
              {[+0.5, +1].map(d => (
                <button key={d} onClick={() => step(d)} style={{
                  flex: 1, padding: '10px 0', borderRadius: 6, border: '1px solid #334155',
                  background: '#1e293b', color: '#94a3b8', cursor: 'pointer',
                  fontSize: 14, fontWeight: 700,
                }}>
                  +{d}h
                </button>
              ))}
            </div>
          </div>

          {/* Meta */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {displayJob.status && (
              <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4,
                background: '#1e293b', border: '1px solid #334155', color: '#94a3b8' }}>
                {displayJob.status}
              </span>
            )}
            {displayJob.days && (
              <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4,
                background: '#1e293b', border: '1px solid #334155', color: '#94a3b8' }}>
                📅 {displayJob.days}d
              </span>
            )}
            {displayJob.vb && (
              <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4,
                background: '#1e293b', border: '1px solid #fbbf24', color: '#fbbf24' }}>
                ⭐ VB
              </span>
            )}
          </div>

          {/* Remove from calendar */}
          {displayJob.scheduled && onUnschedule && (
            <button
              onClick={() => { onUnschedule(displayJob); onClose(); }}
              style={{
                padding: '10px 0', background: 'transparent',
                border: '1px solid #7f1d1d', borderRadius: 6,
                color: '#f87171', fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Remove from calendar
            </button>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 18px', borderTop: '1px solid #1e293b',
          display: 'flex', gap: 8, flexShrink: 0,
        }}>
          <button
            onClick={handleSave}
            style={{
              flex: 1, padding: '10px 0',
              background: changed ? '#fbbf24' : '#22c55e',
              color: '#000', border: 'none', borderRadius: 6,
              fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}
          >
            {changed ? `Save · ${rounded}h` : 'Close'}
          </button>
          {changed && (
            <button
              onClick={onClose}
              style={{
                flex: 1, padding: '10px 0', background: 'transparent', color: '#94a3b8',
                border: '1px solid #334155', borderRadius: 6, fontSize: 13, cursor: 'pointer',
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </>
  );
}
