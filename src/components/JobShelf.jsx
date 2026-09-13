import { useState } from 'react';
import JobCard from './JobCard.jsx';
import DeferredItemsList from './DeferredItemsList.jsx';
import { benchColors, HOURS_BUCKETS, blockedPile, partsMayHaveArrived } from '../data/jobs.js';

export const BENCH_ORDER = ['Setup', 'Luthier', 'Electronics', 'Fretwork', 'Wiring', 'Finishing', 'Admin'];

// Blocked piles are NOT benches — deliberately kept out of BENCH_ORDER so they
// can never be treated as a real `job.bench` anywhere downstream. The stored
// selection is namespaced `pile:*` so it can't collide with a bench name.
const PILES = [
  { key: 'waiting', label: 'Waiting', color: '#f59e0b' },
  { key: 'planning', label: 'Planning', color: '#a78bfa' },
  { key: 'hold', label: 'Hold', color: '#f87171' },
  { key: 'transit', label: 'In Transit', color: '#2dd4bf' },
];
export const PILE_VALUES = PILES.map(p => `pile:${p.key}`);
export const pileOf = sel => (typeof sel === 'string' && sel.startsWith('pile:') ? sel.slice(5) : null);

// 🔧 Parts Arrived — a fourth chip in the same row, but deliberately NOT a pile.
//
// Piles are the blocked jobs: undraggable, benchless, `blockedPile(j) != null`.
// A parts-arrived job is the exact opposite — WP is a label only and does not
// change `schedulable`, so these are workable, draggable, benched jobs. Giving
// it its own `filter:` namespace rather than `pile:` is what keeps that true:
// `pileOf()` returns null for it, so `dragModeVisible()` still offers the
// Regular / 🚨 Urgent toggle above cards that genuinely can be dragged.
export const PARTS_ARRIVED_VALUE = 'filter:partsArrived';

// Whether to offer the Regular / 🚨 Urgent drag-mode toggle. Hide it only when
// a blocked pile is what's actually driving the list, because those cards can't
// be dragged.
//
// This must mirror the precedence in `visible` below: searching → pile → bench
// → focusOnly. Only `searching` outranks a pile, so only searching can put
// draggable jobs on screen while a pile is still selected — and because the
// chip row is hidden while searching, dropping the toggle there would look like
// a bug with nothing on screen to explain it. The Focus pill ranks *below* the
// pile, so it never takes the list over; keeping the toggle for it would put
// drag controls above undraggable cards, the exact thing this guard prevents.
export function dragModeVisible({ selectedPile, searching }) {
  return !(selectedPile && !searching);
}

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
  jobs, dragMode, onDragModeChange, onPdfUpload,
  highlightedJobId, onClearHighlight, onJobClick, lastSyncedAt,
  focusList = [], deferredItems = [], onPullBackIn, onToggleFocus,
}) {
  // Validate what comes back out of localStorage: a stale value that is neither
  // a real bench nor a known pile key would boot the shelf into a dead filter
  // (active, but nothing can ever match it).
  const [selectedBench, setSelectedBench] = useState(() => {
    const stored = localStorage.getItem('jobShelfBench');
    if (stored && (BENCH_ORDER.includes(stored) || PILE_VALUES.includes(stored) || stored === PARTS_ARRIVED_VALUE)) return stored;
    if (stored) localStorage.removeItem('jobShelfBench');
    return null;
  });
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

  // Blocked and benched are mutually exclusive here. A job that went On Hold in
  // Supabase keeps its stale `bench` (useSupabase takes bench verbatim and never
  // re-runs inferBench), so without this guard it would count in BOTH its old
  // bench chip and its pile chip.
  const benchCounts = BENCH_ORDER.map(bench => ({
    bench,
    count: topLevel.filter(j => j.bench === bench && blockedPile(j) == null).length,
  }));

  const pileCounts = PILES.map(p => ({
    ...p,
    count: topLevel.filter(j => blockedPile(j) === p.key).length,
  }));

  // These jobs are also counted by their bench chip, and that is correct here —
  // unlike the Week View sidebar, which lists every group at once and therefore
  // has to carve them out to avoid printing the same card twice. This panel only
  // ever shows ONE filter's worth of cards at a time, so nothing is on screen
  // twice. Taking them out of the bench chips would instead hide real, bookable
  // work from the bench he is actually picking from.
  const partsArrivedCount = topLevel.filter(partsMayHaveArrived).length;

  // Count only the focus jobs this shelf can actually list, so the pill's number
  // always matches what clicking it reveals. `topLevel` has already dropped the
  // done and scheduled ones, which is why this reads lower than focusList.length.
  const focusCount = topLevel.filter(j => focusSet.has(String(j.job))).length;

  const q = search.trim().toLowerCase();
  const searching = q.length > 0;
  const active = searching || !!selectedBench || focusOnly;
  const selectedPile = pileOf(selectedBench);

  const matchHours = job => {
    if (!hoursFilter) return true;
    const bucket = HOURS_BUCKETS.find(b => b.key === hoursFilter);
    if (!bucket) return true;
    const h = parseFloat(job.hours);
    return !isNaN(h) && bucket.test(h);
  };

  const visible = (searching
    ? topLevel.filter(j => [j.customer, j.mfr, j.model].some(v => String(v || '').toLowerCase().includes(q)))
    : selectedBench === PARTS_ARRIVED_VALUE
      ? topLevel.filter(partsMayHaveArrived)
      : selectedPile
      ? topLevel.filter(j => blockedPile(j) === selectedPile)
      : selectedBench
        ? topLevel.filter(j => j.bench === selectedBench && blockedPile(j) == null)
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
          isFocused={focusSet.has(String(job.job))}
          onToggleFocus={onToggleFocus && !indent ? () => onToggleFocus(job.job) : undefined}
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
        <div style={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>unscheduled</div>
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
          {onPdfUpload && (<>
            <label
              htmlFor="job-shelf-pdf-upload"
              title="Import Multitrack PDF"
              style={{
                flexShrink: 0, width: 32, boxSizing: 'border-box', borderRadius: 7, cursor: 'pointer', fontSize: 13,
                background: '#1e1e1e', border: '1px solid #252525', color: '#94a3b8',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >📄</label>
            <input
              id="job-shelf-pdf-upload" type="file" accept=".pdf,application/pdf" style={{ display: 'none' }}
              onChange={e => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) onPdfUpload(file);
              }}
            />
          </>)}
        </div>
        {focusCount > 0 && (
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
            🎯 Focus ({focusCount}){focusOnly ? ' — showing only these' : ''}
          </button>
        )}
        {!searching && !focusOnly && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {benchCounts.map(({ bench, count }) => {
              const isActive = selectedBench === bench;
              const colors = benchColors(bench);
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

            {/* Blocked piles. Rendered in their own block, never through the
                bench loop — a pile key passed to benchColors would land on the
                "no bench" swatch and read as a bench chip. Outlined, not
                filled, so they read as "not a bench" at a glance. Each pile
                gets its own colour (Trevor, 2026-07-28) so Waiting/Planning/
                Hold/In Transit are distinguishable without reading the label. */}
            {(pileCounts.some(p => p.count > 0) || partsArrivedCount > 0) && (
              <div style={{ flexBasis: '100%', height: 0 }} />
            )}
            {pileCounts.filter(p => p.count > 0).map(({ key, label, count, color }) => {
              const value = `pile:${key}`;
              const isActive = selectedBench === value;
              return (
                <span
                  key={value}
                  onClick={() => pickBench(value)}
                  style={{
                    fontSize: 9, padding: '4px 9px', borderRadius: 11, fontWeight: 600, cursor: 'pointer',
                    background: 'transparent',
                    color,
                    opacity: isActive ? 1 : 0.5,
                    border: `1px solid ${color}`,
                  }}
                >
                  {label} <span style={{ opacity: 0.7 }}>{count}</span>
                </span>
              );
            })}

            {/* 🔧 Parts Arrived — jobs Trevor still has tagged WP that Multitrack
                has stopped calling stuck. Hidden entirely at zero: a chip reading
                0 every day is a chip he stops seeing. Question mark dropped from
                the label only because the row has no space for it; the app still
                does not know the parts turned up, which is why clicking it shows
                him the jobs rather than doing anything to them. */}
            {partsArrivedCount > 0 && (
              <span
                onClick={() => pickBench(PARTS_ARRIVED_VALUE)}
                title="Still tagged WP, but Multitrack no longer says waiting — parts may have arrived"
                style={{
                  fontSize: 9, padding: '4px 9px', borderRadius: 11, fontWeight: 600, cursor: 'pointer',
                  background: 'transparent',
                  color: '#4ade80',
                  opacity: selectedBench === PARTS_ARRIVED_VALUE ? 1 : 0.5,
                  border: '1px solid #4ade80',
                }}
              >
                🔧 Parts Arrived <span style={{ opacity: 0.7 }}>{partsArrivedCount}</span>
              </span>
            )}
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

            {/* Blocked cards can't be dragged, so don't offer a drag mode above them. */}
            {dragModeVisible({ selectedPile, searching }) && (
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
            )}
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
