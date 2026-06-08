import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import JobCard from './JobCard.jsx';
import { BENCH_COLORS } from '../data/jobs.js';

const HOURS_BUCKETS = [
  { label: '< 1hr',  key: 'lt1',  test: h => h > 0 && h < 1 },
  { label: '1–2hr',  key: '1to2', test: h => h >= 1 && h < 2 },
  { label: '2–4hr',  key: '2to4', test: h => h >= 2 && h < 4 },
  { label: '4hr+',   key: 'gt4',  test: h => h >= 4 },
];

export default function Sidebar({ jobs, dragMode, onDragModeChange, onCsvUpload, highlightedJobId, onClearHighlight, onJobClick, isOpen, onToggle, lastSyncedAt }) {
  const [search, setSearch] = useState('');
  const [benchFilter, setBenchFilter] = useState(null);
  const [hoursFilter, setHoursFilter] = useState(null);
  const [expandedJobs, setExpandedJobs] = useState({});
  const { setNodeRef, isOver } = useDroppable({ id: 'sidebar' });

  const toggleExpand = (jobId) => setExpandedJobs(prev => ({ ...prev, [jobId]: !prev[jobId] }));

  const renderJob = (job, highlighted = false) => {
    if (job.parentId) return null; // subtasks rendered under parent
    const subtaskList = job.hasSubtasks ? jobs.filter(j => job.subtasks?.includes(j.id)) : [];
    const isExpanded = expandedJobs[job.id];
    return (
      <div key={job.id}>
        <JobCard job={job} dragMode={dragMode} isHighlighted={highlighted} onClick={() => onJobClick(job)} />
        {job.hasSubtasks && (
          <div
            onClick={() => toggleExpand(job.id)}
            style={{ fontSize: 10, color: '#94a3b8', cursor: 'pointer', padding: '2px 4px 4px 8px' }}
          >
            {isExpanded ? '▼' : '▶'} {subtaskList.length} sub-tasks
          </div>
        )}
        {isExpanded && subtaskList.map(st => (
          <div key={st.id} style={{ marginLeft: 16, marginTop: 4 }}>
            <JobCard job={st} dragMode={dragMode} isHighlighted={false} onClick={() => onJobClick(st)} />
          </div>
        ))}
      </div>
    );
  };

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
    displayed          = [...active, ...backlog].filter(j => j.id === highlightedJobId || j.parentId === highlightedJobId);
    displayedBacklog   = [];
    displayedReady     = [];
    displayedAwaiting  = [];
    displayedTransit   = [];
    displayedHold      = [];
  } else {
    const q = search.toLowerCase();
    const matchText  = j => [j.job, j.mfr, j.model, j.bench, j.desc, j.status, j.action]
      .some(v => String(v || '').toLowerCase().includes(q));
    const matchBench = j => !benchFilter || j.bench === benchFilter;
    const matchHours = j => {
      if (!hoursFilter) return true;
      const bucket = HOURS_BUCKETS.find(b => b.key === hoursFilter);
      if (!bucket) return true;
      const h = parseFloat(j.hours);
      return !isNaN(h) && bucket.test(h);
    };
    const match      = j => matchText(j) && matchBench(j) && matchHours(j);
    displayed          = active.filter(match);
    displayedBacklog   = backlog.filter(match);
    displayedReady     = readyToStart.filter(match);
    displayedAwaiting  = awaiting.filter(match);
    displayedTransit   = inTransit.filter(match);
    displayedHold      = onHold.filter(match);
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
          background: isFocusMode ? '#166534' : '#0f2044',
          border: `1px solid ${isFocusMode ? '#22c55e' : '#3b82f6'}`,
          borderRight: 'none',
          color: isFocusMode ? '#86efac' : '#bfdbfe',
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
        background: '#0f2044', borderLeft: '1px solid #3b82f6', height: '100vh',
      }}>
        <div style={{ width: 300, display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
          {/* Search / focus banner */}
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #3b82f6' }}>
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
                    background: '#0a1a38', border: '1px solid #3b82f6', borderRadius: 6,
                    color: '#e2f4fd', fontSize: 13, outline: 'none', boxSizing: 'border-box',
                  }}
                />
              </>
            )}
          </div>

          {/* Drag mode toggle */}
          <div style={{ padding: '10px 16px', borderBottom: '1px solid #3b82f6', display: 'flex', gap: 8 }}>
            <button
              onClick={() => onDragModeChange('regular')}
              style={{
                flex: 1, padding: '6px 0', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: dragMode === 'regular' ? '#166534' : '#0a1a38',
                color: dragMode === 'regular' ? '#bbf7d0' : '#94a3b8',
                outline: dragMode === 'regular' ? '2px solid #22c55e' : '1px solid #334155',
              }}
            >Regular</button>
            <button
              onClick={() => onDragModeChange('urgent')}
              style={{
                flex: 1, padding: '6px 0', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: dragMode === 'urgent' ? '#7f1d1d' : '#0a1a38',
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
              flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: 12,
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
            {displayed.map(job => renderJob(job, isFocusMode))}

            {/* Backlog — schedulable, lower priority queue, draggable */}
            {!isFocusMode && displayedBacklog.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', letterSpacing: 1, padding: '4px 0 6px', borderTop: '1px solid #0284c7' }}>
                  BACKLOG ({displayedBacklog.length})
                </div>
                {displayedBacklog.map(job => renderJob(job))}
              </div>
            )}

            {/* Ready to Start — On Hold + BL=Y + GTS: parts arrived, good to go */}
            {!isFocusMode && displayedReady.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#f59e0b', letterSpacing: 1, padding: '4px 0 6px', borderTop: '1px solid #78350f' }}>
                  ✅ READY TO START ({displayedReady.length})
                </div>
                {displayedReady.map(job => renderJob(job))}
              </div>
            )}

            {/* Awaiting — Waiting + INC or CI: pending customer/incubating, locked */}
            {!isFocusMode && displayedAwaiting.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#6366f1', letterSpacing: 1, padding: '4px 0 6px', borderTop: '1px solid #312e81' }}>
                  📞 AWAITING ({displayedAwaiting.length})
                </div>
                {displayedAwaiting.map(job => renderJob(job))}
              </div>
            )}

            {/* In Transit — locked, visible for tracking */}
            {!isFocusMode && displayedTransit.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#22d3ee', letterSpacing: 1, padding: '4px 0 6px', borderTop: '1px solid #164e63' }}>
                  📦 IN TRANSIT ({displayedTransit.length})
                </div>
                {displayedTransit.map(job => renderJob(job))}
              </div>
            )}

            {/* On Hold — truly parked, dimmed */}
            {!isFocusMode && displayedHold.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', letterSpacing: 1, padding: '4px 0 6px', borderTop: '1px solid #0284c7' }}>
                  🔒 ON HOLD ({displayedHold.length})
                </div>
                {displayedHold.map(job => renderJob(job))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{ padding: '10px 16px', borderTop: '1px solid #3b82f6' }}>
            {lastSyncedAt && (
              <div style={{ fontSize: 10, color: '#64748b', textAlign: 'center', marginBottom: 8 }}>
                ☁ synced {(() => {
                  const d = new Date(lastSyncedAt);
                  const now = new Date();
                  const mins = Math.floor((now - d) / 60000);
                  if (mins < 1) return 'just now';
                  if (mins < 60) return `${mins}m ago`;
                  const hrs = Math.floor(mins / 60);
                  if (hrs < 24) return `${hrs}h ago`;
                  return d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' });
                })()}
              </div>
            )}
            <label
              htmlFor="csv-upload"
              style={{
                display: 'block', textAlign: 'center', padding: '8px 0',
                background: '#0a1a38', border: '1px solid #3b82f6', borderRadius: 6,
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
              {Object.entries(BENCH_COLORS).map(([name, c]) => {
                const isActive = benchFilter === name;
                return (
                  <button
                    key={name}
                    onClick={() => setBenchFilter(isActive ? null : name)}
                    title={isActive ? `Clear ${name} filter` : `Show ${name} jobs only`}
                    style={{
                      fontSize: 10, padding: '3px 8px', borderRadius: 3, cursor: 'pointer',
                      background: isActive ? c.border : c.bg,
                      border: `1px solid ${c.border}`,
                      color: isActive ? '#fff' : c.text,
                      fontWeight: isActive ? 700 : 500,
                      boxShadow: isActive ? `0 0 6px ${c.border}88` : 'none',
                      transform: isActive ? 'scale(1.08)' : 'scale(1)',
                      transition: 'all 0.15s',
                    }}
                  >{name}</button>
                );
              })}
              {benchFilter && (
                <button
                  onClick={() => setBenchFilter(null)}
                  title="Clear filter"
                  style={{
                    fontSize: 10, padding: '3px 7px', borderRadius: 3, cursor: 'pointer',
                    background: 'none', border: '1px solid #475569',
                    color: '#94a3b8', fontWeight: 600,
                  }}
                >✕</button>
              )}
            </div>

            {/* Hours filter */}
            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
              <span style={{ fontSize: 9, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>⏱</span>
              {HOURS_BUCKETS.map(bucket => {
                const isActive = hoursFilter === bucket.key;
                return (
                  <button
                    key={bucket.key}
                    onClick={() => setHoursFilter(isActive ? null : bucket.key)}
                    title={isActive ? 'Clear hours filter' : `Show jobs ${bucket.label}`}
                    style={{
                      fontSize: 10, padding: '3px 8px', borderRadius: 3, cursor: 'pointer',
                      background: isActive ? '#0284c7' : '#0a1a38',
                      border: `1px solid ${isActive ? '#38bdf8' : '#1e4a7a'}`,
                      color: isActive ? '#fff' : '#7dd3fc',
                      fontWeight: isActive ? 700 : 500,
                      boxShadow: isActive ? '0 0 6px #38bdf888' : 'none',
                      transform: isActive ? 'scale(1.08)' : 'scale(1)',
                      transition: 'all 0.15s',
                    }}
                  >{bucket.label}</button>
                );
              })}
              {hoursFilter && (
                <button
                  onClick={() => setHoursFilter(null)}
                  title="Clear hours filter"
                  style={{
                    fontSize: 10, padding: '3px 7px', borderRadius: 3, cursor: 'pointer',
                    background: 'none', border: '1px solid #475569',
                    color: '#94a3b8', fontWeight: 600,
                  }}
                >✕</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
