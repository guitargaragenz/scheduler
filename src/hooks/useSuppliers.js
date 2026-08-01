import { useCallback, useEffect, useState } from 'react';
import {
  isSupabaseConfigured, loadSuppliers, addSupplier, renameSupplier, removeSupplier,
} from '../utils/supabase.js';

// The managed supplier list — the names offered in the Parts to Order dropdown,
// edited in Settings.
//
// Names only, no account numbers or contacts, by explicit instruction.
//
// NOTHING in here reads or writes parts_to_order. A part stores the supplier
// NAME copied at save time, so renaming or removing a supplier here can never
// change a saved part. A part tagged with a removed supplier still shows and
// still groups under that name; it is simply no longer offered for new parts.

export function useSuppliers() {
  const [suppliers, setSuppliers] = useState([]);
  const [ready, setReady] = useState(false);
  // Put on screen rather than logged. A supplier list that silently failed to
  // save would look identical to an empty one.
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured()) { setReady(true); return; }
    try {
      const list = await loadSuppliers();
      setSuppliers(list);
      setError(null);
    } catch (e) {
      setError(`Supplier list could not be loaded: ${e?.message || String(e)}`);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Each of these re-reads the list afterwards rather than patching local state,
  // so what is on screen is what is actually stored.
  const add = useCallback(async (name) => {
    const clean = (name ?? '').trim();
    if (!clean) return;
    try {
      await addSupplier({ name: clean });
      setError(null);
      await refresh();
    } catch (e) {
      setError(`"${clean}" was NOT added: ${e?.message || String(e)}`);
    }
  }, [refresh]);

  const rename = useCallback(async (id, name) => {
    const clean = (name ?? '').trim();
    if (!clean) return;
    try {
      await renameSupplier(id, clean);
      setError(null);
      await refresh();
    } catch (e) {
      setError(`Rename to "${clean}" did NOT save: ${e?.message || String(e)}`);
    }
  }, [refresh]);

  const remove = useCallback(async (id) => {
    try {
      await removeSupplier(id);
      setError(null);
      await refresh();
    } catch (e) {
      setError(`That supplier was NOT removed: ${e?.message || String(e)}`);
    }
  }, [refresh]);

  return { suppliers, ready, error, add, rename, remove, refresh };
}
