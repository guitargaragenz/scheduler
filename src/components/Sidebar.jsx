import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import JobCard from './JobCard.jsx';
import { BENCH_COLORS } from '../data/jobs.js';

export default function Sidebar({ jobs, dragMode, onDragModeChange, onCsvUpload, highlightedJobId, onClearHighlight, onJobClick, isOpen, onToggle }) {
  const [search, setSearch] = useState('');
  const { setNodeRef, isOver } = useDroppable({ id: 'sidebar' });

  // Hide parent jobs that have been split (replaced by subtasks)
  const unscheduled   = jobs.filter(j => !j.scheduled && !j.isSplit);
  const active        = unscheduled.filter(j => j.schedulable && !j.backlog && !j.readyToStart);
  const backlog       = unscheduled.filter(j => j.schedulable && j.backlog && !j.readyToStart);
  const readyToStart  = unscheduled.filter(j => j.readyToStart);
  const awaiting      = unscheduled.filter(j => j.awaiting);
  const inTransit     = unscheduled.filter(j => j.inTransit);
  const onHold        = unscheduled.filter(j => !j.schedulable && !j.awaiting && !j.inTransit);

  const isFocusMode = !!highlightedJobId;

  let displayed, displayedBacklog, displayedReady, displayedAwaiting, displayedTransit, displayedHold;
  if (isFocusMode) {
    displayed          = active.filter(j => j.id === highlightedJobId || j.parentId === highlightedJobId);
    displayedBacklog   = [];
    displayedReady     = [];
    displayedAwaiting  = [];
    displayedTransit   = [];
    displayedHold      = [];
  } else {
    const q = search.toLowerCase();
    const match = j => [j.job, j.mfr, j.model, j.bench, j.desc, j.status, j.action]
      .some(v => String(v || '').toLowerCase().includes(q));
    displayed          = q ? active.filter(match)       : active;
    displayedBacklog   = q ? backlog.filter(match)      : backlog;
    displayedReady     = q ? readyToStart.filter(match) : readyToStart;
    displayedAwaiting  = q ? awaiting.filter(match)     : awaiting;
    displayedTransit   = q ? inTransit.filter(match)    : inTransit;
    displayedHold      = q ? onHold.filter(match)       : onHold;
  }

  const focusCount = isFocusMode ? displayed.length : 0;
  const hasMultipleSessions = isFocusMode && displayed.some(j => j.isSubtask);

  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'stretch' }}>
      {/* Toggle tab */}
      <button
        onClick={onToggle}
        style={{
          position: 'absolute', left: isOpen ? -28 : -28, top: '50%', transform: 'translateY(-50%)',
          width: 28, height: 56, borderRadius: '8px 0 0 8px',
          background: isFocusMode ? '#166534' : '#0369a1',
          border: `1px solid ${isFocusMode ? '#22c55e' : '#38bdf8'}`,
          borderRight: 'none',
          color: isFocusMode ? '#86efac' : '#e0f2fe',
          fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 10,
        }}
      >
        {isOpen ? '›' : '‹'}
      </button>

      {/* Sidebar panel */}
      <div style={{
        width: isOpen ? 300 : 0,
        minWidth: 0,
        overflow: 'hidden',
        transition: 'width 0.3s ease',
        display: 'flex', flexDirection: 'column',
        background: '#1e293b', borderLeft: '1px solid #334155', height: '100%',
      }}>
        <div style={{ width: 300, display: 'flex', flexDirection: 'column', height: '100%' }}>
          {/* Search / focus banner */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #334155' }}>
            {isFocusMode ? (
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                background: '#14532d', border: '1px solid #166534', borderRadius: 6,
                padding: '8px 12px',
              }}>
                <span style={{ fontSize: 12, color: '#86efac', fontWeight: 600 }}>
                  {hasMultipleSessions
                    ? `Split into ${focusCount} — drag each to schedule`
                    : '✓ Saved — drag to schedule'}
                </span>
                <button
                  onClick={onClearHighlight}
                  style={{ background: 'none', border: 'none', color: '#4ade80', fontSize: 16, cursor: 'pointer', padding: 0, lineHeight: 1 }}
                >×</button>
              </div>
            ) : (
              <>
                <label style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>
                  Search jobs
                </label>
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Job #, make, model, bench…"
                  style={{
                    display: 'block', width: '100%', marginTop: 6, padding: '6px 10px',
                    background: '#0f172a', border: '1px solid #334155', borderRadius: 6,
                    color: '#e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </>
            )}
          </div>

          {/* Drag mode toggle */}
          <div style={{ padding: '10px 16px', borderBottom: '1px solid #334155', display: 'flex', gap: 8 }}>
            <button
              onClick={() => onDragModeChange('regular')}
              style={{
                flex: 1, padding: '6px 0', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: dragMode === 'regular' ? '#166534' : '#1e293b',
                color: dragMode === 'regular' ? '#bbf7d0' : '#94a3b8',
                outline: dragMode === 'regular' ? '2px solid #22c55e' : '1px solid #334155',
              }}
            >Regular</button>
            <button
              onClick={() => onDragModeChange('urgent')}
              style={{
                flex: 1, padding: '6px 0', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: dragMode === 'urgent' ? '#7f1d1d' : '#1e293b',
                color: dragMode === 'urgent' ? '#fca5a5' : '#94a3b8',
                outline: dragMode === 'urgent' ? '2px solid #ef4444' : '1px solid #334155',
              }}
            >🚨 Urgent</button>
          </div>

          {/* Job list */}
          <div
            ref={setNodeRef}
            onClick={e => { if (isFocusMode && e.target === e.currentTarget) onClearHighlight(); }}
            style={{
              flex: 1, overflowY: 'auto', padding: 12,
              display: 'flex', flexDirection: 'column', gap: 8,
              background: isOver ? 'rgba(34,197,94,0.05)' : 'transparent',
              transition: 'background 0.15s',
              cursor: isFocusMode ? 'pointer' : 'default',
            }}
          >
            {displayed.length === 0 && (
              <div style={{ textAlign: 'center', marginTop: 40, fontSize: 14 }}>
                {isFocusMode ? (
                  <span style={{ color: '#475569' }}>No cards to schedule</span>
                ) : search ? (
                  <span style={{ color: '#475569' }}>No jobs match</span>
                ) : jobs.length === 0 ? (
                  <div>
                    <div style={{ color: '#64748b', marginBottom: 12 }}>No jobs loaded</div>
                    <label htmlFor="csv-upload" style={{ cursor: 'pointer', color: '#93c5fd', fontSize: 13, textDecoration: 'underline' }}>
                      Upload jobs.csv to get started
                    </label>
                  </div>
                ) : (
                  <span style={{ color: '#475569' }}>No unscheduled jobs</span>
                )}
              </div>
            )}
            {displayed.map(job => (
              <JobCard
                key={job.id}
                job={job}
                dragMode={dragMode}
                isHighlighted={isFocusMode}
                onClick={() => onJobClick(job)}
              />
            ))}

            {/* Backlog — schedulable, lower priority queue, draggable */}
            {!isFocusMode && displayedBacklog.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', letterSpacing: 1, padding: '4px 0 6px', borderTop: '1px solid #1e293b' }}>
                  BACKLOG ({displayedBacklog.length})
                </div>
                {displayedBacklog.map(job => (
                  <div key={job.id} style={{ opacity: 0.65 }}>
                    <JobCard job={job} dragMode={dragMode} isHighlighted={false} onClick={() => onJobClick(job)} />
                  </div>
                ))}
              </div>
            )}

            {/* Ready to Start — On Hold + BL=Y + GTS: parts arrived, good to go */}
            {!isFocusMode && displayedReady.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', letterSpacing: 1, padding: '4px 0 6px', borderTop: '1px solid #78350f' }}>
                  ✅ READY TO START ({displayedReady.length})
                </div>
                {displayedReady.map(job => (
                  <JobCard key={job.id} job={job} dragMode={dragMode} isHighlighted={false} onClick={() => onJobClick(job)} />
                ))}
              </div>
            )}

            {/* Awaiting — Waiting + INC or CI: pending customer/incubating, locked */}
            {!isFocusMode && displayedAwaiting.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#6366f1', letterSpacing: 1, padding: '4px 0 6px', borderTop: '1px solid #312e81' }}>
                  📞 AWAITING ({displayedAwaiting.length})
                </div>
                {displayedAwaiting.map(job => (
                  <div key={job.id} style={{ opacity: 0.55, pointerEvents: 'none' }}>
                    <JobCard job={job} dragMode={false} isHighlighted={false} onClick={() => {}} />
                  </div>
                ))}
              </div>
            )}

            {/* In Transit — locked, visible for tracking */}
            {!isFocusMode && displayedTransit.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#22d3ee', letterSpacing: 1, padding: '4px 0 6px', borderTop: '1px solid #164e63' }}>
                  📦 IN TRANSIT ({displayedTransit.length})
                </div>
                {displayedTransit.map(job => (
                  <div key={job.id} style={{ opacity: 0.55, pointerEvents: 'none' }}>
                    <JobCard job={job} dragMode={false} isHighlighted={false} onClick={() => {}} />
                  </div>
                ))}
              </div>
            )}

            {/* On Hold — truly parked, dimmed */}
            {!isFocusMode && displayedHold.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', letterSpacing: 1, padding: '4px 0 6px', borderTop: '1px solid #1e293b' }}>
                  🔒 ON HOLD ({displayedHold.length})
                </div>
                {displayedHold.map(job => (
                  <div key={job.id} style={{ opacity: 0.35, pointerEvents: 'none' }}>
                    <JobCard job={job} dragMode={false} isHighlighted={false} onClick={() => {}} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: '10px 16px', borderTop: '1px solid #334155' }}>
            <label
              htmlFor="csv-upload"
              style={{
                display: 'block', textAlign: 'center', padding: '8px 0',
                background: '#1e3a5f', border: '1px solid #2563eb', borderRadius: 6,
                color: '#bfdbfe', fontSize: 12, cursor: 'pointer', fontWeight: 600,
              }}
            >📂 Upload CSV</label>
            <input
              id="csv-upload" type="file" accept=".csv" style={{ display: 'none' }}
              onChange={e => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = evt => onCsvUpload(evt.target.result);
                reader.readAsText(file);
                e.target.value = '';
              }}
            />
            <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {Object.entries(BENCH_COLORS).map(([name, c]) => (
                <span key={name} style={{
                  fontSize: 10, padding: '2px 6px', borderRadius: 3,
                  background: c.bg, border: `1px solid ${c.border}`, color: c.text,
                }}>{name}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
