import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import JobCard from './JobCard.jsx';
import { BENCH_COLORS } from '../data/jobs.js';

export default function Sidebar({ jobs, dragMode, onDragModeChange, onCsvUpload, highlightedJobId, onClearHighlight, onJobClick, isOpen, onToggle }) {
  const [search, setSearch] = useState('');
  const { setNodeRef, isOver } = useDroppable({ id: 'sidebar' });

  // Hide parent jobs that have been split (replaced by subtasks)
  const unscheduled = jobs.filter(j => !j.scheduled && !j.isSplit);

  const isFocusMode = !!highlightedJobId;

  let displayed;
  if (isFocusMode) {
    displayed = unscheduled.filter(j => j.id === highlightedJobId || j.parentId === highlightedJobId);
  } else {
    const q = search.toLowerCase();
    displayed = q
      ? unscheduled.filter(j =>
          [j.job, j.mfr, j.model, j.bench, j.desc, j.status, j.blockers]
            .some(v => String(v || '').toLowerCase().includes(q))
        )
      : unscheduled;
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
          background: isFocusMode ? '#166534' : '#1e293b',
          border: `1px solid ${isFocusMode ? '#22c55e' : '#334155'}`,
          borderRight: 'none',
          color: isFocusMode ? '#86efac' : '#64748b',
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
              <div style={{ color: '#475569', textAlign: 'center', marginTop: 40, fontSize: 14 }}>
                {isFocusMode ? 'No cards to schedule' : search ? 'No jobs match' : 'No unscheduled jobs'}
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
