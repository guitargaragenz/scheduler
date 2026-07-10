import { useEffect, useRef, useState } from 'react';
import {
  isFirebaseConfigured, loadPendingRevenueReview, subscribeToPendingRevenueReview,
  addPendingRevenueReviewItems, removePendingRevenueReviewItem,
} from '../utils/firebase.js';

// Jobs that disappeared from a CSV/Sheet sync without being marked done in-app
// (Trevor's real workflow finishes/invoices in Multitrack) — awaiting a
// Done+invoiced or Cancelled call. Kept in its own doc, keyed by job number, so
// it never touches the `jobs` array / CSV drift-safety check.
export function usePendingRevenueReview() {
  const [items, setItems] = useState({});
  const [ready, setReady] = useState(false);
  const justSavedAt = useRef(0);

  useEffect(() => {
    if (!isFirebaseConfigured()) { setReady(true); return; }
    loadPendingRevenueReview().then(data => { setItems(data); setReady(true); });
    const unsub = subscribeToPendingRevenueReview(data => {
      if (Date.now() - justSavedAt.current < 3000) return;
      setItems(data);
    });
    return () => unsub();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function addDisappearedJobs(disappearedJobs) {
    if (!disappearedJobs || disappearedJobs.length === 0) return;
    setItems(prev => {
      const next = { ...prev };
      disappearedJobs.forEach(j => {
        next[String(j.job)] = { ...j, disappearedAt: new Date().toISOString() };
      });
      return next;
    });
    if (isFirebaseConfigured()) {
      justSavedAt.current = Date.now();
      addPendingRevenueReviewItems(disappearedJobs);
    }
  }

  function resolveItem(jobNo) {
    setItems(prev => {
      const next = { ...prev };
      delete next[String(jobNo)];
      return next;
    });
    if (isFirebaseConfigured()) {
      justSavedAt.current = Date.now();
      removePendingRevenueReviewItem(jobNo);
    }
  }

  return { pendingRevenueReview: items, ready, addDisappearedJobs, resolveItem };
}
