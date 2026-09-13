import { useCallback, useEffect, useState } from 'react';
import {
  isSupabaseConfigured, loadPartCategories, addPartCategory, renamePartCategory, removePartCategory,
} from '../utils/supabase.js';

// The managed part category list — the names offered in the Parts to Order
// Category dropdown, edited in Settings. A copy of useSuppliers.js.
//
// NOTHING in here reads or writes parts_to_order. A part stores the category
// NAME copied at save time, so renaming or removing a category here can never
// change a saved part.

export function usePartCategories() {
  const [categories, setCategories] = useState([]);
  const [ready, setReady] = useState(false);
  // Put on screen rather than logged. A category list that silently failed to
  // save would look identical to an empty one.
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!isSupabaseConfigured()) { setReady(true); return; }
    try {
      const list = await loadPartCategories();
      setCategories(list);
      setError(null);
    } catch (e) {
      setError(`Category list could not be loaded: ${e?.message || String(e)}`);
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
      await addPartCategory({ name: clean });
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
      await renamePartCategory(id, clean);
      setError(null);
      await refresh();
    } catch (e) {
      setError(`Rename to "${clean}" did NOT save: ${e?.message || String(e)}`);
    }
  }, [refresh]);

  const remove = useCallback(async (id) => {
    try {
      await removePartCategory(id);
      setError(null);
      await refresh();
    } catch (e) {
      setError(`That category was NOT removed: ${e?.message || String(e)}`);
    }
  }, [refresh]);

  return { categories, ready, error, add, rename, remove, refresh };
}
