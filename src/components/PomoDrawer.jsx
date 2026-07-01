import { useReducer, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BENCH_COLORS } from '../data/jobs.js';

const BREAK_MINS = 5;
const DEFAULT_WORK_MINS = 25;

function reducer(state, action) {
  switch (action.type) {
    case 'START':
      return { ...state, phase: 'work' };
    case 'PAUSE':
      return { ...state, phase: 'paused' };
    case 'RESUME':
      return { ...state, phase: 'work' };
    case 'TICK': {
      const next = state.secsLeft - 1;
      if (next <= 0) {
        if (state.phase === 'work') {
          return { ...state, phase: 'break', secsLeft: BREAK_MINS * 60, pomos: state.pomos + 1 };
        }
        if (state.phase === 'break') {
          return { ...state, phase: 'idle', secsLeft: action.workSecs };
        }
      }
      return { ...state, secsLeft: next };
    }
    case 'STOP':
      return { ...state, phase: 'done' };
    case 'SKIP_BREAK':
      return { ...state, phase: 'idle', secsLeft: action.workSecs };
    case 'SET_WORK_SECS':
      return { ...state, secsLeft: action.workSecs };
    default:
      return state;
  }
}

export default function PomoDrawer({ job, onClose, onLogSession, onMarkDone, onRemove }) {
  const [workMins, setWorkMins] = useState(DEFAULT_WORK_MINS);
  const workSecs = workMins * 60;

  const [state, dispatch] = useReducer(reducer, {
    phase: 'idle',
    secsLeft: workSecs,
    pomos: 0,
  });
  const [note, setNote] = useState('');
  const [showManual, setShowManual] = useState(false);
  const [manualMins, setManualMins] = useState(25);
  const [manualDate, setManualDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [manualNote, setManualNote] = useState('');
  const [doneAmount, setDoneAmount] = useState('');
  const startedAtRef = useRef(null);
  const colors = BENCH_COLORS[job.bench] || BENCH_COLORS.Admin;

  // Run the clock only when work or break
  useEffect(() => {
    if (state.phase !== 'work' && state.phase !== 'break') return;
    const id = setInterval(() => dispatch({ type: 'TICK', workSecs }), 1000);
    return () => clearInterval(id);
  }, [state.phase, workSecs]);

  function handleStart() {
    if (!startedAtRef.current) startedAtRef.current = new Date().toISOString();
    dispatch({ type: 'START' });
  }

  function handleAdjustDuration(delta) {
    if (state.phase !== 'idle') return;
    const next = Math.max(5, Math.min(60, workMins + delta));
    setWorkMins(next);
    dispatch({ type: 'SET_WORK_SECS', workSecs: next * 60 });
  }

  function handleStop() {
    if (state.pomos === 0 && state.phase !== 'break') {
      onClose();
      return;
    }
    dispatch({ type: 'STOP' });
  }

  function handleLog() {
    onLogSession({
      startedAt: startedAtRef.current || new Date().toISOString(),
      pomos: state.pomos,
      mins: state.pomos * workMins,
      notes: note.trim(),
    });
    onClose();
  }

  function handleManualLog() {
    if (!manualMins || manualMins <= 0) return;
    onLogSession({
      startedAt: new Date(manualDate).toISOString(),
      pomos: 0,
      mins: Number(manualMins),
      notes: manualNote.trim(),
      manual: true,
    });
    setShowManual(false);
    setManualMins(25);
    setManualNote('');
  }

  function handleClose() {
    if (state.phase === 'done' && state.pomos > 0) {
      if (!window.confirm(`Discard ${state.pomos} pomo${state.pomos !== 1 ? 's' : ''}?`)) return;
    }
    onClose();
  }

  const mins = Math.floor(state.secsLeft / 60);
  const secs = state.secsLeft % 60;
  const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;

  const phaseColor = {
    idle: '#64748b', work: '#f97316', paused: '#fbbf24',
    break: '#22c55e', done: '#94a3b8',
  }[state.phase] || '#64748b';

  const phaseLabel = {
    idle: 'Ready', work: 'Working…', paused: 'Paused',
    break: 'Take a break!', done: 'Session complete',
  }[state.phase] || '';

  const { phase, pomos } = state;
  const isIdle = phase === 'idle';
  const isRunning = phase === 'work';
  const isPaused = phase === 'paused';
  const isBreak = phase === 'break';
  const isDone = phase === 'done';

  const pastSessions = (job.pomoLog || []).slice(-4).reverse();

  return createPortal(
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 2000,
      width: 340,
      background: '#0f172a',
      border: `2px solid ${colors.border}`,
      borderRadius: 16,
      boxShadow: '0 24px 64px rgba(0,0,0,0.85)',
      overflow: 'hidden',
    }}>
      {/* Job header */}
      <div style={{
        padding: '12px 16px',
        background: `${colors.bg}cc`,
        borderBottom: `1px solid ${colors.border}44`,
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
      }}>
        <div style={{ flex: 1, minWidth: 0, paddingRight: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#f1f5f9', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            #{job.job} · {job.mfr} {job.model}
          </div>
          <div style={{ fontSize: 11, color: colors.text, marginTop: 2, opacity: 0.8 }}>
            {job.bench} · {job.hours}h planned
          </div>
        </div>
        <button onClick={handleClose} style={{
          background: 'none', border: 'none', color: '#475569', fontSize: 22,
          cursor: 'pointer', padding: 0, lineHeight: 1, flexShrink: 0,
        }}>×</button>
      </div>

      {/* Timer body */}
      <div style={{ padding: '20px 20px 18px', textAlign: 'center' }}>

        {!isDone ? (
          <>
            {/* Pomo dots — completed pomos this session */}
            {pomos > 0 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginBottom: 12 }}>
                {Array.from({ length: pomos }).map((_, i) => (
                  <div key={i} style={{
                    width: 9, height: 9, borderRadius: '50%', background: '#f97316',
                  }} />
                ))}
              </div>
            )}

            {/* Duration adjuster — only visible when idle */}
            {isIdle && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10 }}>
                <button onClick={() => handleAdjustDuration(-5)} style={{
                  background: 'transparent', border: '1px solid #334155', color: '#64748b',
                  width: 24, height: 24, borderRadius: 4, cursor: 'pointer', fontSize: 14, lineHeight: 1,
                }}>−</button>
                <span style={{ fontSize: 11, color: '#64748b', minWidth: 60, textAlign: 'center' }}>
                  {workMins} min pomo
                </span>
                <button onClick={() => handleAdjustDuration(5)} style={{
                  background: 'transparent', border: '1px solid #334155', color: '#64748b',
                  width: 24, height: 24, borderRadius: 4, cursor: 'pointer', fontSize: 14, lineHeight: 1,
                }}>+</button>
              </div>
            )}

            {/* Countdown */}
            <div style={{
              fontSize: 60, fontWeight: 800,
              fontFamily: "'Courier Prime', 'Courier New', monospace",
              fontVariantNumeric: 'tabular-nums',
              color: phaseColor,
              lineHeight: 1, marginBottom: 6,
              transition: 'color 0.3s',
              letterSpacing: -1,
            }}>
              {timeStr}
            </div>

            <div style={{
              fontSize: 11, color: phaseColor, opacity: 0.75,
              letterSpacing: 1, textTransform: 'uppercase', marginBottom: 22,
            }}>
              {phaseLabel}{isBreak && pomos > 0 ? ` · pomo ${pomos} done` : ''}
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              {isIdle && (
                <button onClick={handleStart} style={{
                  background: '#f97316', color: '#fff', border: 'none',
                  borderRadius: 10, padding: '13px 40px', fontSize: 16, fontWeight: 700,
                  cursor: 'pointer', letterSpacing: 0.3,
                }}>
                  START
                </button>
              )}
              {isRunning && (
                <>
                  <button onClick={() => dispatch({ type: 'PAUSE' })} style={{
                    background: '#1e293b', color: '#cbd5e1', border: '1px solid #334155',
                    borderRadius: 8, padding: '10px 22px', fontSize: 13, fontWeight: 600,
                    cursor: 'pointer',
                  }}>
                    Pause
                  </button>
                  <button onClick={handleStop} style={{
                    background: 'transparent', color: '#64748b',
                    border: '1px solid #1e293b',
                    borderRadius: 8, padding: '10px 22px', fontSize: 13,
                    cursor: 'pointer',
                  }}>
                    Stop
                  </button>
                </>
              )}
              {isPaused && (
                <>
                  <button onClick={() => dispatch({ type: 'RESUME' })} style={{
                    background: '#f97316', color: '#fff', border: 'none',
                    borderRadius: 8, padding: '10px 22px', fontSize: 13, fontWeight: 700,
                    cursor: 'pointer',
                  }}>
                    Resume
                  </button>
                  <button onClick={handleStop} style={{
                    background: 'transparent', color: '#64748b',
                    border: '1px solid #1e293b',
                    borderRadius: 8, padding: '10px 22px', fontSize: 13,
                    cursor: 'pointer',
                  }}>
                    Stop
                  </button>
                </>
              )}
              {isBreak && (
                <button onClick={() => dispatch({ type: 'SKIP_BREAK', workSecs })} style={{
                  background: '#1e293b', color: '#94a3b8', border: '1px solid #334155',
                  borderRadius: 8, padding: '10px 22px', fontSize: 13,
                  cursor: 'pointer',
                }}>
                  Skip break
                </button>
              )}
            </div>
          </>
        ) : (
          /* Done state — log the session */
          <>
            <div style={{ fontSize: 32, fontWeight: 800, color: '#f97316', marginBottom: 4 }}>
              {pomos} {pomos === 1 ? 'pomo' : 'pomos'}
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 18 }}>
              ≈{pomos * workMins} min · log it?
            </div>
            <input
              type="text"
              placeholder="Notes (optional)…"
              value={note}
              onChange={e => setNote(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLog()}
              autoFocus
              style={{
                width: '100%', boxSizing: 'border-box',
                background: '#1e293b', border: '1px solid #334155',
                borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#e2e8f0',
                marginBottom: 10, outline: 'none',
              }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleClose} style={{
                flex: 1, background: 'transparent', color: '#64748b',
                border: '1px solid #1e293b', borderRadius: 8,
                padding: '10px 0', fontSize: 13, cursor: 'pointer',
              }}>
                Discard
              </button>
              <button onClick={handleLog} style={{
                flex: 2, background: '#2563eb', color: '#fff', border: 'none',
                borderRadius: 8, padding: '10px 0', fontSize: 13, fontWeight: 700,
                cursor: 'pointer',
              }}>
                Log session
              </button>
            </div>
          </>
        )}

        {/* Mark job as done */}
        {onMarkDone && !job.parentId && (isIdle || isDone) && (
          <div style={{ marginTop: 14, borderTop: '1px solid #1e293b', paddingTop: 12 }}>
            <div style={{ fontSize: 9, color: '#334155', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 8, textAlign: 'left' }}>
              Job done? Invoice amount
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', flex: 1, background: '#1e293b', border: '1px solid #334155', borderRadius: 8, padding: '0 10px' }}>
                <span style={{ color: '#475569', fontSize: 14, marginRight: 4 }}>$</span>
                <input
                  type="number"
                  placeholder="0"
                  value={doneAmount}
                  onChange={e => setDoneAmount(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && doneAmount && onMarkDone(job, doneAmount)}
                  style={{
                    flex: 1, background: 'transparent', border: 'none', outline: 'none',
                    fontSize: 15, fontWeight: 700, color: '#f1f5f9', width: 0,
                  }}
                />
              </div>
              <button
                onClick={() => doneAmount && onMarkDone(job, doneAmount)}
                style={{
                  background: doneAmount ? '#14532d' : '#1e293b',
                  color: doneAmount ? '#4ade80' : '#334155',
                  border: `1px solid ${doneAmount ? '#166534' : '#1e293b'}`,
                  borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 700,
                  cursor: doneAmount ? 'pointer' : 'default', whiteSpace: 'nowrap',
                }}
              >Done ✓</button>
            </div>
          </div>
        )}

        {/* Remove from calendar */}
        {onRemove && job.scheduled && isIdle && (
          <button
            onClick={() => { onRemove(job); handleClose(); }}
            style={{
              width: '100%', marginTop: 14, padding: '9px 0',
              background: 'transparent', color: '#f87171',
              border: '1px solid #f8717144', borderRadius: 8,
              fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >
            Remove from Calendar
          </button>
        )}

        {/* Past sessions + manual log */}
        {!isDone && (
          <div style={{ marginTop: 18, borderTop: '1px solid #1e293b', paddingTop: 12, textAlign: 'left' }}>

            {/* Header row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
              <div style={{ fontSize: 9, color: '#334155', textTransform: 'uppercase', letterSpacing: 1.5 }}>
                Past sessions
              </div>
              <button
                onClick={() => setShowManual(v => !v)}
                style={{
                  background: 'none', border: 'none', color: showManual ? '#64748b' : '#475569',
                  fontSize: 10, cursor: 'pointer', padding: 0, letterSpacing: 0.3,
                }}
              >
                {showManual ? 'cancel' : '+ log manually'}
              </button>
            </div>

            {/* Manual entry form */}
            {showManual && (
              <div style={{
                background: '#1e293b', borderRadius: 8, padding: '10px 12px',
                marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 9, color: '#475569', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 1 }}>Date</div>
                    <input
                      type="date"
                      value={manualDate}
                      onChange={e => setManualDate(e.target.value)}
                      style={{
                        width: '100%', background: '#0f172a', border: '1px solid #334155',
                        borderRadius: 6, padding: '5px 8px', fontSize: 12, color: '#e2e8f0',
                        colorScheme: 'dark',
                      }}
                    />
                  </div>
                  <div style={{ width: 70 }}>
                    <div style={{ fontSize: 9, color: '#475569', marginBottom: 3, textTransform: 'uppercase', letterSpacing: 1 }}>Mins</div>
                    <input
                      type="number"
                      min="1"
                      value={manualMins}
                      onChange={e => setManualMins(e.target.value)}
                      style={{
                        width: '100%', background: '#0f172a', border: '1px solid #334155',
                        borderRadius: 6, padding: '5px 8px', fontSize: 12, color: '#e2e8f0', textAlign: 'center',
                      }}
                    />
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="Notes (optional)…"
                  value={manualNote}
                  onChange={e => setManualNote(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleManualLog()}
                  style={{
                    background: '#0f172a', border: '1px solid #334155',
                    borderRadius: 6, padding: '6px 8px', fontSize: 12, color: '#e2e8f0',
                  }}
                />
                <button onClick={handleManualLog} style={{
                  background: '#334155', color: '#cbd5e1', border: 'none',
                  borderRadius: 6, padding: '7px 0', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}>
                  Log {manualMins}m
                </button>
              </div>
            )}

            {/* Session list */}
            {pastSessions.length > 0 ? pastSessions.map((s, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                fontSize: 11, color: '#64748b', padding: '4px 0',
                borderBottom: i < pastSessions.length - 1 ? '1px solid #1e293b' : 'none',
              }}>
                <span>{new Date(s.startedAt).toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                <span style={{ color: s.manual ? '#94a3b8' : '#f97316', fontWeight: 600 }}>
                  {s.manual ? `${s.mins}m` : `${s.pomos}p · ${s.mins}m`}
                </span>
                {s.notes ? (
                  <span style={{ color: '#475569', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.notes}
                  </span>
                ) : <span />}
              </div>
            )) : (
              <div style={{ fontSize: 11, color: '#334155', fontStyle: 'italic' }}>No sessions logged yet.</div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
