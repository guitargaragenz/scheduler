import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { BENCH_COLORS } from '../data/jobs.js';

const ALL_BENCHES = ['Luthier', 'Electronics', 'Setup', 'Fretwork', 'Wiring', 'Admin'];
const DAYS_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function pad(n) { return String(n).padStart(2, '0'); }

function formatSlotDisplay(slot, weekDays = []) {
  if (!slot) return null;
  if (typeof slot === 'object') {
    const { dayIdx, hour: h, minute: m = 0 } = slot;
    const date = weekDays[dayIdx];
    if (!date) return null;
    const dayStr = date.toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' });
    const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const ampm = h < 12 ? 'AM' : 'PM';
    const mins = m === 0 ? '' : `:${pad(m)}`;
    return `${dayStr} · ${hour12}${mins} ${ampm}`;
  }
  const parts = slot.split('-').map(Number);
  if (parts.length < 5 || parts.some(isNaN)) return null;
  const [y, mo, d, h, m] = parts;
  const date = new Date(y, mo - 1, d);
  const dayStr = date.toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' });
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  const ampm = h < 12 ? 'AM' : 'PM';
  const mins = m === 0 ? '' : `:${pad(m)}`;
  return `${dayStr} · ${hour12}${mins} ${ampm}`;
}

function toTimeValue(h, m) { return `${pad(h)}:${pad(m)}`; }

function fromTimeValue(val) {
  const [h, m] = val.split(':').map(Number);
  return { hour: h, minute: m };
}

export default function MobileJobSheet({ job, weekDays, onSchedule, onSave, onClose, onRemove }) {
  const [tab, setTab] = useState('schedule');

  // Schedule tab state
  const [selectedDay, setSelectedDay] = useState(0);
  const [timeVal, setTimeVal] = useState('09:00');

  // Bench/split tab state
  const [rows, setRows] = useState([{ bench: job.bench, sessions: [{ hours: job.hours, note: '' }] }]);

  // Slide-up animation
  const [visible, setVisible] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  function close() {
    setVisible(false);
    setTimeout(onClose, 280);
  }

  // ── Schedule ──────────────────────────────────────────────────────────────────
  function handleSchedule() {
    const { hour, minute } = fromTimeValue(timeVal);
    onSchedule(job, selectedDay, hour, minute);
    close();
  }

  // ── Bench/split ───────────────────────────────────────────────────────────────
  function updateSession(ri, si, field, val) {
    setRows(prev => prev.map((row, r) => r !== ri ? row : {
      ...row,
      sessions: row.sessions.map((s, x) => x !== si ? s : { ...s, [field]: val }),
    }));
  }

  function setBench(ri, bench) {
    setRows(prev => prev.map((row, i) => i !== ri ? row : { ...row, bench }));
  }

  function addBench() {
    const used = new Set(rows.map(r => r.bench));
    const next = ALL_BENCHES.find(b => !used.has(b)) || 'Admin';
    setRows(prev => [...prev, { bench: next, sessions: [{ hours: 1, note: '' }] }]);
  }

  function removeBench(ri) {
    if (rows.length <= 1) return;
    setRows(prev => prev.filter((_, i) => i !== ri));
  }

  function adjustSessionHours(ri, si, delta) {
    setRows(prev => prev.map((row, r) => r !== ri ? row : {
      ...row,
      sessions: row.sessions.map((s, x) => x !== si
        ? s
        : { ...s, hours: Math.max(0.5, Math.round((Number(s.hours) + delta) * 2) / 2) }
      ),
    }));
  }

  function handleSave() {
    onSave(job, rows);
    close();
  }

  const totalHours = rows.reduce((s, r) => s + r.sessions.reduce((ss, x) => ss + Number(x.hours), 0), 0);
  const totalCards = rows.reduce((s, r) => s + r.sessions.length, 0);

  const today = new Date();

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 2000 }}>
      {/* Backdrop */}
      <div
        onClick={close}
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.5)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 280ms ease',
        }}
      />

      {/* Sheet */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0,
        background: '#1e293b',
        borderRadius: '16px 16px 0 0',
        boxShadow: '0 -8px 32px rgba(0,0,0,0.6)',
        maxHeight: '82vh',
        display: 'flex', flexDirection: 'column',
        transform: visible ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 280ms cubic-bezier(0.4,0,0.2,1)',
      }}>
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#475569' }} />
        </div>

        {/* Job header */}
        <div style={{ padding: '8px 20px 12px', borderBottom: '1px solid #334155' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#f1f5f9' }}>
                #{job.job} · {job.mfr} {job.model}
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, lineHeight: 1.4 }}>
                {job.customer}{job.desc ? ` · ${job.desc.slice(0, 60)}` : ''}
              </div>
              {job.calendarSlot && (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  marginTop: 6, padding: '3px 8px', borderRadius: 6,
                  background: '#0f172a', border: '1px solid #2563eb',
                  fontSize: 11, color: '#93c5fd', fontWeight: 600,
                }}>
                  <span style={{ fontSize: 10 }}>📅</span>
                  {formatSlotDisplay(job.calendarSlot, weekDays)}
                </div>
              )}
            </div>
            <button
              onClick={close}
              style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 24, cursor: 'pointer', padding: '0 0 0 12px', lineHeight: 1 }}
            >×</button>
          </div>

          {/* Tab bar */}
          <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
            {[
              { id: 'schedule', label: 'Schedule' },
              { id: 'bench',    label: 'Bench & Split' },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                style={{
                  flex: 1, padding: '7px 0', borderRadius: 8, border: 'none', fontSize: 13,
                  fontWeight: tab === t.id ? 700 : 400, cursor: 'pointer',
                  background: tab === t.id ? '#334155' : 'transparent',
                  color: tab === t.id ? '#f1f5f9' : '#64748b',
                }}
              >{t.label}</button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

          {/* ── SCHEDULE TAB ── */}
          {tab === 'schedule' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Day picker */}
              <div>
                <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                  Day
                </div>
                <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
                  {weekDays.map((day, i) => {
                    const isToday = day.toDateString() === today.toDateString();
                    const isPast  = day < today && !isToday;
                    const isSelected = selectedDay === i;
                    return (
                      <button
                        key={i}
                        onClick={() => !isPast && setSelectedDay(i)}
                        style={{
                          flexShrink: 0, width: 56, padding: '10px 0',
                          borderRadius: 10, border: 'none', cursor: isPast ? 'default' : 'pointer',
                          background: isSelected ? '#2563eb' : isToday ? '#1e3a5f' : '#0f172a',
                          color: isSelected ? '#fff' : isPast ? '#334155' : isToday ? '#93c5fd' : '#94a3b8',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                          outline: isToday && !isSelected ? '1px solid #2563eb' : 'none',
                        }}
                      >
                        <span style={{ fontSize: 11, fontWeight: 600 }}>{DAYS_SHORT[i]}</span>
                        <span style={{ fontSize: 15, fontWeight: 700 }}>
                          {day.getDate()}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time picker */}
              <div>
                <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
                  Start Time
                </div>
                <input
                  type="time"
                  step="1800"
                  value={timeVal}
                  onChange={e => setTimeVal(e.target.value)}
                  style={{
                    width: '100%', padding: '14px 16px',
                    background: '#0f172a', border: '1px solid #334155', borderRadius: 10,
                    color: '#f1f5f9', fontSize: 20, fontWeight: 700,
                    colorScheme: 'dark',
                  }}
                />
              </div>

              {/* Summary */}
              <div style={{
                background: '#0f172a', borderRadius: 10, padding: '12px 16px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <span style={{ fontSize: 13, color: '#94a3b8' }}>
                  {DAYS_SHORT[selectedDay]} {weekDays[selectedDay]?.getDate()} at {timeVal}
                </span>
                <span style={{ fontSize: 13, color: '#64748b' }}>{job.hours}h · {job.bench}</span>
              </div>

              <button
                onClick={handleSchedule}
                style={{
                  width: '100%', padding: '14px 0',
                  background: '#2563eb', color: '#fff',
                  border: 'none', borderRadius: 10,
                  fontSize: 15, fontWeight: 700, cursor: 'pointer',
                }}
              >
                Place on Calendar
              </button>

              {job.scheduled && onRemove && (
                <button
                  onClick={() => { onRemove(job); close(); }}
                  style={{
                    width: '100%', padding: '12px 0',
                    background: 'transparent', color: '#f87171',
                    border: '1px solid #f8717144', borderRadius: 10,
                    fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  Remove from Calendar
                </button>
              )}
            </div>
          )}

          {/* ── BENCH & SPLIT TAB ── */}
          {tab === 'bench' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {rows.map((row, ri) => {
                const colors = BENCH_COLORS[row.bench] || BENCH_COLORS.Admin;
                return (
                  <div key={ri} style={{ borderRadius: 10, border: `1px solid ${colors.border}55`, overflow: 'hidden' }}>
                    {/* Bench selector */}
                    <div style={{ padding: '10px 12px', background: `${colors.bg}88`, borderBottom: `1px solid ${colors.border}33` }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 12, color: colors.text, fontWeight: 700 }}>Bench</span>
                        {rows.length > 1 && (
                          <button
                            onClick={() => removeBench(ri)}
                            style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0 }}
                          >×</button>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {ALL_BENCHES.map(b => {
                          const bc = BENCH_COLORS[b] || BENCH_COLORS.Admin;
                          const isActive = row.bench === b;
                          return (
                            <button
                              key={b}
                              onClick={() => setBench(ri, b)}
                              style={{
                                padding: '6px 12px', borderRadius: 6, border: `1px solid ${isActive ? bc.border : '#334155'}`,
                                background: isActive ? bc.bg : 'transparent',
                                color: isActive ? bc.text : '#64748b',
                                fontSize: 12, fontWeight: isActive ? 700 : 400, cursor: 'pointer',
                              }}
                            >{b}</button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Sessions */}
                    {row.sessions.map((sess, si) => (
                      <div key={si} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 14px',
                        background: 'rgba(0,0,0,0.2)',
                        borderTop: si > 0 ? `1px solid ${colors.border}22` : 'none',
                      }}>
                        <span style={{ fontSize: 12, color: '#64748b', minWidth: 56 }}>
                          {row.sessions.length > 1 ? `Session ${si + 1}` : 'Hours'}
                        </span>
                        <button
                          onClick={() => adjustSessionHours(ri, si, -0.5)}
                          style={{ width: 32, height: 32, border: '1px solid #334155', borderRadius: 6, background: '#0f172a', color: '#94a3b8', fontSize: 18, cursor: 'pointer' }}
                        >−</button>
                        <span style={{ fontSize: 16, fontWeight: 700, color: '#f1f5f9', minWidth: 36, textAlign: 'center' }}>
                          {Number(sess.hours)}h
                        </span>
                        <button
                          onClick={() => adjustSessionHours(ri, si, 0.5)}
                          style={{ width: 32, height: 32, border: '1px solid #334155', borderRadius: 6, background: '#0f172a', color: '#94a3b8', fontSize: 18, cursor: 'pointer' }}
                        >+</button>
                        <input
                          type="text"
                          placeholder="Note…"
                          value={sess.note}
                          onChange={e => updateSession(ri, si, 'note', e.target.value)}
                          style={{
                            flex: 1, padding: '6px 10px', borderRadius: 6,
                            background: '#0f172a', border: '1px solid #334155',
                            color: '#cbd5e1', fontSize: 13,
                          }}
                        />
                      </div>
                    ))}
                  </div>
                );
              })}

              <button
                onClick={addBench}
                style={{
                  width: '100%', padding: '12px 0',
                  border: '1px dashed #334155', background: 'transparent',
                  borderRadius: 10, color: '#64748b', fontSize: 13, cursor: 'pointer',
                }}
              >+ Add bench</button>

              <div style={{ fontSize: 12, color: '#64748b', textAlign: 'center' }}>
                {totalCards === 1 ? '1 card' : `${totalCards} cards`} · {parseFloat(totalHours.toFixed(1))}h total
              </div>

              <button
                onClick={handleSave}
                style={{
                  width: '100%', padding: '14px 0',
                  background: '#2563eb', color: '#fff',
                  border: 'none', borderRadius: 10,
                  fontSize: 15, fontWeight: 700, cursor: 'pointer',
                }}
              >
                {totalCards === 1 ? 'Update' : 'Save Splits'}
              </button>
            </div>
          )}
        </div>


        {/* Bottom safe area spacer */}
        <div style={{ height: 'env(safe-area-inset-bottom, 12px)', flexShrink: 0 }} />
      </div>
    </div>,
    document.body
  );
}
