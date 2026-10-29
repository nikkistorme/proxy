import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ItemKind, NewItem, StoredItem } from './storage';
import { useStorage } from './StorageProvider';

export interface SavedItems<T extends StoredItem> {
  items: NewItem<T>[];
  /** True once the first list has finished, or failed because storage can't be read. */
  loaded: boolean;
  /** Adds or replaces an item at once; it autosaves at most once per `delay` (PS-1). */
  save: (item: NewItem<T>) => void;
  /** Removes an item and its stored copy. A late list can't bring it back. */
  remove: (id: string) => void;
}

/**
 * The items of one kind (AR-6): listed once storage is ready, with changes
 * made meanwhile winning. Each item autosaves at most once per `delay` after
 * its first unsaved change (PS-1), and waiting saves are written on `pagehide`
 * and when the owner unmounts.
 */
export function useSavedItems<T extends StoredItem>(kind: ItemKind, delay: number): SavedItems<T> {
  const storage = useStorage();
  const [items, setItems] = useState<NewItem<T>[]>([]);
  const [loaded, setLoaded] = useState(false);
  const storageRef = useRef(storage);
  /** The latest unsaved version of each item, and its timer, by id. */
  const pending = useRef(new Map<string, NewItem<T>>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  /** Items deleted this visit, so a list that finishes reading late doesn't bring them back. */
  const deleted = useRef(new Set<string>());

  const flush = useCallback(
    (id: string) => {
      clearTimeout(timers.current.get(id));
      timers.current.delete(id);
      const item = pending.current.get(id);
      const current = storageRef.current;
      if (!item || !current) return;
      pending.current.delete(id);
      // A failed save leaves the item in the app for this visit, like card sets.
      current.put<T>(kind, item).catch(() => {});
    },
    [kind],
  );

  const save = useCallback(
    (item: NewItem<T>) => {
      setItems((current) => {
        const index = current.findIndex((own) => own.id === item.id);
        return index < 0 ? [...current, item] : current.map((own, i) => (i === index ? item : own));
      });
      pending.current.set(item.id, item);
      if (!timers.current.has(item.id)) {
        timers.current.set(
          item.id,
          setTimeout(() => flush(item.id), delay),
        );
      }
    },
    [flush, delay],
  );

  const remove = useCallback(
    (id: string) => {
      setItems((current) => current.filter((item) => item.id !== id));
      clearTimeout(timers.current.get(id));
      timers.current.delete(id);
      pending.current.delete(id);
      deleted.current.add(id);
      // Like a failed save, a failed delete leaves things as they are for this visit.
      storageRef.current?.delete(kind, id).catch(() => {});
    },
    [kind],
  );

  // Read the saved items once storage is ready. Anything changed meanwhile wins.
  useEffect(() => {
    storageRef.current = storage;
    if (!storage) return;
    let cancelled = false;
    storage
      .list<T>(kind)
      .then((saved) => {
        if (cancelled) return;
        [...deleted.current].forEach((id) => void storage.delete(kind, id).catch(() => {}));
        const fresh = saved.filter((item) => !deleted.current.has(item.id));
        setItems((current) => [...fresh.filter((item) => !current.some((own) => own.id === item.id)), ...current]);
        // Changes made before storage was ready save now.
        [...pending.current.keys()].filter((id) => !timers.current.has(id)).forEach(flush);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [storage, kind, flush]);

  // Save what's waiting when the page is closed or hidden, and when the owner goes.
  useEffect(() => {
    const flushAll = () => [...pending.current.keys()].forEach(flush);
    window.addEventListener('pagehide', flushAll);
    return () => {
      window.removeEventListener('pagehide', flushAll);
      flushAll();
    };
  }, [flush]);

  return useMemo(() => ({ items, loaded, save, remove }), [items, loaded, save, remove]);
}
