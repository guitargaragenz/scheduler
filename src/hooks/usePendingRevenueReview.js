import { useEffect, useRef, useState } from 'react';
import {
  isSupabaseConfigured, loadPendingRevenueReview, subscribeToPendingRevenueReview,
  addPendingRevenueReviewItems, removePendingRevenueReviewItem,
} from '../utils/supabase.js';
import { keyReviewItemsById } from '../data/joinJobs.js';

// Jobs that disappeared from a CSV/Sheet sync without being marked done
// in-app (Trevor's real workflow finishes/invoices in Multitrack), plus
// orphaned split-child jobsState docs surfaced by the jobsMaster/jobsState
// join — both awaiting a Done+invoiced or Cancelled call. Kept in its own
// doc, keyed by each item's own Firestore doc id (see keyReviewItemsById —
// job number is undefined on a top-level jobsState doc and shared across
// every split child of the same parent, so keying by job number would let
// one simultaneous orphan silently clobber another). Never touches the
// `jobs` array / CSV drift-safety check.
export function usePendingRevenueReview() {
  const [items, setItems] = useState({});
  const [ready, setReady] = useState(false);
  const justSavedAt = useRef(0);

  useEffect(() => {
    if (!isSupabaseConfigured()) { setReady(true); return; }
    loadPendingRevenueReview().then(data => { setItems(data); setReady(true); });
    const unsub = subscribeToPendingRevenueReview(data => {
      if (Date.now() - justSavedAt.current < 3000) return;
      setItems(data);
    });
    return () => unsub();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function addDisappearedJobs(disappearedJobs) {
    if (!disappearedJobs || disappearedJobs.length === 0) return;
    const stamped = disappearedJobs.map(j => ({ ...j, disappearedAt: new Date().toISOString() }));
    setItems(prev => ({ ...prev, ...keyReviewItemsById(stamped) }));
    if (isSupabaseConfigured()) {
      justSavedAt.current = Date.now();
      addPendingRevenueReviewItems(stamped);
    }
  }

  function resolveItem(itemId) {
    setItems(prev => {
      const next = { ...prev };
      delete next[String(itemId)];
      return next;
    });
    if (isSupabaseConfigured()) {
      justSavedAt.current = Date.now();
      removePendingRevenueReviewItem(itemId);
    }
  }

  return { pendingRevenueReview: items, ready, addDisappearedJobs, resolveItem };
}
