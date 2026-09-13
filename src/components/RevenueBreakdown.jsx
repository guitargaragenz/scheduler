import { createPortal } from 'react-dom';
import { useEffect, useRef, useState } from 'react';
import { formatMoney } from '../utils/money.js';

// Plain list of the completedJobs records making up a revenue total —
// job #, date, amount. No bench/customer — just enough to trace a number
// back to the invoices that produced it.
//
// Rendered via a portal, positioned from the trigger element's own
// getBoundingClientRect() — NOT a plain position:absolute child of the
// header. The header sets overflowX:'auto', and per the CSS spec, an
// element with overflow-x set to anything but visible and overflow-y
// unset computes overflow-y to 'auto' too — so the header silently clips
// anything extending below its own bottom edge, portal-free popovers
// included. Every other floating panel in this app (PomoDrawer, modals)
// already avoids this by portaling to document.body; this does the same.
export default function RevenueBreakdown({ records, anchorRef, onClose }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);

  useEffect(() => {
    if (anchorRef.current) {
      const r = anchorRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 8, left: r.left + r.width / 2 });
    }
  }, [anchorRef]);

  useEffect(() => {
    function onDown(e) {
      if (ref.current && !ref.current.contains(e.target) && !anchorRef.current?.contains(e.target)) onClose();
    }
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose, anchorRef]);

  if (!pos) return null;

  // Records invoiced via buildManualInvoiceJob (the job vanished entirely
  // before invoicing — data.js's handleMarkDone-from-bullet-text path)
  // always have job: null by design. Their id still carries the job number
  // as a leading digit run (e.g. "1704_Wiring_0"), so fall back to that
  // instead of showing a bare dash.
  const jobLabel = (r) => {
    if (r.job) return `#${r.job}`;
    const m = /^(\d+)/.exec(String(r.id || ''));
    return m ? `#${m[1]}` : '—';
  };

  const sorted = [...records].sort((a, b) => (b.completedAt || '').localeCompare(a.completedAt || ''));

  return createPortal(
    <div ref={ref} style={{
      position: 'fixed', top: pos.top, left: pos.left, transform: 'translateX(-50%)',
      width: 260, zIndex: 3000,
      background: '#0f172a', border: '1px solid #334155', borderRadius: 10,
      boxShadow: '0 16px 40px rgba(0,0,0,0.6)', overflow: 'hidden',
    }}>
      <div style={{
        padding: '8px 12px', fontSize: 9, fontWeight: 700, color: '#475569',
        textTransform: 'uppercase', letterSpacing: 1, borderBottom: '1px solid #1e293b',
      }}>
        Invoices this week
      </div>
      <div style={{ maxHeight: 220, overflowY: 'auto' }}>
        {sorted.length === 0 ? (
          <div style={{ padding: '14px 12px', fontSize: 12, color: '#475569', textAlign: 'center' }}>
            No invoices yet
          </div>
        ) : sorted.map(r => (
          <div key={r.id} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '7px 12px', borderBottom: '1px solid #1e293b', fontSize: 12,
          }}>
            <span style={{ color: '#e2e8f0', fontWeight: 600 }}>
              {jobLabel(r)}
            </span>
            <span style={{ color: '#64748b' }}>
              {r.completedAt ? new Date(r.completedAt).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short' }) : '—'}
            </span>
            <span style={{ color: '#4ade80', fontWeight: 700 }}>
              ${formatMoney(r.invoiceAmount)}
            </span>
          </div>
        ))}
      </div>
    </div>,
    document.body
  );
}
