import { useState, useEffect, useCallback } from 'react';
import { getJobSplits, buildManualInvoiceJob, BENCH_COLORS, canInvoiceJob, getUndonePieces } from '../data/jobs.js';
import { formatMoney } from '../utils/money.js';

const ACTIONS = ['kept', 'dropped', 'deferred', 'completed'];

function PieceStatusLine({ job, jobs, onMarkPieceDone }) {
  if (!job || (!job.hasSubtasks && !job.isSplit)) return null;

  const children = job.hasSubtasks
    ? jobs.filter(j => job.subtasks?.includes(j.id))
    : jobs.filter(j => j.parentId === job.id);

  if (children.length === 0) return null;

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
      {children.map(child => (
        <button
          key={child.id}
          onClick={() => onMarkPieceDone(job.id, child.id, !child.pieceDone)}
          title={`Click to mark ${child.bench} ${child.pieceDone ? 'undone' : 'done'}`}
          style={{
            background: child.pieceDone ? '#1a2e1a' : 'transparent',
            border: `1px solid ${child.pieceDone ? '#4a9e5a' : '#444'}`,
            color: child.pieceDone ? '#4a9e5a' : '#666',
            borderRadius: 6,
            padding: '4px 8px',
            fontSize: 11,
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            transition: 'all 0.15s',
            textDecoration: child.pieceDone ? 'line-through' : 'none',
          }}
          onMouseEnter={e => {
            if (!child.pieceDone) e.currentTarget.style.borderColor = '#666';
          }}
          onMouseLeave={e => {
            if (!child.pieceDone) e.currentTarget.style.borderColor = '#444';
          }}
        >
          {child.pieceDone ? '✓' : '○'} {child.bench}
        </button>
      ))}
    </div>
  );
}

const ACTION_STYLES = {
  kept:      { background: '#1a2e1a', color: '#4a9e5a' },
  dropped:   { background: '#2a1a1a', color: '#9e4a4a' },
  deferred:  { background: '#1a1a2e', color: '#4a5a9e' },
  completed: { background: '#1a2536', color: '#5b9bd5' },
};

const ACTION_LABELS = {
  kept:      'Keep',
  dropped:   'Drop',
  deferred:  'Defer',
  completed: 'Job complete',
};

const ACTION_EXPLANATIONS = {
  kept:      "appears at top of tomorrow's log",
  dropped:   'stays in history, gone from view',
  deferred:  'returns to job shelf',
  completed: 'marks done and invoices',
};

// Same detail JobCard.jsx already shows on a split's calendar card — which
// bench piece this is (note/label, falling back to a trimmed desc) so a
// split job isn't just an anonymous bench name here.
function BenchChips({ splits }) {
  if (!splits.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
      {splits.map((s, i) => {
        const colors = BENCH_COLORS[s.bench] || BENCH_COLORS.Admin;
        const detail = s.sessionNote || s.label
          || (() => { const t = s.splitDesc ?? s.desc; return t ? t.slice(0, 60) + (t.length > 60 ? '…' : '') : null; })();
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
            <span
              style={{
                background: colors.bg, color: colors.text, border: `1px solid ${colors.border}`,
                borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 600, flexShrink: 0,
              }}
            >
              {s.bench}{s.hours ? ` · ${s.hours}h` : ''}
              {s.sessionIndex && s.sessionTotal > 1 ? ` (${s.sessionIndex}/${s.sessionTotal})` : ''}
            </span>
            {detail && (
              <span style={{
                fontSize: 11, color: s.sessionNote ? '#fbbf24' : 'rgba(255,255,255,0.5)',
                fontStyle: s.sessionNote ? 'italic' : 'normal',
              }}>
                {detail}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Matches the "bench · hours · action" subtitle DailyLogPage's BulletRow shows,
// so a split job's individual sub-tasks are distinguishable here too.
function BulletMeta({ meta }) {
  if (!meta) return null;
  const line = [meta.bench, meta.hoursRange ? `${meta.hoursRange}h` : null, meta.action]
    .filter(Boolean).join(' · ');
  if (!line) return null;
  return (
    <div style={{ fontSize: 11, color: '#64748b', marginBottom: 12 }}>
      {line}
    </div>
  );
}

// Job already gone from the live jobs[] array (finished + synced out via the
// CSV/Sheet pipeline). Surfaces which case this is instead of silently
// letting "Job complete" resolve with no explanation.
function JobStatusNote({ job, completedRecord, hasJobId }) {
  if (job) return null;
  if (completedRecord) {
    return (
      <div style={{ fontSize: 11, color: '#4a9e5a', marginBottom: 12 }}>
        ✓ Already invoiced ${formatMoney(completedRecord.invoiceAmount)}
      </div>
    );
  }
  if (hasJobId) {
    return (
      <div style={{ fontSize: 11, color: '#666', marginBottom: 4 }}>
        No matching job found — enter an amount below if it still needs invoicing,
        or leave blank to just mark it done.
      </div>
    );
  }
  return null;
}

function ActionRow({ selected, reason, onSelect, onReasonChange, invoiceJob, amount, onAmountChange, jobs = [] }) {
  const showInvoice = selected === 'completed' && invoiceJob;
  const canInvoice = !invoiceJob || canInvoiceJob(invoiceJob, jobs);
  const undonePieces = invoiceJob ? getUndonePieces(invoiceJob, jobs) : [];
  const invoiceBlockReason = undonePieces.length > 0
    ? `Waiting for: ${undonePieces.map(p => p.bench).join(', ')}`
    : null;

  return (
    <div>
      <div style={{ display: 'flex', gap: 8 }}>
        {ACTIONS.map(action => {
          const isSelected = selected === action;
          const isInvoiceAction = action === 'completed';
          const isDisabled = isInvoiceAction && !canInvoice;

          return (
            <button
              key={action}
              onClick={() => !isDisabled && onSelect(action)}
              title={isDisabled ? invoiceBlockReason : ''}
              style={{
                ...ACTION_STYLES[action],
                border: 'none', borderRadius: 6, padding: '6px 14px',
                fontSize: 13, fontWeight: 500, cursor: isDisabled ? 'not-allowed' : 'pointer',
                opacity: (selected === null || isSelected) && !isDisabled ? 1 : isDisabled ? 0.4 : 0.4,
                transition: 'opacity 0.15s',
                outline: isSelected ? `1px solid ${ACTION_STYLES[action].color}` : 'none',
              }}
            >
              {ACTION_LABELS[action]}
            </button>
          );
        })}
      </div>
      {selected && (
        <div style={{ fontSize: 11, color: '#555', marginTop: 8 }}>
          {ACTION_EXPLANATIONS[selected]}
        </div>
      )}
      {selected === 'deferred' && onReasonChange && (
        <input
          type="text"
          value={reason || ''}
          onChange={e => onReasonChange(e.target.value)}
          placeholder="why? (e.g. waiting on advice from Sam)"
          style={{
            marginTop: 8, width: '100%', boxSizing: 'border-box',
            background: '#0f0f0f', border: '1px solid #252525', borderRadius: 6,
            padding: '7px 10px', fontSize: 12, color: '#ccc', outline: 'none',
            fontFamily: 'inherit',
          }}
        />
      )}
      {showInvoice && (
        <input
          type="number"
          autoFocus
          value={amount || ''}
          onChange={e => onAmountChange(e.target.value)}
          placeholder="Invoice amount, ex-GST ($)"
          style={{
            marginTop: 8, width: '100%', boxSizing: 'border-box',
            background: '#1e293b', border: '1px solid #334155', borderRadius: 6,
            padding: '7px 10px', fontSize: 12, color: '#e2e8f0', outline: 'none',
            fontFamily: 'inherit',
          }}
        />
      )}
    </div>
  );
}

export default function CloseDayModal({ bullets = [], jobs = [], completedJobs = [], onJobComplete, onClose, onMarkPieceDone }) {
  // Split bullets into whole-bullet resolution (no checklist, or empty checklist)
  // vs per-item resolution (checklist bullets — only their unresolved 'todo' items need a decision).
  const wholeBullets = bullets.filter(b =>
    (!Array.isArray(b.checklist) || b.checklist.length === 0) && b.migration == null
  );
  const checklistBullets = bullets
    .filter(b => Array.isArray(b.checklist) && b.checklist.length > 0)
    .map(b => ({ ...b, unresolvedItems: b.checklist.filter(i => i.status === 'todo') }))
    .filter(b => b.unresolvedItems.length > 0);

  // Exclude already-done jobs — otherwise a job invoiced elsewhere (JobDrawer,
  // RevenueReviewBanner) earlier in the session still matches here, reopening
  // the amount prompt and risking a duplicate completedJobs record.
  const jobForBullet = b => jobs.find(j => j.id === b.jobId && !j.done) || null;
  const completedRecordForBullet = b => completedJobs.find(r => r.id === b.jobId) || null;

  const [selections, setSelections] = useState(() => {
    const init = {};
    wholeBullets.forEach(b => { init[b.id] = null; });
    return init;
  });

  // { [bulletId]: amountString } — only used for whole-bullet 'completed' selections
  // where a real job was resolved (invoicing prompt); irrelevant otherwise.
  const [invoiceAmounts, setInvoiceAmounts] = useState({});

  // { [bulletId]: amountString } — optional manual invoice entry for bullets
  // whose job vanished from jobs[] entirely (no live record, no completedJobs
  // record). Left blank = just mark done, no invoice.
  const [manualAmounts, setManualAmounts] = useState({});

  // { [bulletId]: { [itemId]: { action, reason } } }
  const [itemSelections, setItemSelections] = useState(() => {
    const init = {};
    checklistBullets.forEach(b => {
      init[b.id] = {};
      b.unresolvedItems.forEach(item => { init[b.id][item.id] = { action: null, reason: '' }; });
    });
    return init;
  });

  const select = useCallback((bulletId, action) => {
    setSelections(prev => ({ ...prev, [bulletId]: action }));
  }, []);

  const setInvoiceAmount = useCallback((bulletId, value) => {
    setInvoiceAmounts(prev => ({ ...prev, [bulletId]: value }));
  }, []);

  const setManualAmount = useCallback((bulletId, value) => {
    setManualAmounts(prev => ({ ...prev, [bulletId]: value }));
  }, []);

  const selectItem = useCallback((bulletId, itemId, action) => {
    setItemSelections(prev => ({
      ...prev,
      [bulletId]: { ...prev[bulletId], [itemId]: { ...prev[bulletId][itemId], action } },
    }));
  }, []);

  const setItemReason = useCallback((bulletId, itemId, reason) => {
    setItemSelections(prev => ({
      ...prev,
      [bulletId]: { ...prev[bulletId], [itemId]: { ...prev[bulletId][itemId], reason } },
    }));
  }, []);

  useEffect(() => {
    const handleKey = e => {
      const row = document.activeElement?.closest('[data-bullet-id]');
      if (!row) return;
      const bulletId = row.dataset.bulletId;
      if (e.key === 'k' || e.key === 'K') select(bulletId, 'kept');
      if (e.key === 'd' || e.key === 'D') select(bulletId, 'dropped');
      if (e.key === 'f' || e.key === 'F') select(bulletId, 'deferred');
      if (e.key === 'c' || e.key === 'C') select(bulletId, 'completed');
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [select]);

  const wholeBulletsResolved = wholeBullets.every(b => {
    const sel = selections[b.id];
    if (sel === null) return false;
    if (sel === 'completed' && jobForBullet(b)) {
      const amt = invoiceAmounts[b.id];
      return amt !== undefined && amt !== '' && !isNaN(Number(amt));
    }
    return true;
  });
  const checklistItemsResolved = checklistBullets.every(b =>
    b.unresolvedItems.every(item => {
      const sel = itemSelections[b.id]?.[item.id];
      if (!sel || !sel.action) return false;
      if (sel.action === 'deferred' && !sel.reason?.trim()) return false;
      return true;
    })
  );

  const allResolved = wholeBulletsResolved && checklistItemsResolved;
  const totalCount = wholeBullets.length + checklistBullets.reduce((n, b) => n + b.unresolvedItems.length, 0);
  const unresolvedCount =
    wholeBullets.filter(b => selections[b.id] === null).length +
    checklistBullets.reduce((n, b) => n + b.unresolvedItems.filter(item => {
      const sel = itemSelections[b.id]?.[item.id];
      return !sel || !sel.action || (sel.action === 'deferred' && !sel.reason?.trim());
    }).length, 0);

  function handleLock() {
    const migrations = { ...selections, checklist: {} };
    checklistBullets.forEach(b => {
      migrations.checklist[b.id] = {};
      b.unresolvedItems.forEach(item => {
        const sel = itemSelections[b.id][item.id];
        migrations.checklist[b.id][item.id] = { action: sel.action, reason: sel.reason };
      });
    });
    if (onJobComplete) {
      wholeBullets.forEach(b => {
        if (selections[b.id] !== 'completed') return;
        const job = jobForBullet(b);
        const amt = invoiceAmounts[b.id];
        if (job && amt !== undefined && amt !== '' && !isNaN(Number(amt))) {
          onJobComplete(job, amt);
          return;
        }
        // No live job and no completedJobs record — only reachable when a
        // manual amount was actually typed in (optional, defaults to none).
        if (!job && !completedRecordForBullet(b) && b.jobId) {
          const manualAmt = manualAmounts[b.id];
          if (manualAmt !== undefined && manualAmt !== '' && !isNaN(Number(manualAmt))) {
            onJobComplete(buildManualInvoiceJob(b), manualAmt);
          }
        }
      });
    }
    onClose(migrations);
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: 480, maxWidth: '90vw',
        background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 14,
        padding: 28, display: 'flex', flexDirection: 'column', gap: 16,
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#eee', marginBottom: 4 }}>
            End of day
          </div>
          <div style={{ fontSize: 13, color: '#666' }}>
            {unresolvedCount > 0
              ? `${unresolvedCount} unresolved — decide on each`
              : 'All resolved — ready to lock'}
          </div>
        </div>

        <div>
          {wholeBullets.map(bullet => {
            const selected = selections[bullet.id];
            const job = jobForBullet(bullet);
            const completedRecord = job ? null : completedRecordForBullet(bullet);
            const splits = getJobSplits(job, jobs);
            return (
              <div
                key={bullet.id}
                data-bullet-id={bullet.id}
                tabIndex={0}
                style={{
                  background: '#161616', border: '1px solid #252525',
                  borderRadius: 10, padding: 14, marginBottom: 10, outline: 'none',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = '#3a3a3a'; }}
                onBlur={e => { e.currentTarget.style.borderColor = '#252525'; }}
              >
                <div style={{ fontSize: 14, color: '#bbb', marginBottom: 2 }}>
                  {bullet.text}
                </div>
                <BenchChips splits={splits} />
                <BulletMeta meta={bullet.meta} />
                <JobStatusNote job={job} completedRecord={completedRecord} hasJobId={!!bullet.jobId} />
                {job && (job.hasSubtasks || job.isSplit) && (
                  <PieceStatusLine
                    job={job}
                    jobs={jobs}
                    onMarkPieceDone={onMarkPieceDone}
                  />
                )}
                {!job && !completedRecord && bullet.jobId && selected === 'completed' && (
                  <input
                    type="number"
                    value={manualAmounts[bullet.id] || ''}
                    onChange={e => setManualAmount(bullet.id, e.target.value)}
                    placeholder="Invoice amount, ex-GST ($) — optional"
                    style={{
                      marginBottom: 8, width: '100%', boxSizing: 'border-box',
                      background: '#1e293b', border: '1px solid #334155', borderRadius: 6,
                      padding: '7px 10px', fontSize: 12, color: '#e2e8f0', outline: 'none',
                      fontFamily: 'inherit',
                    }}
                  />
                )}
                <ActionRow
                  selected={selected}
                  onSelect={action => select(bullet.id, action)}
                  invoiceJob={job}
                  amount={invoiceAmounts[bullet.id]}
                  onAmountChange={value => setInvoiceAmount(bullet.id, value)}
                  jobs={jobs}
                />
              </div>
            );
          })}

          {checklistBullets.map(bullet => {
            const job = jobForBullet(bullet);
            const splits = getJobSplits(job, jobs);
            return (
            <div
              key={bullet.id}
              style={{
                background: '#161616', border: '1px solid #252525',
                borderRadius: 10, padding: 14, marginBottom: 10,
              }}
            >
              <div style={{ fontSize: 14, color: '#bbb', marginBottom: 2 }}>
                {bullet.text}
              </div>
              <BenchChips splits={splits} />
              <BulletMeta meta={bullet.meta} />
              {bullet.unresolvedItems.map((item, idx) => {
                const sel = itemSelections[bullet.id][item.id];
                return (
                  <div
                    key={item.id}
                    style={{
                      marginLeft: 12, paddingTop: idx > 0 ? 12 : 0,
                      marginTop: idx > 0 ? 12 : 0,
                      borderTop: idx > 0 ? '1px solid #1e1e1e' : 'none',
                    }}
                  >
                    <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>· {item.text}</div>
                    <ActionRow
                      selected={sel.action}
                      reason={sel.reason}
                      onSelect={action => selectItem(bullet.id, item.id, action)}
                      onReasonChange={reason => setItemReason(bullet.id, item.id, reason)}
                    />
                  </div>
                );
              })}
            </div>
            );
          })}

          {totalCount === 0 && (
            <div style={{ fontSize: 14, color: '#555', textAlign: 'center', padding: '20px 0' }}>
              No unresolved bullets.
            </div>
          )}
        </div>

        {allResolved && (
          <button
            onClick={handleLock}
            style={{
              background: '#2a2a2a', color: '#888', border: 'none',
              borderRadius: 8, padding: '10px 20px', width: '100%',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#333'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#2a2a2a'; }}
          >
            Lock day
          </button>
        )}

        <div style={{ fontSize: 11, color: '#333', textAlign: 'center' }}>
          🔒 Today's log locks when you close it. No editing after.
        </div>
      </div>
    </div>
  );
}
