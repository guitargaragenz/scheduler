// Brief G, Build 1b — the Jobs Sheet page.
//
// This is what replaces the Google Sheet. Every top-level job, one row each,
// with the six columns Trevor owns editable and the six Multitrack reports
// greyed out beside them for context. Nothing saves until he presses Commit.
//
// Deliberately not autosaving. The Sheet never did, this page is where a whole
// morning's triage gets typed in one pass, and a half-typed Action is a job in
// the wrong pile. One button, one write, one confirmation.

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { isTopLevelJob } from '../data/pdfImportPlan.js';
import { batchWriteJobsState, isSupabaseConfigured } from '../utils/supabase.js';
import {
  TAG_OPTIONS,
  ACTION_OPTIONS,
  withLegacyOption,
  applyTagToDraft,
  initialRowDraft,
  draftChanges,
  buildSheetWrites,
  parseHoursInput,
  isHoursInputInvalid,
} from '../data/jobsSheet.js';

const C = {
  bg: '#ffffff',
  line: '#d1d5db',
  edge: '#cbd5e1',
  text: '#1e293b',
  bright: '#0f172a',
  dim: '#64748b',
  dimmer: '#94a3b8',
  accent: '#4f46e5',
  accentText: '#4338ca',
  warn: '#b45309',
  bad: '#dc2626',
  good: '#16a34a',
};

// The look is deliberately a spreadsheet's, not a web table's: ruled lines in
// both directions, banded rows, a frozen job column, and cells that are plain
// until you're in them. The first cut drew a bordered input inside every
// bordered cell — a hundred little frames on screen — which is what made it
// unreadable. A cell here shows its border only on hover and focus.
//
// White cells, grey gridlines, dark text — Trevor's own words: "like the
// sheet". This table is its own island; nothing outside JobsSheetPage
// changes colour off the back of this.
const SHEET_CSS = `
.gsheet { border-collapse: separate; border-spacing: 0; width: 100%; table-layout: fixed;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }

.gsheet th, .gsheet td {
  border-right: 1px solid #e2e8f0;
  border-bottom: 1px solid #e2e8f0;
  padding: 0 8px;
  height: 30px;
  font-size: 12.5px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.gsheet th:last-child, .gsheet td:last-child { border-right: none; }

/* Column headers — the grey strip along the top of a spreadsheet. */
.gsheet th {
  position: sticky; top: 0; z-index: 3;
  background: #f1f5f9; color: #64748b;
  border-bottom: 1px solid #cbd5e1;
  font-size: 10.5px; font-weight: 600; letter-spacing: .07em;
  text-transform: uppercase; text-align: left;
}
.gsheet th.mine { background: #eef2ff; color: #4338ca; }

/* Banded rows, and a highlight for the row under the pointer. */
.gsheet tbody tr:nth-child(even) td { background: #ffffff; }
.gsheet tbody tr:nth-child(odd)  td { background: #f8fafc; }
.gsheet tbody tr:hover td { background: #eff6ff; }
.gsheet tbody tr.dirty td { background: #fef9c3; }

/* Multitrack's columns: present, but quiet — readable on white, just not
   as dark as the columns Trevor owns. */
.gsheet td.ro { color: #475569; }

/* The six columns that are Trevor's. Darker, and fenced off on the left
   the way a shaded input range is in Sheets. */
.gsheet td.mine { color: #0f172a; }
.gsheet th.fence, .gsheet td.fence { border-left: 2px solid #c7d2fe; }

/* Frozen job-number column — the row label you scroll against. */
.gsheet th.freeze, .gsheet td.freeze {
  position: sticky; left: 0; z-index: 2;
  border-right: 1px solid #cbd5e1;
  font-variant-numeric: tabular-nums; font-weight: 600; color: #475569;
}
.gsheet th.freeze { z-index: 4; }
.gsheet tbody tr:nth-child(even) td.freeze { background: #f8fafc; }
.gsheet tbody tr:nth-child(odd)  td.freeze { background: #f1f5f9; }
.gsheet tbody tr:hover td.freeze { background: #e0e7ff; }

.gsheet td.num { text-align: right; font-variant-numeric: tabular-nums; }
.gsheet td.mid { text-align: center; }

/* A cell you can type in is a plain cell until you touch it. */
.gcell {
  width: 100%; height: 29px; box-sizing: border-box;
  background: transparent; border: 1px solid transparent; border-radius: 0;
  padding: 0 2px; margin: 0;
  color: inherit; font: inherit; font-size: 12.5px;
  -webkit-appearance: none; appearance: none;
}
.gsheet td:hover > .gcell { border-color: #cbd5e1; }
.gcell:focus { outline: none; border: 2px solid #6366f1; padding: 0 1px; background: #ffffff; }
select.gcell { cursor: pointer; }
.gcell.bad { color: #dc2626; border-color: #dc2626; }
/* Three ticked columns across 53 rows is 159 boxes. Left as browser default
   they are 159 white squares and the loudest thing on the page, so an unticked
   box is drawn as a plain outlined square and only a tick has any colour. */
.gsheet input[type=checkbox] {
  -webkit-appearance: none; appearance: none;
  width: 13px; height: 13px; margin: 0; vertical-align: middle;
  border: 1px solid #cbd5e1; border-radius: 2px; background: #ffffff;
  position: relative;
}
.gsheet input[type=checkbox]:checked { background: #4f46e5; border-color: #4f46e5; }
.gsheet input[type=checkbox]:checked::after {
  content: ''; position: absolute; left: 3.5px; top: 0.5px;
  width: 3px; height: 7px; border: solid #fff;
  border-width: 0 2px 2px 0; transform: rotate(45deg);
}
.gsheet input[type=checkbox]:disabled { opacity: .55; }

/* Column resizers — a drag strip on the right edge of every header cell, the
   same as the boundary between column letters in Sheets. Each grip resizes the
   column to its LEFT, which is what makes a column feel draggable from both
   sides: Desc's own grip widens Desc, and the grip on Status (Desc's left
   boundary) narrows Status and hands the room to Desc.
   overflow:visible so the grip is not clipped by the cell's own ellipsis rule. */
.gsheet th { overflow: visible; }
.gsheet th .colgrip {
  position: absolute; top: 0; right: -3px; width: 7px; height: 100%;
  cursor: col-resize; z-index: 5; background: transparent;
  border: none; padding: 0;
}
.gsheet th .colgrip::after {
  content: ''; position: absolute; top: 4px; bottom: 4px; left: 3px;
  width: 1px; background: #94a3b8; opacity: 0; transition: opacity .12s;
}
.gsheet th .colgrip:hover::after,
.gsheet th .colgrip.dragging::after { opacity: 1; background: #4f46e5; width: 2px; }
`;

// The grid, in order. `width` is the default; null means "no width of its own"
// — Desc soaks up whatever the other eleven leave over, which is how the page
// behaved before any of this and what a reset returns to.
//
// `cls` mirrors what the header and body cells already carried: `freeze` is the
// sticky job-number column, `mine` marks the six columns Trevor owns and
// `fence` draws the shaded-range line down the left of them.
const COLUMNS = Object.freeze([
  { key: 'job',      label: 'Job',      width: 58,  cls: 'freeze' },
  { key: 'customer', label: 'Customer', width: 150, cls: '' },
  { key: 'mfr',      label: 'Mfr',      width: 100, cls: '' },
  { key: 'model',    label: 'Model',    width: 130, cls: '' },
  { key: 'status',   label: 'Status',   width: 92,  cls: '' },
  { key: 'desc',     label: 'Desc',     width: null, cls: '' },
  { key: 'tag',      label: 'Tag',      width: 72,  cls: 'mine fence' },
  { key: 'hours',    label: 'Hours',    width: 68,  cls: 'mine' },
  { key: 'action',   label: 'Action',   width: 86,  cls: 'mine' },
  { key: 'vb',       label: 'VB',       width: 40,  cls: 'mine' },
  { key: 'bl',       label: 'BL',       width: 40,  cls: 'mine' },
  { key: 'pj',       label: 'PJ',       width: 40,  cls: 'mine' },
]);

// Below this a column is unreadable and, worse, its grip lands on top of the
// next one's and the grid becomes impossible to drag back out.
const COL_MIN_PX = 36;
const COL_WIDTHS_KEY = 'ggnz.jobsSheet.colWidths';

export default function JobsSheetPage({ jobs, onBack, isMobile = false, onSaved }) {
  // Top-level jobs only. Split and derived cards have ids like
  // 1620_Electronics_0 and are the app's own bookkeeping — Trevor never triages
  // them here, and the Multitrack columns would be meaningless on them.
  const rows = useMemo(() => {
    return (jobs || [])
      .filter(isTopLevelJob)
      .slice()
      .sort((a, b) => Number(b.id) - Number(a.id));
  }, [jobs]);

  const [drafts, setDrafts] = useState({});
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null); // { ok, text }

  // Dragged column widths, keyed by COLUMNS key. A key that is absent means
  // "still at its default" — so an empty object is the untouched grid, and
  // resetting a column is a delete rather than a value. Kept in localStorage:
  // these are workspace preferences, not job data, and re-dragging them on
  // every visit is the thing being fixed.
  const [colWidths, setColWidths] = useState(() => {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(COL_WIDTHS_KEY) || '{}');
      const clean = {};
      for (const c of COLUMNS) {
        const n = Number(parsed?.[c.key]);
        if (Number.isFinite(n) && n >= COL_MIN_PX) clean[c.key] = n;
      }
      return clean;
    } catch {
      return {}; // private mode, or a stored value we can no longer parse
    }
  });
  const [draggingKey, setDraggingKey] = useState(null);
  const colRefs = useRef({});

  useEffect(() => {
    try {
      if (Object.keys(colWidths).length === 0) window.localStorage.removeItem(COL_WIDTHS_KEY);
      else window.localStorage.setItem(COL_WIDTHS_KEY, JSON.stringify(colWidths));
    } catch {
      // Storage unavailable. The widths still apply for this session.
    }
  }, [colWidths]);

  const widthOf = useCallback(
    col => (colWidths[col.key] !== undefined ? colWidths[col.key] : col.width),
    [colWidths]
  );

  // Once ANY column has been dragged the table has to size to its own columns
  // rather than to the container: table-layout:fixed rescales specified widths
  // to fill a width:100% table, so a widened column would otherwise just squash
  // its neighbours back. Desc is the one column allowed no width of its own, so
  // while it is still on auto there is nothing to overflow and 100% is right.
  const totalWidth = useMemo(() => {
    if (widthOf(COLUMNS[5]) === null) return null; // Desc still auto
    return COLUMNS.reduce((sum, c) => sum + (widthOf(c) ?? 0), 0);
  }, [widthOf]);

  // Drag to resize. Every grip resizes the column it sits on — i.e. the one to
  // the LEFT of the boundary being dragged, exactly as a spreadsheet does. That
  // is what lets Desc be widened from either side: its own grip pushes its right
  // edge out, and Status's grip pulls Desc's left edge in.
  //
  // Starting width is measured off the rendered header cell rather than taken
  // from state, so the first drag on a column still at auto picks up where it
  // actually sits instead of jumping to a guess. The header cell is measured,
  // not the <col>: browsers disagree on whether a <col> reports a layout box.
  const startResize = useCallback((e, col) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth =
      colRefs.current[col.key]?.getBoundingClientRect().width ?? col.width ?? COL_MIN_PX;
    setDraggingKey(col.key);

    const onMove = ev => {
      const next = Math.max(COL_MIN_PX, Math.round(startWidth + (ev.clientX - startX)));
      setColWidths(prev => (prev[col.key] === next ? prev : { ...prev, [col.key]: next }));
    };
    const onUp = () => {
      setDraggingKey(null);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  // Double-click a grip to put that one column back to its default — the escape
  // hatch for a column dragged somewhere silly.
  const resetResize = useCallback(col => {
    setColWidths(prev => {
      if (prev[col.key] === undefined) return prev;
      const next = { ...prev };
      delete next[col.key];
      return next;
    });
  }, []);

  const draftFor = useCallback(
    (job) => drafts[job.id] || initialRowDraft(job),
    [drafts]
  );

  const setDraft = useCallback((job, next) => {
    setResult(null);
    setDrafts(prev => ({ ...prev, [job.id]: next }));
  }, []);

  // Drafts for every row that has been touched, keyed by id — what the write
  // builder and the changed-count both read.
  const dirty = useMemo(() => {
    const out = [];
    for (const job of rows) {
      const d = drafts[job.id];
      if (!d) continue;
      const changes = draftChanges(job, d);
      if (Object.keys(changes).length > 0) out.push({ job, changes });
    }
    return out;
  }, [rows, drafts]);

  const invalidCount = useMemo(() => {
    return Object.values(drafts).filter(d => isHoursInputInvalid(d.hoursText)).length;
  }, [drafts]);

  const commit = useCallback(async () => {
    if (saving || dirty.length === 0) return;
    if (!isSupabaseConfigured()) {
      setResult({ ok: false, text: 'Not connected to the database — nothing was saved.' });
      return;
    }
    const writes = buildSheetWrites(rows, drafts);
    if (writes.length === 0) return;

    setSaving(true);
    setResult(null);
    const res = await batchWriteJobsState(writes);
    setSaving(false);

    if (!res || !res.ok) {
      setResult({ ok: false, text: 'Save failed — nothing was changed. Your edits are still on screen.' });
      return;
    }

    // Saved. Hand the same changes back so the board matches the database
    // without waiting for a reload, then clear the drafts so the rows read
    // from the live job again.
    if (onSaved) {
      const updates = {};
      for (const w of writes) {
        const { job: _jobNo, ...fields } = w.data;
        updates[w.id] = fields;
      }
      onSaved(updates);
    }
    setDrafts({});
    setResult({ ok: true, text: `Saved ${writes.length} job${writes.length === 1 ? '' : 's'}.` });
  }, [saving, dirty.length, rows, drafts, onSaved]);

  const discard = useCallback(() => {
    setDrafts({});
    setResult(null);
  }, []);

  const editable = !isMobile;

  return (
    <div style={{
      flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column',
      background: C.bg, color: C.text,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      <style>{SHEET_CSS}</style>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
        padding: '12px 18px', borderBottom: `1px solid ${C.line}`, background: C.bg,
      }}>
        {onBack && (
          <button onClick={onBack} style={{
            background: 'none', border: `1px solid ${C.edge}`, borderRadius: 6,
            color: C.dim, fontSize: 13, padding: '5px 12px', cursor: 'pointer',
            fontFamily: 'inherit',
          }}>← Scheduler</button>
        )}

        <div style={{ flex: 1, minWidth: 180 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.bright }}>Jobs Sheet</div>
          <div style={{ fontSize: 11, color: C.dimmer }}>
            {rows.length} job{rows.length === 1 ? '' : 's'} · greyed columns come from Multitrack
          </div>
        </div>

        {editable && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {invalidCount > 0 && (
              <span style={{ fontSize: 11, color: C.warn }}>
                {invalidCount} hours box{invalidCount === 1 ? '' : 'es'} unreadable — not saved
              </span>
            )}
            {result && (
              <span style={{ fontSize: 11, color: result.ok ? C.good : C.bad }}>{result.text}</span>
            )}
            <span style={{ fontSize: 11, color: dirty.length ? C.accentText : C.dimmer }}>
              {dirty.length === 0 ? 'No changes' : `${dirty.length} changed`}
            </span>
            <button
              onClick={discard}
              disabled={dirty.length === 0 || saving}
              style={{
                background: 'none', border: `1px solid ${C.edge}`, borderRadius: 6,
                color: C.dim, fontSize: 12, padding: '5px 12px', fontFamily: 'inherit',
                cursor: dirty.length === 0 || saving ? 'default' : 'pointer',
                opacity: dirty.length === 0 || saving ? 0.4 : 1,
              }}
            >Discard</button>
            <button
              onClick={commit}
              disabled={dirty.length === 0 || saving}
              style={{
                background: dirty.length === 0 || saving ? '#1e293b' : C.accent,
                border: 'none', borderRadius: 6, color: '#fff', fontSize: 12,
                fontWeight: 700, padding: '6px 18px', fontFamily: 'inherit',
                cursor: dirty.length === 0 || saving ? 'default' : 'pointer',
                opacity: dirty.length === 0 || saving ? 0.5 : 1,
              }}
            >{saving ? 'Saving…' : 'Commit'}</button>
          </div>
        )}
      </div>

      {isMobile && (
        <div style={{
          padding: '8px 18px', fontSize: 11, color: C.warn,
          borderBottom: `1px solid ${C.line}`,
        }}>
          Read-only on a phone — a grid this wide is not editable with a thumb.
          Open the Jobs Sheet on the iMac to make changes.
        </div>
      )}

      {/* Grid */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {rows.length === 0 ? (
          <div style={{ color: C.dimmer, fontSize: 13, textAlign: 'center', padding: 40 }}>
            No jobs on the board.
          </div>
        ) : (
          <table
            className="gsheet"
            style={totalWidth === null ? undefined : { width: totalWidth, minWidth: '100%' }}
          >
            <colgroup>
              {COLUMNS.map(col => {
                const w = widthOf(col);
                return <col key={col.key} style={w === null ? undefined : { width: w }} />;
              })}
            </colgroup>
            <thead>
              <tr>
                {COLUMNS.map(col => (
                  <th
                    key={col.key}
                    ref={el => { colRefs.current[col.key] = el; }}
                    className={col.cls || undefined}
                  >
                    {col.label}
                    <button
                      type="button"
                      className={draggingKey === col.key ? 'colgrip dragging' : 'colgrip'}
                      onMouseDown={e => startResize(e, col)}
                      onDoubleClick={() => resetResize(col)}
                      title={`Drag to resize ${col.label} · double-click to reset`}
                      aria-label={`Resize the ${col.label} column`}
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(job => {
                const d = draftFor(job);
                const changed = Object.keys(draftChanges(job, d)).length > 0;
                const badHours = isHoursInputInvalid(d.hoursText);
                const avg = !badHours && /-/.test(String(d.hoursText || '')) ? parseHoursInput(d.hoursText) : null;

                return (
                  <tr key={job.id} className={changed ? 'dirty' : undefined}>
                    <td className="ro freeze">{job.job}</td>
                    <td className="ro" title={job.customer || ''}>{job.customer}</td>
                    <td className="ro" title={job.mfr || ''}>{job.mfr}</td>
                    <td className="ro" title={job.model || ''}>{job.model}</td>
                    <td className="ro">{job.status}</td>
                    <td className="ro" title={job.desc || ''}>{job.desc}</td>

                    {/* Tag — picking one fills in the matching hours */}
                    <td className="mine fence">
                      {editable ? (
                        <select
                          className="gcell"
                          value={d.tag ?? ''}
                          onChange={e => setDraft(job, applyTagToDraft(d, e.target.value))}
                        >
                          {withLegacyOption(TAG_OPTIONS, d.tag).map(o => (
                            <option key={o || '_blank'} value={o}>{o || '—'}</option>
                          ))}
                        </select>
                      ) : (d.tag || '—')}
                    </td>

                    {/* Hours — accepts a range like 2-4, saved as the average */}
                    <td className="mine num">
                      {editable ? (
                        <input
                          className={badHours ? 'gcell bad' : 'gcell'}
                          style={{ textAlign: 'right' }}
                          value={d.hoursText}
                          onChange={e => setDraft(job, { ...d, hoursText: e.target.value })}
                          title={avg !== null ? `Saves as ${avg}` : undefined}
                        />
                      ) : (d.hoursText || '—')}
                    </td>

                    {/* Action — a list, never free text: it sorts the piles */}
                    <td className="mine">
                      {editable ? (
                        <select
                          className="gcell"
                          value={d.action ?? ''}
                          onChange={e => setDraft(job, { ...d, action: e.target.value })}
                        >
                          {withLegacyOption(ACTION_OPTIONS, d.action).map(o => (
                            <option key={o || '_blank'} value={o}>{o || '—'}</option>
                          ))}
                        </select>
                      ) : (d.action || '—')}
                    </td>

                    {['vb', 'backlog', 'project'].map(field => (
                      <td key={field} className="mine mid">
                        <input
                          type="checkbox"
                          checked={!!d[field]}
                          disabled={!editable}
                          onChange={e => setDraft(job, { ...d, [field]: e.target.checked })}
                          style={{ cursor: editable ? 'pointer' : 'default' }}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
