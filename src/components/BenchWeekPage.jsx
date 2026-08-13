import { useMemo, useState } from 'react';
import { benchColors } from '../data/jobs.js';
import { localDateKey, formatDateRange } from '../utils/calendar.js';

// The week page — bench view, Build 1.
//
// This week's jobs grouped by bench, ONE row per job (never one per split),
// with a column per day M–S and a trailing column that carries the job into
// next week.
//
// What it writes: bench_week_marks, and nothing else. Not jobs[], not
// scheduledSlots, not calendarSlot. Marking a day is a note about what happened
// at the bench, not a scheduling instruction — the app does not decide a
// schedule any more, Trevor does.
//
// What it deliberately does NOT do:
//   - propose or fill slots;
//   - enforce the 12-hour glue gap. The data cannot tell a glue-up from any
//     other session, so a rule enforced here would be guessing. Glue timing is
//     Trevor's call.

// The five benches Trevor plans the week on. Wiring was dropped 2026-08-13 —
// it isn't a bench he books a week against, and an always-drawn empty heading
// is dead space on the page.
//
// Dropping it from THIS list does not hide a wiring job: benchSections() draws
// any bench it finds in the data after these, so a job filed under Wiring still
// gets its own heading. It just stops appearing when there is nothing on it.
const BENCH_ORDER = ['Electronics', 'Fretwork', 'Setup', 'Luthier', 'Admin'];

// Stored as words, drawn as symbols. The database keeps 'slash', not '/', so a
// change of symbol later is a display change and not a data migration.
export const MARKS = {
  dot:   { symbol: '·', label: 'booked' },
  slash: { symbol: '/', label: 'worked that day' },
  arrow: { symbol: '>', label: 'not worked — move on' },
  cross: { symbol: '×', label: 'done' },
};

// Tap order. Round-trips back to blank so a mis-tap is always undoable with
// more taps and never needs a separate clear button.
const CYCLE = ['dot', 'slash', 'arrow', 'cross', ''];

export function nextMark(current) {
  const i = CYCLE.indexOf(current || '');
  return CYCLE[(i + 1) % CYCLE.length];
}

// The date part of a calendarSlot ("2026-08-13-10-30" -> "2026-08-13").
// slotKey() zero-pads month and day, so the first ten characters are always the
// local date. Deliberately not parsed as a Date — that would reintroduce the
// UTC drift localDateKey() exists to avoid.
export function slotDateKey(calendarSlot) {
  if (!calendarSlot || typeof calendarSlot !== 'string') return null;
  const key = calendarSlot.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : null;
}

// The key that holds a hand-added row for a week.
//
// It lives in bench_week_marks alongside the day marks, but it is NOT one of the
// seven day keys, so nothing that draws or exports a day can ever see it:
// cellMark(), trailing() and buildWeekExport() all walk weekKeys and only
// weekKeys. That is what lets an added row start blank without inventing a
// "blank" marker symbol.
//
// The week's Monday is weekKeys[0] — getWeekDays() always starts on Monday.
export function weekRowKey(weekKeys) {
  const monday = (weekKeys || [])[0];
  return monday ? `week:${monday}` : null;
}

// The value stored under that key. Never displayed; the key's existence is the
// whole message. Deliberately not one of the MARKS names, so a stray read that
// did look it up would find nothing to draw.
const ROW_MARK = 'row';

// ---------------------------------------------------------------------------
// Typed rows — hand-written admin work that is not a job (Build 1c)
// ---------------------------------------------------------------------------
//
// Trevor types "buy strings" under a bench and gets a row that behaves exactly
// like a job row. There is no jobs[] entry behind it, and there must never be
// one: if it was added by hand, it isn't a job.
//
// No schema change. Both of the pieces a typed row needs are carried inside the
// two free-text columns bench_week_marks already has:
//
//   job_id  = "task:<monday>:<random>"
//             The "task:" prefix is what keeps a typed id out of job space. A
//             Multitrack job id is digits, optionally with a split suffix
//             (1714, 1714-ST) — it can never contain a colon, so no typed id
//             can ever collide with, or be mistaken for, a job id. The Monday
//             is in there so an id is readable at a glance and belongs visibly
//             to one week.
//
//   mark    = "task:<bench>:<name>"   (stored on the week key, week:<monday>)
//             The week key is the only place a typed row's name and bench can
//             live, because rowBenchOf() has no job.bench to read. Bench names
//             are the shop's own list and contain no colon, so the value is
//             parsed as: tag, then bench up to the NEXT colon, then everything
//             remaining is the name. A typed name containing a colon survives
//             that intact.
//
// A job row added by hand still stores plain 'row' on the same key, and 'row'
// deliberately fails to decode as a typed row — the two cannot be confused.
export const TYPED_ID_PREFIX = 'task:';

// The longest typed name that still exports as a readable column.
const MAX_TYPED_NAME = 60;

export function isTypedRowId(id) {
  return String(id ?? '').startsWith(TYPED_ID_PREFIX);
}

// A fresh id for one typed row in one week. Random, because two typed rows
// created in the same second under the same bench must still be two rows.
export function newTypedRowId(weekKeys, rand = Math.random) {
  const monday = (weekKeys || [])[0];
  if (!monday) return null;
  const tail = rand().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
  return `${TYPED_ID_PREFIX}${monday}:${tail}`;
}

// Typed rows are Trevor's admin to-do list — do the books, order strings,
// clean the benches — so Admin is the only bench they can ever sit on
// (corrected 2026-08-13). The bench is not a parameter anywhere: it is
// written as Admin and read back as Admin, so no caller can place one
// elsewhere even by mistake.
export const TYPED_ROW_BENCH = 'Admin';

// name -> the value stored on the week key. Returns null for a name that is
// blank once trimmed, so an empty box can never create a row.
export function encodeTypedRow(name) {
  const n = String(name ?? '').trim().slice(0, MAX_TYPED_NAME);
  if (!n) return null;
  return `${TYPED_ID_PREFIX}${TYPED_ROW_BENCH}:${n}`;
}

// The reverse. Returns null for anything that is not a typed row value —
// including 'row', the marker a hand-added JOB row stores on the same key.
export function decodeTypedRow(value) {
  if (typeof value !== 'string') return null;
  if (!value.startsWith(TYPED_ID_PREFIX)) return null;
  const rest = value.slice(TYPED_ID_PREFIX.length);
  const cut = rest.indexOf(':');
  if (cut === -1) return null;
  const name = rest.slice(cut + 1).trim();
  if (!name) return null;
  // The bench is always Admin, whatever the stored value happens to say. The
  // field is still parsed past so a name containing a colon survives, but its
  // content is never trusted — that is what makes a typed row on another bench
  // impossible rather than merely unlikely.
  return { bench: TYPED_ROW_BENCH, name };
}

// The pieces of a job that can carry a bench and a booking: its splits if it has
// any, otherwise the job itself. Auto-splits are reached through subtasks[],
// manual splits through parentId — the same two routes weekRows() has always
// used, pulled out so the bench dropdown cannot drift from the row list.
export function partsOf(job, all, byId) {
  let kids = [];
  if (job.hasSubtasks && Array.isArray(job.subtasks)) {
    kids = job.subtasks.map(id => byId.get(id)).filter(Boolean);
  } else if (job.isSplit) {
    kids = all.filter(j => j.parentId === job.id);
  }
  return kids.length > 0 ? kids : [job];
}

// The bench a job's ROW is filed under: the parent's own if it has one,
// otherwise the first bench any of its pieces sits on. One row, one bench
// heading, even for a job split across two benches.
export function rowBenchOf(job, parts) {
  return job.bench || parts.map(p => p.bench).find(Boolean) || '';
}

export function rowName(job) {
  return [job.job, job.mfr, job.model].filter(Boolean).join(' ').trim();
}

// Job numbers are issued in order, so sorting them low-to-high is the same as
// listing the week's jobs oldest first — which is how Trevor reads the page.
//
// A number can carry a split suffix (`1714-ST`), so the leading digits are
// compared as a NUMBER and the rest as text. Comparing the whole thing as text
// would put 1714 after 171 and after 17140; comparing it as a number alone
// would make 1714 and 1714-ST tie and reshuffle on reload.
export function compareJobNumber(a, b) {
  const parse = id => {
    const s = String(id ?? '');
    const m = s.match(/^(\d+)(.*)$/);
    return m ? [Number(m[1]), m[2]] : [Number.POSITIVE_INFINITY, s];
  };
  const [an, ar] = parse(a);
  const [bn, br] = parse(b);
  return an - bn || ar.localeCompare(br);
}

// One row per top-level job that has anything to do with this week.
//
// "Anything to do with this week" is a booking in it, a mark already made in it,
// or a hand-added row for it. The second matters because once the calendar's
// automatic moving is parked, a job marked as worked must not fall off the page
// just because its booking later changed. The third is how Trevor fills a blank
// Sunday page, before any booking or mark exists.
//
// Splits are reached through their parent and collapsed back into the parent's
// single row — a job worked on two benches is still one guitar and one line.
// `!parentId && !isDerived` is how a top-level job is found; `!hasSubtasks` is
// NOT, because auto-split children inherit hasSubtasks from the parent they
// were spread from.
export function weekRows(jobs, weekKeys, marks = {}) {
  const all = jobs || [];
  const inWeek = new Set(weekKeys);
  const byId = new Map(all.map(j => [j.id, j]));
  const rowKey = weekRowKey(weekKeys);
  const rows = [];

  for (const job of all) {
    if (job.parentId || job.isDerived) continue;
    if (job.done) continue;

    const parts = partsOf(job, all, byId);

    // Every day this week any part of the job is booked on.
    const bookedDays = new Set();
    for (const p of [job, ...parts]) {
      const key = slotDateKey(p.calendarSlot);
      if (key && inWeek.has(key)) bookedDays.add(key);
    }

    const jobMarks = marks[String(job.id)] || {};
    const hasMarkThisWeek = weekKeys.some(k => jobMarks[k]);
    const addedByHand = Boolean(rowKey && jobMarks[rowKey]);

    if (bookedDays.size === 0 && !hasMarkThisWeek && !addedByHand) continue;

    rows.push({
      id: String(job.id),
      job,
      bench: rowBenchOf(job, parts),
      name: rowName(job),
      bookedDays,
      addedByHand,
      benches: [...new Set(parts.map(p => p.bench).filter(Boolean))],
    });
  }

  // Job rows read oldest-first by job number. Done before the typed rows are
  // added so hand-typed admin rows stay together at the foot of their bench
  // rather than being interleaved by a number they don't have.
  rows.sort((a, b) => compareJobNumber(a.job?.job ?? a.id, b.job?.job ?? b.id));

  // Second pass: the rows that have no job behind them at all.
  //
  // The loop above can only ever find rows by walking jobs[], so a typed row
  // would never be drawn by it. These are found from the marks instead: a
  // typed id whose week key decodes into a bench and a name IS the row. The
  // week key is the only record of it, which is also why a typed row cannot
  // survive its own removal — clearing the keys clears the row.
  //
  // `job: null` is a stub on purpose. Nothing reads row.job; the row's name and
  // bench are carried on the row itself, exactly as they are for a job row.
  if (rowKey) {
    const typedRows = [];
    for (const [id, rowMarks] of Object.entries(marks || {})) {
      if (!isTypedRowId(id)) continue;
      const typed = decodeTypedRow(rowMarks?.[rowKey]);
      if (!typed) continue;
      typedRows.push({
        id: String(id),
        job: null,
        bench: typed.bench,
        name: typed.name,
        bookedDays: new Set(),
        addedByHand: true,
        typed: true,
        benches: typed.bench ? [typed.bench] : [],
      });
    }
    // Marks arrive from Supabase in no guaranteed order, so sort them rather
    // than let the page reshuffle itself on a reload.
    typedRows.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
    rows.push(...typedRows);
  }

  return rows;
}

// What a cell shows. A stored mark always wins; otherwise a booked day shows
// the booked dot. The dot is DERIVED from the booking rather than stored, so
// there is no second copy of "this job is booked on Tuesday" to drift.
export function cellMark(row, dateKey, jobMarks) {
  const stored = jobMarks?.[dateKey];
  if (stored) return stored;
  return row.bookedDays.has(dateKey) ? 'dot' : '';
}

// The trailing column, and the day the row gets struck through from.
//
// Never marked by hand. A × on a day means the last piece of that job finished
// there, so the trailing column takes × too and the row is ruled off from that
// day to the end. Any other week gets > — carry it into next week.
export function trailing(weekKeys, jobMarks) {
  const doneIndex = weekKeys.findIndex(k => jobMarks?.[k] === 'cross');
  return {
    mark: doneIndex === -1 ? 'arrow' : 'cross',
    doneIndex,
  };
}

// What a row is called on the page and in the exported file.
//
// A job row reads "1714 Fender Strat" — job number first, so it always starts
// with a digit. A typed row reads "+ buy strings": the plus says the line was
// written by hand and is not a job, and it cannot be misread as a job number.
export function rowLabel(row) {
  return row?.typed ? `+ ${row.name}` : (row?.name || '');
}

// One plain readable file for the week. Text, built here and downloaded by the
// browser — nothing is written to Drive and no copy of the week is stored
// anywhere. Re-exporting always re-reads the live marks.
export function buildWeekExport({ rows, weekKeys, weekDays, marks }) {
  const dayLetters = weekDays.map(d => d.toLocaleDateString('en-NZ', { weekday: 'short' }));
  const lines = [];
  lines.push(`Guitar Garage NZ — week of ${formatDateRange(weekDays)}`);
  lines.push('');
  lines.push('  · booked    / worked    > move on    × done');
  lines.push('');

  const benches = groupByBench(rows);
  const nameWidth = Math.max(20, ...rows.map(r => rowLabel(r).length));

  const header = ' '.repeat(nameWidth + 2) + dayLetters.map(d => d.padEnd(4)).join('') + '>';
  lines.push(header);

  for (const group of benches) {
    lines.push('');
    lines.push(group.bench.toUpperCase());
    for (const row of group.rows) {
      const jobMarks = marks[row.id] || {};
      const t = trailing(weekKeys, jobMarks);
      const cells = weekKeys.map((k, i) => {
        // Past the × the row is ruled off, exactly as it reads on screen.
        if (t.doneIndex !== -1 && i > t.doneIndex) return '-'.padEnd(4, '-');
        const m = cellMark(row, k, jobMarks);
        return (m ? MARKS[m].symbol : ' ').padEnd(4);
      });
      lines.push('  ' + rowLabel(row).padEnd(nameWidth) + cells.join('') + MARKS[t.mark].symbol);
    }
  }

  if (rows.length === 0) lines.push('  (no jobs on the bench this week)');

  lines.push('');
  return lines.join('\n');
}

// Benches in the shop's own order first, then any other bench name that turns
// up in the data, then the jobs with no bench at all.
//
// The "then any other bench name" step matters: a fixed list quietly files an
// unlisted bench (Finishing, or one added later) under "No bench set", which is
// the same silent mis-filing benchColors() exists to stop.
export function groupByBench(rows) {
  const known = BENCH_ORDER.filter(b => rows.some(r => r.bench === b));
  const extra = [...new Set(rows.map(r => r.bench).filter(b => b && !BENCH_ORDER.includes(b)))].sort();
  const groups = [...known, ...extra].map(b => ({ bench: b, rows: rows.filter(r => r.bench === b) }));
  const none = rows.filter(r => !r.bench);
  if (none.length) groups.push({ bench: 'No bench set', rows: none });
  return groups;
}

// What the page draws. Same grouping as groupByBench(), except every shop bench
// is always shown even with no rows on it.
//
// That is required, not cosmetic: Trevor plans the week on Sunday, when the page
// is empty, and a bench with no heading has nowhere to hang its dropdown — the
// page could never be filled by hand at all. groupByBench() is left alone
// because buildWeekExport() uses it, and an exported week should still list only
// the benches that actually have jobs on them.
//
// `canAdd` is false for "No bench set": a job with no bench cannot be offered
// under a bench, so those rows can appear (from a booking or a mark) but nothing
// can be added there. Accepted, per the brief.
export function benchSections(rows) {
  const all = rows || [];
  const extra = [...new Set(all.map(r => r.bench).filter(b => b && !BENCH_ORDER.includes(b)))].sort();
  const groups = [...BENCH_ORDER, ...extra].map(bench => ({
    bench,
    rows: all.filter(r => r.bench === bench),
    canAdd: true,
  }));
  const none = all.filter(r => !r.bench);
  if (none.length) groups.push({ bench: 'No bench set', rows: none, canAdd: false });
  return groups;
}

// The jobs offerable under one bench: on that bench, not finished, and not
// already a row anywhere this week.
//
// "Already a row" is checked by job id against the WHOLE week's rows, not
// against this bench's rows. A job split across two benches shows as one row
// under one of them, and must not still be addable under the other — that would
// put the same guitar on the page twice, which is the one thing the one-row-per-
// job rule exists to stop.
export function addableJobs(jobs, bench, rows) {
  const all = jobs || [];
  if (!bench) return [];
  const byId = new Map(all.map(j => [j.id, j]));
  const taken = new Set((rows || []).map(r => String(r.id)));
  const out = [];

  for (const job of all) {
    if (job.parentId || job.isDerived) continue;
    if (job.done) continue;
    if (taken.has(String(job.id))) continue;
    if (rowBenchOf(job, partsOf(job, all, byId)) !== bench) continue;
    out.push({ id: String(job.id), name: rowName(job) || String(job.id), job: String(job.job ?? job.id) });
  }

  // Same oldest-first order the rows use. Sorting by name put 875 and 97 after
  // 1718, because as text "8" comes after "1".
  return out.sort((a, b) => compareJobNumber(a.job, b.job));
}

// The per-bench "add a job" picker.
//
// Kept as its own component so the option list is recomputed per bench only when
// that bench's inputs change, and so the select's own value can be reset to the
// placeholder on every pick without the page tracking one piece of state per
// bench.
function AddJobToBench({ bench, jobs, rows, ready, nameW, isMobile, onAdd }) {
  const options = useMemo(() => addableJobs(jobs, bench, rows), [jobs, bench, rows]);
  if (options.length === 0) return null;

  return (
    <div style={{ paddingLeft: 2, paddingTop: 4, paddingBottom: 2 }}>
      <select
        value=""
        disabled={!ready}
        onChange={(e) => {
          const id = e.target.value;
          e.target.value = '';
          if (id) onAdd(id);
        }}
        style={{
          width: isMobile ? '100%' : nameW, maxWidth: '100%',
          padding: '5px 8px', borderRadius: 5,
          border: '1px dashed #334155', background: '#0f172a',
          color: '#94a3b8', fontSize: 12.5,
          cursor: ready ? 'pointer' : 'default',
        }}
      >
        <option value="">+ Add a job to {bench}…</option>
        {options.map(o => (
          <option key={o.id} value={o.id}>{o.name}</option>
        ))}
      </select>
    </div>
  );
}

// The per-bench "type something that isn't a job" box.
//
// Sits under the job dropdown on every bench, and unlike that dropdown it is
// always there — it has no list that can run out. Its own text state lives here
// so the page does not track one box per bench.
function AddTaskToBench({ ready, nameW, isMobile, onAddTask }) {
  const [text, setText] = useState('');

  async function submit() {
    const name = text.trim();
    if (!name) return;
    // Cleared straight away, so a second task can be typed while the first
    // saves. A failed save says so in a toast rather than holding the box.
    setText('');
    await onAddTask(name);
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); submit(); }}
      style={{ display: 'flex', gap: 6, paddingLeft: 2, paddingTop: 4, paddingBottom: 2 }}
    >
      <input
        type="text"
        value={text}
        maxLength={MAX_TYPED_NAME}
        disabled={!ready}
        onChange={(e) => setText(e.target.value)}
        placeholder="+ Type an admin task…"
        style={{
          width: isMobile ? '100%' : nameW, maxWidth: '100%',
          padding: '5px 8px', borderRadius: 5,
          border: '1px dashed #334155', background: '#0f172a',
          color: '#cbd5e1', fontSize: 12.5,
        }}
      />
      <button
        type="submit"
        disabled={!ready || !text.trim()}
        style={{
          padding: '5px 12px', borderRadius: 5,
          border: '1px solid #334155', background: '#1e293b',
          color: text.trim() ? '#cbd5e1' : '#475569', fontSize: 12.5,
          cursor: ready && text.trim() ? 'pointer' : 'default',
        }}
      >Add</button>
    </form>
  );
}

export default function BenchWeekPage({ jobs, weekDays, marks, ready, saveError, setMark, clearJobKeys, isMobile, showToast }) {
  const weekKeys = useMemo(() => (weekDays || []).map(localDateKey), [weekDays]);
  const rows = useMemo(() => weekRows(jobs, weekKeys, marks), [jobs, weekKeys, marks]);
  const groups = useMemo(() => benchSections(rows), [rows]);
  const rowKey = useMemo(() => weekRowKey(weekKeys), [weekKeys]);

  function handleExport() {
    const text = buildWeekExport({ rows, weekKeys, weekDays, marks });
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ggnz-week-${weekKeys[0] || 'export'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast?.('Week saved to your downloads');
  }

  async function handleCell(row, dateKey) {
    if (!ready) {
      showToast?.('Not saving yet — the week marks have not loaded');
      return;
    }
    const current = cellMark(row, dateKey, marks[row.id] || {});
    const res = await setMark(row.id, dateKey, nextMark(current));
    if (!res?.ok) showToast?.('That mark did not save');
  }

  // Put a job on the week. Writes the week's row key and NOTHING else — no dot,
  // no day symbol. The row lands blank and Trevor marks the days himself, the
  // same way he does on a row that arrived from a booking.
  async function handleAdd(jobId) {
    if (!ready) {
      showToast?.('Not saving yet — the week marks have not loaded');
      return;
    }
    if (!jobId || !rowKey) return;
    const res = await setMark(jobId, rowKey, ROW_MARK);
    if (!res?.ok) showToast?.('That job did not get added to the week');
  }

  // Put a typed row on the week — admin work with no job behind it.
  // Same one write as handleAdd, so it lands just as blank; the difference is
  // that the mark carries the bench and the name, because there is no jobs[]
  // entry to read either from.
  async function handleAddTask(name) {
    if (!ready) {
      showToast?.('Not saving yet — the week marks have not loaded');
      return;
    }
    if (!rowKey) return;
    const value = encodeTypedRow(name);
    const id = newTypedRowId(weekKeys);
    if (!value || !id) return;
    const res = await setMark(id, rowKey, value);
    if (!res?.ok) showToast?.('That task did not get added to the week');
  }

  // Take a job off the week: its day marks and the week's row key go together.
  // Asks first, because it throws away marks for days already worked.
  async function handleRemove(row) {
    if (!ready) {
      showToast?.('Not saving yet — the week marks have not loaded');
      return;
    }
    const ok = window.confirm(`Take ${row.name} off this week? Any days already marked on this row are cleared.`);
    if (!ok) return;
    const res = await clearJobKeys?.(row.id, rowKey ? [...weekKeys, rowKey] : weekKeys);
    if (!res?.ok) showToast?.('That job did not come off the week');
  }

  const cellW = isMobile ? 34 : 44;
  // On a computer the job name reads first, down the left, with the days to its
  // right — same order as the exported file. Fixed width so every day column
  // still lines up under its heading.
  const nameW = 220;

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0f172a' }}>

      <div style={{
        flexShrink: 0, padding: '12px 16px', borderBottom: '1px solid #1e293b',
        display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap',
      }}>
        <span style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 700 }}>
          Week of {formatDateRange(weekDays || [])}
        </span>
        <span style={{ color: '#475569', fontSize: 12 }}>
          {/* "rows", not "jobs" — a typed row is counted here and isn't a job. */}
          {rows.length} row{rows.length === 1 ? '' : 's'}
        </span>
        <button
          type="button"
          onClick={handleExport}
          style={{
            marginLeft: 'auto', padding: '6px 14px', borderRadius: 6, cursor: 'pointer',
            border: '1px solid #334155', background: '#1e293b', color: '#cbd5e1', fontSize: 12.5,
          }}
        >Save week as a file</button>
      </div>

      {!ready && (
        <div style={{ flexShrink: 0, padding: '8px 16px', background: '#451a03', color: '#fcd34d', fontSize: 12 }}>
          {saveError || 'Loading the week marks — nothing will save until this finishes.'}
        </div>
      )}
      {ready && saveError && (
        <div style={{ flexShrink: 0, padding: '8px 16px', background: '#450a0a', color: '#fca5a5', fontSize: 12 }}>
          {saveError}
        </div>
      )}

      <div style={{ flex: 1, overflow: 'auto', padding: isMobile ? '10px 8px 40px' : 16 }}>
        {/* Key. Four symbols is the whole language of this page. */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', color: '#64748b', fontSize: 11.5, marginBottom: 10 }}>
          {Object.entries(MARKS).map(([key, m]) => (
            <span key={key}><b style={{ color: '#cbd5e1' }}>{m.symbol}</b> {m.label}</span>
          ))}
        </div>

        {/* Day headings */}
        <div style={{ display: 'flex', alignItems: 'flex-end', marginBottom: 4 }}>
          {!isMobile && <div style={{ width: nameW, flexShrink: 0 }} />}
          {(weekDays || []).map((d, i) => (
            <div key={weekKeys[i]} style={{
              width: cellW, textAlign: 'center', fontSize: 11, fontWeight: 700,
              color: '#94a3b8', textTransform: 'uppercase',
            }}>{d.toLocaleDateString('en-NZ', { weekday: 'short' })[0]}</div>
          ))}
          <div style={{ width: cellW, textAlign: 'center', fontSize: 11, fontWeight: 700, color: '#475569' }}>&gt;</div>
          <div style={{ flex: 1, minWidth: 0 }} />
        </div>

        {rows.length === 0 && (
          <div style={{ color: '#475569', fontSize: 13, padding: '16px 2px' }}>
            Nothing on the bench this week yet — add jobs to a bench below.
          </div>
        )}

        {groups.map(group => (
          <section key={group.bench} style={{ marginBottom: 14 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase',
              color: benchColors(group.bench).text || '#cbd5e1',
              borderBottom: `1px solid ${benchColors(group.bench).border || '#1e293b'}`,
              // Sits at the left, over the job names it heads.
              paddingBottom: 3, marginBottom: 4, paddingLeft: 0,
            }}>{group.bench}</div>

            {group.rows.map(row => {
              const jobMarks = marks[row.id] || {};
              const t = trailing(weekKeys, jobMarks);
              // The name comes first: to the left of the marks on a computer,
              // above them on the phone — there isn't the width to put both on
              // one line.
              const nameStyle = {
                flex: 'none', width: isMobile ? 'auto' : nameW, minWidth: 0,
                fontSize: isMobile ? 12.5 : 13, color: '#e2e8f0',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                paddingLeft: 2, paddingRight: isMobile ? 0 : 8, paddingBottom: isMobile ? 2 : 0,
                textDecoration: t.doneIndex !== -1 ? 'line-through' : 'none',
                opacity: t.doneIndex !== -1 ? 0.55 : 1,
              };
              return (
                <div key={row.id} style={{
                  display: 'flex', flexDirection: isMobile ? 'column' : 'row',
                  alignItems: isMobile ? 'stretch' : 'center',
                  minHeight: 32, marginBottom: isMobile ? 8 : 0, position: 'relative',
                }}>
                  <div style={nameStyle}>
                    {/* The dim + says this line was typed by hand and has no job
                        number. Kept out of row.name so the Remove question and
                        the tooltip still read as plain words. */}
                    {row.typed && <span style={{ color: '#64748b' }}>+ </span>}
                    {row.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', flex: isMobile ? 'none' : 'initial' }}>
                  {weekKeys.map((k, i) => {
                    const m = cellMark(row, k, jobMarks);
                    // The rule-off runs from the × to the end of the row. It is
                    // drawn, never stored and never tapped in.
                    const ruled = t.doneIndex !== -1 && i > t.doneIndex;
                    return (
                      <button
                        key={k}
                        type="button"
                        onClick={() => handleCell(row, k)}
                        title={m ? MARKS[m].label : 'blank'}
                        style={{
                          width: cellW, height: 30, cursor: ready ? 'pointer' : 'default',
                          border: '1px solid #1e293b', borderRadius: 4, margin: '1px 0',
                          background: ruled ? '#0b1220' : '#111c2f',
                          color: m === 'cross' ? '#f87171' : m === 'slash' ? '#34d399' : '#cbd5e1',
                          fontSize: 16, lineHeight: 1, padding: 0,
                          position: 'relative',
                        }}
                      >
                        {ruled ? '' : (m ? MARKS[m].symbol : '')}
                        {ruled && (
                          <span style={{
                            position: 'absolute', left: 0, right: 0, top: '50%',
                            borderTop: '1px solid #f87171', opacity: 0.7,
                          }} />
                        )}
                      </button>
                    );
                  })}

                  {/* Trailing column — derived, never tapped. */}
                  <div style={{
                    width: cellW, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: t.mark === 'cross' ? '#f87171' : '#475569', fontSize: 16,
                  }}>{MARKS[t.mark].symbol}</div>

                  {/* Take the job off the week.
                      Only on rows with no booking this week — a booked job is on
                      the page BECAUSE of its booking, and clearing marks would
                      not remove it. Offering a button that visibly does nothing
                      is worse than not offering one. */}
                  {row.bookedDays.size === 0 && (
                    <button
                      type="button"
                      onClick={() => handleRemove(row)}
                      disabled={!ready}
                      title={`Take ${row.name} off this week`}
                      style={{
                        marginLeft: 8, padding: '3px 9px', borderRadius: 5,
                        border: '1px solid #334155', background: 'transparent',
                        color: '#64748b', fontSize: 11.5,
                        cursor: ready ? 'pointer' : 'default',
                      }}
                    >Remove</button>
                  )}
                  </div>
                </div>
              );
            })}

            {/* Add a job to this bench for this week.
                A plain select, so the phone gives its own full-screen picker
                rather than a cramped custom menu. It never holds a value: it
                fires on pick and resets, because the list itself changes the
                moment the job becomes a row. */}
            {group.canAdd && (
              <AddJobToBench
                bench={group.bench}
                jobs={jobs}
                rows={rows}
                ready={ready}
                nameW={nameW}
                isMobile={isMobile}
                onAdd={handleAdd}
              />
            )}

            {/* Type a task that has no job number — the Admin bench only, since
                this is Trevor's admin to-do list, not something a repair bench
                keeps. Rendered separately from the dropdown above, which
                disappears once a bench has no addable jobs left; this box has no
                list to run out, so it is always here on Admin. */}
            {group.canAdd && group.bench === TYPED_ROW_BENCH && (
              <AddTaskToBench
                ready={ready}
                nameW={nameW}
                isMobile={isMobile}
                onAddTask={handleAddTask}
              />
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
