import { useEffect, useMemo, useState } from 'react';
import { localDateKey } from '../utils/calendar.js';
import { listEvents, isSignedIn } from '../utils/googleCalendar.js';
import { weekRows, partsOf, rowName, slotDateKey, MARKS, TYPED_ID_PREFIX } from './BenchWeekPage.jsx';
import { topLevelJob } from '../hooks/useJobs.js';

// The Daily Log — one day, three things: what is booked in, what has to be
// done, and which jobs are being worked on.
//
// What it writes: bench_day_marks; the one Weekly Log cell that matches the
// mark just picked; and that split's `pieceDone` when the mark becomes or
// stops being a cross. Nothing else. Not scheduledSlots, not calendarSlot, and
// nothing that finishes a whole job. Putting a job on a day is a note about the
// day, not a booking — nothing here moves a calendar slot. Closing a job is
// still the cross in the Weekly Log's last column, and the invoice is still
// asked for there and only there.
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

// A note under a job is just another row in the same table: its id says which
// job it belongs to and which note it is. Text lives in the existing `label`
// column, so notes need no schema change.
const NOTE_PREFIX = 'note:';

export function newNoteId(itemId) {
  return `${NOTE_PREFIX}${itemId}:${Math.random().toString(36).slice(2, 8)}`;
}

export function isNoteId(id) {
  return String(id ?? '').startsWith(NOTE_PREFIX);
}

// A mark is stored the same way a note is: its own row, whose id says which
// day row it belongs to. Nothing here is written to week_marks.
const MARK_PREFIX = 'mark:';

export function markIdFor(itemId) {
  return `${MARK_PREFIX}${itemId}`;
}

export function isMarkId(id) {
  return String(id ?? '').startsWith(MARK_PREFIX);
}

export function markOwner(id) {
  return isMarkId(id) ? String(id).slice(MARK_PREFIX.length) : '';
}

export function noteOwner(id) {
  if (!isNoteId(id)) return '';
  const rest = String(id).slice(NOTE_PREFIX.length);
  return rest.slice(0, rest.lastIndexOf(':'));
}

// Which Weekly Log cell a Daily Log row writes into.
//
// The Weekly Log only ever draws ONE row per top-level job (weekRows() skips
// anything with a parentId), so a split's mark has to land under its parent's
// id — a split's own id names a row that is never on the page, i.e. a mark
// that saves and shows nowhere.
//
// Returns null for a row that has no job behind it at all: a hand-typed task.
// Those live in the Daily Log only and add no Weekly Log row.
export function weekCellJobId(rowId, jobs) {
  const all = jobs || [];
  const job = all.find(j => String(j.id) === String(rowId));
  if (!job) return null;
  const top = topLevelJob(job, all);
  return top ? String(top.id) : null;
}

// May this row write the Weekly Log cell?
//
// A cell stores a mark and nothing about who put it there, so "did I write
// this" is answered by comparing what the cell holds against the mark this row
// last wrote — its own stored Daily Log mark before this change.
//
//   - Nothing stored in the cell: free to write.
//   - The cell holds what this row last wrote: this row's own mark, so it may
//     be changed or cleared. Without this, the first pick would lock the cell
//     and a correction would leave the Weekly Log stuck on the old mark — the
//     exact thing this feature exists to stop.
//   - Anything else: Trevor set it by hand, or another split of the same job
//     did, that day. Left alone, and the caller says so on screen.
//
// `stored` must be the STORED mark, never cellMark()'s: cellMark() draws a dot
// on any booked day without storing one, so testing what is drawn would refuse
// nearly every job.
export function mayWriteWeekCell(stored, lastOwnMark) {
  if (!stored) return true;
  return String(stored) === String(lastOwnMark || '');
}

// The longest typed task that still reads on a phone.
const MAX_TASK_NAME = 80;
const MAX_NOTE = 160;

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
      // `note` is the split's own sessionNote — shown in the dropdown option
      // text so the picker reads the way the placed row will. It is NOT part of
      // `label`: `label` is what gets stored, and the placed row already prints
      // the note on its own second line, so baking it into `label` would double
      // it up.
      out.push({ id: String(part.id), label, note: part.sessionNote || '' });
    }
  }

  // Two splits of one job can share a description; the id is what makes them
  // two lines, and it is also the primary key, so a duplicate id would be one
  // row fighting itself.
  const seen = new Set();
  return out.filter(o => (seen.has(o.id) ? false : (seen.add(o.id), true)));
}

// Every split booked ON this day, read from each split's own `calendarSlot` —
// the same field, read the same way, as the Weekly Log's dot. Nothing is
// stored: a booked split appears because it is booked, and stops appearing the
// moment the booking moves. No new table, no new field, and no write anywhere.
//
// Parts only, matching dayJobOptions: a job with no splits IS its own single
// part (partsOf returns [job]), so an unsplit booked job still shows up.
export function bookedOnDay(jobs, weekKeys, dateKey, marks) {
  if (!dateKey) return [];
  const all = jobs || [];
  const byId = new Map(all.map(j => [j.id, j]));
  const rows = weekRows(all, weekKeys, marks || {});
  const out = [];

  for (const row of rows) {
    if (!row.job) continue;

    let booked = 0;
    for (const part of partsOf(row.job, all, byId)) {
      if (slotDateKey(part.calendarSlot) !== dateKey) continue;
      booked += 1;
      const label = [rowName(part) || row.name, part.bench].filter(Boolean).join(' — ');
      out.push({ id: String(part.id), label, note: part.sessionNote || '' });
    }
    if (booked) continue;

    // A job put on the week by hand has no calendarSlot — nothing books it to
    // a time. What says which day it is, is the day Trevor marked on the
    // Weekly Log. That mark is the booking, so the row belongs on that day.
    //
    // It comes through as ONE line for the whole job, not one per split: a
    // week mark is on the job's row, so there is no split-level day to read.
    if (!marks?.[row.id]?.[dateKey]) continue;
    out.push({ id: String(row.id), label: row.name, note: '' });
  }

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

// The mark box: one down the left of every Daily Log line, job row or typed
// task alike. Picked, never clicked through — a phone tap has to land on the
// mark meant, not cycle past it.
//
// The VALUE is the mark's key ('slash'/'cross'/'arrow'), never its symbol. The
// symbol is only what gets drawn; storing it would save a value the Weekly Log
// cannot draw, so the mark would save and show blank.
function MarkSelect({ value, disabled, onPick, title, ariaLabel }) {
  return (
    <select
      value={value || ''}
      disabled={disabled}
      onChange={(e) => onPick(e.target.value)}
      title={title}
      aria-label={ariaLabel || title}
      style={{
        flex: '0 0 auto', width: 34, padding: '1px 2px', borderRadius: 4,
        border: '1px solid #334155', background: '#0f172a',
        color: '#cbd5e1', fontWeight: 700, fontSize: 13, textAlign: 'center',
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      <option value="">·</option>
      {Object.entries(MARKS).map(([key, m]) => (
        <option key={key} value={key}>{m.symbol}</option>
      ))}
    </select>
  );
}

const SECTION = {
  fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase',
  color: '#94a3b8', borderBottom: '1px solid #1e293b',
  paddingBottom: 3, marginBottom: 6,
};

export default function DailyLogPanel({
  jobs, weekDays, marks,
  dayItems, ready, saveError, addItem, removeItem,
  // The Weekly Log half. `ready` above is the DAY's save gate; this is the
  // week's, a separate gate with its own failure counter, so the two are never
  // one flag. Both are checked before either half is written.
  weekReady, setWeekMark, onMarkPieceDone,
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
  // Each day-log row is a bench split (a "part"), so its second line is the
  // note Trevor typed under that split ("level crown and polish") — the split's
  // own `sessionNote`. That IS the "split description" he means: it is the field
  // the JobDrawer per-split note editor writes to (row.sessions[].note →
  // sessionNote), the only place that text is stored. NOT `desc` (the parent
  // guitar's whole Multitrack description) and NOT `splitDesc` (a field nothing
  // ever writes, so always empty) — showing either of those was the repeated
  // fault. No fallback: a split with no note shows nothing, never the guitar's
  // Multitrack text. Looked up fresh from jobs so it stays current if edited.
  const jobById = useMemo(() => new Map((jobs || []).map(j => [String(j.id), j])), [jobs]);
  const subTaskNote = (id) => {
    const p = jobById.get(id);
    return p ? (p.sessionNote || '') : '';
  };

  const onDay = dayItems?.[dateKey] || {};
  const entries = useMemo(() => Object.entries(onDay), [onDay]);
  const dayTasks = entries.filter(([, v]) => v.kind === 'task');
  const hidden = useMemo(
    () => new Set(entries.filter(([, v]) => v.kind === 'hidden').map(([id]) => id)),
    [entries]
  );

  // Jobs booked on this day appear by themselves. Rows put on by hand come
  // after them. A hidden id is one Trevor took off an auto row, so it stays off.
  const auto = useMemo(
    () => bookedOnDay(jobs, weekKeys, dateKey, marks),
    [jobs, weekKeys, dateKey, marks]
  );
  const dayJobs = useMemo(() => {
    const rows = [];
    const seen = new Set();
    for (const a of auto) {
      if (hidden.has(a.id)) continue;
      seen.add(a.id);
      rows.push({ id: a.id, label: a.label, auto: true });
    }
    for (const [id, v] of entries) {
      if (v.kind !== 'job' || seen.has(id)) continue;
      seen.add(id);
      rows.push({ id, label: v.label, auto: false });
    }
    return rows;
  }, [auto, entries, hidden]);

  // The Daily Log's mark belongs to the ROW, not the job. Nine times in ten a
  // day row is a split or a task, not the whole job — so ticking one here must
  // not tick the job off on the Weekly Log. The WL keeps its one master mark.
  const markOf = useMemo(() => {
    const map = new Map();
    for (const [id, v] of entries) {
      if (isMarkId(id)) map.set(markOwner(id), v.label || '');
    }
    return map;
  }, [entries]);

  // Notes filed under the job they belong to.
  const notesFor = useMemo(() => {
    const map = new Map();
    for (const [id, v] of entries) {
      if (!isNoteId(id)) continue;
      const owner = noteOwner(id);
      if (!map.has(owner)) map.set(owner, []);
      map.get(owner).push({ id, text: v.label || '' });
    }
    for (const list of map.values()) list.sort((a, b) => a.id.localeCompare(b.id));
    return map;
  }, [entries]);

  // Already on the day, so not offered again.
  const taken = new Set(dayJobs.map(r => r.id));
  const pickable = options.filter(o => !taken.has(o.id) && !hidden.has(o.id));

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

  async function handleRemove(row) {
    if (!ready) {
      showToast?.('Not saving yet — the day has not loaded');
      return;
    }
    // An auto row appears BECAUSE nothing is stored for it, so deleting would
    // undo itself on the next reload. It gets a 'hidden' row instead.
    const res = row.auto
      ? await addItem(dateKey, row.id, 'hidden', row.label)
      : await removeItem(dateKey, row.id);
    if (!res?.ok) showToast?.('That did not come off the day');
  }

  // Picking a mark here is the one pick: it marks the day row AND the same
  // job's Weekly Log cell for that day, so the mark is only ever chosen once.
  //
  // Nothing here books a day. `>` says the work was deferred; which day it
  // moves to is Trevor's, by hand, and this never asks.
  async function handleSetMark(row, value) {
    if (!ready) {
      showToast?.('Not saving yet — the day has not loaded');
      return;
    }

    // A typed task has no job and so no Weekly Log cell — its mark is a Daily
    // Log mark only, and the week's gate has no say over it.
    const weekJobId = weekCellJobId(row.id, jobs);

    // Both gates, before either half is written. Half a mark — the day marked
    // and the week silently missed — is worse than no mark, because the screen
    // would look like it worked.
    if (weekJobId && !weekReady) {
      showToast?.('Not saving yet — the Weekly Log has not loaded');
      return;
    }

    // What this row last wrote, read before the change lands.
    const previous = markOf.get(row.id) || '';

    const id = markIdFor(row.id);
    const res = value
      ? await addItem(dateKey, id, 'mark', value)
      : await removeItem(dateKey, id);
    if (!res?.ok) {
      showToast?.('That mark did not save');
      return;
    }

    if (!weekJobId) return;

    // The board's tick, moved ONLY as the cross arrives or leaves. The board
    // (JobCard, PomoDrawer, CloseDayModal) writes pieceDone too, so clearing it
    // on any non-cross mark would silently un-tick a piece already ticked done
    // there — pick `/` because more work happened, and the tick vanishes.
    // Nothing to do for a row that isn't a split's child: pieceDone is a
    // child's field.
    const rowJob = jobById.get(String(row.id));
    if (rowJob?.parentId && onMarkPieceDone) {
      const wasCross = previous === 'cross';
      const isCross = value === 'cross';
      if (wasCross !== isCross) onMarkPieceDone(rowJob.parentId, rowJob.id, isCross);
    }

    // The STORED week mark, not what the grid draws.
    const stored = marks?.[weekJobId]?.[dateKey] || '';
    if (!mayWriteWeekCell(stored, previous)) {
      showToast?.('Weekly Log left alone — that day already has a mark this row did not put there');
      return;
    }

    const weekRes = await setWeekMark?.(weekJobId, dateKey, value || '');
    if (!weekRes?.ok) showToast?.('The Weekly Log did not take that mark');
  }

  async function handleAddNote(row) {
    if (!ready) {
      showToast?.('Not saving yet — the day has not loaded');
      return;
    }
    const res = await addItem(dateKey, newNoteId(row.id), 'note', '');
    if (!res?.ok) showToast?.('That note did not save');
  }

  async function handleSaveNote(noteId, text) {
    // Same id = overwrite, so saving an edit is just adding it again.
    const res = await addItem(dateKey, noteId, 'note', text.slice(0, MAX_NOTE));
    if (!res?.ok) showToast?.('That note did not save');
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
      {/* The week's own gate, said out loud. A mark picked while this is up
          reaches neither log — the tap is refused, never silently dropped. */}
      {ready && !weekReady && (
        <div style={{ flexShrink: 0, padding: '8px 16px', background: '#451a03', color: '#fcd34d', fontSize: 12 }}>
          The Weekly Log has not loaded — marks will not save until it does.
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
          {dayJobs.map(row => (
            <div key={row.id} style={{
              display: 'flex', gap: 8, alignItems: 'flex-start',
              padding: '4px 2px', fontSize: 12.5, color: '#e2e8f0',
            }}>
              <MarkSelect
                value={markOf.get(row.id)}
                disabled={!ready}
                onPick={(v) => handleSetMark(row, v)}
                title="How this job went today"
                ariaLabel={`Mark for ${row.label}`}
              />
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {row.label}
                </div>
                {subTaskNote(row.id) && (
                  <div style={{
                    fontSize: 11, color: '#94a3b8', overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {subTaskNote(row.id)}
                  </div>
                )}
                {(notesFor.get(row.id) || []).map(n => (
                  <div key={n.id} style={{ display: 'flex', gap: 6, alignItems: 'center', paddingTop: 3 }}>
                    <span style={{ color: '#475569', fontSize: 11 }}>–</span>
                    <input
                      defaultValue={n.text}
                      disabled={!ready}
                      maxLength={MAX_NOTE}
                      placeholder="What happened…"
                      onBlur={(e) => {
                        if (e.target.value !== n.text) handleSaveNote(n.id, e.target.value);
                      }}
                      style={{
                        flex: 1, minWidth: 0, padding: '2px 5px', borderRadius: 4,
                        border: '1px solid #1e293b', background: '#0b1220',
                        color: '#cbd5e1', fontSize: 11.5,
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => removeItem(dateKey, n.id)}
                      disabled={!ready}
                      title="Delete this note"
                      style={{
                        border: 'none', background: 'transparent', color: '#475569',
                        fontSize: 12, cursor: ready ? 'pointer' : 'default', padding: '0 3px',
                      }}
                    >×</button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => handleAddNote(row)}
                  disabled={!ready}
                  style={{
                    border: 'none', background: 'transparent', color: '#475569',
                    fontSize: 11, cursor: ready ? 'pointer' : 'default',
                    padding: '3px 0 0 0',
                  }}
                >+ note</button>
              </span>
              <button
                type="button"
                onClick={() => handleRemove(row)}
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
                  <option key={o.id} value={o.id}>{o.note ? `${o.label} — ${o.note}` : o.label}</option>
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
              {/* A typed task gets the same mark box as a job line — it is
                  still a thing that was worked on, deferred or finished. It has
                  no job behind it, so it has no Weekly Log row and the mark
                  stays here. */}
              <MarkSelect
                value={markOf.get(id)}
                disabled={!ready}
                onPick={(val) => handleSetMark({ id, label: v.label }, val)}
                title="How this task went today"
                ariaLabel={`Mark for ${v.label}`}
              />
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
