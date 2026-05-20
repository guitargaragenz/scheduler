import { useDroppable } from '@dnd-kit/core';
import { formatHour, isLunchSlot, isSaturday, isSunday, isGapHour, getWorkHours, slotKey } from '../utils/calendar.js';
import { BENCH_COLORS } from '../data/jobs.js';
import JobCard from './JobCard.jsx';

const TIME_COL_WIDTH = 56;
const SLOT_HEIGHT = 26; // each 30-min half-slot

// All slots: day hours 10am–6pm (both halves) + evening 9pm–11pm (both halves)
const DAY_HOURS    = [10,11,12,13,14,15,16,17,18];
const EVENING_HOURS = [21, 22];
const ALL_SLOTS = [
  ...DAY_HOURS.flatMap(h => [{hour: h, minute: 0}, {hour: h, minute: 30}]),
  ...EVENING_HOURS.flatMap(h => [{hour: h, minute: 0}, {hour: h, minute: 30}]),
];

function TimeSlot({ date, dayIdx, hour, minute, job, isFirstSlot, externalEvent, isDropping, onJobClick }) {
  const key = slotKey(date, hour, minute);
  const { setNodeRef, isOver } = useDroppable({ id: key, data: { dayIdx, hour, minute } });

  let bg = 'transparent';
  if (isOver) bg = 'rgba(34,197,94,0.15)';
  else if (isDropping) bg = 'rgba(34,197,94,0.08)';

  if (job) {
    const colors = BENCH_COLORS[job.bench] || BENCH_COLORS.Admin;
    if (isFirstSlot) {
      return (
        <div ref={setNodeRef} style={{
          height: SLOT_HEIGHT, borderBottom: '1px solid #263348',
          padding: '2px 2px', position: 'relative',
          background: colors.bg, borderLeft: `3px solid ${colors.border}`,
        }}>
          <JobCard job={job} slotKey={key} inCalendar dragMode="regular" compact onClick={() => onJobClick(job)} />
        </div>
      );
    }
    // Continuation bar — draggable strip
    return (
      <div ref={setNodeRef} style={{
        height: SLOT_HEIGHT,
        borderBottom: `1px solid ${colors.border}33`,
        background: `${colors.bg}dd`,
        borderLeft: `3px solid ${colors.border}`,
        cursor: 'grab',
      }} />
    );
  }

  if (externalEvent) {
    const blockH = externalEvent._isSpan ? SLOT_HEIGHT : Math.round(SLOT_HEIGHT / 2);
    return (
      <div style={{ height: SLOT_HEIGHT, borderBottom: '1px solid #263348', position: 'relative' }}>
        <div style={{
          height: blockH, padding: '2px 6px', background: '#65a30d',
          borderLeft: '3px solid #ecfccb',
          display: 'flex', alignItems: 'center',
        }}>
          {!externalEvent._isSpan && (
            <div style={{ fontSize: 9, color: '#94a3b8', fontWeight: 600, overflow: 'hidden', display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#fff' }}>
                {(externalEvent.summary || '').split(' and ')[0].split(' - ')[0].trim()}
              </span>
              {externalEvent._durationMins && (
                <span style={{ color: '#1a2e05', fontWeight: 400, flexShrink: 0 }}>
                  {externalEvent._durationMins}m
                </span>
              )}
            </div>
          )}
          {externalEvent._isSpan && (
            <div style={{ fontSize: 9, color: '#475569', fontStyle: 'italic' }}>↕</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div ref={setNodeRef} style={{
      height: SLOT_HEIGHT, borderBottom: '1px solid #263348',
      background: bg, transition: 'background 0.1s', cursor: 'default',
    }} />
  );
}

function LunchSlot({ dayIdx, minute }) {
  const { setNodeRef, isOver } = useDroppable({
    id: `lunch-${dayIdx}-12-${minute}`,
    data: { isLunch: true },
  });
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
      {minute === 0 && (
        <span style={{ fontSize: 8, color: '#ef4444', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>
          🔒 LUNCH
        </span>
      )}
    </div>
  );
}

export default function CalendarGrid({ weekDays, scheduledJobs, bufferSlotKeys, externalEvents, isDragging, onJobClick }) {

  // slotKey -> job object
  const slotJobMap = scheduledJobs;

  // Build extMap across all half-slots
  const extMap = {};
  if (externalEvents) {
    externalEvents.forEach(ev => {
      if (/^#\d+/.test(ev.summary || '')) return;
      const start = new Date(ev.start?.dateTime || ev.start?.date);
      const end   = new Date(ev.end?.dateTime   || ev.end?.date);
      const matchDay = weekDays.find(d => d.toDateString() === start.toDateString());
      if (!matchDay) return;
      const startH = start.getHours();
      const startM = start.getMinutes() < 30 ? 0 : 30;
      const eventEndMins = end.getHours() * 60 + end.getMinutes();
      const durationMins = (end - start) / 60000;

      // Fill every half-slot the event actually overlaps (stop when slot start >= event end)
      let h = startH, m = startM, first = true;
      while (h * 60 + m < eventEndMins) {
        const key = slotKey(matchDay, h, m);
        if (!extMap[key]) extMap[key] = { ...ev, _isSpan: !first, _durationMins: durationMins };
        first = false;
        if (m === 0) { m = 30; } else { m = 0; h++; }
      }
    });
  }

  return (
    <div style={{ flex: 1, overflowX: 'auto', overflowY: 'auto', WebkitOverflowScrolling: 'touch', position: 'relative', background: '#3d5470' }}>
      <div style={{ minWidth: 700, display: 'flex', flexDirection: 'column', height: '100%' }}>

        {/* Header row */}
        <div style={{ display: 'flex', position: 'sticky', top: 0, zIndex: 10, background: '#2c4460' }}>
          <div style={{ width: TIME_COL_WIDTH, flexShrink: 0, position: 'sticky', left: 0, zIndex: 11, background: '#2c4460' }} />
          {weekDays.map((d, i) => {
            const isWeekend = isSaturday(d) || isSunday(d);
            return (
              <div key={i} style={{
                flex: 1, padding: '10px 6px', textAlign: 'center',
                borderLeft: '1px solid #4e6e8a', borderBottom: '2px solid #4e6e8a',
                background: isWeekend ? '#334e68' : '#2c4460',
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: isWeekend ? '#94a3b8' : '#e2e8f0', letterSpacing: 0.5 }}>
                  {d.toLocaleDateString('en-NZ', { weekday: 'short' }).toUpperCase()}
                </div>
                <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>
                  {d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Time rows — one per 30-min slot */}
        {ALL_SLOTS.map(({ hour, minute }) => (
          <div key={`${hour}-${minute}`}>

            {/* Evening break divider */}
            {hour === 21 && minute === 0 && (
              <div style={{ display: 'flex', height: 22, background: '#2c4460', borderBottom: '1px solid #4e6e8a', borderTop: '1px solid #4e6e8a' }}>
                <div style={{ width: TIME_COL_WIDTH, flexShrink: 0, position: 'sticky', left: 0, zIndex: 5, background: '#2c4460', borderRight: '1px solid #263348' }} />
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 9, color: '#64748b', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>— evening —</span>
                </div>
              </div>
            )}

            <div style={{ display: 'flex' }}>
              {/* Time label — sticky left so it stays visible on horizontal scroll */}
              <div style={{
                width: TIME_COL_WIDTH, flexShrink: 0,
                position: 'sticky', left: 0, zIndex: 5,
                display: 'flex', alignItems: 'center',
                justifyContent: 'flex-end',
                paddingRight: 8, height: SLOT_HEIGHT,
                fontSize: minute === 0 ? 10 : 8,
                color: minute === 0 ? '#e2e8f0' : '#334155',
                background: minute === 0 ? '#3d5470' : '#374f67',
                borderBottom: '1px solid #4e6e8a',
                borderRight: '1px solid #4e6e8a',
              }}>
                {minute === 0 ? formatHour(hour) : ':30'}
              </div>

              {weekDays.map((d, dayIdx) => {
                const { start, end } = getWorkHours(d);
                const sat = isSaturday(d);
                const sun = isSunday(d);
                const key = slotKey(d, hour, minute);
                const jobId = slotJobMap[key]?.id ?? null;

                // Outside work hours
                if (hour < start || hour >= end) {
                  const hatched = hour >= 21;
                  return (
                    <div key={dayIdx} style={{
                      flex: 1, height: SLOT_HEIGHT,
                      borderLeft: '1px solid #4e6e8a', borderBottom: '1px solid #4e6e8a',
                      background: hatched
                        ? 'repeating-linear-gradient(135deg, #2c4460 0px, #2c4460 4px, transparent 4px, transparent 10px)'
                        : '#334e68',
                    }} />
                  );
                }

                // Lunch (weekdays only)
                if (!sat && !sun && isLunchSlot(hour)) {
                  return (
                    <div key={dayIdx} style={{ flex: 1, borderLeft: '1px solid #4e6e8a' }}>
                      <LunchSlot dayIdx={dayIdx} minute={minute} />
                    </div>
                  );
                }

                // Buffer slot
                if (bufferSlotKeys?.has(key)) {
                  return (
                    <div key={dayIdx} style={{
                      flex: 1, height: SLOT_HEIGHT,
                      borderLeft: '1px solid #4e6e8a', borderBottom: '1px solid #263348',
                      background: 'repeating-linear-gradient(45deg, rgba(100,116,139,0.12) 0px, rgba(100,116,139,0.12) 2px, transparent 2px, transparent 8px)',
                      borderLeftWidth: 2, borderLeftColor: 'rgba(100,116,139,0.3)',
                    }} />
                  );
                }

                // Is this the first slot of the job occupying this cell?
                const job = slotJobMap[key] ?? null;
                let isFirstSlot = true;
                if (job) {
                  const prevMinute = minute === 30 ? 0 : 30;
                  const prevHour   = minute === 30 ? hour : hour - 1;
                  if (!(minute === 0 && hour <= start)) {
                    const prevKey = slotKey(d, prevHour, prevMinute);
                    isFirstSlot = slotJobMap[prevKey]?.id !== job.id;
                  }
                }

                return (
                  <div key={dayIdx} style={{ flex: 1, borderLeft: '1px solid #4e6e8a' }}>
                    <TimeSlot
                      date={d}
                      dayIdx={dayIdx}
                      hour={hour}
                      minute={minute}
                      job={job}
                      isFirstSlot={isFirstSlot}
                      externalEvent={extMap[key]}
                      isDropping={isDragging}
                      onJobClick={onJobClick}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
