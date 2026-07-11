import { useState, useMemo } from 'react';
import { dayLabel } from '../utils/calendar.js';
import { getJobSplits, buildManualInvoiceJob, BENCH_COLORS } from '../data/jobs.js';
import ReasonPicker from './ReasonPicker.jsx';

function BenchChips({ splits }) {
  if (!splits.length) return null;
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
      {splits.map((s, i) => {
        const colors = BENCH_COLORS[s.bench] || BENCH_COLORS.Admin;
        return (
          <span
            key={i}
            style={{
              background: colors.bg, color: colors.text, border: `1px solid ${colors.border}`,
              borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 600,
            }}
          >
            {s.bench}{s.hours ? ` · ${s.hours}h` : ''}
          </span>
        );
      })}
    </div>
  );
}

// Steps through each stale day's unresolved bullets one at a time. Reason
// picker UI is shared with Problem 3's BumpReasonModal via ReasonPicker.jsx.
export default function CatchUpInterview({ days = [], logs = {}, jobs = [], completedJobs = [], onJobComplete, onClose }) {
  const steps = useMemo(() => {
    const out = [];
    days.forEach(dateKey => {
      const day = logs[dateKey];
      if (!day) return;
      day.bullets.forEach(b => {
        const hasChecklist = Array.isArray(b.checklist) && b.checklist.length > 0;
        const unresolved = hasChecklist
          ? b.checklist.some(i => i.status === 'todo')
          : !b.done && b.migration == null;
        if (unresolved) out.push({ dateKey, bullet: b });
      });
    });
    return out;
  }, [days, logs]);

  const [index, setIndex] = useState(0);
  const [resolutions, setResolutions] = useState({});
  const [reason, setReason] = useState(null);
  const [reasonText, setReasonText] = useState('');
  const [amountOpen, setAmountOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [noJobNote, setNoJobNote] = useState(false);
  const [manualInvoiceOpen, setManualInvoiceOpen] = useState(false);

  const step = steps[index];
  const atEnd = index >= steps.length;

  // Exclude already-done jobs — otherwise a job invoiced elsewhere (JobDrawer,
  // RevenueReviewBanner) earlier in the session still matches here, reopening
  // the amount prompt and risking a duplicate completedJobs record.
  const job = step ? jobs.find(j => j.id === step.bullet.jobId && !j.done) : null;
  const completedRecord = step && !job ? completedJobs.find(r => r.id === step.bullet.jobId) : null;
  const splits = useMemo(() => getJobSplits(job, jobs), [job, jobs]);

  function recordAndAdvance(action) {
    if (step) {
      setResolutions(prev => ({
        ...prev,
        [step.dateKey]: {
          ...(prev[step.dateKey] || {}),
          [step.bullet.id]: { action, reason, reasonText: reason === 'Other' ? reasonText : undefined },
        },
      }));
    }
    setReason(null);
    setReasonText('');
    setAmountOpen(false);
    setAmount('');
    setNoJobNote(false);
    setManualInvoiceOpen(false);
    setIndex(i => i + 1);
  }

  function handleCarry() {
    recordAndAdvance('carry');
  }

  function handleSkip() {
    recordAndAdvance('skip');
  }

  // Marking a job complete invoices it for real (onJobComplete → handleMarkDone
  // in useJobs.js) — reveal an amount prompt first, matching RevenueReviewBanner's
  // inline pattern. If the job already has a completedJobs record (finished +
  // synced out of jobs[] already), just resolve — it's already invoiced. If
  // there's genuinely no matching job anywhere, show it instead of silently
  // advancing, so "nothing happened" never reads as a bug.
  function handleComplete() {
    if (job && onJobComplete) {
      setAmountOpen(true);
      return;
    }
    if (completedRecord) {
      recordAndAdvance('complete');
      return;
    }
    // Free-text notes have no jobId at all — nothing to invoice, just resolve.
    if (!step.bullet.jobId) {
      recordAndAdvance('complete');
      return;
    }
    setNoJobNote(true);
  }

  function confirmComplete() {
    if (amount !== '' && !isNaN(Number(amount)) && job && onJobComplete) {
      onJobComplete(job, amount);
    }
    recordAndAdvance('complete');
  }

  // No live job, no completedJobs record — the job's genuinely gone from
  // Firestore. Still lets Trevor capture an invoice against a synthetic
  // record built from the bullet text, rather than losing it silently.
  function confirmManualComplete() {
    if (amount !== '' && !isNaN(Number(amount)) && onJobComplete) {
      onJobComplete(buildManualInvoiceJob(step.bullet), amount);
    }
    recordAndAdvance('complete');
  }

  function handleFinish() {
    onClose(resolutions);
  }

  function handleCancel() {
    onClose(null);
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
            Catch-up
          </div>
          <div style={{ fontSize: 13, color: '#666' }}>
            {steps.length === 0
              ? 'Nothing unresolved.'
              : atEnd
                ? 'All done — ready to carry forward.'
                : `${index + 1} of ${steps.length}`}
          </div>
        </div>

        {!atEnd && step && (
          <div style={{ background: '#161616', border: '1px solid #252525', borderRadius: 10, padding: 14 }}>
            <div style={{ fontSize: 11, color: '#555', marginBottom: 6 }}>
              {dayLabel(new Date(step.dateKey + 'T00:00:00'))}
            </div>
            <div style={{ fontSize: 14, color: '#bbb', marginBottom: splits.length ? 2 : 14 }}>
              {step.bullet.text}
            </div>
            <BenchChips splits={splits} />
            {completedRecord && (
              <div style={{ fontSize: 11, color: '#4a9e5a', marginBottom: 12 }}>
                ✓ Already invoiced ${Number(completedRecord.invoiceAmount).toFixed(0)}
              </div>
            )}

            {amountOpen ? (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="number"
                  autoFocus
                  placeholder="Invoice amount, ex-GST ($)"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  style={{
                    background: '#1e293b', border: '1px solid #334155', borderRadius: 6,
                    color: '#e2e8f0', fontSize: 12, padding: '7px 8px', flex: 1,
                  }}
                />
                <button
                  onClick={confirmComplete}
                  disabled={amount === '' || isNaN(Number(amount))}
                  style={{
                    background: '#22c55e', border: 'none', borderRadius: 6, color: '#052e16',
                    fontSize: 12, fontWeight: 700, padding: '7px 14px',
                    cursor: amount === '' || isNaN(Number(amount)) ? 'default' : 'pointer',
                    opacity: amount === '' || isNaN(Number(amount)) ? 0.5 : 1,
                  }}
                >
                  Confirm
                </button>
                <button
                  onClick={() => { setAmountOpen(false); setAmount(''); }}
                  style={{
                    background: 'none', border: '1px solid #334155', borderRadius: 6,
                    color: '#888', fontSize: 12, padding: '7px 10px', cursor: 'pointer',
                  }}
                >
                  Back
                </button>
              </div>
            ) : noJobNote ? (
              manualInvoiceOpen ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    type="number"
                    autoFocus
                    placeholder="Invoice amount, ex-GST ($)"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    style={{
                      background: '#1e293b', border: '1px solid #334155', borderRadius: 6,
                      color: '#e2e8f0', fontSize: 12, padding: '7px 8px', flex: 1,
                    }}
                  />
                  <button
                    onClick={confirmManualComplete}
                    disabled={amount === '' || isNaN(Number(amount))}
                    style={{
                      background: '#22c55e', border: 'none', borderRadius: 6, color: '#052e16',
                      fontSize: 12, fontWeight: 700, padding: '7px 14px',
                      cursor: amount === '' || isNaN(Number(amount)) ? 'default' : 'pointer',
                      opacity: amount === '' || isNaN(Number(amount)) ? 0.5 : 1,
                    }}
                  >
                    Confirm
                  </button>
                  <button
                    onClick={() => { setManualInvoiceOpen(false); setAmount(''); }}
                    style={{
                      background: 'none', border: '1px solid #334155', borderRadius: 6,
                      color: '#888', fontSize: 12, padding: '7px 10px', cursor: 'pointer',
                    }}
                  >
                    Back
                  </button>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 10 }}>
                    No matching job found for this bullet — enter an amount if it still needs
                    invoicing, or just mark it done.
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => setManualInvoiceOpen(true)}
                      style={{
                        flex: 1, background: '#1a2536', color: '#5b9bd5', border: 'none',
                        borderRadius: 8, padding: '9px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      Enter amount
                    </button>
                    <button
                      onClick={() => recordAndAdvance('complete')}
                      style={{
                        flex: 1, background: '#2a2a2a', color: '#ccc', border: 'none',
                        borderRadius: 8, padding: '9px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      Mark done
                    </button>
                    <button
                      onClick={() => setNoJobNote(false)}
                      style={{
                        background: 'none', border: '1px solid #334155', borderRadius: 6,
                        color: '#888', fontSize: 12, padding: '7px 14px', cursor: 'pointer',
                      }}
                    >
                      Back
                    </button>
                  </div>
                </div>
              )
            ) : (
              <>
                <ReasonPicker
                  reason={reason}
                  reasonText={reasonText}
                  onSelectReason={setReason}
                  onReasonTextChange={setReasonText}
                />

                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button
                    onClick={handleCarry}
                    disabled={reason === 'Other' && !reasonText.trim()}
                    style={{
                      flex: 1, background: '#1a2e1a', color: '#4a9e5a', border: 'none',
                      borderRadius: 8, padding: '9px 0', fontSize: 13, fontWeight: 600,
                      cursor: reason === 'Other' && !reasonText.trim() ? 'default' : 'pointer',
                      opacity: reason === 'Other' && !reasonText.trim() ? 0.5 : 1,
                    }}
                  >
                    Carry forward
                  </button>
                  <button
                    onClick={handleSkip}
                    style={{
                      flex: 1, background: '#2a2a2a', color: '#888', border: 'none',
                      borderRadius: 8, padding: '9px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Skip
                  </button>
                  <button
                    onClick={handleComplete}
                    style={{
                      flex: 1, background: '#1a2536', color: '#5b9bd5', border: 'none',
                      borderRadius: 8, padding: '9px 0', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    Job complete
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {(atEnd || steps.length === 0) && (
          <button
            onClick={handleFinish}
            style={{
              background: '#2a2a2a', color: '#888', border: 'none',
              borderRadius: 8, padding: '10px 20px', width: '100%',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = '#333'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#2a2a2a'; }}
          >
            Carry forward selected
          </button>
        )}

        <div
          onClick={handleCancel}
          style={{ fontSize: 11, color: '#444', textAlign: 'center', cursor: 'pointer' }}
        >
          cancel
        </div>
      </div>
    </div>
  );
}
