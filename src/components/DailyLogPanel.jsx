import { useEffect, useMemo, useState } from 'react';
import { localDateKey } from '../utils/calendar.js';
import { listEvents, isSignedIn } from '../utils/googleCalendar.js';
import { weekRows, partsOf, rowName, TYPED_ID_PREFIX } from './BenchWeekPage.jsx';

// The Daily Log — one day, three things: what is booked in, what has to be
// done, and which jobs are being worked on.
//
// What it writes: bench_day_marks, and nothing else. Not jobs[], not
// scheduledSlots, not calendarSlot. Putting a job on a day is a note about the
// day, not a booking — nothing here moves a calendar slot and nothing here
// finishes a job. Closing a job is still the cross in the Weekly Log's last
// column, and the invoice is still asked for there.
//
// Appointments are READ-ONLY, always. listEvents() is a read and there is no
// write counterpart anywhere on this page.

// A fresh id for a typed task. Same shape as the week page's typed rows: the
// "task:" prefix is what keeps it out of job space, since a Multitrack job id
// is digits with an optional split suffix and can never contain a colon.
export function newDayTaskId(dateKey, rand = Math.random) {
  if (!dateKey) return null;
  const tail = rand().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  return `${TYPED_ID_PREFIX}${dateKey}:${tail}`;
}

export function isDayTaskId(id) {
  return String(id ?? '').startsWith(TYPED_ID_PREFIX);
}

// The longest typed task that still reads on a phone.
const MAX_TASK_NAME = 80;

// Every split of every job on the current Weekly Log, as pickable lines.
//
// The week is the only source. There is no job-number search on this page on
// purpose: if a job is not on the week, it cannot go on a day. That is what
// stops the Daily Log quietly becoming a second, competing job list.
//
// Splits are offered individually — a job worked on two benches is two things
// that can happen on two different days, even though the week shows it as one
// row.
export function dayJobOptions(jobs, weekKeys, marks) {
  const all = jobs || [];
  const byId = new Map(all.map(j => [j.id, j]));
  const rows = weekRows(all, weekKeys, marks || {});
  const out = [];

  for (const row of rows) {
    // Typed admin rows have no job behind them, so they have no splits to
    // offer. Day tasks are typed on this page instead.
    if (!row.job) continue;
    for (const part of partsOf(row.job, all, byId)) {
      const label = [rowName(part) || row.name, part.bench].filter(Boolean).join(' — ');
      out.push({ id: String(part.id), label });
    }
  }

  // Two splits of one job can share a description; the id is what makes them
  // two lines, and it is also the primary key, so a duplicate id would be one
  // row fighting itself.
  const seen = new Set();
  return out.filter(o => (seen.has(o.id) ? false : (seen.add(o.id), true)));
}

// One day's appointments, from Google Calendar, read fresh for that day.
//
// Deliberately its own read rather than a reuse of the 30-second poll's cached
// list: that poll only replaces its cache when it gets a non-empty result, so a
// day whose appointments were all cancelled would keep showing the old ones
// forever. A day view has to be able to say "nothing booked".
function useDayAppointments(dateKey) {
  const [events, setEvents] = useState([]);
  const [state, setState] = useState('idle'); // idle | loading | ready | signed-out

  useEffect(() => {
    if (!dateKey) return;
    if (!isSignedIn()) {
      setEvents([]);
      setState('signed-out');
      return;
    }

    let cancelled = false;
    setState('loading');

    // listEvents takes Date objects, not strings. Local midnight to local
    // midnight — building these from the date text keeps the day boundary the
    // shop's, not UTC's.
    const [y, m, d] = dateKey.split('-').map(Number);
    const start = new Date(y, m - 1, d, 0, 0, 0, 0);
    const end = new Date(y, m - 1, d + 1, 0, 0, 0, 0);

    (async () => {
      const list = await listEvents(start, end);
      if (cancelled) return;
      setEvents(Array.isArray(list) ? list : []);
      setState('ready');
    })();

    return () => { cancelled = true; };
  }, [dateKey]);

  return { events, state };
}

function eventTime(ev) {
  const iso = ev?.start?.dateTime;
  if (!iso) return 'All day';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '';
  return dt.toLocaleTimeString('en-NZ', { hour: 'numeric', minute: '2-digit' });
}

function eventSortKey(ev) {
  // All-day events have a date but no dateTime, and belong at the top.
  return ev?.start?.dateTime || '';
}

const SECTION = {
  fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase',
  color: '#94a3b8', borderBottom: '1px solid #1e293b',
  paddingBottom: 3, marginBottom: 6,
};

export default function DailyLogPanel({
  jobs, weekDays, marks,
  dayItems, ready, saveError, addItem, removeItem,
  isMobile, showToast,
}) {
  const weekKeys = useMemo(() => (weekDays || []).map(localDateKey), [weekDays]);
  const todayKey = useMemo(() => localDateKey(new Date()), []);

  // The day starts on today, unless today is not in the shown week — then it
  // starts on that week's Monday, so the page is never pointing at a day the
  // Weekly Log beside it is not showing.
  const [dateKey, setDateKey] = useState(() =>
    (weekKeys.includes(todayKey) ? todayKey : (weekKeys[0] || todayKey))
  );

  useEffect(() => {
    if (weekKeys.length === 0) return;
    if (weekKeys.includes(dateKey)) return;
    setDateKey(weekKeys.includes(todayKey) ? todayKey : weekKeys[0]);
  }, [weekKeys, dateKey, todayKey]);

  const { events, state: apptState } = useDayAppointments(dateKey);
  const options = useMemo(() => dayJobOptions(jobs, weekKeys, marks), [jobs, weekKeys, marks]);

  const onDay = dayItems?.[dateKey] || {};
  const entries = useMemo(() => Object.entries(onDay), [onDay]);
  const dayJobs = entries.filter(([, v]) => v.kind !== 'task');
  const dayTasks = entries.filter(([, v]) => v.kind === 'task');

  // Already on the day, so not offered again.
  const taken = new Set(dayJobs.map(([id]) => id));
  const pickable = options.filter(o => !taken.has(o.id));

  const [taskText, setTaskText] = useState('');

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => eventSortKey(a).localeCompare(eventSortKey(b))),
    [events]
  );

  async function handlePickJob(id) {
    if (!ready) {
      showToast?.('Not saving yet — the day has not loaded');
      return;
    }
    const opt = options.find(o => o.id === id);
    if (!opt) return;
    // The label is stored as it reads NOW. A split's description can change, or
    // the split can stop existing; what the day says was worked on must not
    // change underneath it.
    const res = await addItem(dateKey, opt.id, 'job', opt.label);
    if (!res?.ok) showToast?.('That job did not go on the day');
  }

  async function handleAddTask(e) {
    e.preventDefault();
    if (!ready) {
      showToast?.('Not saving yet — the day has not loaded');
      return;
    }
    const name = taskText.trim().slice(0, MAX_TASK_NAME);
    if (!name) return;
    const id = newDayTaskId(dateKey);
    if (!id) return;
    setTaskText('');
    const res = await addItem(dateKey, id, 'task', name);
    if (!res?.ok) showToast?.('That task did not save');
  }

  async function handleRemove(id) {
    if (!ready) {
      showToast?.('Not saving yet — the day has not loaded');
      return;
    }
    const res = await removeItem(dateKey, id);
    if (!res?.ok) showToast?.('That did not come off the day');
  }

  const dayDate = useMemo(() => {
    const [y, m, d] = String(dateKey).split('-').map(Number);
    return (y && m && d) ? new Date(y, m - 1, d) : null;
  }, [dateKey]);

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0f172a', minWidth: 0 }}>

      <div style={{
        flexShrink: 0, padding: '12px 16px', borderBottom: '1px solid #1e293b',
        display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
      }}>
        <span style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 700 }}>
          Daily Log{dayDate ? ` — ${dayDate.toLocaleDateString('en-NZ', { weekday: 'long', day: 'numeric', month: 'short' })}` : ''}
        </span>
        {/* The week's own days, so the Daily Log can only ever point at a day
            the Weekly Log beside it is showing. */}
        <select
          value={dateKey}
          onChange={(e) => setDateKey(e.target.value)}
          style={{
            marginLeft: 'auto', padding: '5px 8px', borderRadius: 5,
            border: '1px solid #334155', background: '#1e293b',
            color: '#cbd5e1', fontSize: 12.5, cursor: 'pointer',
          }}
        >
          {(weekDays || []).map((d, i) => (
            <option key={weekKeys[i]} value={weekKeys[i]}>
              {d.toLocaleDateString('en-NZ', { weekday: 'short', day: 'numeric', month: 'short' })}
              {weekKeys[i] === todayKey ? ' (today)' : ''}
            </option>
          ))}
        </select>
      </div>

      {!ready && (
        <div style={{ flexShrink: 0, padding: '8px 16px', background: '#451a03', color: '#fcd34d', fontSize: 12 }}>
          {saveError || 'Loading the day — nothing will save until this finishes.'}
        </div>
      )}
      {ready && saveError && (
        <div style={{ flexShrink: 0, padding: '8px 16px', background: '#450a0a', color: '#fca5a5', fontSize: 12 }}>
          {saveError}
        </div>
      )}

      <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '10px 8px 40px' : 16 }}>

        {/* 1. Appointments. Read from Google Calendar and never written back —
            this is a look at the day, not a way to change it. */}
        <section style={{ marginBottom: 18 }}>
          <div style={SECTION}>Appointments</div>
          {apptState === 'signed-out' && (
            <div style={{ color: '#475569', fontSize: 12.5 }}>Not signed in to Google Calendar.</div>
          )}
          {apptState === 'loading' && (
            <div style={{ color: '#475569', fontSize: 12.5 }}>Loading…</div>
          )}
          {apptState === 'ready' && sortedEvents.length === 0 && (
            <div style={{ color: '#475569', fontSize: 12.5 }}>Nothing booked in.</div>
          )}
          {sortedEvents.map(ev => (
            <div key={ev.id} style={{
              display: 'flex', gap: 10, alignItems: 'baseline',
              padding: '4px 2px', fontSize: 12.5, color: '#cbd5e1',
            }}>
              <span style={{ color: '#7dd3fc', width: 64, flexShrink: 0 }}>{eventTime(ev)}</span>
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {ev.summary || '(no title)'}
              </span>
            </div>
          ))}
        </section>

        {/* 2. Jobs on the day — splits picked off the current Weekly Log. */}
        <section style={{ marginBottom: 18 }}>
          <div style={SECTION}>Jobs</div>
          {dayJobs.length === 0 && (
            <div style={{ color: '#475569', fontSize: 12.5, marginBottom: 6 }}>
              No jobs on this day yet.
            </div>
          )}
          {dayJobs.map(([id, v]) => (
            <div key={id} style={{
              display: 'flex', gap: 8, alignItems: 'center',
              padding: '4px 2px', fontSize: 12.5, color: '#e2e8f0',
            }}>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {v.label}
              </span>
              <button
                type="button"
                onClick={() => handleRemove(id)}
                disabled={!ready}
                title="Take this off the day"
                style={{
                  padding: '2px 9px', borderRadius: 5, border: '1px solid #334155',
                  background: 'transparent', color: '#64748b', fontSize: 11.5,
                  cursor: ready ? 'pointer' : 'default',
                }}
              >Remove</button>
            </div>
          ))}

          {pickable.length > 0 && (
            <div style={{ paddingTop: 6 }}>
              <select
                value=""
                disabled={!ready}
                onChange={(e) => {
                  const id = e.target.value;
                  e.target.value = '';
                  if (id) handlePickJob(id);
                }}
                style={{
                  width: '100%', padding: '5px 8px', borderRadius: 5,
                  border: '1px dashed #334155', background: '#0f172a',
                  color: '#94a3b8', fontSize: 12.5,
                  cursor: ready ? 'pointer' : 'default',
                }}
              >
                <option value="">+ Put a job on this day…</option>
                {pickable.map(o => (
                  <option key={o.id} value={o.id}>{o.label}</option>
                ))}
              </select>
            </div>
          )}
          {options.length === 0 && (
            <div style={{ color: '#475569', fontSize: 11.5, paddingTop: 6 }}>
              Nothing on the Weekly Log yet — a job has to be on the week before it can go on a day.
            </div>
          )}
        </section>

        {/* 3. Tasks. Free text, no status and no job behind them. */}
        <section>
          <div style={SECTION}>Tasks</div>
          {dayTasks.map(([id, v]) => (
            <div key={id} style={{
              display: 'flex', gap: 8, alignItems: 'center',
              padding: '4px 2px', fontSize: 12.5, color: '#e2e8f0',
            }}>
              <span style={{ color: '#64748b' }}>+</span>
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {v.label}
              </span>
              <button
                type="button"
                onClick={() => handleRemove(id)}
                disabled={!ready}
                title="Take this off the day"
                style={{
                  padding: '2px 9px', borderRadius: 5, border: '1px solid #334155',
                  background: 'transparent', color: '#64748b', fontSize: 11.5,
                  cursor: ready ? 'pointer' : 'default',
                }}
              >Remove</button>
            </div>
          ))}

          <form onSubmit={handleAddTask} style={{ display: 'flex', gap: 6, paddingTop: 6 }}>
            <input
              type="text"
              value={taskText}
              maxLength={MAX_TASK_NAME}
              disabled={!ready}
              onChange={(e) => setTaskText(e.target.value)}
              placeholder="+ Type something for this day…"
              style={{
                flex: 1, minWidth: 0, padding: '5px 8px', borderRadius: 5,
                border: '1px dashed #334155', background: '#0f172a',
                color: '#cbd5e1', fontSize: 12.5,
              }}
            />
            <button
              type="submit"
              disabled={!ready || !taskText.trim()}
              style={{
                padding: '5px 12px', borderRadius: 5, border: '1px solid #334155',
                background: '#1e293b', color: taskText.trim() ? '#cbd5e1' : '#475569',
                fontSize: 12.5, cursor: ready && taskText.trim() ? 'pointer' : 'default',
              }}
            >Add</button>
          </form>
        </section>
      </div>
    </div>
  );
}
