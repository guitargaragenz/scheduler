import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import JobCard from './JobCard.jsx';
import { BENCH_COLORS } from '../data/jobs.js';

const BENCHES = ['All benches', 'Luthier', 'Electronics', 'Setup', 'Fretwork', 'Admin'];

export default function Sidebar({ jobs, dragMode, onDragModeChange, onCsvUpload }) {
  const [bench, setBench] = useState('All benches');

  const { setNodeRef, isOver } = useDroppable({ id: 'sidebar' });

  const unscheduled = jobs.filter(j => !j.scheduled);
  const filtered = bench === 'All benches' ? unscheduled : unscheduled.filter(j => j.bench === bench);

  const counts = {};
  BENCHES.slice(1).forEach(b => {
    counts[b] = unscheduled.filter(j => j.bench === b).length;
  });

  return (
    <div style={{
      width: '30%', minWidth: 280, display: 'flex', flexDirection: 'column',
      background: '#1e293b', borderLeft: '1px solid #334155', height: '100%',
    }}>
      {/* Bench filter */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid #334155' }}>
        <label style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>
          Filter by bench
        </label>
        <select
          value={bench}
          onChange={e => setBench(e.target.value)}
          style={{
            width: '100%', marginTop: 6, padding: '6px 10px',
            background: '#0f172a', border: '1px solid #334155', borderRadius: 6,
            color: '#e2e8f0', fontSize: 13, cursor: 'pointer',
          }}
        >
          <option value="All benches">All benches ({unscheduled.length})</option>
          {BENCHES.slice(1).map(b => (
            <option key={b} value={b}>{b} ({counts[b] || 0})</option>
          ))}
        </select>
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
        >
          Regular
        </button>
        <button
          onClick={() => onDragModeChange('urgent')}
          style={{
            flex: 1, padding: '6px 0', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
            background: dragMode === 'urgent' ? '#7f1d1d' : '#1e293b',
            color: dragMode === 'urgent' ? '#fca5a5' : '#94a3b8',
            outline: dragMode === 'urgent' ? '2px solid #ef4444' : '1px solid #334155',
          }}
        >
          🚨 Urgent
        </button>
      </div>

      {/* Job list */}
      <div
        ref={setNodeRef}
        style={{
          flex: 1, overflowY: 'auto', padding: 12,
          display: 'flex', flexDirection: 'column', gap: 8,
          background: isOver ? 'rgba(34,197,94,0.05)' : 'transparent',
          transition: 'background 0.15s',
        }}
      >
        {filtered.length === 0 && (
          <div style={{ color: '#475569', textAlign: 'center', marginTop: 40, fontSize: 14 }}>
            No unscheduled jobs{bench !== 'All benches' ? ` for ${bench}` : ''}
          </div>
        )}
        {filtered.map(job => (
          <JobCard key={job.id} job={job} dragMode={dragMode} />
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
        >
          📂 Upload CSV
        </label>
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

        {/* Bench legend */}
        <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {Object.entries(BENCH_COLORS).map(([name, c]) => (
            <span key={name} style={{
              fontSize: 10, padding: '2px 6px', borderRadius: 3,
              background: c.bg, border: `1px solid ${c.border}`, color: c.text,
            }}>
              {name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
