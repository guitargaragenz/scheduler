// Brief G, Build 1b — the Jobs Sheet page.
//
// This is what replaces the Google Sheet. Every top-level job, one row each,
// with the six columns Trevor owns editable and the six Multitrack reports
// greyed out beside them for context. Nothing saves until he presses Commit.
//
// Deliberately not autosaving. The Sheet never did, this page is where a whole
// morning's triage gets typed in one pass, and a half-typed Action is a job in
// the wrong pile. One button, one write, one confirmation.

import { useState, useMemo, useCallback } from 'react';
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
  bg: '#0d1117',
  panel: '#111827',
  line: '#1e293b',
  edge: '#334155',
  text: '#e2e8f0',
  bright: '#f1f5f9',
  dim: '#64748b',
  dimmer: '#475569',
  accent: '#4f46e5',
  accentText: '#a5b4fc',
  warn: '#f59e0b',
  bad: '#ef4444',
  good: '#22c55e',
};

const cellBase = {
  padding: '5px 8px',
  borderBottom: `1px solid ${C.line}`,
  fontSize: 12,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
};

const readOnlyCell = { ...cellBase, color: C.dim, background: '#0b0f16' };
const editCell = { ...cellBase, color: C.bright, background: C.panel };

const inputStyle = {
  width: '100%',
  background: '#0d1117',
  border: `1px solid ${C.edge}`,
  borderRadius: 4,
  padding: '3px 6px',
  color: C.bright,
  fontSize: 12,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
};

function headerCell(label, editable) {
  return (
    <th
      key={label}
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 2,
        background: editable ? '#161e2e' : '#0b0f16',
        color: editable ? C.accentText : C.dimmer,
        borderBottom: `1px solid ${C.edge}`,
        padding: '7px 8px',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '.08em',
        textTransform: 'uppercase',
        textAlign: 'left',
      }}
    >
      {label}
    </th>
  );
}

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
      background: C.bg, color: C.text, fontFamily: "'Courier New', monospace",
    }}>
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
          <table style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: 62 }} />{/* Job */}
              <col style={{ width: 150 }} />{/* Customer */}
              <col style={{ width: 110 }} />{/* Mfr */}
              <col style={{ width: 130 }} />{/* Model */}
              <col style={{ width: 96 }} />{/* Status */}
              <col />{/* Desc */}
              <col style={{ width: 74 }} />{/* Tag */}
              <col style={{ width: 74 }} />{/* Hours */}
              <col style={{ width: 88 }} />{/* Action */}
              <col style={{ width: 42 }} />{/* VB */}
              <col style={{ width: 42 }} />{/* BL */}
              <col style={{ width: 42 }} />{/* PJ */}
            </colgroup>
            <thead>
              <tr>
                {headerCell('Job', false)}
                {headerCell('Customer', false)}
                {headerCell('Mfr', false)}
                {headerCell('Model', false)}
                {headerCell('Status', false)}
                {headerCell('Desc', false)}
                {headerCell('Tag', true)}
                {headerCell('Hours', true)}
                {headerCell('Action', true)}
                {headerCell('VB', true)}
                {headerCell('BL', true)}
                {headerCell('PJ', true)}
              </tr>
            </thead>
            <tbody>
              {rows.map(job => {
                const d = draftFor(job);
                const changed = Object.keys(draftChanges(job, d)).length > 0;
                const badHours = isHoursInputInvalid(d.hoursText);
                const avg = !badHours && /-/.test(String(d.hoursText || '')) ? parseHoursInput(d.hoursText) : null;

                return (
                  <tr key={job.id} style={{ background: changed ? '#141d33' : 'transparent' }}>
                    <td style={{ ...readOnlyCell, color: C.dim, fontWeight: 700 }}>{job.job}</td>
                    <td style={readOnlyCell} title={job.customer || ''}>{job.customer}</td>
                    <td style={readOnlyCell} title={job.mfr || ''}>{job.mfr}</td>
                    <td style={readOnlyCell} title={job.model || ''}>{job.model}</td>
                    <td style={readOnlyCell}>{job.status}</td>
                    <td style={readOnlyCell} title={job.desc || ''}>{job.desc}</td>

                    {/* Tag — picking one fills in the matching hours */}
                    <td style={editCell}>
                      {editable ? (
                        <select
                          value={d.tag ?? ''}
                          onChange={e => setDraft(job, applyTagToDraft(d, e.target.value))}
                          style={inputStyle}
                        >
                          {withLegacyOption(TAG_OPTIONS, d.tag).map(o => (
                            <option key={o || '_blank'} value={o}>{o || '—'}</option>
                          ))}
                        </select>
                      ) : (d.tag || '—')}
                    </td>

                    {/* Hours — accepts a range like 2-4, saved as the average */}
                    <td style={editCell}>
                      {editable ? (
                        <input
                          value={d.hoursText}
                          onChange={e => setDraft(job, { ...d, hoursText: e.target.value })}
                          placeholder="e.g. 3 or 2-4"
                          title={avg !== null ? `Saves as ${avg}` : undefined}
                          style={{
                            ...inputStyle,
                            borderColor: badHours ? C.bad : C.edge,
                            color: badHours ? C.bad : C.bright,
                          }}
                        />
                      ) : (d.hoursText || '—')}
                    </td>

                    {/* Action — a list, never free text: it sorts the piles */}
                    <td style={editCell}>
                      {editable ? (
                        <select
                          value={d.action ?? ''}
                          onChange={e => setDraft(job, { ...d, action: e.target.value })}
                          style={inputStyle}
                        >
                          {withLegacyOption(ACTION_OPTIONS, d.action).map(o => (
                            <option key={o || '_blank'} value={o}>{o || '—'}</option>
                          ))}
                        </select>
                      ) : (d.action || '—')}
                    </td>

                    {['vb', 'backlog', 'project'].map(field => (
                      <td key={field} style={{ ...editCell, textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={!!d[field]}
                          disabled={!editable}
                          onChange={e => setDraft(job, { ...d, [field]: e.target.checked })}
                          style={{ width: 14, height: 14, accentColor: C.accent, cursor: editable ? 'pointer' : 'default' }}
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
