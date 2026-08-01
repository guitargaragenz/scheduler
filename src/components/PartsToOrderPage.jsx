import { useState, useEffect, useCallback } from 'react';
import {
  isSupabaseConfigured,
  loadPartsToOrder,
  addPartsToOrderItems,
  markPartResolved,
} from '../utils/supabase.js';
import { getAllParts } from '../utils/partsbox.js';
import {
  partitionParts, buildPartPayload, groupPartsByJob, groupPartsBySupplier, findStockMatch,
} from '../data/partsToOrder.js';

// Which way the To Order list is grouped. This one IS a per-device preference —
// how you like to read the page on the phone has nothing to do with how you read
// it at the bench — so it stays in localStorage and deliberately does not go in
// the shared settings store.
const GROUP_BY_KEY = 'partsToOrderGroupBy';

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

// The stock check is advisory and can fail on its own without anything being
// wrong with the list. It gets its own quiet grey note, deliberately NOT the
// red Notice above — red on this page means "your save did not happen", and a
// PartsBox outage must never read as a lost part.
function QuietNote({ children }) {
  if (!children) return null;
  return (
    <div style={{
      background: '#1f2937', border: `1px solid ${BORDER}`, color: '#9ca3af',
      borderRadius: 8, padding: '10px 12px', fontSize: 12, lineHeight: 1.5,
      marginBottom: 18,
    }}>
      {children}
    </div>
  );
}

// One "you may already have this" flag. Only an exact part-number match is
// allowed to speak with certainty; everything else is worded as a maybe, and a
// single-word match is softened further still. The flag is a door, not just a
// notice — the button opens the inventory drawer already searched.
function StockFlag({ match, onCheckStock }) {
  if (!match) return null;
  const { part, quantity, certain, matchedTermCount, searchText } = match;
  const weak = !certain && matchedTermCount < 2;
  const name = part['part/name'] || 'a part';

  return (
    <div style={{
      marginTop: 10, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
      background: certain ? '#1c2a1c' : '#1f2937',
      border: `1px solid ${certain ? '#3f6212' : BORDER}`,
      borderRadius: 8, padding: '8px 10px',
      opacity: weak ? 0.75 : 1,
    }}>
      <div style={{ flex: 1, minWidth: 180, fontSize: 12, lineHeight: 1.5, color: certain ? '#bef264' : '#9ca3af' }}>
        {certain
          ? <>PartsBox: <strong>{quantity} in stock</strong> — same part number, “{name}”.</>
          : weak
            ? <>Possibly already in stock — something called “{name}” loosely matches. Worth a look.</>
            : <>You may already have this — “{name}” looks similar ({quantity} in stock).</>}
      </div>
      <button
        type="button"
        onClick={() => onCheckStock?.(searchText)}
        style={{
          flexShrink: 0, padding: '6px 12px', borderRadius: 6, fontSize: 12, fontWeight: 600,
          border: `1px solid ${BORDER}`, background: '#111827', color: '#d1d5db', cursor: 'pointer',
        }}
      >
        Check stock
      </button>
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

export default function PartsToOrderPage({ onCheckStock, suppliers = [] }) {
  const [itemsById, setItemsById] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [writeError, setWriteError] = useState(null);
  // Third, separate state on purpose — a PartsBox outage is not a failed save
  // and must not share the red box with one.
  const [stockCheckError, setStockCheckError] = useState(null);
  const [inventory, setInventory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [showResolved, setShowResolved] = useState(false);

  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [neededForJob, setNeededForJob] = useState('');
  const [partNumber, setPartNumber] = useState('');
  // Blank is "not decided yet" and is the default. Optional exactly like the
  // part number — the form must never refuse a part for want of a supplier.
  const [supplier, setSupplier] = useState('');

  const [groupBy, setGroupBy] = useState(() => {
    try { return localStorage.getItem(GROUP_BY_KEY) === 'supplier' ? 'supplier' : 'job'; }
    catch { return 'job'; }
  });

  function changeGroupBy(next) {
    setGroupBy(next);
    try { localStorage.setItem(GROUP_BY_KEY, next); } catch { /* private mode */ }
  }

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

  // Inventory loads once on open, same as the drawer does. Read-only: this page
  // never writes to PartsBox. If it fails, the flags simply don't appear and
  // everything else on the page still works.
  useEffect(() => {
    let cancelled = false;
    getAllParts()
      .then(parts => { if (!cancelled) { setInventory(parts || []); setStockCheckError(null); } })
      .catch(e => {
        if (cancelled) return;
        setInventory([]);
        setStockCheckError(`Stock check unavailable — couldn't reach PartsBox (${errorText(e)}). The list still works; you just won't see "already in stock" flags.`);
      });
    return () => { cancelled = true; };
  }, []);

  const { active, resolved } = partitionParts(itemsById);
  const activeGroups = groupBy === 'supplier'
    ? groupPartsBySupplier(active)
    : groupPartsByJob(active);

  // What the add form is currently suggesting, recomputed as it is typed.
  const draftMatch = findStockMatch(inventory, { description, partNumber });

  async function handleAdd(e) {
    e.preventDefault();
    const payload = buildPartPayload({ description, category, neededForJob, partNumber, supplier });
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
      setPartNumber('');
      // The supplier is deliberately NOT cleared. Parts get typed in runs from
      // one place, and re-picking the same name every time is the friction that
      // makes people stop filling the field in.
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
        <QuietNote>{stockCheckError}</QuietNote>

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
            <label style={labelStyle} htmlFor="pto-pn">Part number (optional)</label>
            <input
              id="pto-pn"
              style={fieldStyle}
              value={partNumber}
              onChange={e => setPartNumber(e.target.value)}
              placeholder="If you have it — turns a maybe into a certainty"
              autoComplete="off"
            />
          </div>

          {/* Advisory only. It never blocks the save below it. */}
          <StockFlag match={draftMatch} onCheckStock={onCheckStock} />

          <div style={{ marginBottom: 18, marginTop: 18 }}>
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

          <div style={{ marginBottom: 18 }}>
            <label style={labelStyle} htmlFor="pto-supplier">Supplier (optional)</label>
            <select
              id="pto-supplier"
              style={fieldStyle}
              value={supplier}
              onChange={e => setSupplier(e.target.value)}
            >
              {/* Blank first and selected by default — "not decided yet" is a
                  perfectly normal state for a part to sit in. */}
              <option value="">— not decided yet —</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
            {/* If the list is empty the dropdown still works; it just offers
                nothing but blank. Names are added in Settings. */}
            {suppliers.length === 0 && (
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>
                No suppliers set up yet — add them in Settings.
              </div>
            )}
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
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: 12, marginBottom: 10, paddingLeft: 2, flexWrap: 'wrap',
            }}>
              <div style={{
                fontSize: 11, color: '#6b7280', textTransform: 'uppercase',
                letterSpacing: '0.07em',
              }}>
                To order · {active.length}
              </div>
              {/* Grouping only. Neither view hides anything, and neither one
                  changes a single stored row. */}
              <div style={{ display: 'flex', gap: 0, border: `1px solid ${BORDER}`, borderRadius: 6, overflow: 'hidden' }}>
                {[['job', 'By job'], ['supplier', 'By supplier']].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => changeGroupBy(value)}
                    style={{
                      padding: '5px 12px', fontSize: 12, border: 'none', cursor: 'pointer',
                      background: groupBy === value ? '#374151' : 'transparent',
                      color: groupBy === value ? '#f3f4f6' : '#9ca3af',
                      fontWeight: groupBy === value ? 600 : 400,
                    }}
                  >{label}</button>
                ))}
              </div>
            </div>
            {/* Grouped for display only — nothing about the rows or the
                database changes, and the job number is still free text. */}
            {activeGroups.map(group => (
              <div key={group.key || '__shop__'} style={{ marginBottom: 26 }}>
                <div style={{
                  fontSize: 13, fontWeight: 600, color: '#e5e7eb',
                  marginBottom: 10, paddingLeft: 2,
                }}>
                  {group.label}
                  <span style={{ color: '#6b7280', fontWeight: 400 }}> · {group.parts.length}</span>
                </div>

                {group.parts.map(part => (
                  <div
                    key={part.id}
                    style={{
                      background: PANEL_BG, border: `1px solid ${BORDER}`, borderRadius: 10,
                      padding: '16px 18px', marginBottom: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 15, color: '#f3f4f6', lineHeight: 1.4 }}>
                          {part.description}
                        </div>
                        <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 6, lineHeight: 1.6 }}>
                          {part.category || 'part'}
                          {part.partNumber ? ` · part no. ${part.partNumber}` : ''}
                          {/* Whichever field the heading above is NOT already
                              saying. Suppressing the repeated one is per-view on
                              purpose — in a supplier group the job number is the
                              useful half, and vice versa. */}
                          {groupBy === 'supplier'
                            ? (part.neededForJob ? ` · for job ${part.neededForJob}` : ' · shop stock')
                            : (part.supplier ? ` · ${part.supplier}` : '')}
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

                    <StockFlag
                      match={findStockMatch(inventory, {
                        description: part.description,
                        partNumber: part.partNumber,
                      })}
                      onCheckStock={onCheckStock}
                    />
                  </div>
                ))}
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
                        {part.partNumber ? ` · part no. ${part.partNumber}` : ''}
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
