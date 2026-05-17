import { useDroppable } from '@dnd-kit/core';
import { dayLabel, formatHour, isLunchSlot, isSaturday, getWorkHours, slotKey } from '../utils/calendar.js';
import { BENCH_COLORS } from '../data/jobs.js';
import JobCard from './JobCard.jsx';

const TIME_COL_WIDTH = 56;
const SLOT_HEIGHT = 52;

function TimeSlot({ dayIdx, hour, job, externalEvent, isDropping }) {
  const key = slotKey(dayIdx, hour);
  const { setNodeRef, isOver } = useDroppable({ id: key, data: { dayIdx, hour } });

  let bg = 'transparent';
  if (isOver) bg = 'rgba(34,197,94,0.15)';
  else if (isDropping) bg = 'rgba(34,197,94,0.08)';

  if (job) {
    const colors = BENCH_COLORS[job.bench] || BENCH_COLORS.Admin;
    return (
      <div ref={setNodeRef} style={{
        height: SLOT_HEIGHT, borderBottom: '1px solid #263348',
        padding: 2, position: 'relative', background: colors.bg,
        borderLeft: `3px solid ${colors.border}`,
      }}>
        <JobCard job={job} slotKey={key} inCalendar dragMode="regular" compact />
      </div>
    );
  }

  if (externalEvent) {
    const blockH = externalEvent._isSpan
      ? SLOT_HEIGHT
      : Math.round(Math.min(externalEvent._durationMins || 60, 60) / 60 * SLOT_HEIGHT);
    return (
      <div style={{
        height: SLOT_HEIGHT, borderBottom: '1px solid #263348', position: 'relative',
      }}>
        <div style={{
          height: blockH, padding: '3px 6px', background: '#1a2234',
          borderLeft: '3px solid #475569',
          display: 'flex', alignItems: 'center',
        }}>
          {!externalEvent._isSpan && (
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600, lineHeight: 1.3, overflow: 'hidden', display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {(externalEvent.summary || '').split(' and ')[0].split(' - ')[0].trim()}
              </span>
              {externalEvent._durationMins && (
                <span style={{ color: '#475569', fontWeight: 400, flexShrink: 0 }}>
                  {externalEvent._durationMins}m
                </span>
              )}
            </div>
          )}
          {externalEvent._isSpan && (
            <div style={{ fontSize: 9, color: '#475569', fontStyle: 'italic' }}>↕ cont.</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={{
      height: SLOT_HEIGHT, borderBottom: '1px solid #263348',
      background: bg, transition: 'background 0.1s',
      cursor: 'default',
    }} />
  );
}

function LunchSlot({ dayIdx }) {
  // Give lunch a droppable ID so App.jsx can catch and reject it explicitly
  const { setNodeRef, isOver } = useDroppable({ id: `lunch-${dayIdx}-12`, data: { isLunch: true } });
  return (
    <div ref={setNodeRef} style={{
      height: SLOT_HEIGHT, borderBottom: '1px solid #263348',
      background: isOver
        ? 'rgba(239,68,68,0.25)'
        : 'repeating-linear-gradient(45deg, rgba(239,68,68,0.08) 0px, rgba(239,68,68,0.08) 4px, transparent 4px, transparent 10px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      borderLeft: '3px solid #ef4444',
      transition: 'background 0.1s',
    }}>
      <span style={{ fontSize: 9, color: '#ef4444', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>
        🔒 LUNCH 12–1 PM
      </span>
    </div>
  );
}

export default function CalendarGrid({ weekDays, scheduledJobs, externalEvents, isDragging }) {
  // Build time range: 10am-6pm, but only show slots relevant to any day
  const allHours = Array.from({ length: 9 }, (_, i) => i + 10); // 10-18 (slots 10am–7pm, labels 10am–6pm)

  // Map slotKey -> job object
  const slotJobMap = {};
  Object.entries(scheduledJobs).forEach(([key, jobId]) => {
    slotJobMap[key] = jobId;
  });

  // Map external events across ALL their hours so every blocked slot shows as occupied
  const extMap = {};
  if (externalEvents) {
    externalEvents.forEach(ev => {
      const start = new Date(ev.start?.dateTime || ev.start?.date);
      const end   = new Date(ev.end?.dateTime   || ev.end?.date);
      const dayIdx = weekDays.findIndex(d => d.toDateString() === start.toDateString());
      if (dayIdx < 0) return;
      const startH = start.getHours();
      const endH   = end.getHours() + (end.getMinutes() > 0 ? 1 : 0); // round up partial hours
      const durationMins = (end - start) / 60000;
      for (let h = startH; h < endH; h++) {
        const key = slotKey(dayIdx, h);
        if (!extMap[key]) extMap[key] = { ...ev, _isSpan: h !== startH, _durationMins: durationMins };
      }
    });
  }

  return (
    <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', position: 'relative', background: '#1e293b' }}>
      <div style={{ minWidth: 700, display: 'flex', flexDirection: 'column', height: '100%' }}>

        {/* Header row */}
        <div style={{ display: 'flex', position: 'sticky', top: 0, zIndex: 10, background: '#0f172a' }}>
          <div style={{ width: TIME_COL_WIDTH, flexShrink: 0 }} />
          {weekDays.map((d, i) => {
            const isSat = isSaturday(d);
            return (
              <div key={i} style={{
                flex: 1, padding: '10px 6px', textAlign: 'center',
                borderLeft: '1px solid #263348', borderBottom: '2px solid #334155',
                background: isSat ? '#1a1f2e' : '#0f172a',
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: isSat ? '#94a3b8' : '#e2e8f0', letterSpacing: 0.5 }}>
                  {d.toLocaleDateString('en-NZ', { weekday: 'short' }).toUpperCase()}
                </div>
                <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>
                  {d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Time rows */}
        {allHours.map(hour => (
          <div key={hour} style={{ display: 'flex' }}>
            {/* Time label */}
            <div style={{
              width: TIME_COL_WIDTH, flexShrink: 0, display: 'flex', alignItems: 'center',
              justifyContent: 'flex-end', paddingRight: 8, height: SLOT_HEIGHT,
              fontSize: 10, color: '#e2e8f0', borderBottom: '1px solid #263348',
              borderRight: '1px solid #263348',
            }}>
              {formatHour(hour)}
            </div>

            {weekDays.map((d, dayIdx) => {
              const { start, end } = getWorkHours(d);
              const sat = isSaturday(d);
              const key = slotKey(dayIdx, hour);
              const jobId = slotJobMap[key];

              // Outside work hours
              if (hour < start || hour >= end) {
                return (
                  <div key={dayIdx} style={{
                    flex: 1, height: SLOT_HEIGHT, borderLeft: '1px solid #263348',
                    borderBottom: '1px solid #263348',
                    background: 'repeating-linear-gradient(135deg, #0f172a 0px, #0f172a 4px, transparent 4px, transparent 10px)',
                  }} />
                );
              }

              // Lunch slot (weekdays only)
              if (!sat && isLunchSlot(hour)) {
                return (
                  <div key={dayIdx} style={{ flex: 1, borderLeft: '1px solid #263348' }}>
                    <LunchSlot dayIdx={dayIdx} />
                  </div>
                );
              }

              return (
                <div key={dayIdx} style={{ flex: 1, borderLeft: '1px solid #263348' }}>
                  <TimeSlot
                    dayIdx={dayIdx}
                    hour={hour}
                    job={jobId}
                    externalEvent={extMap[key]}
                    isDropping={isDragging}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
