import { useState } from 'react';
import { BENCH_COLORS } from '../data/jobs.js';

const SECTION_DEFS = [
  { key: 'input',    label: 'Needs Input',       sub: 'CI · Parts',           actions: ['CI', 'PARTS'],          hatch: true  },
  { key: 'thinking', label: 'Needs Thinking',    sub: 'INC · RS · RS-C · DG', actions: ['INC', 'RS', 'RS-C', 'DG'], hatch: true  },
  { key: 'ready',    label: 'Ready to Schedule', sub: 'GTS',                  actions: ['GTS'],                  hatch: false },
];

function ageBadgeColor(days) {
  if (days < 30) return '#4ade80';
  if (days < 60) return '#fbbf24';
  return '#f87171';
}

function actionTagColors(action) {
  const a = (action || '').trim().toUpperCase();
  if (a === 'CI')                return { bg: '#1c1917', color: '#a8a29e', border: '#44403c' };
  if (a === 'PARTS')             return { bg: '#172554', color: '#93c5fd', border: '#1e40af' };
  if (a === 'INC')               return { bg: '#1a1a2e', color: '#a78bfa', border: '#4c1d95' };
  if (a === 'RS' || a === 'RS-C') return { bg: '#1a2a1a', color: '#86efac', border: '#166534' };
  if (a === 'DG')                return { bg: '#2d1515', color: '#fca5a5', border: '#7f1d1d' };
  if (a === 'GTS')               return { bg: '#14532d', color: '#86efac', border: '#15803d' };
  return { bg: '#1f2937', color: '#9ca3af', border: '#374151' };
}

function JobBar({ job, windowDays, hatch }) {
  const TODAY_PCT = 93;
  const days = job.days || 0;
  const left  = days >= windowDays ? 0 : (windowDays - days) / windowDays * TODAY_PCT;
  const width = Math.max(TODAY_PCT - left, 0.5);
  const bc    = BENCH_COLORS[job.bench] || BENCH_COLORS.Admin;
  const tc    = actionTagColors(job.action);
  const ageColor = ageBadgeColor(days);

  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '230px 1fr 110px',
      alignItems: 'center', padding: '5px 0',
      borderBottom: '1px solid #161f2e',
    }}>
      {/* Job info */}
      <div style={{ paddingRight: 12 }}>
        <div style={{ fontWeight: 500, color: '#e5e7eb', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          #{job.job} · {job.mfr} {job.model}
        </div>
        <div style={{ fontSize: 11, color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1 }}>
          {job.customer}{job.desc ? ` · ${job.desc}` : ''}
        </div>
        <div style={{ marginTop: 3 }}>
          <span style={{
            fontSize: 10, fontWeight: 600, padding: '1px 5px', borderRadius: 3,
            background: bc.bg, color: bc.text, border: `1px solid ${bc.border}`,
          }}>{job.bench}</span>
        </div>
      </div>

      {/* Timeline bar */}
      <div style={{ position: 'relative', height: 30 }}>
        {/* Today marker */}
        <div style={{
          position: 'absolute', top: 0, bottom: 0, left: `${TODAY_PCT}%`,
          width: 2, background: 'rgba(251,191,36,0.55)', borderRadius: 1, pointerEvents: 'none',
        }} />
        {/* Bar */}
        <div style={{
          position: 'absolute', top: 5, height: 20, borderRadius: 4, overflow: 'hidden',
          left: `${left}%`, width: `${width}%`,
          minWidth: 4,
        }}>
          <div style={{ position: 'absolute', inset: 0, background: bc.bg, border: `1px solid ${bc.border}`, borderRadius: 4 }} />
          {hatch && (
            <div style={{
              position: 'absolute', right: 0, top: 0, bottom: 0, width: '35%',
              background: 'repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(0,0,0,0.3) 3px, rgba(0,0,0,0.3) 6px)',
            }} />
          )}
          <div style={{
            position: 'relative', fontSize: 10, fontWeight: 500,
            padding: '0 6px', lineHeight: '20px', whiteSpace: 'nowrap',
            overflow: 'hidden', color: bc.text,
          }}>
            {days >= 365 ? `${Math.round(days / 365 * 10) / 10}yr` : `${days}d`} · {job.desc?.slice(0, 40)}
          </div>
        </div>
      </div>

      {/* Right — age + action */}
      <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: ageColor }}>
          {days >= 365 ? `${Math.round(days / 365 * 10) / 10} yrs` : `${days} days`}
        </span>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4,
          background: tc.bg, color: tc.color, border: `1px solid ${tc.border}`,
          letterSpacing: '0.03em', whiteSpace: 'nowrap',
        }}>
          {job.action || '—'}
        </span>
      </div>
    </div>
  );
}

function Section({ def, jobs, windowDays }) {
  if (jobs.length === 0) return null;
  return (
    <div>
      <div style={{
        fontSize: 11, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.07em',
        padding: '14px 0 4px 4px', borderTop: '1px solid #1f2937',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        {def.label}
        <span style={{ background: '#1f2937', color: '#6b7280', fontSize: 10, padding: '1px 6px', borderRadius: 10 }}>
          {def.sub}
        </span>
        <span style={{ background: '#1f2937', color: '#6b7280', fontSize: 10, padding: '1px 6px', borderRadius: 10 }}>
          {jobs.length}
        </span>
      </div>
      {jobs.map(j => <JobBar key={j.id} job={j} windowDays={windowDays} hatch={def.hatch} />)}
    </div>
  );
}

export default function ProjectsPage({ jobs }) {
  const [actionFilter, setActionFilter] = useState(null);

  const today = new Date().toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });

  // Only top-level project jobs
  const projects = jobs.filter(j => j.project && !j.parentId);

  // Apply filter
  const filtered = actionFilter
    ? projects.filter(j => (j.action || '').trim().toUpperCase() === actionFilter)
    : projects;

  // Group into sections
  const inSection = new Set();
  const sections = SECTION_DEFS.map(def => {
    const sectionJobs = filtered.filter(j => {
      const a = (j.action || '').trim().toUpperCase();
      return def.actions.includes(a);
    });
    sectionJobs.forEach(j => inSection.add(j.id));
    return { def, jobs: sectionJobs };
  });
  // Other — project jobs with actions not matching any section
  const otherJobs = filtered.filter(j => !inSection.has(j.id));

  // Timeline window: show max 400 days, but at least enough for all jobs
  const maxJobDays = Math.max(...projects.map(j => j.days || 0), 60);
  const windowDays = Math.min(maxJobDays + 30, 400);

  // Scale markers
  const markers = [
    { pct: 0,   label: `${windowDays}+ days` },
    { pct: 25,  label: `${Math.round(windowDays * 0.75)} days` },
    { pct: 50,  label: `${Math.round(windowDays * 0.5)} days` },
    { pct: 75,  label: `${Math.round(windowDays * 0.25)} days` },
    { pct: 93,  label: 'Today' },
  ];

  const filterActions = ['CI', 'PARTS', 'INC', 'RS', 'RS-C', 'DG', 'GTS'];

  if (projects.length === 0) {
    return (
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#111827', color: '#6b7280',
      }}>
        <div style={{ textAlign: 'center', maxWidth: 380 }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>📋</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#9ca3af', marginBottom: 8 }}>No projects yet</div>
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>
            To add a job to Projects, open your Google Sheet,
            add a <code style={{ background: '#1f2937', padding: '1px 6px', borderRadius: 4, color: '#86efac' }}>PJ</code> column
            and set it to <code style={{ background: '#1f2937', padding: '1px 6px', borderRadius: 4, color: '#86efac' }}>Y</code> for
            any long-running job you want to track here. Then run <code style={{ background: '#1f2937', padding: '1px 6px', borderRadius: 4, color: '#86efac' }}>sheet_to_csv.command</code>.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', background: '#111827', color: '#f9fafb' }}>
      <div style={{ maxWidth: 1140, margin: '0 auto', padding: '24px 20px' }}>

        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>Projects</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
              Long-running projects · {today} · {projects.length} jobs
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button
              onClick={() => setActionFilter(null)}
              style={{
                padding: '5px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                background: !actionFilter ? '#374151' : '#1f2937',
                border: `1px solid ${!actionFilter ? '#6b7280' : '#374151'}`,
                color: !actionFilter ? '#f9fafb' : '#d1d5db',
              }}
            >All</button>
            {filterActions.map(a => {
              const tc = actionTagColors(a);
              const isActive = actionFilter === a;
              return (
                <button key={a} onClick={() => setActionFilter(isActive ? null : a)} style={{
                  padding: '5px 12px', borderRadius: 6, fontSize: 11, cursor: 'pointer', fontWeight: 700,
                  background: isActive ? tc.bg : '#1f2937',
                  border: `1px solid ${isActive ? tc.border : '#374151'}`,
                  color: isActive ? tc.color : '#9ca3af',
                }}>{a}</button>
              );
            })}
          </div>
        </div>

        {/* Timeline header */}
        <div style={{
          display: 'grid', gridTemplateColumns: '230px 1fr 110px',
          marginBottom: 8, paddingBottom: 6, borderBottom: '1px solid #1f2937',
        }}>
          <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', paddingLeft: 4 }}>
            Job / Customer
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px' }}>
            {markers.map(m => (
              <span key={m.pct} style={{ fontSize: 11, color: '#4b5563' }}>{m.label}</span>
            ))}
          </div>
          <div style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'right' }}>
            Age · Action
          </div>
        </div>

        {/* Sections */}
        {sections.map(({ def, jobs: sJobs }) => (
          <Section key={def.key} def={def} jobs={sJobs} windowDays={windowDays} />
        ))}

        {/* Other section */}
        {otherJobs.length > 0 && (
          <Section
            def={{ key: 'other', label: 'Other', sub: 'custom actions', hatch: false }}
            jobs={otherJobs}
            windowDays={windowDays}
          />
        )}

        {filtered.length === 0 && actionFilter && (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#4b5563', fontSize: 13 }}>
            No projects with action <strong>{actionFilter}</strong>
          </div>
        )}

        {/* Legend */}
        <div style={{
          display: 'flex', gap: 16, marginTop: 28, flexWrap: 'wrap',
          borderTop: '1px solid #1f2937', paddingTop: 16,
        }}>
          {[
            { swatch: <div style={{ width: 18, height: 10, borderRadius: 2, background: '#4ade80' }} />, label: '<30 days' },
            { swatch: <div style={{ width: 18, height: 10, borderRadius: 2, background: '#fbbf24' }} />, label: '30–60 days' },
            { swatch: <div style={{ width: 18, height: 10, borderRadius: 2, background: '#f87171' }} />, label: '60+ days' },
            {
              swatch: <div style={{ width: 18, height: 10, borderRadius: 2, background: 'repeating-linear-gradient(45deg,#374151,#374151 3px,#1f2937 3px,#1f2937 6px)' }} />,
              label: 'No recent activity',
            },
            {
              swatch: <div style={{ width: 2, height: 14, background: 'rgba(251,191,36,0.6)', borderRadius: 1 }} />,
              label: 'Today',
            },
          ].map(({ swatch, label }, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#9ca3af' }}>
              {swatch} {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
