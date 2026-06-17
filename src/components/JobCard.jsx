import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { BENCH_COLORS } from '../data/jobs.js';

export default function JobCard({ job, slotKey: slotKeyProp, inCalendar = false, dragMode = 'regular', compact = false, isHighlighted = false, onClick }) {
  const draggableId = inCalendar && slotKeyProp ? `${job.id}::${slotKeyProp}` : job.id;

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: draggableId,
    data: { jobId: job.id, job, source: inCalendar ? 'calendar' : 'sidebar', dragMode },
  });

  const colors = BENCH_COLORS[job.bench] || BENCH_COLORS.Admin;

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    background: colors.bg,
    border: isHighlighted
      ? `1px solid #fbbf24`
      : `1px solid ${colors.border}`,
    borderRadius: 6,
    padding: compact ? '4px 8px' : '8px 10px',
    cursor: 'grab',
    userSelect: 'none',
    touchAction: 'none',
    position: 'relative',
    zIndex: isDragging ? 999 : 1,
    boxShadow: isHighlighted ? '0 0 0 2px #f59e0b44, 0 0 12px #f59e0b22' : 'none',
    transition: 'box-shadow 0.2s, border-color 0.2s',
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} onClick={onClick}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
        <span style={{ fontWeight: 700, fontSize: compact ? 11 : 12, color: colors.text }}>
          #{job.job}
          {job.sessionIndex && job.sessionTotal > 1 && (
            <span style={{
              marginLeft: 5, fontSize: 10, fontWeight: 700,
              background: '#1d4ed8', color: '#bfdbfe',
              borderRadius: 4, padding: '1px 5px',
            }}>
              {job.sessionIndex}/{job.sessionTotal}
            </span>
          )}
        </span>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, background: 'rgba(255,255,255,0.1)', color: colors.text }}>
            {job.bench}
          </span>
          <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, background: 'rgba(255,255,255,0.15)', color: '#fbbf24' }}>
            {job.hoursRange}h
          </span>
        </div>
      </div>
      {!compact && (
        <>
          {job.customer && (
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
              {job.customer}
            </div>
          )}
          <div style={{ fontSize: 12, color: colors.text, marginTop: job.customer ? 1 : 2, fontWeight: 600 }}>
            {job.mfr} {job.model}
          </div>
          {job.sessionNote ? (
            <div style={{ fontSize: 11, color: '#fbbf24', marginTop: 2, fontStyle: 'italic' }}>
              {job.sessionNote}
            </div>
          ) : (
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2, lineHeight: 1.3 }}>
              {(job.splitDesc ?? job.desc)?.slice(0, 60)}{(job.splitDesc ?? job.desc)?.length > 60 ? '…' : ''}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: '#94a3b8' }}>📅 {job.days}d</span>
            {job.vb && <span style={{ fontSize: 10, color: '#fbbf24' }}>⭐ VB</span>}
            {job.action && <span style={{ fontSize: 10, color: '#f87171' }}>⚠ {job.action.slice(0, 20)}</span>}
          </div>
        </>
      )}
    </div>
  );
}
