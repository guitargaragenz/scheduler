import { useState } from 'react';
import { BENCH_COLORS } from '../data/jobs.js';

const BENCH_ORDER = ['Fretwork', 'Luthier', 'Setup', 'Wiring', 'Electronics', 'Admin'];

export default function JobsPage({ jobs, onJobClick }) {
  const [filter, setFilter] = useState('All');
  const [expandedJobs, setExpandedJobs] = useState({});

  const toggleExpand = (jobId) => setExpandedJobs(prev => ({ ...prev, [jobId]: !prev[jobId] }));

  // Show top-level jobs only (no subtask children as separate rows).
  // Subtask children have parentId set — they're accessible via expand toggle.
  const topLevel = jobs.filter(j => !j.parentId);

  // Which benches actually have top-level jobs
  const activeBenches = ['All', ...BENCH_ORDER.filter(b => topLevel.some(j => j.bench === b))];

  const filtered = filter === 'All' ? topLevel : topLevel.filter(j => j.bench === filter);

  const schedulable = filtered.filter(j => j.schedulable);
  const locked      = filtered.filter(j => !j.schedulable);

  function getSubtasks(job) {
    // Auto-splits: subtask ids listed on parent
    if (job.hasSubtasks && Array.isArray(job.subtasks)) {
      return jobs.filter(j => job.subtasks.includes(j.id));
    }
    // Manual splits: children have parentId pointing to this job
    if (job.isSplit) {
      return jobs.filter(j => j.parentId === job.id);
    }
    return [];
  }

  function renderJobRow(job) {
    const subtasks = getSubtasks(job);
    const isExpanded = expandedJobs[job.id];
    return (
      <div key={job.id}>
        <JobRow
          job={job}
          splits={subtasks.length}
          isExpanded={isExpanded}
          onTap={job.schedulable ? onJobClick : null}
          onToggleExpand={subtasks.length > 0 ? () => toggleExpand(job.id) : null}
        />
        {isExpanded && subtasks.map(st => (
          <div key={st.id} style={{ marginLeft: 16, marginTop: 6 }}>
            <JobRow job={st} splits={0} isExpanded={false} onTap={onJobClick} onToggleExpand={null} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0f172a' }}>

      {/* Bench filter chips */}
      <div style={{ flexShrink: 0, borderBottom: '1px solid #1e293b' }}>
        <div style={{
          display: 'flex', gap: 6, overflowX: 'auto', padding: '12px 16px',
          scrollbarWidth: 'none',
        }}>
          {activeBenches.map(b => {
            const colors = b !== 'All' ? (BENCH_COLORS[b] || BENCH_COLORS.Admin) : null;
            const isActive = filter === b;
            return (
              <button
                key={b}
                onClick={() => setFilter(b)}
                style={{
                  flexShrink: 0, padding: '6px 16px', borderRadius: 20, cursor: 'pointer',
                  border: isActive
                    ? `1px solid ${colors?.border ?? '#475569'}`
                    : '1px solid #334155',
                  background: isActive ? (colors?.bg ?? '#334155') : 'transparent',
                  color: isActive ? (colors?.text ?? '#e2e8f0') : '#64748b',
                  fontSize: 13, fontWeight: isActive ? 700 : 400,
                }}
              >{b}</button>
            );
          })}
        </div>
      </div>

      {/* Job list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px 32px', display: 'flex', flexDirection: 'column', gap: 0 }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', color: '#475569', fontSize: 14, marginTop: 48 }}>
            No jobs{filter !== 'All' ? ` on ${filter} bench` : ''}
          </div>
        )}

        {schedulable.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {schedulable.map(job => renderJobRow(job))}
          </div>
        )}

        {locked.length > 0 && (
          <>
            <div style={{
              fontSize: 11, color: '#475569', textTransform: 'uppercase',
              letterSpacing: '.06em', margin: schedulable.length > 0 ? '20px 0 8px' : '4px 0 8px',
            }}>
              Waiting / On Hold
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {locked.map(job => renderJobRow(job))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function JobRow({ job, splits, isExpanded, onTap, onToggleExpand }) {
  const colors = BENCH_COLORS[job.bench] || BENCH_COLORS.Admin;

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <button
        onClick={() => onTap?.(job)}
        style={{
          display: 'flex', alignItems: 'stretch', gap: 0,
          background: '#1e293b', border: '1px solid #334155',
          borderRadius: 10, overflow: 'hidden', padding: 0,
          cursor: onTap ? 'pointer' : 'default',
          opacity: onTap ? 1 : 0.45,
          textAlign: 'left', width: '100%',
        }}
      >
        {/* Bench colour stripe */}
        <div style={{ width: 4, background: colors.border, flexShrink: 0 }} />

        {/* Content */}
        <div style={{ flex: 1, padding: '11px 14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: '#f1f5f9' }}>#{job.job}</span>
              {job.customer && (
                <span style={{ fontSize: 13, color: '#94a3b8', marginLeft: 8 }}>{job.customer}</span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 5, alignItems: 'center', flexShrink: 0 }}>
              {job.scheduled && (
                <span style={{
                  fontSize: 10, background: '#0f172a', border: '1px solid #2563eb',
                  color: '#93c5fd', borderRadius: 4, padding: '2px 5px', fontWeight: 600,
                }}>📅</span>
              )}
              <span style={{
                fontSize: 12, fontWeight: 700, color: colors.text,
                background: colors.bg, border: `1px solid ${colors.border}55`,
                borderRadius: 4, padding: '2px 7px',
              }}>{job.hours}h</span>
            </div>
          </div>

          <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
            {job.mfr} {job.model}
          </div>

          {job.desc && (
            <div style={{ fontSize: 11, color: '#475569', marginTop: 3, lineHeight: 1.4 }}>
              {job.desc.length > 90 ? job.desc.slice(0, 90) + '…' : job.desc}
            </div>
          )}
        </div>
      </button>

      {/* Expand toggle — shown below the card when job has subtasks */}
      {onToggleExpand && splits > 0 && (
        <div
          onClick={onToggleExpand}
          style={{
            fontSize: 11, color: '#94a3b8', cursor: 'pointer',
            padding: '3px 6px 2px 10px', userSelect: 'none',
          }}
        >
          {isExpanded ? '▼' : '▶'} {splits} sub-tasks
        </div>
      )}
    </div>
  );
}
