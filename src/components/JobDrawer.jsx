import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { BENCH_COLORS } from '../data/jobs.js';

const ALL_BENCHES = ['Luthier', 'Electronics', 'Setup', 'Fretwork', 'Admin'];
const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function fromTimeValue(val) {
  const [h, m] = (val || '09:00').split(':').map(Number);
  return { hour: h, minute: m };
}

function initRows(job) {
  return [{ bench: job.bench, sessions: [{ hours: job.hours, note: job.sessionNote || '' }] }];
}

export default function JobDrawer({ job, onClose, onSave, weekDays = [], onSchedule, onMarkDone }) {
  const [rows, setRows] = useState(() => initRows(job));
  const [selectedDay, setSelectedDay] = useState(0);
  const [timeVal, setTimeVal] = useState('09:00');
  const [doneAmount, setDoneAmount] = useState('');
  const modalRef = useRef(null);

  useEffect(() => {
    function handleMouseDown(e) {
      if (modalRef.current && !modalRef.current.contains(e.target)) {
        onClose();
      }
    }
    function handleKeyDown(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  function updateSession(ri, si, field, value) {
    setRows(prev => prev.map((row, r) => r !== ri ? row : {
      ...row,
      sessions: row.sessions.map((s, x) => x !== si ? s : { ...s, [field]: value }),
    }));
  }

  function setSessionCount(ri, newCount) {
    if (newCount < 1) return;
    setRows(prev => prev.map((row, r) => {
      if (r !== ri) return row;
      const cur = row.sessions;
      const total = cur.reduce((s, x) => s + Number(x.hours), 0);
      if (newCount === cur.length) return row;
      if (newCount > cur.length) {
        const perSession = parseFloat((total / newCount).toFixed(1));
        // Redistribute all sessions evenly, preserving existing notes
        const next = Array.from({ length: newCount }, (_, i) => ({
          hours: perSession,
          note: i < cur.length ? cur[i].note : '',
        }));
        // Fix last item for rounding drift
        const runningTotal = next.reduce((s, x) => s + Number(x.hours), 0);
        next[newCount - 1].hours = parseFloat((Number(next[newCount - 1].hours) + (total - runningTotal)).toFixed(1));
        return { ...row, sessions: next };
      } else {
        const kept = cur.slice(0, newCount).map(s => ({ ...s }));
        const removedHours = cur.slice(newCount).reduce((s, x) => s + Number(x.hours), 0);
        kept[newCount - 1].hours = parseFloat((Number(kept[newCount - 1].hours) + removedHours).toFixed(1));
        return { ...row, sessions: kept };
      }
    }));
  }

  function addBench() {
    const used = new Set(rows.map(r => r.bench));
    const next = ALL_BENCHES.find(b => !used.has(b)) || 'Admin';
    setRows(prev => [...prev, { bench: next, sessions: [{ hours: 1, note: '' }] }]);
  }

  function removeBench(ri) {
    setRows(prev => prev.filter((_, i) => i !== ri));
  }

  function setBench(ri, bench) {
    setRows(prev => prev.map((row, i) => i !== ri ? row : { ...row, bench }));
  }

  function handleSave() {
    onSave(job, rows);
    onClose();
  }

  const isSubtaskEdit = !!job.isSubtask;
  const totalCards = rows.reduce((s, r) => s + r.sessions.length, 0);
  const totalHours = rows.reduce((s, r) => s + r.sessions.reduce((ss, x) => ss + Number(x.hours), 0), 0);

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div ref={modalRef} style={{
        background: '#1e293b', border: '1px solid #334155', borderRadius: 12,
        width: 440, maxHeight: '82vh', overflowY: 'auto',
        boxShadow: '0 24px 64px rgba(0,0,0,0.7)',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#f1f5f9' }}>#{job.job}</div>
            <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>{job.mfr} {job.model}</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, lineHeight: 1.4 }}>{job.desc}</div>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: '#64748b', fontSize: 22,
            cursor: 'pointer', padding: 0, marginLeft: 12, lineHeight: 1, alignSelf: 'flex-start',
          }}>×</button>
        </div>

        {/* Bench rows */}
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rows.map((row, ri) => {
            const colors = BENCH_COLORS[row.bench] || BENCH_COLORS.Admin;
            const rowTotal = row.sessions.reduce((s, x) => s + Number(x.hours), 0);
            return (
              <div key={ri} style={{
                borderRadius: 8, border: `1px solid ${colors.border}55`, overflow: 'hidden',
              }}>
                {/* Bench header */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
                  background: `${colors.bg}88`,
                  borderBottom: `1px solid ${colors.border}33`,
                }}>
                  <div style={{ width: 3, alignSelf: 'stretch', background: colors.border, borderRadius: 2, flexShrink: 0 }} />
                  {isSubtaskEdit ? (
                    <span style={{ flex: 1, fontSize: 13, fontWeight: 700, color: colors.text }}>{row.bench}</span>
                  ) : (
                    <select
                      value={row.bench}
                      onChange={e => setBench(ri, e.target.value)}
                      style={{ flex: 1, background: 'transparent', border: 'none', color: colors.text, fontSize: 13, fontWeight: 700, cursor: 'pointer', outline: 'none' }}
                    >
                      {ALL_BENCHES.map(b => <option key={b} value={b} style={{ background: '#1e293b', color: '#e2e8f0' }}>{b}</option>)}
                    </select>
                  )}
                  <span style={{ fontSize: 10, color: colors.text, opacity: 0.6, marginRight: 4 }}>{parseFloat(rowTotal.toFixed(1))}h</span>
                  {!isSubtaskEdit && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
                      <span style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.05em' }}>Sessions</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#0f172a', border: '1px solid #475569', borderRadius: 4, padding: '2px 7px' }}>
                        <button onClick={() => setSessionCount(ri, row.sessions.length - 1)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: 0 }}>−</button>
                        <span style={{ fontSize: 12, color: '#cbd5e1', minWidth: 14, textAlign: 'center' }}>{row.sessions.length}</span>
                        <button onClick={() => setSessionCount(ri, row.sessions.length + 1)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: 0 }}>+</button>
                      </div>
                    </div>
                  )}
                  {rows.length > 1 && !isSubtaskEdit && (
                    <button onClick={() => removeBench(ri)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 16, padding: 0, marginLeft: 2 }}>×</button>
                  )}
                </div>

                {/* Session rows */}
                {row.sessions.map((sess, si) => (
                  <div key={si} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 12px 8px 18px',
                    borderTop: si > 0 ? `1px solid ${colors.border}22` : 'none',
                    background: 'rgba(0,0,0,0.2)',
                  }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: colors.border, flexShrink: 0 }} />
                    <span style={{ fontSize: 11, color: '#64748b', minWidth: 62, flexShrink: 0 }}>
                      {row.sessions.length > 1 ? `Session ${si + 1}` : 'Hours'}
                    </span>
                    <input
                      type="number" min="0.5" step="0.5"
                      value={sess.hours}
                      onChange={e => updateSession(ri, si, 'hours', parseFloat(e.target.value) || 0.5)}
                      style={{
                        width: 54, background: '#0f172a', border: '1px solid #475569', borderRadius: 4,
                        padding: '3px 6px', fontSize: 12, color: '#cbd5e1', textAlign: 'center',
                      }}
                    />
                    <span style={{ fontSize: 11, color: '#475569' }}>h</span>
                    <input
                      type="text"
                      placeholder={row.sessions.length > 1 ? `Session ${si + 1} note…` : 'Note (optional)'}
                      value={sess.note}
                      onChange={e => updateSession(ri, si, 'note', e.target.value)}
                      style={{
                        flex: 1, background: '#0f172a', border: '1px solid #475569', borderRadius: 4,
                        padding: '3px 8px', fontSize: 12, color: '#cbd5e1',
                      }}
                    />
                  </div>
                ))}
              </div>
            );
          })}

          {!isSubtaskEdit && (
            <button
              onClick={addBench}
              style={{
                border: '1px dashed #334155', background: 'transparent', borderRadius: 8,
                padding: '8px 0', fontSize: 12, color: '#64748b', cursor: 'pointer',
              }}
            >
              + Add bench
            </button>
          )}

          {onSchedule && weekDays.length > 0 && (
            <div style={{ borderTop: '1px solid #334155', paddingTop: 12, marginTop: 4 }}>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>Schedule</div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                {weekDays.map((day, i) => {
                  const today = new Date();
                  const isToday = day.toDateString() === today.toDateString();
                  const isPast = day < today && !isToday;
                  const isSelected = selectedDay === i;
                  return (
                    <button key={i} onClick={() => setSelectedDay(i)} style={{
                      flex: 1, minWidth: 36, padding: '5px 4px', borderRadius: 6, border: 'none',
                      background: isSelected ? '#2563eb' : isToday ? '#1e3a5f' : '#0f172a',
                      color: isSelected ? '#fff' : isPast ? '#334155' : isToday ? '#93c5fd' : '#94a3b8',
                      outline: isToday && !isSelected ? '1px solid #2563eb' : 'none',
                      cursor: isPast ? 'default' : 'pointer', fontSize: 10, fontWeight: 600,
                    }}>
                      <div>{DAYS_SHORT[i]}</div>
                      <div>{day.getDate()}</div>
                    </button>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="time" value={timeVal}
                  onChange={e => setTimeVal(e.target.value)}
                  style={{
                    background: '#0f172a', border: '1px solid #475569', borderRadius: 4,
                    padding: '4px 8px', fontSize: 12, color: '#cbd5e1',
                  }}
                />
                <button
                  onClick={() => { const { hour, minute } = fromTimeValue(timeVal); onSchedule(job, selectedDay, hour, minute); onClose(); }}
                  style={{
                    flex: 1, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6,
                    padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  Place on Calendar
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
            <span style={{ fontSize: 11, color: '#64748b' }}>
              {totalCards === 1 ? '1 card' : `${totalCards} cards`} · {parseFloat(totalHours.toFixed(1))}h total
            </span>
            <button
              onClick={handleSave}
              style={{
                background: '#2563eb', color: '#fff', border: 'none', borderRadius: 6,
                padding: '8px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
              }}
            >
              {isSubtaskEdit || totalCards === 1 ? 'Update' : 'Save splits'}
            </button>
          </div>

          {onMarkDone && !job.parentId && (
            <div style={{ borderTop: '1px solid #1e293b', paddingTop: 12, marginTop: 4 }}>
              <div style={{ fontSize: 10, color: '#334155', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 8 }}>Mark as Done</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span style={{ color: '#475569', fontSize: 14 }}>$</span>
                <input
                  type="number"
                  placeholder="Invoice amount"
                  value={doneAmount}
                  onChange={e => setDoneAmount(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && doneAmount && onMarkDone(job, doneAmount)}
                  style={{
                    flex: 1, background: '#0f172a', border: '1px solid #334155', borderRadius: 6,
                    padding: '7px 10px', fontSize: 13, color: '#f1f5f9',
                  }}
                />
                <button
                  onClick={() => doneAmount && onMarkDone(job, doneAmount)}
                  style={{
                    background: doneAmount ? '#14532d' : '#1e293b',
                    color: doneAmount ? '#4ade80' : '#334155',
                    border: `1px solid ${doneAmount ? '#166534' : '#1e293b'}`,
                    borderRadius: 6, padding: '7px 14px', fontSize: 12, fontWeight: 700,
                    cursor: doneAmount ? 'pointer' : 'default',
                  }}
                >Done ✓</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
