import { useState, useRef, useEffect } from 'react';
import JobShelf from './JobShelf';

const DATE_LABEL = new Date().toLocaleDateString('en-NZ', {
  weekday: 'long', day: 'numeric', month: 'long',
});

const ACTION_COLORS = {
  GTS:   { bg: '#0f2d1f', color: '#3fb950' },
  CI:    { bg: '#2d2213', color: '#d29922' },
  INC:   { bg: '#131a2d', color: '#58a6ff' },
  'RS-C':{ bg: '#2d1414', color: '#c44040' },
  RS:    { bg: '#2d1414', color: '#c44040' },
  DG:    { bg: '#1a1a2d', color: '#8b8bff' },
};

const BENCH_COLORS = {
  Luthier:     { bg: '#0f2d0f', color: '#3fb950' },
  Electronics: { bg: '#0f1a2d', color: '#58a6ff' },
  Setup:       { bg: '#2d2a0f', color: '#d29922' },
  Fretwork:    { bg: '#2d1a0f', color: '#e08030' },
  Admin:       { bg: '#2a1a2d', color: '#a371f7' },
  Wiring:      { bg: '#0f2a2d', color: '#3fbfa0' },
};

function ageDotColor(days) {
  if (days < 30) return '#3a9e5f';
  if (days <= 60) return '#c47d20';
  return '#c44040';
}

function Tag({ label, style: extraStyle }) {
  return (
    <span style={{
      fontSize: 9, padding: '2px 6px', borderRadius: 3,
      fontWeight: 700, letterSpacing: 0.3, ...extraStyle,
    }}>
      {label}
    </span>
  );
}

function BulletRow({ bullet, locked, onToggle, onRemove, onOpenJob, jobs }) {
  const done = bullet.done;
  const meta = bullet.meta || (() => {
    const job = jobs?.find(j => j.id === bullet.jobId);
    return job ? { bench: job.bench, hoursRange: job.hoursRange, action: job.action } : null;
  })();
  const isJob = !!bullet.jobId;

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '8px 0', borderBottom: '1px solid #1e293b',
    }}>
      <div
        onClick={() => !locked && onToggle(bullet.id)}
        style={{
          width: 6, height: 6, borderRadius: '50%',
          background: done ? '#334155' : (isJob ? '#58a6ff' : '#64748b'),
          flexShrink: 0, marginTop: 6, cursor: locked ? 'default' : 'pointer',
        }}
      />
      <div
        onClick={() => {
          if (locked) return;
          if (isJob && onOpenJob) onOpenJob(bullet.jobId);
          else onToggle(bullet.id);
        }}
        style={{ flex: 1, cursor: locked ? 'default' : 'pointer' }}
      >
        <div style={{
          fontSize: 13, lineHeight: 1.4,
          color: done ? '#475569' : '#e2e8f0',
          textDecoration: done ? 'line-through' : 'none',
        }}>
          {bullet.text}
          {isJob && !done && (
            <span style={{ marginLeft: 5, fontSize: 10, color: '#334155' }}>›</span>
          )}
        </div>
        {meta && (
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
            {[meta.bench, meta.hoursRange ? `${meta.hoursRange}h` : null, meta.action]
              .filter(Boolean).join(' · ')}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <span
          onClick={() => !locked && onToggle(bullet.id)}
          style={{ fontSize: 12, color: done ? '#238636' : '#475569', cursor: locked ? 'default' : 'pointer' }}
        >
          {done ? '✓' : '○'}
        </span>
        {!locked && (
          <span
            onClick={() => onRemove(bullet.id)}
            style={{ fontSize: 11, color: '#475569', cursor: 'pointer', padding: '1px 3px' }}
          >
            ✕
          </span>
        )}
      </div>
    </div>
  );
}

function LogJobCard({ job, pulled, onPull, jobs }) {
  const splits = jobs.filter(j => j.parentId === job.id);
  const actionStyle = ACTION_COLORS[job.action] || { bg: '#1e293b', color: '#64748b' };
  const benchStyle = BENCH_COLORS[job.bench] || { bg: '#1e293b', color: '#64748b' };

  return (
    <div style={{
      margin: '0 16px 10px',
      background: pulled ? '#131a13' : '#1e293b',
      border: `1px solid ${pulled ? '#1a3a1a' : '#334155'}`,
      borderRadius: 12, padding: '12px 14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: ageDotColor(job.days ?? 0),
          flexShrink: 0, marginTop: 5,
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 10, color: '#64748b', marginBottom: 1 }}>#{job.job}</div>
          {job.customer && (
            <div style={{ fontSize: 11, color: '#94a3b8' }}>{job.customer}</div>
          )}
          <div style={{ fontSize: 14, color: '#f1f5f9', fontWeight: 500, lineHeight: 1.3 }}>
            {job.mfr} {job.model}
          </div>
        </div>
      </div>

      {job.desc && (
        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 8, lineHeight: 1.4 }}>
          {job.desc.slice(0, 80)}{job.desc.length > 80 ? '…' : ''}
        </div>
      )}

      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center', marginBottom: splits.length ? 8 : 0 }}>
        <Tag label={job.bench} style={benchStyle} />
        {job.action && <Tag label={job.action} style={actionStyle} />}
        {job.hoursRange && (
          <span style={{ fontSize: 10, color: '#64748b' }}>{job.hoursRange}h</span>
        )}
        {job.days != null && (
          <span style={{ fontSize: 10, color: '#475569' }}>{job.days}d</span>
        )}
      </div>

      {splits.length > 0 && (
        <div style={{ borderTop: '1px solid #334155', paddingTop: 7, marginBottom: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {splits.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#334155', flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: '#64748b' }}>
                {s.bench} · {s.hoursRange}h{s.label ? ` · ${s.label}` : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => !pulled && onPull(job)}
        style={{
          width: '100%', border: `1px solid ${pulled ? '#1a3a1a' : '#334155'}`,
          borderRadius: 8, background: pulled ? 'rgba(35,134,54,0.08)' : 'none',
          padding: '7px', fontSize: 12,
          color: pulled ? '#3fb950' : '#64748b',
          cursor: pulled ? 'default' : 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {pulled ? '● in today\'s log' : '+ pull to today'}
      </button>
    </div>
  );
}

export default function DailyLogPage({ jobs, todayLog, onAddBullet, onToggleDone, onRemoveBullet, onBulletJobClick, onRequestCloseDay }) {
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [benchFilter, setBenchFilter] = useState(null);
  const [shelfOpen, setShelfOpen] = useState(false);
  const inputRef = useRef(null);

  const bullets = todayLog?.bullets || [];
  const locked = !!todayLog?.locked;
  const hasBullets = bullets.length > 0;

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  useEffect(() => {
    if (!locked && !isMobile) inputRef.current?.focus();
  }, [locked, isMobile]);

  function handleKeyDown(e) {
    if (e.key === 'Enter' && input.trim()) {
      onAddBullet(input.trim(), null, null);
      setInput('');
    }
  }

  function handlePull(job) {
    const text = `${job.customer ? job.customer + ' — ' : ''}${job.mfr} ${job.model}`;
    const meta = { bench: job.bench, hoursRange: job.hoursRange, action: job.action };
    onAddBullet(text, job.id, meta);
  }

  const pulledJobIds = new Set(bullets.map(b => b.jobId).filter(Boolean));

  // Jobs available in the log job list (parent jobs only, not subtasks)
  const availableJobs = jobs.filter(j => j.id && !j.parentId);

  const benches = [...new Set(availableJobs.map(j => j.bench).filter(Boolean))].sort();

  const q = search.toLowerCase();
  const filteredJobs = availableJobs
    .filter(j => !benchFilter || j.bench === benchFilter)
    .filter(j => {
      if (!q) return true;
      return [j.job, j.customer, j.mfr, j.model, j.desc].some(v =>
        String(v || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => (b.days ?? 0) - (a.days ?? 0));

  // ── MOBILE ──────────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{
        flex: 1, background: '#0f172a', color: '#e2e8f0',
        display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0,
      }}>
        {/* Header */}
        <div style={{
          background: '#1e293b', borderBottom: '1px solid #334155',
          padding: '10px 16px 12px', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>{DATE_LABEL}</div>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
              Today's log{locked ? ' · Locked' : ''}
            </div>
          </div>
          {hasBullets && !locked && (
            <button
              onClick={onRequestCloseDay}
              style={{
                background: 'none', border: '1px solid #334155', borderRadius: 16,
                padding: '5px 12px', fontSize: 11, color: '#94a3b8', cursor: 'pointer',
              }}
            >
              Close day →
            </button>
          )}
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto' }}>

          {/* TODAY'S LOG */}
          <div style={{ padding: '12px 16px 8px', borderBottom: '2px solid #1e293b' }}>
            <div style={{
              fontSize: 9, fontWeight: 700, letterSpacing: 1.8,
              color: '#475569', textTransform: 'uppercase', marginBottom: 8,
            }}>
              Today
            </div>

            {bullets.length === 0 ? (
              <div style={{
                color: '#475569', fontStyle: 'italic', fontSize: 13,
                padding: '12px 0', textAlign: 'center',
              }}>
                · pull a job or type a note ·
              </div>
            ) : (
              bullets.map(b => (
                <BulletRow
                  key={b.id}
                  bullet={b}
                  locked={locked}
                  onToggle={onToggleDone}
                  onRemove={onRemoveBullet}
                  onOpenJob={onBulletJobClick}
                  jobs={jobs}
                />
              ))
            )}

            <div style={{ paddingTop: 8 }}>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={locked}
                placeholder="quick note — hit enter"
                style={{
                  width: '100%', background: locked ? '#172032' : '#1e293b',
                  border: '1px solid #334155', borderRadius: 8,
                  padding: '9px 12px', fontSize: 13,
                  color: locked ? '#475569' : '#e2e8f0',
                  outline: 'none', cursor: locked ? 'not-allowed' : 'text',
                  fontFamily: 'inherit',
                }}
              />
            </div>
          </div>

          {/* JOBS */}
          {!locked && (
            <div style={{ paddingBottom: 20 }}>
              <div style={{
                fontSize: 9, fontWeight: 700, letterSpacing: 1.8,
                color: '#475569', textTransform: 'uppercase',
                padding: '12px 16px 8px',
              }}>
                Jobs
              </div>

              <div style={{ padding: '0 16px 8px' }}>
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Customer, make, model…"
                  style={{
                    width: '100%', background: '#1e293b', border: '1px solid #334155',
                    borderRadius: 8, padding: '8px 12px', fontSize: 13,
                    color: '#e2e8f0', outline: 'none', fontFamily: 'inherit',
                  }}
                />
              </div>

              {/* Bench filter pills */}
              <div style={{
                display: 'flex', gap: 6, padding: '0 16px 10px',
                overflowX: 'auto',
              }}>
                {benches.map(b => {
                  const bc = BENCH_COLORS[b] || { bg: '#1e293b', color: '#64748b' };
                  const active = benchFilter === b;
                  return (
                    <button
                      key={b}
                      onClick={() => setBenchFilter(active ? null : b)}
                      style={{
                        fontSize: 10, padding: '4px 10px', borderRadius: 12,
                        border: `1px solid ${active ? bc.color : '#334155'}`,
                        color: active ? bc.color : '#94a3b8',
                        background: active ? bc.bg : 'none',
                        cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                        fontFamily: 'inherit',
                      }}
                    >
                      {b}
                    </button>
                  );
                })}
              </div>

              {filteredJobs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, color: '#475569' }}>
                  {search || benchFilter ? 'No jobs match' : 'No jobs'}
                </div>
              ) : (
                filteredJobs.map(job => (
                  <LogJobCard
                    key={job.id}
                    job={job}
                    pulled={pulledJobIds.has(job.id)}
                    onPull={handlePull}
                    jobs={jobs}
                  />
                ))
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── DESKTOP ──────────────────────────────────────────────────────────────────
  const leftPanel = (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        padding: '24px 24px 16px', flexShrink: 0, borderBottom: '1px solid #1e293b',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ fontSize: 22, fontWeight: 600, color: '#f1f5f9', lineHeight: 1.2 }}>
              {DATE_LABEL}
            </div>
            {locked && (
              <span style={{
                fontSize: 10, color: '#64748b', background: '#1e293b',
                border: '1px solid #334155', borderRadius: 4, padding: '2px 7px',
              }}>
                Locked
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>Today's log</div>
        </div>
        {hasBullets && !locked && (
          <button
            onClick={onRequestCloseDay}
            style={{
              border: '1px solid #334155', borderRadius: 20, padding: '5px 14px',
              fontSize: 11, color: '#94a3b8', background: 'none', cursor: 'pointer',
              flexShrink: 0, marginTop: 4,
            }}
          >
            Close day
          </button>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 24px' }}>
        {bullets.length === 0 ? (
          <div style={{
            color: '#475569', fontStyle: 'italic', fontSize: 13,
            padding: '24px 0', textAlign: 'center',
          }}>
            · pull a job from the shelf, or type a note ·
          </div>
        ) : (
          bullets.map(b => (
            <BulletRow
              key={b.id}
              bullet={b}
              locked={locked}
              onToggle={onToggleDone}
              onRemove={onRemoveBullet}
              jobs={jobs}
            />
          ))
        )}
      </div>

      <div style={{ padding: '12px 24px 20px', flexShrink: 0, borderTop: '1px solid #1e293b' }}>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={locked}
          placeholder="quick note — hit enter"
          style={{
            width: '100%', boxSizing: 'border-box',
            background: locked ? '#172032' : '#1e293b',
            border: '1px solid #334155', borderRadius: 8,
            padding: '10px 14px', fontSize: 14,
            color: locked ? '#475569' : '#e2e8f0',
            outline: 'none', cursor: locked ? 'not-allowed' : 'text',
          }}
        />
      </div>
    </div>
  );

  return (
    <div style={{
      flex: 1, background: '#0f172a', color: '#e2e8f0',
      display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0,
    }}>
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 280px',
        minHeight: 0, overflow: 'hidden',
      }}>
        <div style={{ minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {leftPanel}
        </div>
        <div style={{ height: '100%', overflow: 'hidden', borderLeft: '1px solid #1e293b' }}>
          <JobShelf jobs={jobs} onPull={handlePull} />
        </div>
      </div>
    </div>
  );
}
