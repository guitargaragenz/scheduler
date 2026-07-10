import { useState, useRef, useEffect } from 'react';
import JobShelf from './JobShelf';
import CalendarGrid from './CalendarGrid';
import DeferredItemsList from './DeferredItemsList.jsx';
import ReasonPicker from './ReasonPicker.jsx';
import { BENCH_COLORS as CANONICAL_BENCH_COLORS } from '../data/jobs.js';
import { localDateKey } from '../utils/calendar.js';

const DATE_LABEL = new Date().toLocaleDateString('en-NZ', {
  weekday: 'long', day: 'numeric', month: 'long',
});

function JobPeekPopover({ job, onClose, onOpenFull }) {
  const colors = CANONICAL_BENCH_COLORS[job.bench] || CANONICAL_BENCH_COLORS.Admin;
  return (
    <div style={{
      position: 'absolute', top: 12, right: 12, zIndex: 10,
      background: '#1e293b', border: '1px solid #334155', borderRadius: 10,
      padding: '14px 16px', width: 240, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>{job.mfr} {job.model}</div>
          <div style={{ fontSize: 11, color: '#94a3b8' }}>{job.customer} · {job.bench}</div>
        </div>
        <span onClick={onClose} style={{ fontSize: 14, color: '#64748b', cursor: 'pointer' }}>&times;</span>
      </div>
      {job.desc && (
        <div style={{ fontSize: 11, color: colors.text, fontStyle: 'italic', marginBottom: 10 }}>
          {job.desc.length > 60 ? job.desc.slice(0, 60) + '…' : job.desc}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={onOpenFull}
          style={{ flex: 1, background: 'none', border: '1px solid #334155', borderRadius: 6, padding: 6, fontSize: 11, color: '#94a3b8', cursor: 'pointer' }}
        >
          Start Pomo
        </button>
        <button
          onClick={onOpenFull}
          style={{ flex: 1, background: 'none', border: '1px solid #334155', borderRadius: 6, padding: 6, fontSize: 11, color: '#94a3b8', cursor: 'pointer' }}
        >
          Full details →
        </button>
      </div>
    </div>
  );
}

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

function formatCarriedDate(dateKey) {
  const d = new Date(dateKey + 'T00:00:00');
  return d.toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' });
}

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

function ChecklistSection({ bullet, locked, onToggleItem, onAddItem }) {
  const [input, setInput] = useState('');
  const items = bullet.checklist || [];

  function submit() {
    const text = input.trim();
    if (!text) return;
    onAddItem(bullet.id, text);
    setInput('');
  }

  return (
    <div style={{ marginTop: 6, marginLeft: 2 }} onClick={e => e.stopPropagation()}>
      {items.map(item => (
        <div
          key={item.id}
          onClick={() => !locked && item.status !== 'irrelevant' && onToggleItem(bullet.id, item.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0',
            cursor: locked || item.status === 'irrelevant' ? 'default' : 'pointer',
          }}
        >
          <span style={{
            fontSize: 11,
            color: item.status === 'done' ? '#238636'
              : item.status === 'irrelevant' ? '#475569'
              : item.status === 'migrated' || item.status === 'deferred' ? '#64748b'
              : '#475569',
          }}>
            {item.status === 'done' ? '✓' : item.status === 'irrelevant' ? '✕' : '○'}
          </span>
          <span style={{
            fontSize: 12,
            color: item.status === 'done' ? '#64748b' : '#94a3b8',
            textDecoration: item.status === 'irrelevant' ? 'line-through' : 'none',
          }}>
            {item.text}
          </span>
        </div>
      ))}
      {!locked && (
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); }}
          placeholder="+ add step"
          style={{
            marginTop: 4, width: '100%', boxSizing: 'border-box',
            background: 'transparent', border: 'none', borderBottom: '1px dashed #253044',
            padding: '3px 0', fontSize: 11, color: '#64748b', outline: 'none', fontFamily: 'inherit',
          }}
        />
      )}
    </div>
  );
}

// Collapsed-by-default reason capture for an auto-carried bullet whose bump
// history entry has no reason yet (silent autoCarryForward doesn't prompt —
// this lets Trevor attach one retroactively). Correlated by
// entry.fromSlot === bullet.carriedFrom && !entry.reason.
function CarriedReasonPicker({ onSave }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(null);
  const [reasonText, setReasonText] = useState('');

  if (!open) {
    return (
      <span
        onClick={e => { e.stopPropagation(); setOpen(true); }}
        style={{ fontSize: 10, color: '#64748b', marginLeft: 8, cursor: 'pointer', textDecoration: 'underline' }}
      >
        why?
      </span>
    );
  }

  const disabled = reason === 'Other' && !reasonText.trim();

  return (
    <div
      onClick={e => e.stopPropagation()}
      style={{ marginTop: 6, background: '#161616', border: '1px solid #252525', borderRadius: 8, padding: 10 }}
    >
      <ReasonPicker
        reason={reason}
        reasonText={reasonText}
        onSelectReason={setReason}
        onReasonTextChange={setReasonText}
      />
      <button
        onClick={() => { onSave({ reason, reasonText }); setOpen(false); }}
        disabled={!reason || disabled}
        style={{
          background: '#1a2e1a', color: '#4a9e5a', border: 'none', borderRadius: 6,
          padding: '5px 12px', fontSize: 11, fontWeight: 600,
          cursor: !reason || disabled ? 'default' : 'pointer',
          opacity: !reason || disabled ? 0.5 : 1,
        }}
      >
        Save
      </button>
    </div>
  );
}

function BulletRow({ bullet, locked, onToggle, onRemove, onOpenJob, jobs, onAddChecklistItem, onToggleChecklistItem, onSetBumpReason }) {
  const done = bullet.done;
  const linkedJob = jobs?.find(j => j.id === bullet.jobId);
  const unresolvedBumpEntry = bullet.carriedFrom && linkedJob?.bumpHistory
    ? linkedJob.bumpHistory.find(e => e.source === 'auto-carry' && e.fromSlot === bullet.carriedFrom && !e.reason)
    : null;
  const meta = bullet.meta || (linkedJob ? { bench: linkedJob.bench, hoursRange: linkedJob.hoursRange, action: linkedJob.action } : null);
  const isJob = !!bullet.jobId;
  const sessionNote = linkedJob?.sessionNote;
  const sessionBadge = linkedJob?.sessionIndex && linkedJob?.sessionTotal > 1
    ? `${linkedJob.sessionIndex}/${linkedJob.sessionTotal}`
    : null;
  const timeLabel = bullet.scheduledMinutes != null
    ? `${Math.floor(bullet.scheduledMinutes / 60)}:${String(bullet.scheduledMinutes % 60).padStart(2, '0')}`
    : meta?.isAdHoc && meta.hour != null
      ? (() => {
          const hm = `${meta.hour}:${String(meta.minute).padStart(2, '0')}`;
          if (meta.scheduledDateKey === localDateKey()) return `📅 ${hm}`;
          const d = new Date(meta.scheduledDateKey + 'T00:00:00');
          return `📅 ${d.toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric' })} · ${hm}`;
        })()
      : null;

  const [offsetX, setOffsetX] = useState(0);
  const [springing, setSpringing] = useState(false);
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const dirLocked = useRef(null); // 'h' | 'v' | null

  function handleTouchStart(e) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    dirLocked.current = null;
    setSpringing(false);
  }

  function handleTouchMove(e) {
    if (locked || touchStartX.current === null) return;
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (!dirLocked.current) {
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        dirLocked.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      }
    }
    if (dirLocked.current !== 'h') return;
    e.preventDefault();
    setOffsetX(Math.max(-110, Math.min(110, dx)));
  }

  function handleTouchEnd() {
    const THRESHOLD = 72;
    if (dirLocked.current === 'h') {
      if (offsetX < -THRESHOLD) { onRemove(bullet.id); return; }
      if (offsetX > THRESHOLD)  { onToggle(bullet.id); }
    }
    setSpringing(true);
    setOffsetX(0);
    touchStartX.current = null;
  }

  const swipeProgress = Math.abs(offsetX) / 72;
  const revealOpacity = Math.min(1, swipeProgress * 1.2);
  const isLeft  = offsetX < -20;
  const isRight = offsetX > 20;

  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderBottom: '1px solid #1e293b' }}>
      {/* Swipe reveal layer */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center',
        justifyContent: isLeft ? 'flex-end' : 'flex-start',
        padding: '0 18px',
        background: isLeft
          ? `rgba(185,28,28,${revealOpacity * 0.85})`
          : isRight
          ? `rgba(22,163,74,${revealOpacity * 0.85})`
          : 'transparent',
        color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
        transition: springing ? 'background 0.2s' : 'none',
        pointerEvents: 'none',
      }}>
        {isLeft && offsetX < -36 ? '✕  remove' : isRight && offsetX > 36 ? '✓  done' : ''}
      </div>

      {/* Row content */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          display: 'flex', alignItems: 'flex-start', gap: 10,
          padding: '8px 0',
          background: '#0f172a',
          transform: `translateX(${offsetX}px)`,
          transition: springing ? 'transform 0.25s ease' : 'none',
          willChange: 'transform',
        }}
      >
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
            {timeLabel && (
              <span style={{ fontSize: 10, color: '#64748b', marginRight: 6, fontVariantNumeric: 'tabular-nums' }}>
                {timeLabel}
              </span>
            )}
            {bullet.text}
            {sessionBadge && (
              <span style={{
                marginLeft: 5, fontSize: 9, fontWeight: 700,
                background: '#1d4ed8', color: '#bfdbfe', borderRadius: 4, padding: '1px 4px',
              }}>
                {sessionBadge}
              </span>
            )}
            {isJob && !done && (
              <span style={{ marginLeft: 5, fontSize: 10, color: '#334155' }}>›</span>
            )}
          </div>
          {sessionNote && (
            <div style={{ fontSize: 11, color: '#fbbf24', fontStyle: 'italic', marginTop: 2 }}>
              {sessionNote}
            </div>
          )}
          {meta && (
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
              {[meta.bench, meta.hoursRange ? `${meta.hoursRange}h` : null, meta.action]
                .filter(Boolean).join(' · ')}
            </div>
          )}
          {bullet.carriedFrom && (
            <div style={{ fontSize: 10, color: '#a371f7', marginTop: 2 }}>
              ↪ carried from {formatCarriedDate(bullet.carriedFrom)}
              {unresolvedBumpEntry && onSetBumpReason && (
                <CarriedReasonPicker
                  onSave={info => onSetBumpReason(bullet.jobId, bullet.carriedFrom, info)}
                />
              )}
            </div>
          )}
          {isJob && (onAddChecklistItem || (bullet.checklist || []).length > 0) && (
            <ChecklistSection
              bullet={bullet}
              locked={locked}
              onToggleItem={onToggleChecklistItem}
              onAddItem={onAddChecklistItem}
            />
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
    </div>
  );
}

function LogJobCard({ job, pulled, onPull, onOpenJob, jobs, deferredItems = [], onPullBackIn }) {
  const splits = jobs.filter(j => j.parentId === job.id);
  const jobDeferredItems = deferredItems.filter(d => d.jobId === job.id);
  const actionStyle = ACTION_COLORS[job.action] || { bg: '#1e293b', color: '#64748b' };
  const benchStyle = BENCH_COLORS[job.bench] || { bg: '#1e293b', color: '#64748b' };

  return (
    <div
      onClick={() => onOpenJob && onOpenJob(job.id)}
      style={{
        margin: '0 16px 10px',
        background: pulled ? '#131a13' : '#1e293b',
        border: `1px solid ${pulled ? '#1a3a1a' : '#334155'}`,
        borderRadius: 12, padding: '12px 14px',
        cursor: onOpenJob ? 'pointer' : 'default',
      }}
    >
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

      <DeferredItemsList items={jobDeferredItems} onPullBackIn={onPullBackIn} />

      <button
        onClick={(e) => { e.stopPropagation(); if (!pulled) onPull(job); }}
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

const DEFAULT_COL_WIDTHS = { shelf: 280, schedule: 260 };
const MIN_COL_WIDTH = 120;
const MAX_COL_WIDTH = 720;

function loadColWidths() {
  try {
    const stored = JSON.parse(localStorage.getItem('dailyLogColWidths') || 'null');
    return stored ? { ...DEFAULT_COL_WIDTHS, ...stored } : DEFAULT_COL_WIDTHS;
  } catch {
    return DEFAULT_COL_WIDTHS;
  }
}

function ResizeHandle({ onResize }) {
  const dragRef = useRef(null);

  function handleMouseDown(e) {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, pendingDx: 0, rafId: null };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    function flush() {
      dragRef.current.rafId = null;
      const dx = dragRef.current.pendingDx;
      dragRef.current.pendingDx = 0;
      if (dx !== 0) onResize(dx);
    }

    function handleMouseMove(moveEvent) {
      const dx = moveEvent.clientX - dragRef.current.startX;
      dragRef.current.startX = moveEvent.clientX;
      dragRef.current.pendingDx += dx;
      if (dragRef.current.rafId == null) {
        dragRef.current.rafId = requestAnimationFrame(flush);
      }
    }
    function handleMouseUp() {
      if (dragRef.current.rafId != null) {
        cancelAnimationFrame(dragRef.current.rafId);
        flush();
      }
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{
        width: 10, marginLeft: -5, marginRight: -5, flexShrink: 0, cursor: 'col-resize',
        background: 'transparent', position: 'relative', zIndex: 1,
        display: 'flex', justifyContent: 'center',
      }}
      onMouseEnter={e => { e.currentTarget.firstChild.style.background = '#475569'; }}
      onMouseLeave={e => { e.currentTarget.firstChild.style.background = 'transparent'; }}
    >
      <div style={{ width: 2, height: '100%', background: 'transparent', pointerEvents: 'none' }} />
    </div>
  );
}

const DURATION_OPTIONS = [
  { hours: 0.25, label: '15m' },
  { hours: 0.5,  label: '30m' },
  { hours: 1,    label: '1h' },
  { hours: 1.5,  label: '1.5h' },
  { hours: 2,    label: '2h' },
];

function ScheduleNoteModal({ text, defaultDate, onConfirm, onClose }) {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const initialDate = defaultDate && defaultDate >= new Date(today.toDateString()) ? defaultDate : today;
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [timeVal, setTimeVal] = useState('17:00');
  const [hours, setHours] = useState(0.5);
  const [error, setError] = useState('');

  function pick(d) { setSelectedDate(d); setError(''); }

  function handleConfirm() {
    const [h, m] = timeVal.split(':').map(Number);
    const result = onConfirm(selectedDate, h, m, hours);
    if (!result.ok) setError(result.reason);
  }

  const dayBtn = (active) => ({
    flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
    border: active ? '1px solid #38bdf8' : '1px solid #334155',
    background: active ? '#0284c7' : 'none',
    color: active ? '#fff' : '#94a3b8', fontFamily: 'inherit',
  });

  const hourBtn = (active) => ({
    flex: 1, padding: '6px 0', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
    border: active ? '1px solid #38bdf8' : '1px solid #334155',
    background: active ? '#0284c7' : 'none',
    color: active ? '#fff' : '#94a3b8', fontFamily: 'inherit',
  });

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 200,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 420, background: '#1e293b',
          borderRadius: '16px 16px 0 0', padding: 18, borderTop: '1px solid #334155',
          boxSizing: 'border-box',
        }}
      >
        <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', marginBottom: 4 }}>Schedule note</div>
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 14, fontStyle: 'italic' }}>
          "{text.length > 60 ? text.slice(0, 60) + '…' : text}"
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          <button onClick={() => pick(today)} style={dayBtn(selectedDate.toDateString() === today.toDateString())}>Today</button>
          <button onClick={() => pick(tomorrow)} style={dayBtn(selectedDate.toDateString() === tomorrow.toDateString())}>Tomorrow</button>
          <input
            type="date"
            value={localDateKey(selectedDate)}
            onChange={e => { if (e.target.value) pick(new Date(e.target.value + 'T00:00:00')); }}
            style={{
              flex: 1, background: '#0f172a', border: '1px solid #334155', borderRadius: 8,
              padding: '6px 8px', fontSize: 12, color: '#e2e8f0', fontFamily: 'inherit',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 11, color: '#94a3b8', width: 36 }}>Time</span>
          <input
            type="time"
            step={1800}
            value={timeVal}
            onChange={e => setTimeVal(e.target.value)}
            style={{
              flex: 1, background: '#0f172a', border: '1px solid #334155', borderRadius: 8,
              padding: '6px 8px', fontSize: 13, color: '#e2e8f0', fontFamily: 'inherit',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 11, color: '#94a3b8', width: 36 }}>Length</span>
          <div style={{ display: 'flex', gap: 6, flex: 1 }}>
            {DURATION_OPTIONS.map(opt => (
              <button key={opt.hours} onClick={() => setHours(opt.hours)} style={hourBtn(hours === opt.hours)}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div style={{ fontSize: 11, color: '#f87171', marginBottom: 10 }}>⚠ {error}</div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onClose}
            style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: '1px solid #334155', background: 'none', color: '#94a3b8', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            style={{ flex: 2, padding: '9px 0', borderRadius: 8, border: 'none', background: '#0284c7', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Place on calendar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DailyLogPage({
  jobs, scheduledSlots, weekDays, displayedDate, onDisplayedDateChange, scheduledJobs, externalEvents, isDragging, activeJobId, onCalendarJobClick,
  onRemoveAdHocTask, onScheduleAdHocNote,
  dragMode, onDragModeChange, onCsvUpload, highlightedJobId, onClearHighlight, onJobClick, lastSyncedAt,
  todayLog, onAddBullet, onToggleDone, onRemoveBullet, onBulletJobClick, onRequestCloseDay,
  onAddChecklistItem, onToggleChecklistItem, deferredItems = [], onPullBackIn,
  focusList = [],
  onAutoCarryForward, catchUpNeeded, onRequestCatchUp,
  onSetBumpReason,
}) {
  const autoCarryRanRef = useRef(false);
  useEffect(() => {
    if (autoCarryRanRef.current) return;
    autoCarryRanRef.current = true;
    onAutoCarryForward?.();
  }, [onAutoCarryForward]);

  const isDisplayedDateToday = displayedDate.toDateString() === new Date().toDateString();
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [benchFilter, setBenchFilter] = useState(null);
  const [focusOnly, setFocusOnly] = useState(false);
  const [shelfOpen, setShelfOpen] = useState(false);
  const [colWidths, setColWidths] = useState(loadColWidths);
  const [peekJob, setPeekJob] = useState(null);
  const [mobileView, setMobileView] = useState('log');
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const wheelAccumRef = useRef(0);
  const wheelCooldownRef = useRef(false);
  const inputRef = useRef(null);
  const dayTouchStartX = useRef(null);
  const dayTouchStartY = useRef(null);
  const dayDirLocked = useRef(null);

  const SWIPE_THRESHOLD = 70;
  const SWIPE_COOLDOWN_MS = 400;

  function changeDay(delta) {
    const next = new Date(displayedDate);
    next.setDate(next.getDate() + delta);
    onDisplayedDateChange(next);
  }

  function handleDayTouchStart(e) {
    dayTouchStartX.current = e.touches[0].clientX;
    dayTouchStartY.current = e.touches[0].clientY;
    dayDirLocked.current = null;
  }

  function handleDayTouchMove(e) {
    if (dayTouchStartX.current === null) return;
    const dx = e.touches[0].clientX - dayTouchStartX.current;
    const dy = e.touches[0].clientY - dayTouchStartY.current;
    if (!dayDirLocked.current && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      dayDirLocked.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
    }
  }

  function handleDayTouchEnd(e) {
    if (dayDirLocked.current === 'h' && dayTouchStartX.current !== null) {
      const dx = e.changedTouches[0].clientX - dayTouchStartX.current;
      if (dx < -SWIPE_THRESHOLD) changeDay(1);
      else if (dx > SWIPE_THRESHOLD) changeDay(-1);
    }
    dayTouchStartX.current = null;
    dayTouchStartY.current = null;
    dayDirLocked.current = null;
  }

  function handleDayWheel(e) {
    if (wheelCooldownRef.current) return;
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    e.preventDefault();

    wheelAccumRef.current += e.deltaX;
    if (wheelAccumRef.current > SWIPE_THRESHOLD) {
      changeDay(1);
    } else if (wheelAccumRef.current < -SWIPE_THRESHOLD) {
      changeDay(-1);
    } else {
      return;
    }
    wheelAccumRef.current = 0;
    wheelCooldownRef.current = true;
    setTimeout(() => { wheelCooldownRef.current = false; }, SWIPE_COOLDOWN_MS);
  }

  useEffect(() => {
    localStorage.setItem('dailyLogColWidths', JSON.stringify(colWidths));
  }, [colWidths]);

  function resizeShelf(dx) {
    setColWidths(prev => ({
      ...prev, shelf: Math.min(MAX_COL_WIDTH, Math.max(MIN_COL_WIDTH, prev.shelf + dx)),
    }));
  }

  function resizeSchedule(dx) {
    setColWidths(prev => ({
      ...prev, schedule: Math.min(MAX_COL_WIDTH, Math.max(MIN_COL_WIDTH, prev.schedule - dx)),
    }));
  }

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

  function handleConfirmSchedule(date, hour, minute, hours) {
    const result = onScheduleAdHocNote(input.trim(), date, hour, minute, hours);
    if (result.ok) {
      setInput('');
      setScheduleModalOpen(false);
    }
    return result;
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

  const focusSet = new Set(focusList.map(String));

  const q = search.toLowerCase();
  const filteredJobs = availableJobs
    .filter(j => !benchFilter || j.bench === benchFilter)
    .filter(j => !focusOnly || focusSet.has(String(j.job)))
    .filter(j => {
      if (!q) return true;
      return [j.job, j.customer, j.mfr, j.model, j.desc].some(v =>
        String(v || '').toLowerCase().includes(q)
      );
    })
    .sort((a, b) => (b.days ?? 0) - (a.days ?? 0));

  // ── MOBILE ──────────────────────────────────────────────────────────────────
  if (isMobile) {
    const dayLabel = displayedDate.toLocaleDateString('en-NZ', {
      weekday: 'long', day: 'numeric', month: 'long',
    });
    const jobsActive = search.trim().length > 0 || !!benchFilter || focusOnly;

    return (
      <div style={{
        flex: 1, background: '#0f172a', color: '#e2e8f0',
        display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0,
      }}>
        {/* Header */}
        <div style={{
          background: '#1e293b', borderBottom: '1px solid #334155',
          padding: '10px 16px 10px', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9' }}>
                {mobileView === 'day' ? dayLabel : DATE_LABEL}
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginTop: 1 }}>
                {mobileView === 'day'
                  ? (isDisplayedDateToday ? 'Today' : ' ')
                  : `Today's log${locked ? ' · Locked' : ''}`}
              </div>
            </div>
            {mobileView === 'log' && hasBullets && !locked && (
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

          {mobileView === 'log' && catchUpNeeded && (
            <div
              onClick={onRequestCatchUp}
              style={{
                marginTop: 8, background: '#2a1a3a', border: '1px solid #4a2e6e',
                borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#c9a3f7',
                cursor: 'pointer',
              }}
            >
              {catchUpNeeded.days.length} unfinished days since {formatCarriedDate(catchUpNeeded.days[0])} — catch up →
            </div>
          )}

          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => setMobileView('log')}
              style={{
                flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 12, fontWeight: 600,
                border: mobileView === 'log' ? '1px solid #38bdf8' : '1px solid #334155',
                background: mobileView === 'log' ? '#0284c7' : 'none',
                color: mobileView === 'log' ? '#fff' : '#94a3b8',
                fontFamily: 'inherit', cursor: 'pointer',
              }}
            >
              Log
            </button>
            <button
              onClick={() => setMobileView('day')}
              style={{
                flex: 1, padding: '7px 0', borderRadius: 8, fontSize: 12, fontWeight: 600,
                border: mobileView === 'day' ? '1px solid #38bdf8' : '1px solid #334155',
                background: mobileView === 'day' ? '#0284c7' : 'none',
                color: mobileView === 'day' ? '#fff' : '#94a3b8',
                fontFamily: 'inherit', cursor: 'pointer',
              }}
            >
              Day
            </button>
          </div>
        </div>

        {mobileView === 'day' ? (
          /* DAY CALENDAR */
          <div
            style={{ flex: 1, position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            onTouchStart={handleDayTouchStart}
            onTouchMove={handleDayTouchMove}
            onTouchEnd={handleDayTouchEnd}
          >
            <CalendarGrid
              key={displayedDate.toDateString()}
              weekDays={[displayedDate]}
              scheduledJobs={scheduledJobs}
              externalEvents={externalEvents}
              isDragging={isDragging}
              activeJobId={activeJobId}
              onJobClick={job => setPeekJob(job)}
              onRemoveAdHocTask={onRemoveAdHocTask}
              scrollToCurrentHour={isDisplayedDateToday}
            />
            <div
              onClick={() => changeDay(-1)}
              style={{
                position: 'absolute', left: 0, top: 0, bottom: 0, width: 32, zIndex: 20,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#334155', fontSize: 20, background: 'linear-gradient(to right, rgba(15,23,42,0.5), transparent)',
              }}
            >
              ‹
            </div>
            <div
              onClick={() => changeDay(1)}
              style={{
                position: 'absolute', right: 0, top: 0, bottom: 0, width: 32, zIndex: 20,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#334155', fontSize: 20, background: 'linear-gradient(to left, rgba(15,23,42,0.5), transparent)',
              }}
            >
              ›
            </div>
            {peekJob && (
              <JobPeekPopover
                job={peekJob}
                onClose={() => setPeekJob(null)}
                onOpenFull={() => { onCalendarJobClick(peekJob); setPeekJob(null); }}
              />
            )}
          </div>
        ) : (
        /* Scrollable body */
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
                  onAddChecklistItem={onAddChecklistItem}
                  onToggleChecklistItem={onToggleChecklistItem}
                  onSetBumpReason={onSetBumpReason}
                />
              ))
            )}

            <div style={{ paddingTop: 8, display: 'flex', gap: 8 }}>
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={locked}
                placeholder="quick note — hit enter"
                style={{
                  flex: 1, background: locked ? '#172032' : '#1e293b',
                  border: '1px solid #334155', borderRadius: 8,
                  padding: '9px 12px', fontSize: 13,
                  color: locked ? '#475569' : '#e2e8f0',
                  outline: 'none', cursor: locked ? 'not-allowed' : 'text',
                  fontFamily: 'inherit',
                }}
              />
              {!locked && input.trim() && (
                <button
                  onClick={() => setScheduleModalOpen(true)}
                  title="Schedule this note"
                  style={{
                    flexShrink: 0, width: 38, borderRadius: 8, border: '1px solid #334155',
                    background: '#1e293b', color: '#94a3b8', fontSize: 15, cursor: 'pointer',
                  }}
                >
                  📅
                </button>
              )}
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

              <div style={{ padding: '0 16px 8px', display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Customer, make, model…"
                  style={{
                    flex: 1, background: '#1e293b', border: '1px solid #334155',
                    borderRadius: 8, padding: '8px 12px', fontSize: 13,
                    color: '#e2e8f0', outline: 'none', fontFamily: 'inherit',
                  }}
                />
                <label
                  htmlFor="mobile-job-csv-upload"
                  title="Upload CSV"
                  style={{
                    flexShrink: 0, width: 44, height: 38, borderRadius: 8,
                    border: '1px solid #334155', background: '#1e293b', color: '#94a3b8',
                    fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  📂
                </label>
                <input
                  id="mobile-job-csv-upload" type="file" accept=".csv" style={{ display: 'none' }}
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

              {/* Bench filter pills */}
              <div style={{
                display: 'flex', gap: 6, padding: '0 16px 10px',
                overflowX: 'auto',
              }}>
                {focusList.length > 0 && (
                  <button
                    onClick={() => setFocusOnly(v => !v)}
                    style={{
                      fontSize: 10, padding: '4px 10px', borderRadius: 12,
                      border: `1px solid ${focusOnly ? '#f59e0b' : '#334155'}`,
                      color: focusOnly ? '#fcd34d' : '#94a3b8',
                      background: focusOnly ? '#451a03' : 'none',
                      cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                      fontFamily: 'inherit', fontWeight: 700,
                    }}
                  >
                    🎯 Focus ({focusList.length})
                  </button>
                )}
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

              {!jobsActive ? (
                <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, color: '#475569', fontStyle: 'italic' }}>
                  · pick a bench above, or search ·
                </div>
              ) : filteredJobs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 13, color: '#475569' }}>
                  No jobs match
                </div>
              ) : (
                filteredJobs.map(job => (
                  <LogJobCard
                    key={job.id}
                    job={job}
                    pulled={pulledJobIds.has(job.id)}
                    onPull={handlePull}
                    onOpenJob={onBulletJobClick}
                    jobs={jobs}
                    deferredItems={deferredItems}
                    onPullBackIn={onPullBackIn}
                  />
                ))
              )}
            </div>
          )}
        </div>
        )}
        {scheduleModalOpen && (
          <ScheduleNoteModal
            text={input.trim()}
            defaultDate={displayedDate}
            onConfirm={handleConfirmSchedule}
            onClose={() => setScheduleModalOpen(false)}
          />
        )}
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
          {catchUpNeeded && (
            <div
              onClick={onRequestCatchUp}
              style={{
                marginTop: 8, background: '#2a1a3a', border: '1px solid #4a2e6e',
                borderRadius: 8, padding: '6px 12px', fontSize: 11, color: '#c9a3f7',
                cursor: 'pointer', display: 'inline-block',
              }}
            >
              {catchUpNeeded.days.length} unfinished days since {formatCarriedDate(catchUpNeeded.days[0])} — catch up →
            </div>
          )}
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
              onAddChecklistItem={onAddChecklistItem}
              onToggleChecklistItem={onToggleChecklistItem}
              onSetBumpReason={onSetBumpReason}
            />
          ))
        )}

        <div style={{
          position: 'sticky', bottom: 0, left: 0, right: 0,
          background: '#0f172a', padding: '12px 0 8px', marginTop: 8,
          borderTop: '1px solid #1e293b',
          display: 'flex', gap: 8,
        }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={locked}
            placeholder="quick note — hit enter"
            style={{
              flex: 1, boxSizing: 'border-box',
              background: locked ? '#172032' : '#1e293b',
              border: '1px solid #334155', borderRadius: 8,
              padding: '10px 14px', fontSize: 14,
              color: locked ? '#475569' : '#e2e8f0',
              outline: 'none', cursor: locked ? 'not-allowed' : 'text',
            }}
          />
          {!locked && input.trim() && (
            <button
              onClick={() => setScheduleModalOpen(true)}
              title="Schedule this note"
              style={{
                flexShrink: 0, width: 40, borderRadius: 8, border: '1px solid #334155',
                background: '#1e293b', color: '#94a3b8', fontSize: 16, cursor: 'pointer',
              }}
            >
              📅
            </button>
          )}
        </div>
      </div>
      {scheduleModalOpen && (
        <ScheduleNoteModal
          text={input.trim()}
          defaultDate={displayedDate}
          onConfirm={handleConfirmSchedule}
          onClose={() => setScheduleModalOpen(false)}
        />
      )}
    </div>
  );

  return (
    <div style={{
      flex: 1, background: '#0f172a', color: '#e2e8f0',
      display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0,
    }}>
      <div style={{
        flex: 1,
        display: 'flex',
        minHeight: 0, overflow: 'hidden',
      }}>
        <div style={{ flex: '1 1 260px', minWidth: 180, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {leftPanel}
        </div>
        <ResizeHandle onResize={resizeShelf} />
        <div style={{ flex: `0 1 ${colWidths.shelf}px`, minWidth: 180, height: '100%', overflow: 'hidden' }}>
          <JobShelf
            jobs={jobs}
            dragMode={dragMode} onDragModeChange={onDragModeChange}
            onCsvUpload={onCsvUpload}
            highlightedJobId={highlightedJobId} onClearHighlight={onClearHighlight}
            onJobClick={onJobClick}
            lastSyncedAt={lastSyncedAt}
            focusList={focusList}
            deferredItems={deferredItems}
            onPullBackIn={onPullBackIn}
          />
        </div>
        <ResizeHandle onResize={resizeSchedule} />
        <div
          onWheel={handleDayWheel}
          style={{ flex: `0 1 ${colWidths.schedule}px`, minWidth: 180, height: '100%', overflow: 'hidden', borderLeft: '1px solid #1e293b', display: 'flex', flexDirection: 'column', position: 'relative' }}
        >
          <CalendarGrid
            key={displayedDate.toDateString()}
            weekDays={[displayedDate]}
            scheduledJobs={scheduledJobs}
            externalEvents={externalEvents}
            isDragging={isDragging}
            activeJobId={activeJobId}
            onJobClick={job => setPeekJob(job)}
            onRemoveAdHocTask={onRemoveAdHocTask}
            scrollToCurrentHour={isDisplayedDateToday}
          />
          {peekJob && (
            <JobPeekPopover
              job={peekJob}
              onClose={() => setPeekJob(null)}
              onOpenFull={() => { onCalendarJobClick(peekJob); setPeekJob(null); }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
