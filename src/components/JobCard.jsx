import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { BENCH_COLORS } from '../data/jobs.js';

export default function JobCard({ job, inCalendar = false, dragMode = 'regular', compact = false }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: job.id,
    data: { job, source: inCalendar ? 'calendar' : 'sidebar', dragMode },
  });

  const colors = BENCH_COLORS[job.bench] || BENCH_COLORS.Admin;

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    background: colors.bg,
    border: `1px solid ${colors.border}`,
    borderRadius: 6,
    padding: compact ? '4px 8px' : '8px 10px',
    cursor: 'grab',
    userSelect: 'none',
    touchAction: 'none',
    position: 'relative',
    zIndex: isDragging ? 999 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
        <span style={{ fontWeight: 700, fontSize: compact ? 11 : 12, color: colors.text }}>
          #{job.job}
        </span>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <span style={{
            fontSize: 10, padding: '1px 5px', borderRadius: 3,
            background: 'rgba(255,255,255,0.1)', color: colors.text,
          }}>
            {job.bench}
          </span>
          <span style={{
            fontSize: 10, padding: '1px 5px', borderRadius: 3,
            background: 'rgba(255,255,255,0.15)', color: '#fbbf24',
          }}>
            {job.hours}h
          </span>
        </div>
      </div>
      {!compact && (
        <>
          <div style={{ fontSize: 12, color: colors.text, marginTop: 2, fontWeight: 600 }}>
            {job.mfr} {job.model}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2, lineHeight: 1.3 }}>
            {job.desc?.slice(0, 60)}{job.desc?.length > 60 ? '…' : ''}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: '#94a3b8' }}>📅 {job.days}d</span>
            {job.vb && <span style={{ fontSize: 10, color: '#fbbf24' }}>⭐ VB</span>}
            {job.blockers && <span style={{ fontSize: 10, color: '#f87171' }}>⚠ {job.blockers.slice(0, 20)}</span>}
          </div>
        </>
      )}
    </div>
  );
}
