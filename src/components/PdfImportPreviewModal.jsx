// Brief G, Build 1a — the screen Trevor sees before a PDF import writes
// anything. Same modal chrome as SyncPreviewModal.jsx.
//
// Mandatory: the import handler builds the plan and stops here. Nothing
// reaches the database until Confirm is clicked.
//
// Three counts and two lists, deliberately no more. This is not a field-level
// diff — a wall of "customer changed from X to Y" for forty jobs is exactly
// the kind of dense screen that gets clicked through without being read. The
// two things worth Trevor's attention are which jobs are new, and which jobs
// have quietly dropped off the printout.
//
// Build 1c adds a second body for the Jobs-by-Age printout. One modal, two
// bodies, chosen by plan.kind — a second near-identical modal component would
// mean every future change to the confirm/cancel behaviour had to be made
// twice, and one of the two would eventually get missed.

const box = { background: '#161616', border: '1px solid #252525', borderRadius: 10, padding: 14 };
const warnBox = { background: '#1a1410', border: '1px solid #3a2a15', borderRadius: 10, padding: 14 };
const rowStyle = { fontSize: 12, color: '#aaa', padding: '1px 0' };

const dangerBox = { background: '#1a1010', border: '1px solid #4a2020', borderRadius: 10, padding: 14 };

// "On the board but not in this file" — the Jobs-by-Age half, which genuinely
// does nothing about it. That printout is a different population: a job absent
// from it has no booked-in date recorded, which is not the same fact as
// "finished". Only the Multitrack jobs list takes work off the board.
function MissingDatesBlock({ missing }) {
  if (missing.length === 0) return null;
  return (
    <div style={warnBox}>
      <div style={{ fontSize: 12, color: '#c88a3a', fontWeight: 600, marginBottom: 6 }}>
        On the board but not in this file ({missing.length})
      </div>
      <div style={{ fontSize: 11, color: '#8a6a3a', marginBottom: 8 }}>
        This file only carries booked-in dates, so it changes nothing about these jobs — they stay
        on the board exactly as they are, and no date is cleared.
      </div>
      {missing.map(m => (
        <div key={m.id} style={{ fontSize: 12, color: '#a88', padding: '1px 0' }}>{m.label}</div>
      ))}
    </div>
  );
}

// The consequential block on this screen, and the reason it is red rather than
// amber. The count check on the file only proves we read every row the PDF said
// it had — it cannot tell that the RIGHT report was printed. A filtered subset
// or a stale export can be perfectly self-consistent and still take most of the
// workshop off the board. So the job numbers are listed, not just counted:
// a wrong report should be obvious on sight, before Import is pressed.
function DepartingBlock({ departures }) {
  if (departures.length === 0) return null;
  return (
    <div style={dangerBox}>
      <div style={{ fontSize: 12, color: '#d46a6a', fontWeight: 600, marginBottom: 6 }}>
        Coming off the board ({departures.length})
      </div>
      <div style={{ fontSize: 11, color: '#a06a6a', marginBottom: 8 }}>
        These are on the board but not on this printout, so Multitrack has finished or invoiced
        them. Pressing Import removes them from the Jobs Sheet, the Sidebar, the Jobs page and the
        Projects page, and frees any calendar slots they hold.
        <br />
        Nothing is deleted — every one keeps its tag, action, hours, bench and notes, and comes
        back exactly as it was if it turns up on a later printout.
        <br />
        <strong style={{ color: '#c88a3a' }}>
          Check this list before importing. If jobs you are still working on are on it, this is the
          wrong report — press cancel.
        </strong>
      </div>
      <div style={{ fontSize: 12, color: '#caa', fontWeight: 600, padding: '2px 0 6px' }}>
        Job {departures.map(d => d.id).join(', ')}
      </div>
      {departures.map(d => (
        <div key={d.id} style={{ fontSize: 12, color: '#a88', padding: '1px 0' }}>{d.label}</div>
      ))}
    </div>
  );
}

// A job number that came off the board on an earlier printout and is back on
// this one. It is not a new job: its row was kept, so its tag, action, hours,
// bench and notes are all still on it and come back with it.
function ReturningBlock({ returning }) {
  if (!returning || returning.length === 0) return null;
  return (
    <div style={box}>
      <div style={{ fontSize: 12, color: '#7dd3fc', fontWeight: 600, marginBottom: 6 }}>
        Back on the board ({returning.length})
      </div>
      <div style={{ fontSize: 11, color: '#4a7a8a', marginBottom: 8 }}>
        These came off the board on an earlier printout and are on this one again. They come back
        with their tag, action, hours, bench and notes intact — not as blank new jobs.
      </div>
      {returning.map(r => (
        <div key={r.id} style={rowStyle}>{r.label}</div>
      ))}
    </div>
  );
}

function JobsSummary({ plan }) {
  const departing = plan.departures?.length ?? 0;
  const back = plan.returning?.length ?? 0;
  return (
    <>
      {plan.newLabels.length} new · {plan.existingCount} already here
      {back > 0 ? ` · ${back} back` : ''} · {departing} coming off the board.
      Nothing is written until you confirm.
    </>
  );
}

function JobsBlocks({ plan }) {
  const { newLabels } = plan;
  const departures = plan.departures || [];
  const newCount = newLabels.length;
  return (
    <>
      <div style={box}>
        <div style={{ fontSize: 12, color: '#4a9e5a', fontWeight: 600, marginBottom: 6 }}>
          New jobs ({newCount})
        </div>
        {newCount === 0 ? (
          <div style={{ fontSize: 12, color: '#555' }}>Nothing new — every job on this printout is already here.</div>
        ) : (
          newLabels.map(n => <div key={n.id} style={rowStyle}>{n.label}</div>)
        )}
      </div>
      <ReturningBlock returning={plan.returning} />
      <DepartingBlock departures={departures} />
      <div style={{ fontSize: 11, color: '#555', lineHeight: 1.5 }}>
        Your Tag, Hours, Action, VB and BL stay exactly as you left them — the Multitrack
        printout doesn’t carry them, so this import can’t change them.
      </div>
    </>
  );
}

function JbaSummary({ plan }) {
  const { filled, changed, unchangedCount } = plan;
  return (
    <>
      {filled.length} date{filled.length === 1 ? '' : 's'} filled in ·{' '}
      {changed.length} changed · {unchangedCount} already right.
      Nothing is written until you confirm.
    </>
  );
}

function JbaBlocks({ plan }) {
  const { filled, changed, missing, unknown } = plan;
  return (
    <>
      <div style={box}>
        <div style={{ fontSize: 12, color: '#4a9e5a', fontWeight: 600, marginBottom: 6 }}>
          Booked-in dates filled in ({filled.length})
        </div>
        {filled.length === 0 ? (
          <div style={{ fontSize: 12, color: '#555' }}>None — every job in this file already had its date.</div>
        ) : (
          filled.map(f => (
            <div key={f.id} style={rowStyle}>{f.label} → {f.to}</div>
          ))
        )}
      </div>

      {/* The one thing on this screen that must never be skimmed past. An
          overwrite of a date already on the board is a real change to live job
          data, so it gets its own block, its own colour and both dates. */}
      {changed.length > 0 && (
        <div style={warnBox}>
          <div style={{ fontSize: 12, color: '#c88a3a', fontWeight: 600, marginBottom: 6 }}>
            Dates changed ({changed.length})
          </div>
          <div style={{ fontSize: 11, color: '#8a6a3a', marginBottom: 8 }}>
            These jobs already had a booked-in date and this printout disagrees. Multitrack wins —
            confirming replaces the date, and the job’s age changes to match.
          </div>
          {changed.map(c => (
            <div key={c.id} style={{ fontSize: 12, color: '#a88', padding: '1px 0' }}>
              {c.label}: {c.from} → {c.to}
            </div>
          ))}
        </div>
      )}

      {unknown.length > 0 && (
        <div style={warnBox}>
          <div style={{ fontSize: 12, color: '#c88a3a', fontWeight: 600, marginBottom: 6 }}>
            In this file but not on the board ({unknown.length})
          </div>
          <div style={{ fontSize: 11, color: '#8a6a3a' }}>
            Skipped. This printout only carries booked-in dates, so it can’t add a job — there’d be
            no customer, no guitar and no description on the card. Drop the Jobs PDF to bring them
            in, then run this one again to date them. Job {unknown.map(u => u.id).join(', ')}.
          </div>
        </div>
      )}

      <MissingDatesBlock missing={missing} />

      <div style={{ fontSize: 11, color: '#555', lineHeight: 1.5 }}>
        This file changes one thing and one thing only: the date each job came in the door.
        Customer, guitar, status, description, Tag, Hours, Action, VB and BL are all left
        exactly as they are.
      </div>
    </>
  );
}

export default function PdfImportPreviewModal({ plan, onConfirm, onCancel, busy = false }) {
  const isJba = plan.kind === 'jba';

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        width: 520, maxWidth: '92vw',
        background: '#1e1e1e', border: '1px solid #2a2a2a', borderRadius: 14,
        padding: 28, display: 'flex', flexDirection: 'column', gap: 16,
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 18, color: '#eee', marginBottom: 4 }}>
            {isJba ? 'Update booked-in dates from Multitrack' : 'Import jobs from Multitrack'}
          </div>
          <div style={{ fontSize: 13, color: '#666' }}>
            {isJba ? <JbaSummary plan={plan} /> : <JobsSummary plan={plan} />}
          </div>
          {plan.filename && (
            <div style={{ fontSize: 11, color: '#444', marginTop: 4 }}>{plan.filename}</div>
          )}
        </div>

        {isJba ? <JbaBlocks plan={plan} /> : <JobsBlocks plan={plan} />}

        <button
          onClick={onConfirm}
          disabled={busy}
          style={{
            width: '100%', background: '#1a2e1a', color: '#4a9e5a', border: 'none',
            borderRadius: 8, padding: '10px 0', fontSize: 13, fontWeight: 600,
            cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.5 : 1,
          }}
        >
          {busy ? 'Importing…' : isJba ? 'Update dates' : 'Import'}
        </button>

        <div
          onClick={busy ? undefined : onCancel}
          style={{ fontSize: 11, color: '#444', textAlign: 'center', cursor: busy ? 'default' : 'pointer' }}
        >
          cancel
        </div>
      </div>
    </div>
  );
}
