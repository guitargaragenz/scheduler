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

// Every Daily Log mark, one per row, latest day wins.
//
// A row can be marked on more than one day (worked Monday, finished Thursday),
// so the marks are walked in date order and the last one seen for a row is the
// one that counts. Date keys are `YYYY-MM-DD`, so plain text sorting IS date
// order. A day whose mark was removed has no row at all, so it simply does not
// overwrite an earlier one.
export function latestDayMarks(dayItems) {
  const out = new Map();
  for (const day of Object.keys(dayItems || {}).sort()) {
    for (const [id, v] of Object.entries(dayItems[day] || {})) {
      if (!isMarkId(id)) continue;
      out.set(markOwner(id), v?.label || '');
    }
  }
  return out;
}

// Is this split the LAST piece of its job still without a cross?
//
// Read from the Daily Log's own marks and deliberately NOT from `pieceDone`:
// the board (JobCard, PomoDrawer, CloseDayModal) writes pieceDone too, so a
// piece ticked there but never marked here would make the Daily Log think the
// job had finished when Trevor had not said so on this page.
//
// A row that is not a split answers false — it has no siblings, and its mark is
// the job's own mark, which this rule never touches.
export function isLastUncrossedSplit(rowId, jobs, dayItems) {
  const all = jobs || [];
  const rowJob = all.find(j => String(j.id) === String(rowId));
  if (!rowJob?.parentId) return false;
  const top = topLevelJob(rowJob, all);
  if (!top) return false;
  const byId = new Map(all.map(j => [j.id, j]));
  const others = partsOf(top, all, byId).filter(p => String(p.id) !== String(rowId));
  if (others.length === 0) return true;
  const marks = latestDayMarks(dayItems);
  return others.every(o => marks.get(String(o.id)) === 'cross');
}

// The Daily Log drives the Weekly Log. A pick here overwrites whatever the week
// cell holds, and clearing the row clears it.
//
// This used to refuse a cell the row hadn't written itself — Trevor's mark set
// by hand, or another split of the same job that day. He rejected that on the
// preview (2026-08-20): "I specifically said that the DL should drive WL — when
// I select action in DL, WL should reflect that change." Two splits of one job
// marked the same day share one cell, so the last pick wins.

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
      // Two pieces the picker has no business offering:
      //
      // A piece already BOOKED onto the calendar. This is the job card's own
      // rule — `Sidebar.jsx:20` keeps only unscheduled sub-tasks — and matching
      // it is what Trevor asked for, 2026-08-22, after 1632 offered 7 where the
      // card showed 4. A booked piece turns up on its own day by itself
      // (`bookedOnDay()`), so offering it again is a second way to put it
      // somewhere it already is.
      //
      // A piece already ticked off. Finished work, and picking it by mistake is
      // how the wrong row lands on a day.
      //
      // Only the PICKER filters. `bookedOnDay()` deliberately does not: a split
      // that is booked is booked whether or not it is done, and hiding a
      // finished piece there would erase the day's record of the work.
      if (part.scheduled || part.calendarSlot || part.pieceDone) continue;
      // The job this piece belongs to, used as the dropdown's group heading so
      // the picker reads the way the Daily Log itself now does — pieces under
      // their job, not a flat run of lines that all start with the same number.
      const group = rowName(row.job) || row.name;
      const label = [rowName(part) || row.name, part.bench].filter(Boolean).join(' — ');
      // `note` is the split's own sessionNote — shown in the dropdown option
      // text so the picker reads the way the placed row will. It is NOT part of
      // `label`: `label` is what gets stored, and the placed row already prints
      // the note on its own second line, so baking it into `label` would double
      // it up.
      // `short` is for the dropdown only. Under a group already headed with the
      // job, repeating the number on every line is the noise the grouping was
      // meant to remove — so the option shows just the bench. `label` is what
      // gets STORED and stays whole: the placed row has no group above it.
      const short = part.bench || label;
      out.push({ id: String(part.id), label, group, short, note: part.sessionNote || '' });
    }
  }

  // Two splits of one job can share a description; the id is what makes them
  // two lines, and it is also the primary key, so a duplicate id would be one
  // row fighting itself.
  const seen = new Set();
  return out.filter(o => (seen.has(o.id) ? false : (seen.add(o.id), true)));
}

// The picker's options, gathered under one heading per job. Order is kept as
// `dayJobOptions` built it — the Weekly Log's own oldest-first order — for both
// the headings and the pieces inside them, so the picker lists jobs in the same
// order as the page behind it.
export function groupsOf(options) {
  const out = [];
  const byName = new Map();
  for (const o of options || []) {
    const name = o.group || '';
    let g = byName.get(name);
    if (!g) {
      g = { name, items: [] };
      byName.set(name, g);
      out.push(g);
    }
    g.items.push(o);
  }
  return out;
}

// What a typed search matches against: the job number, make and model (all in
// `group`), the bench (`short`), and the split's own note. Deliberately dumb
// substring matching, all lower case — no typo or plural tolerance. Every word
// typed has to appear SOMEWHERE in the option, in any order, so "1632 fret"
// finds the Hofner's fretwork without caring which came first.
export function matchesSearch(option, query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return true;
  const hay = [option.group, option.short, option.label, option.note]
    .filter(Boolean).join(' ').toLowerCase();
  return q.split(/\s+/).every(word => hay.includes(word));
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
      value={value || 'dot'}
      disabled={disabled}
      onChange={(e) => onPick(e.target.value)}
      title={title}
      aria-label={ariaLabel || title}
      style={{
        flex: '0 0 auto', width: 34, padding: '1px 2px', borderRadius: 4,
        border: '1px solid #334155', background: '#0f172a',
        color: '#cbd5e1', fontWeight: 700, fontSize: 13, textAlign: 'center',
        cursor: disabled ? 'default' : 'pointer',
        // No browser arrow. Trevor, 2026-08-22: strip it everywhere except the
        // Weekly Log's "add a job" box, where it is the thing that says the box
        // opens. On a 34px mark box the arrow was most of the width.
        appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
        textAlignLast: 'center',
      }}
    >
      {/* No erase line here, and an unmarked box reads as `·`, not blank.
          Trevor, 2026-08-22: a Daily Log line only exists because the job is on
          that day, so `booked` IS its resting state — there is nothing to clear
          it back to. Clearing a cell is a Weekly Log job, and the Weekly Log
          keeps its own erase line for exactly that. A line put on the day by
          mistake comes off with Remove, not by blanking its mark. */}
      {Object.entries(MARKS).map(([key, m]) => (
        <option key={key} value={key}>{m.symbol}</option>
      ))}
    </select>
  );
}

// One markable Jobs-section line: mark box, label, sub-note, per-line notes,
// Remove button. Pulled out so Build 2 can render the same row either flat
// (an unsplit job, exactly as before) or indented under its parent's header
// (a split) without duplicating the markup.
function JobLine({
  row, indent, markValue, ready, onPick, subNote, notes, onSaveNote, onDeleteNote, onAddNote, onRemove,
}) {
  return (
    <div style={{
      display: 'flex', gap: 8, alignItems: 'flex-start',
      padding: '4px 2px', fontSize: 12.5, color: '#e2e8f0',
      marginLeft: indent ? 20 : 0,
      borderLeft: indent ? '1px solid #1e293b' : 'none',
      paddingLeft: indent ? 8 : 2,
    }}>
      <MarkSelect
        value={markValue}
        disabled={!ready}
        onPick={onPick}
        title="How this job went today"
        ariaLabel={`Mark for ${row.label}`}
      />
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {row.label}
        </div>
        {subNote && (
          <div style={{
            fontSize: 11, color: '#94a3b8', overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {subNote}
          </div>
        )}
        {notes.map(n => (
          <div key={n.id} style={{ display: 'flex', gap: 6, alignItems: 'center', paddingTop: 3 }}>
            <span style={{ color: '#475569', fontSize: 11 }}>–</span>
            <input
              defaultValue={n.text}
              disabled={!ready}
              maxLength={MAX_NOTE}
              placeholder="What happened…"
              onBlur={(e) => {
                if (e.target.value !== n.text) onSaveNote(n.id, e.target.value);
              }}
              style={{
                flex: 1, minWidth: 0, padding: '2px 5px', borderRadius: 4,
                border: '1px solid #1e293b', background: '#0b1220',
                color: '#cbd5e1', fontSize: 11.5,
              }}
            />
            <button
              type="button"
              onClick={() => onDeleteNote(n.id)}
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
          onClick={onAddNote}
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
        onClick={onRemove}
        disabled={!ready}
        title="Take this off the day"
        style={{
          padding: '2px 9px', borderRadius: 5, border: '1px solid #334155',
          background: 'transparent', color: '#64748b', fontSize: 11.5,
          cursor: ready ? 'pointer' : 'default',
        }}
      >Remove</button>
    </div>
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

  // Splits sit under their parent job, indented, so a job worked on two
  // benches reads as one job with two markable lines under it instead of two
  // unrelated rows. A split is any dayJobs row whose job has a `parentId`;
  // its parent is found once via `topLevelJob` and given its OWN header line
  // with its OWN mark — never derived from the splits underneath it. There is
  // no stored row for that header today (Build 1 never wrote one), so it is
  // built here from `jobById`/`rowName` alone: no note, no remove button,
  // nothing to take off the day, just a label and a mark box. An unsplit job
  // (partsOf returned itself) has no parent to nest under, so it renders
  // exactly as it did before Build 2 — one plain row.
  //
  // Order follows first appearance in `dayJobs`: a split's header takes the
  // position its first split would have had, and later splits of the same
  // job join that same block rather than opening a second header further
  // down the list.
  const dayJobBlocks = useMemo(() => {
    const blocks = [];
    const groupAt = new Map(); // top-level job id -> index into blocks
    for (const row of dayJobs) {
      const rowJob = jobById.get(row.id);
      if (rowJob?.parentId) {
        const top = topLevelJob(rowJob, jobs) || rowJob;
        const topId = String(top.id);
        if (groupAt.has(topId)) {
          blocks[groupAt.get(topId)].rows.push(row);
        } else {
          groupAt.set(topId, blocks.length);
          blocks.push({ kind: 'group', id: topId, label: rowName(top), rows: [row] });
        }
      } else {
        blocks.push({ kind: 'single', row });
      }
    }
    return blocks;
  }, [dayJobs, jobById, jobs]);

  // Already on the day, so not offered again.
  const taken = new Set(dayJobs.map(r => r.id));
  const pickable = options.filter(o => !taken.has(o.id) && !hidden.has(o.id));

  // What the picker is showing right now. An empty box is the whole week,
  // grouped — the search narrows the list, it is not a gate in front of it.
  const [jobSearch, setJobSearch] = useState('');
  const searchGroups = useMemo(
    () => groupsOf(pickable.filter(o => matchesSearch(o, jobSearch))),
    [pickable, jobSearch],
  );

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
    if (!res?.ok) {
      showToast?.('That job did not go on the day');
      return;
    }

    // Putting a job on the day puts a dot in its week cell, so the two logs
    // agree the moment the job lands. Trevor, 2026-08-23: "Book in WL adds to
    // DL. Book in DL adds to WL". The dot is what the day's mark box already
    // shows for an unmarked row, so nothing new appears on screen here.
    //
    // Three things it must not do:
    //  - write through a split. No split mark reaches the Weekly Log; only a
    //    job's own line drives the week.
    //  - overwrite a cell that already holds a mark. The day is being added,
    //    not marked, so a `/` or `>` already there is the better record.
    //  - write before the week is ready, which would save over a week we have
    //    not actually read.
    const optJob = jobs?.find(j => String(j.id) === String(opt.id));
    if (optJob?.parentId) return;
    const weekJobId = weekCellJobId(opt.id, jobs);
    if (!weekJobId || !weekReady) return;
    if (marks?.[weekJobId]?.[dateKey]) return;
    const weekRes = await setWeekMark?.(weekJobId, dateKey, 'dot');
    if (weekRes && !weekRes.ok) showToast?.('That did not reach the Weekly Log');
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
    if (!res?.ok) {
      showToast?.('That did not come off the day');
      return;
    }

    // Taking the line off the day takes its mark with it, on both logs.
    // Trevor, 2026-08-22: "if I delete job from DL the mark should clear in
    // WL". Leaving the week cell behind showed a job worked on a day it was
    // no longer on.
    //
    // The week cell belongs to the whole job, not to one line, so it clears
    // only when the job's LAST line leaves the day. Removing one bench's piece
    // off a job still on the day must not wipe the cell the job's own header
    // line drove — the header carries no Remove button of its own, so its
    // cell would otherwise be stranded.
    await removeItem(dateKey, markIdFor(row.id));

    const weekJobId = weekCellJobId(row.id, jobs);
    if (!weekJobId || !weekReady) return;
    const stillOnTheDay = dayJobs.some(r => String(r.id) !== String(row.id)
      && weekCellJobId(r.id, jobs) === weekJobId);
    if (stillOnTheDay) return;

    // The header line's own mark goes too — nothing is left to show it on.
    await removeItem(dateKey, markIdFor(weekJobId));
    const weekRes = await setWeekMark?.(weekJobId, dateKey, '');
    if (!weekRes?.ok) showToast?.('The Weekly Log did not take that');
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

    // WHY the week write is skipped here — do not remove this without asking.
    //
    // A × on ONE piece of a job means that piece is finished, not the guitar.
    // The Weekly Log draws one row per whole job, so passing every piece's ×
    // straight through was marking the job done the moment its first bench was
    // finished. Trevor, 2026-08-22: "any subtasks with x shld show nothing on
    // WL unless it's the last subtask of job in which case it marks an x. The
    // job is then closed manually by me in WL with second x."
    //
    // So a split's × reaches the week ONLY when every other piece of that job
    // already carries one. Taking that × off again clears the cell it wrote,
    // and nothing else does — a × that wrote nothing has nothing to clear.
    //
    // Widened 2026-08-22 on the preview, Trevor's call: the × was held back
    // but `·`, `/` and `>` on a piece still landed on the whole guitar's row.
    // Same objection either way — one bench's progress is not the job's. So a
    // split writes NOTHING to the week; the one exception is the × on the last
    // uncrossed piece, which is the job finishing.
    //
    // The job's own header row is untouched by all of this: it is not a split,
    // so it falls straight through and last pick still wins. That row is where
    // the job's `·`, `/` and `>` come from on the week.
    if (rowJob?.parentId) {
      const isCross = value === 'cross' || (value === '' && previous === 'cross');
      if (!isCross) return;
      if (!isLastUncrossedSplit(row.id, jobs, dayItems)) return;
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
            appearance: 'none', WebkitAppearance: 'none', MozAppearance: 'none',
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
          {dayJobBlocks.map(block => block.kind === 'group' ? (
            // The parent line: new, not a stored day-item. Its mark writes to
            // its OWN Weekly Log cell (its id is already the top-level id, so
            // weekCellJobId resolves to itself) — it is never set from, or
            // reset by, the splits indented under it.
            <div key={`group:${block.id}`}>
              <div style={{
                display: 'flex', gap: 8, alignItems: 'center',
                padding: '4px 2px', fontSize: 12.5, color: '#e2e8f0', fontWeight: 600,
              }}>
                <MarkSelect
                  value={markOf.get(block.id)}
                  disabled={!ready}
                  onPick={(v) => handleSetMark({ id: block.id, label: block.label }, v)}
                  title="How this job went today"
                  ariaLabel={`Mark for ${block.label}`}
                />
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {block.label}
                </span>
              </div>
              {block.rows.map(row => (
                <JobLine
                  key={row.id}
                  row={row}
                  indent
                  markValue={markOf.get(row.id)}
                  ready={ready}
                  onPick={(v) => handleSetMark(row, v)}
                  subNote={subTaskNote(row.id)}
                  notes={notesFor.get(row.id) || []}
                  onSaveNote={handleSaveNote}
                  onDeleteNote={(id) => removeItem(dateKey, id)}
                  onAddNote={() => handleAddNote(row)}
                  onRemove={() => handleRemove(row)}
                />
              ))}
            </div>
          ) : (
            <JobLine
              key={block.row.id}
              row={block.row}
              markValue={markOf.get(block.row.id)}
              ready={ready}
              onPick={(v) => handleSetMark(block.row, v)}
              subNote={subTaskNote(block.row.id)}
              notes={notesFor.get(block.row.id) || []}
              onSaveNote={handleSaveNote}
              onDeleteNote={(id) => removeItem(dateKey, id)}
              onAddNote={() => handleAddNote(block.row)}
              onRemove={() => handleRemove(block.row)}
            />
          ))}

          {/* The picker draws its own list rather than using a <select>.
              A native dropdown is painted by the operating system, which
              throws away the heading colour — Trevor asked for a heading he
              could follow down a long list and got grey on both the Mac and
              the phone, whatever was set. Our own markup is the only way the
              amber holds.

              The list is always open, and scrolls inside its own box: a week's
              worth of pieces must not push the Tasks section off the screen. */}
          {pickable.length > 0 && (
            <div style={{ paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 5 }}>
              <input
                type="text"
                value={jobSearch}
                disabled={!ready}
                onChange={(e) => setJobSearch(e.target.value)}
                placeholder="+ Put a job on this day…"
                aria-label="Search the week for a job to put on this day"
                style={{
                  width: '100%', padding: '6px 9px', borderRadius: 5,
                  border: '1px dashed #334155', background: '#0f172a',
                  color: '#e2e8f0', fontSize: 12.5,
                }}
              />
              {/* Nothing below the box until something is typed. Trevor asked
                  for a picker that stays out of the way until he goes looking
                  for it — an always-open list is the chip row he turned down,
                  in a different shape. */}
              <div style={{ maxHeight: 190, overflowY: 'auto' }} hidden={!jobSearch.trim()}>
                {searchGroups.map(g => (
                  <div key={g.name} style={{ paddingBottom: 4 }}>
                    <div style={{
                      color: '#fcd34d', fontSize: 11.5, fontWeight: 600,
                      padding: '3px 2px',
                    }}>{g.name}</div>
                    {g.items.map(o => (
                      <button
                        key={o.id}
                        type="button"
                        // The search stays put. A job is nearly always several
                        // pieces going on one day, so clearing it after each
                        // pick meant re-typing the same job number for every
                        // bench — Trevor, 2026-08-22: "way too much typing…
                        // I can only choose 1 at a time". The piece just picked
                        // drops out of the list on its own (it is `taken`
                        // now), so tapping down the list places them all.
                        onClick={() => handlePickJob(o.id)}
                        disabled={!ready}
                        style={{
                          display: 'block', width: '100%', textAlign: 'left',
                          padding: '5px 8px', marginLeft: 9, borderRadius: 4,
                          border: '1px solid transparent', background: '#1e293b',
                          color: '#e2e8f0', fontSize: 12.5, marginBottom: 2,
                          cursor: ready ? 'pointer' : 'default',
                        }}
                      >
                        {o.note ? `${o.short} — ${o.note}` : o.short}
                      </button>
                    ))}
                  </div>
                ))}
                {searchGroups.length === 0 && (
                  <div style={{ color: '#475569', fontSize: 11.5, padding: '3px 2px' }}>
                    Nothing on the week matches that.
                  </div>
                )}
              </div>
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
                // handleRemove reads `row.id` and `row.auto`, so it needs the
                // row — passing the bare id deleted nothing and only toasted.
                onClick={() => handleRemove({ id, label: v.label })}
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
