import { createPortal } from 'react-dom';
import { useRef, useEffect } from 'react';
import { BENCH_COLORS } from '../data/jobs.js';

const BENCH_ORDER = ['Electronics', 'Setup', 'Luthier', 'Fretwork', 'Admin'];

function getWeekDatePrefix(date) {
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const dy = String(date.getDate()).padStart(2, '0');
  return `${y}-${mo}-${dy}`;
}

function computeSummary(jobs, scheduledSlots, weekDays) {
  // Find job IDs scheduled this week
  const weekPrefixes = new Set(weekDays.map(getWeekDatePrefix));
  const scheduledThisWeek = new Set();
  Object.entries(scheduledSlots).forEach(([key, jobId]) => {
    if (jobId === '__buffer__') return;
    const prefix = key.split('-').slice(0, 3).join('-');
    if (weekPrefixes.has(prefix)) scheduledThisWeek.add(jobId);
  });

  const weekStart = new Date(weekDays[0]); weekStart.setHours(0, 0, 0, 0);
  const weekEnd   = new Date(weekDays[6]); weekEnd.setHours(23, 59, 59, 999);

  const summary = {};
  jobs.forEach(job => {
    const bench = job.bench || 'Admin';
    if (!summary[bench]) summary[bench] = { planned: 0, actualPomos: 0, actualMins: 0 };

    if (scheduledThisWeek.has(job.id)) {
      summary[bench].planned += job.hours || 0;
    }

    (job.pomoLog || []).forEach(s => {
      const d = new Date(s.startedAt);
      if (d >= weekStart && d <= weekEnd) {
        summary[bench].actualPomos += s.pomos || 0;
        summary[bench].actualMins  += s.mins  || 0;
      }
    });
  });

  return summary;
}

export default function WeeklySummaryModal({ jobs, scheduledSlots, weekDays, onClose }) {
  const modalRef = useRef(null);
  const summary = computeSummary(jobs, scheduledSlots, weekDays);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    function onDown(e) {
      if (modalRef.current && !modalRef.current.contains(e.target)) onClose();
    }
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [onClose]);

  const benches = BENCH_ORDER.filter(b => summary[b]);
  const totalPlanned = benches.reduce((s, b) => s + summary[b].planned, 0);
  const totalActualMins = benches.reduce((s, b) => s + summary[b].actualMins, 0);
  const totalPomos = benches.reduce((s, b) => s + summary[b].actualPomos, 0);

  const weekLabel = weekDays.length > 0
    ? `${weekDays[0].toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })} – ${weekDays[6].toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}`
    : '';

  return createPortal(
    <div style={{
      position: 'fixed', inset: 0, zIndex: 3000,
      background: 'rgba(0,0,0,0.65)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div ref={modalRef} style={{
        background: '#0f172a', border: '1px solid #334155', borderRadius: 14,
        width: 440, boxShadow: '0 24px 64px rgba(0,0,0,0.8)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #1e293b',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#f1f5f9' }}>Weekly Summary</div>
            <div style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>{weekLabel}</div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: '#475569', fontSize: 22,
            cursor: 'pointer', padding: 0, lineHeight: 1,
          }}>×</button>
        </div>

        {/* Table */}
        <div style={{ padding: '16px 20px' }}>
          {benches.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#475569', fontSize: 13, padding: '24px 0' }}>
              No data for this week yet.
            </div>
          ) : (
            <>
              {/* Column headers */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px',
                fontSize: 9, color: '#475569', letterSpacing: 1.5,
                textTransform: 'uppercase', paddingBottom: 8,
                borderBottom: '1px solid #1e293b', marginBottom: 4,
              }}>
                <span>Bench</span>
                <span style={{ textAlign: 'right' }}>Planned</span>
                <span style={{ textAlign: 'right' }}>Actual</span>
                <span style={{ textAlign: 'right' }}>Pomos</span>
              </div>

              {/* Bench rows */}
              {benches.map(bench => {
                const row = summary[bench];
                const colors = BENCH_COLORS[bench] || BENCH_COLORS.Admin;
                const actualH = (row.actualMins / 60).toFixed(1);
                const delta = row.actualMins / 60 - row.planned;
                const deltaStr = delta >= 0 ? `+${delta.toFixed(1)}h` : `${delta.toFixed(1)}h`;
                const deltaColor = delta > 0.5 ? '#22c55e' : delta < -0.5 ? '#f87171' : '#64748b';

                return (
                  <div key={bench} style={{
                    display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px',
                    alignItems: 'center',
                    padding: '9px 0',
                    borderBottom: '1px solid #1e293b',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 3, height: 16, borderRadius: 2, background: colors.border }} />
                      <span style={{ fontSize: 13, color: colors.text, fontWeight: 600 }}>{bench}</span>
                    </div>
                    <span style={{ textAlign: 'right', fontSize: 13, color: '#94a3b8' }}>
                      {row.planned > 0 ? `${parseFloat(row.planned.toFixed(1))}h` : '—'}
                    </span>
                    <span style={{ textAlign: 'right', fontSize: 13, color: row.actualMins > 0 ? '#e2e8f0' : '#334155' }}>
                      {row.actualMins > 0 ? `${actualH}h` : '—'}
                    </span>
                    <span style={{ textAlign: 'right', fontSize: 13, color: '#f97316' }}>
                      {row.actualPomos > 0 ? `${row.actualPomos}` : '—'}
                    </span>
                  </div>
                );
              })}

              {/* Totals */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 80px 80px 80px',
                alignItems: 'center',
                padding: '10px 0 0',
              }}>
                <span style={{ fontSize: 11, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Total
                </span>
                <span style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#94a3b8' }}>
                  {totalPlanned > 0 ? `${parseFloat(totalPlanned.toFixed(1))}h` : '—'}
                </span>
                <span style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: totalActualMins > 0 ? '#e2e8f0' : '#334155' }}>
                  {totalActualMins > 0 ? `${(totalActualMins / 60).toFixed(1)}h` : '—'}
                </span>
                <span style={{ textAlign: 'right', fontSize: 13, fontWeight: 700, color: '#f97316' }}>
                  {totalPomos > 0 ? totalPomos : '—'}
                </span>
              </div>
            </>
          )}
        </div>

        <div style={{ padding: '0 20px 16px', fontSize: 11, color: '#334155' }}>
          Tap a scheduled job on the calendar to start a pomo timer.
        </div>
      </div>
    </div>,
    document.body
  );
}
