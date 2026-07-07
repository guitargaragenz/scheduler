import { useState } from 'react';
import JobCard from './JobCard.jsx';
import DeferredItemsList from './DeferredItemsList.jsx';
import { BENCH_COLORS, HOURS_BUCKETS } from '../data/jobs.js';

const BENCH_ORDER = ['Setup', 'Luthier', 'Electronics', 'Fretwork', 'Wiring', 'Finishing', 'Admin'];

function getAllSubtasks(job, jobs) {
  if (job.hasSubtasks && Array.isArray(job.subtasks)) {
    return jobs.filter(j => job.subtasks.includes(j.id));
  }
  if (job.isSplit) {
    return jobs.filter(j => j.parentId === job.id);
  }
  return [];
}

// Only unscheduled subtasks — once a split piece is dragged onto the
// calendar it should drop out of the shelf, same as Sidebar.jsx.
function getSubtasks(job, jobs) {
  return getAllSubtasks(job, jobs).filter(j => !j.scheduled);
}

function formatSyncedAt(lastSyncedAt) {
  const d = new Date(lastSyncedAt);
  const now = new Date();
  const mins = Math.floor((now - d) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' });
}

export default function JobShelf({
  jobs, dragMode, onDragModeChange, onCsvUpload,
  highlightedJobId, onClearHighlight, onJobClick, lastSyncedAt,
  focusList = [], deferredItems = [], onPullBackIn,
}) {
  const [selectedBench, setSelectedBench] = useState(() => localStorage.getItem('jobShelfBench') || null);
  const [search, setSearch] = useState('');
  const [hoursFilter, setHoursFilter] = useState(null);
  const [focusOnly, setFocusOnly] = useState(false);
  const [expandedJobs, setExpandedJobs] = useState({});
  const focusSet = new Set(focusList.map(String));

  function pickBench(bench) {
    setSelectedBench(prev => {
      const next = prev === bench ? null : bench;
      if (next) localStorage.setItem('jobShelfBench', next);
      else localStorage.removeItem('jobShelfBench');
      return next;
    });
  }

  const toggleExpand = jobId => setExpandedJobs(prev => ({ ...prev, [jobId]: !prev[jobId] }));

  const topLevel = jobs.filter(j => {
    if (!j.id || j.done || j.parentId || j.scheduled) return false;
    // Hide a split/auto-split parent once every piece is already scheduled — nothing left to pull.
    if (j.hasSubtasks || j.isSplit) {
      const all = getAllSubtasks(j, jobs);
      if (all.length > 0 && all.every(k => k.scheduled)) return false;
    }
    return true;
  });

  const benchCounts = BENCH_ORDER.map(bench => ({
    bench,
    count: topLevel.filter(j => j.bench === bench).length,
  }));

  const q = search.trim().toLowerCase();
  const searching = q.length > 0;
  const active = searching || !!selectedBench || focusOnly;

  const matchHours = job => {
    if (!hoursFilter) return true;
    const bucket = HOURS_BUCKETS.find(b => b.key === hoursFilter);
    if (!bucket) return true;
    const h = parseFloat(job.hours);
    return !isNaN(h) && bucket.test(h);
  };

  const visible = (searching
    ? topLevel.filter(j => [j.customer, j.mfr, j.model].some(v => String(v || '').toLowerCase().includes(q)))
    : selectedBench
      ? topLevel.filter(j => j.bench === selectedBench)
      : focusOnly
        ? topLevel.filter(j => focusSet.has(String(j.job)))
        : []
  ).filter(matchHours).sort((a, b) => (b.days ?? 0) - (a.days ?? 0));

  function renderJob(job, indent = false) {
    const subtasks = getSubtasks(job, jobs);
    const isExpanded = expandedJobs[job.id];
    const jobDeferredItems = deferredItems.filter(d => d.jobId === job.id);
    return (
      <div key={job.id} style={{ marginBottom: 6, marginLeft: indent ? 16 : 0 }}>
        <JobCard
          job={job}
          dragMode={dragMode}
          isHighlighted={job.id === highlightedJobId}
          onClick={() => onJobClick(job)}
        />
        <DeferredItemsList items={jobDeferredItems} onPullBackIn={onPullBackIn} />
        {subtasks.length > 0 && (
          <div
            onClick={() => toggleExpand(job.id)}
            style={{ fontSize: 10, color: '#94a3b8', cursor: 'pointer', padding: '2px 4px 4px 8px' }}
          >
            {isExpanded ? '▼' : '▶'} {subtasks.length} sub-tasks
          </div>
        )}
        {isExpanded && subtasks.map(st => renderJob(st, true))}
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: '#181818', overflow: 'hidden',
    }}>
      <div style={{ textAlign: 'center', padding: '14px 14px 12px', borderBottom: '1px solid #232323' }}>
        <div style={{ fontSize: 22, fontWeight: 500, color: '#e2e8f0' }}>{topLevel.length}</div>
        <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>jobs waiting</div>
      </div>

      <div style={{ padding: '10px 14px 8px' }}>
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Customer, make, model…"
            style={{
              flex: 1, padding: '6px 10px',
              background: '#1e1e1e', border: '1px solid #252525', borderRadius: 7,
              color: '#ccc', fontSize: 13, outline: 'none', boxSizing: 'border-box',
            }}
          />
          <label
            htmlFor="job-shelf-csv-upload"
            title="Upload CSV"
            style={{
              flexShrink: 0, width: 32, boxSizing: 'border-box', borderRadius: 7, cursor: 'pointer', fontSize: 13,
              background: '#1e1e1e', border: '1px solid #252525', color: '#94a3b8',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >📂</label>
          <input
            id="job-shelf-csv-upload" type="file" accept=".csv" style={{ display: 'none' }}
            onChange={e => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = evt => onCsvUpload(evt.target.result);
              reader.readAsText(file);
              e.target.value = '';
            }}
          />
        </div>
        {focusList.length > 0 && (
          <button
            onClick={() => setFocusOnly(v => !v)}
            style={{
              width: '100%', padding: '6px 0', borderRadius: 7, cursor: 'pointer',
              fontSize: 11, fontWeight: 700, marginBottom: 8,
              border: `1px solid ${focusOnly ? '#f59e0b' : '#252525'}`,
              background: focusOnly ? '#451a03' : '#1e1e1e',
              color: focusOnly ? '#fcd34d' : '#94a3b8',
            }}
          >
            🎯 Focus ({focusList.length}){focusOnly ? ' — showing only these' : ''}
          </button>
        )}
        {!searching && !focusOnly && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {benchCounts.map(({ bench, count }) => {
              const isActive = selectedBench === bench;
              const colors = BENCH_COLORS[bench] || BENCH_COLORS.Admin;
              return (
                <span
                  key={bench}
                  onClick={() => pickBench(bench)}
                  style={{
                    fontSize: 9, padding: '4px 9px', borderRadius: 11, fontWeight: 600, cursor: 'pointer',
                    background: colors.bg,
                    color: colors.text,
                    opacity: isActive ? 1 : 0.5,
                    border: isActive ? `1px solid ${colors.border}` : '1px solid transparent',
                  }}
                >
                  {bench} <span style={{ opacity: 0.7 }}>{count}</span>
                </span>
              );
            })}
          </div>
        )}

        {active && (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 8 }}>
              {HOURS_BUCKETS.map(bucket => {
                const isActive = hoursFilter === bucket.key;
                return (
                  <button
                    key={bucket.key}
                    onClick={() => setHoursFilter(isActive ? null : bucket.key)}
                    title={isActive ? 'Clear hours filter' : `Show jobs ${bucket.label}`}
                    style={{
                      fontSize: 9, padding: '3px 7px', borderRadius: 4, cursor: 'pointer',
                      background: isActive ? '#0284c7' : '#1e1e1e',
                      border: `1px solid ${isActive ? '#38bdf8' : '#252525'}`,
                      color: isActive ? '#fff' : '#7dd3fc',
                      fontWeight: isActive ? 700 : 500,
                    }}
                  >{bucket.label}</button>
                );
              })}
            </div>

            <div style={{ display: 'flex', gap: 6, marginTop: 8, alignItems: 'center' }}>
              <button
                onClick={() => onDragModeChange('regular')}
                style={{
                  flex: 1, padding: '4px 0', borderRadius: 5, border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 600,
                  background: dragMode === 'regular' ? '#166534' : '#1e1e1e',
                  color: dragMode === 'regular' ? '#bbf7d0' : '#94a3b8',
                }}
              >Regular</button>
              <button
                onClick={() => onDragModeChange('urgent')}
                style={{
                  flex: 1, padding: '4px 0', borderRadius: 5, border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 600,
                  background: dragMode === 'urgent' ? '#7f1d1d' : '#1e1e1e',
                  color: dragMode === 'urgent' ? '#fca5a5' : '#94a3b8',
                }}
              >🚨 Urgent</button>
            </div>
          </>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 14px 12px' }}>
        {!active && (
          <div style={{ textAlign: 'center', marginTop: 32, fontSize: 12, color: '#333', fontStyle: 'italic' }}>
            · pick a bench above, or search ·
          </div>
        )}
        {active && visible.length === 0 && (
          <div style={{ textAlign: 'center', marginTop: 32, fontSize: 13, color: '#333' }}>
            {searching ? 'No jobs match' : 'No jobs'}
          </div>
        )}
        {visible.map(job => renderJob(job))}
      </div>

      <div style={{ padding: '8px 14px', borderTop: '1px solid #1e1e1e' }}>
        {lastSyncedAt && (
          <div style={{ fontSize: 9, color: '#3a3a3a', textAlign: 'center', marginBottom: 4 }}>
            ☁ synced {formatSyncedAt(lastSyncedAt)}
          </div>
        )}
        <div style={{ fontSize: 10, color: '#2a2a2a', textAlign: 'center', letterSpacing: 0.5 }}>
          you drag · it never pushes
        </div>
      </div>
    </div>
  );
}
