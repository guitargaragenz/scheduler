import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { benchColors, blockedPile, blockedReason } from '../data/jobs.js';

export default function JobCard({ job, slotKey: slotKeyProp, inCalendar = false, dragMode = 'regular', compact = false, isHighlighted = false, onClick, onMarkPieceDone, parentJob, isFocused = false, onToggleFocus }) {
  const draggableId = inCalendar && slotKeyProp ? `${job.id}::${slotKeyProp}` : job.id;

  // A blocked job (Waiting or Planning pile) never picks up at all — Trevor's
  // settled decision, 2026-07-27: "blocked jobs should never be dnd until not
  // blocked then normal." The instant blockedPile stops returning a pile for
  // this job, `disabled` goes false and drag is exactly what it was before —
  // no separate blocked-drag mode, just this one flag gating today's behaviour.
  const isBlocked = blockedPile(job) != null;

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: draggableId,
    data: { jobId: job.id, job, source: inCalendar ? 'calendar' : 'sidebar', dragMode },
    disabled: isBlocked,
  });

  const colors = benchColors(job.bench);

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
    background: colors.bg,
    border: isHighlighted
      ? `1px solid #fbbf24`
      : `1px solid ${colors.border}`,
    borderRadius: 6,
    padding: compact ? '4px 8px' : '8px 10px',
    cursor: isBlocked ? 'not-allowed' : 'grab',
    userSelect: 'none',
    touchAction: 'none',
    position: 'relative',
    zIndex: isDragging ? 999 : 1,
    boxShadow: isHighlighted ? '0 0 0 2px #f59e0b44, 0 0 12px #f59e0b22' : 'none',
    transition: 'box-shadow 0.2s, border-color 0.2s',
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      title={isBlocked ? blockedReason(job) : undefined}
    >
      {compact ? (
        /* Calendar card: Mfr + Model primary, job number as small tag */
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 4, position: 'relative' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 11, color: colors.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {job.mfr} {job.model}
              {job.sessionIndex && job.sessionTotal > 1 && (
                <span style={{
                  marginLeft: 5, fontSize: 9, fontWeight: 700,
                  background: '#1d4ed8', color: '#bfdbfe',
                  borderRadius: 4, padding: '1px 4px',
                }}>
                  {job.sessionIndex}/{job.sessionTotal}
                </span>
              )}
            </div>
            {(job.sessionNote || job.label || job.splitDesc || job.desc) && (
              <div style={{
                fontSize: 9,
                color: job.sessionNote ? '#fbbf24' : 'rgba(255,255,255,0.5)',
                marginTop: 1,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                fontStyle: job.sessionNote ? 'italic' : 'normal',
              }}>
                {job.sessionNote
                  ? job.sessionNote
                  : job.label
                    ? job.label
                    : (() => { const t = job.splitDesc ?? job.desc; return t?.slice(0, 40) + (t?.length > 40 ? '…' : ''); })()
                }
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end', flexShrink: 0 }}>
            {onMarkPieceDone && job.parentId && parentJob && (
              <button
                onClick={e => {
                  e.stopPropagation();
                  onMarkPieceDone(job.parentId, job.id, !job.pieceDone);
                }}
                title={`Click to mark ${job.bench} ${job.pieceDone ? 'undone' : 'done'}`}
                style={{
                  background: 'none', border: 'none', fontSize: 11, fontWeight: 700,
                  color: job.pieceDone ? '#4ade80' : '#666', cursor: 'pointer', padding: 0,
                  textDecoration: job.pieceDone ? 'line-through' : 'none',
                }}
              >
                {job.pieceDone ? '✓' : '○'}
              </button>
            )}
            <span style={{ fontSize: 9, padding: '1px 4px', borderRadius: 3, background: 'rgba(0,0,0,0.3)', color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap' }}>
              #{job.job}
            </span>
          </div>
        </div>
      ) : (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
        <span style={{ fontWeight: 700, fontSize: 12, color: colors.text }}>
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
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          {onToggleFocus && (
            <button
              onClick={e => { e.stopPropagation(); onToggleFocus(); }}
              onPointerDown={e => e.stopPropagation()}
              title={isFocused ? 'Remove from focus list' : 'Add to focus list'}
              style={{
                background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                fontSize: 12, lineHeight: 1, opacity: isFocused ? 1 : 0.3,
              }}
            >
              🎯
            </button>
          )}
          <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, background: 'rgba(255,255,255,0.1)', color: colors.text }}>
            {job.bench}
          </span>
          <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 3, background: 'rgba(255,255,255,0.15)', color: '#fbbf24' }}>
            {job.hoursRange}h
          </span>
        </div>
      </div>
      )}
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
