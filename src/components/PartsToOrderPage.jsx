import { useState, useEffect, useCallback } from 'react';
import {
  isSupabaseConfigured,
  loadPartsToOrder,
  addPartsToOrderItems,
  markPartResolved,
} from '../utils/supabase.js';
import { partitionParts, buildPartPayload } from '../data/partsToOrder.js';

// The Parts to Order page — the chase list of parts waiting to be ordered or to
// arrive. Nothing here touches job state: ticking a part off clears it from this
// list and nothing else. Multitrack is still what unsticks the job.
//
// Load-on-open, no realtime. One person edits this list, so a subscription would
// buy nothing and add cleanup to get wrong.
//
// Every failure is written onto the page as plain text and left there. Not a
// toast: a tech who walks away mid-shop has to still see it when they come back.

const PAGE_BG = '#111827';
const PANEL_BG = '#1f2937';
const BORDER = '#374151';

function formatAdded(iso) {
  if (!iso) return 'date unknown';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'date unknown';
  return d.toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' });
}

function errorText(e) {
  return e?.message || String(e || 'unknown error');
}

function Notice({ children }) {
  if (!children) return null;
  return (
    <div style={{
      background: '#2d1515', border: '1px solid #7f1d1d', color: '#fca5a5',
      borderRadius: 8, padding: '12px 14px', fontSize: 13, lineHeight: 1.5,
      marginBottom: 18, whiteSpace: 'pre-wrap',
    }}>
      {children}
    </div>
  );
}

const fieldStyle = {
  width: '100%', boxSizing: 'border-box',
  background: '#111827', border: `1px solid ${BORDER}`, borderRadius: 6,
  color: '#f9fafb', fontSize: 14, padding: '10px 12px',
};

const labelStyle = {
  display: 'block', fontSize: 11, color: '#9ca3af',
  textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6,
};

export default function PartsToOrderPage() {
  const [itemsById, setItemsById] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [writeError, setWriteError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showResolved, setShowResolved] = useState(false);

  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [neededForJob, setNeededForJob] = useState('');

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      if (!isSupabaseConfigured()) {
        throw new Error('Supabase is not configured on this device (missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).');
      }
      const items = await loadPartsToOrder();
      setItemsById(items || {});
      setLoadError(null);
    } catch (e) {
      // Deliberately does NOT clear the list already on screen — a failed
      // refresh should not look like an empty parts list.
      setLoadError(`Couldn't load the parts list: ${errorText(e)}`);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const { active, resolved } = partitionParts(itemsById);

  async function handleAdd(e) {
    e.preventDefault();
    const payload = buildPartPayload({ description, category, neededForJob });
    if (!payload) {
      setWriteError('Type what the part is before adding it.');
      return;
    }
    setBusy(true);
    try {
      await addPartsToOrderItems([payload]);
      setWriteError(null);
      setDescription('');
      setCategory('');
      setNeededForJob('');
      await refresh();
    } catch (err) {
      // The typed values are left in the boxes on purpose, so nothing is lost
      // and the add can simply be retried.
      setWriteError(`That part was NOT saved: ${errorText(err)}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleResolve(part, resolvedNext) {
    setBusy(true);
    try {
      await markPartResolved(part.id, resolvedNext);
      setWriteError(null);
      await refresh();
    } catch (err) {
      setWriteError(
        `"${part.description}" was NOT ${resolvedNext ? 'ticked off' : 'put back'}: ${errorText(err)}`
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', background: PAGE_BG, color: '#f9fafb' }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '28px 20px 60px' }}>

        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 18, fontWeight: 600 }}>Parts to Order</div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4, lineHeight: 1.6 }}>
            The chase list. Ticking a part off here clears it from this list only —
            it doesn't change the job.
          </div>
        </div>

        <Notice>{loadError}</Notice>
        <Notice>{writeError}</Notice>

        {/* Add a part */}
        <form
          onSubmit={handleAdd}
          style={{
            background: PANEL_BG, border: `1px solid ${BORDER}`, borderRadius: 10,
            padding: 20, marginBottom: 32,
          }}
        >
          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle} htmlFor="pto-desc">What's needed</label>
            <input
              id="pto-desc"
              style={fieldStyle}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="e.g. 500k audio pot, long shaft"
              autoComplete="off"
            />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle} htmlFor="pto-cat">Category (optional)</label>
            <input
              id="pto-cat"
              style={fieldStyle}
              value={category}
              onChange={e => setCategory(e.target.value)}
              placeholder="part"
              autoComplete="off"
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle} htmlFor="pto-job">Job number (optional)</label>
            <input
              id="pto-job"
              style={fieldStyle}
              value={neededForJob}
              onChange={e => setNeededForJob(e.target.value)}
              placeholder="Leave blank for shop stock"
              autoComplete="off"
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            style={{
              padding: '11px 22px', borderRadius: 8, fontSize: 14, fontWeight: 600,
              border: '1px solid #15803d', background: busy ? '#14532d' : '#166534',
              color: '#bbf7d0', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
            }}
          >
            {busy ? 'Saving…' : 'Add part'}
          </button>
        </form>

        {/* Active list */}
        {loading && Object.keys(itemsById).length === 0 ? (
          <div style={{ color: '#6b7280', fontSize: 13, padding: '20px 2px' }}>Loading…</div>
        ) : active.length === 0 ? (
          <div style={{ color: '#6b7280', fontSize: 13, padding: '20px 2px', lineHeight: 1.6 }}>
            Nothing on the chase list right now.
          </div>
        ) : (
          <div>
            <div style={{
              fontSize: 11, color: '#6b7280', textTransform: 'uppercase',
              letterSpacing: '0.07em', marginBottom: 10, paddingLeft: 2,
            }}>
              To order · {active.length}
            </div>
            {active.map(part => (
              <div
                key={part.id}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 14,
                  background: PANEL_BG, border: `1px solid ${BORDER}`, borderRadius: 10,
                  padding: '16px 18px', marginBottom: 12,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, color: '#f3f4f6', lineHeight: 1.4 }}>
                    {part.description}
                  </div>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 6, lineHeight: 1.6 }}>
                    {part.category || 'part'}
                    {part.neededForJob ? ` · for job ${part.neededForJob}` : ' · shop stock'}
                    {` · added ${formatAdded(part.addedAt)}`}
                  </div>
                </div>
                <button
                  onClick={() => handleResolve(part, true)}
                  disabled={busy}
                  style={{
                    flexShrink: 0, padding: '9px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                    border: '1px solid #15803d', background: '#14532d', color: '#86efac',
                    cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
                  }}
                >
                  Got it
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Resolved — kept, dimmed, collapsed. Worth a glance at the next
            meeting for "what got sorted this week", so it is not deleted. */}
        {resolved.length > 0 && (
          <div style={{ marginTop: 36, borderTop: `1px solid ${BORDER}`, paddingTop: 18 }}>
            <button
              onClick={() => setShowResolved(s => !s)}
              style={{
                background: 'none', border: 'none', padding: '2px 0', cursor: 'pointer',
                fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.07em',
              }}
            >
              {showResolved ? '▾' : '▸'} Sorted · {resolved.length}
            </button>

            {showResolved && (
              <div style={{ marginTop: 14, opacity: 0.55 }}>
                {resolved.map(part => (
                  <div
                    key={part.id}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 14,
                      padding: '12px 2px', borderBottom: '1px solid #1f2937',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, color: '#d1d5db', textDecoration: 'line-through' }}>
                        {part.description}
                      </div>
                      <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
                        {part.category || 'part'}
                        {part.neededForJob ? ` · for job ${part.neededForJob}` : ' · shop stock'}
                        {` · added ${formatAdded(part.addedAt)}`}
                      </div>
                    </div>
                    <button
                      onClick={() => handleResolve(part, false)}
                      disabled={busy}
                      style={{
                        flexShrink: 0, padding: '6px 12px', borderRadius: 6, fontSize: 12,
                        border: `1px solid ${BORDER}`, background: '#1f2937', color: '#9ca3af',
                        cursor: busy ? 'default' : 'pointer',
                      }}
                    >
                      Put back
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
