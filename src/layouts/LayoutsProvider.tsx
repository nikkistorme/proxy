import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { CardFace } from '../model/card';
import type { Layout, LayoutDesign } from '../model/layout';
import { chooseLayout } from '../model/layoutChoice';
import type { NewItem } from '../storage/storage';
import { useOption, useStorage } from '../storage/StorageProvider';

/** A layout as the app holds it: `put` stamps the time and version when it saves. */
export type LayoutItem = NewItem<Layout>;

/** Autosave waits this long after a layout's first unsaved change, so each item saves at most once a second (PS-1). */
export const LAYOUT_SAVE_DELAY = 1000;

interface LayoutsContextValue {
  layouts: LayoutItem[];
  /** Adds or replaces a layout. Cards using it re-render at once (LY-10); its item autosaves (PS-1). */
  saveLayout: (layout: LayoutItem) => void;
  /** Removes a layout and its item (LY-1). Cards that used it fall through to their next choice (LY-8). */
  deleteLayout: (id: string) => void;
}

const LayoutsContext = createContext<LayoutsContextValue>({ layouts: [], saveLayout: () => {}, deleteLayout: () => {} });

export function LayoutsProvider({ children }: { children: ReactNode }) {
  const storage = useStorage();
  const [layouts, setLayouts] = useState<LayoutItem[]>([]);
  const storageRef = useRef(storage);
  /** The latest unsaved version of each layout, and its timer, by id. */
  const pending = useRef(new Map<string, LayoutItem>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  /** Layouts deleted this visit, so a list that finishes reading late doesn't bring them back. */
  const deleted = useRef(new Set<string>());

  const flush = useCallback((id: string) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    const layout = pending.current.get(id);
    const current = storageRef.current;
    if (!layout || !current) return;
    pending.current.delete(id);
    // A failed save leaves the layout in the app for this visit, like card sets.
    current.put<Layout>('layout', layout).catch(() => {});
  }, []);

  const saveLayout = useCallback(
    (layout: LayoutItem) => {
      setLayouts((current) => {
        const index = current.findIndex((item) => item.id === layout.id);
        return index < 0 ? [...current, layout] : current.map((item, i) => (i === index ? layout : item));
      });
      pending.current.set(layout.id, layout);
      if (!timers.current.has(layout.id)) {
        timers.current.set(
          layout.id,
          setTimeout(() => flush(layout.id), LAYOUT_SAVE_DELAY),
        );
      }
    },
    [flush],
  );

  const deleteLayout = useCallback((id: string) => {
    setLayouts((current) => current.filter((item) => item.id !== id));
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    pending.current.delete(id);
    deleted.current.add(id);
    // Like a failed save, a failed delete leaves things as they are for this visit.
    storageRef.current?.delete('layout', id).catch(() => {});
  }, []);

  // Read the saved layouts once storage is ready. Anything changed meanwhile wins.
  useEffect(() => {
    storageRef.current = storage;
    if (!storage) return;
    let cancelled = false;
    void storage.list<Layout>('layout').then((saved) => {
      if (cancelled) return;
      [...deleted.current].forEach((id) => void storage.delete('layout', id).catch(() => {}));
      const fresh = saved.filter((item) => !deleted.current.has(item.id));
      setLayouts((current) => [...fresh.filter((item) => !current.some((own) => own.id === item.id)), ...current]);
      // Changes made before storage was ready save now.
      [...pending.current.keys()].filter((id) => !timers.current.has(id)).forEach(flush);
    });
    return () => {
      cancelled = true;
    };
  }, [storage, flush]);

  // Save what's waiting when the page is closed or hidden, and when the provider goes.
  useEffect(() => {
    const flushAll = () => [...pending.current.keys()].forEach(flush);
    window.addEventListener('pagehide', flushAll);
    return () => {
      window.removeEventListener('pagehide', flushAll);
      flushAll();
    };
  }, [flush]);

  const value = useMemo(() => ({ layouts, saveLayout, deleteLayout }), [layouts, saveLayout, deleteLayout]);
  return <LayoutsContext.Provider value={value}>{children}</LayoutsContext.Provider>;
}

/** Every layout in the app, and the ways to change them. */
export function useLayouts(): LayoutsContextValue {
  return useContext(LayoutsContext);
}

/** Works out the layout a face is drawn with (LY-8), with the mapping and default read through the options resolver (AR-7). */
export function useLayoutChooser(): (face: CardFace) => LayoutDesign {
  const { layouts } = useContext(LayoutsContext);
  const layoutByType = useOption('layoutByType');
  const defaultLayout = useOption('defaultLayout');
  return useCallback((face: CardFace) => chooseLayout(face, layouts, { layoutByType, defaultLayout }), [layouts, layoutByType, defaultLayout]);
}

/** The layout a face is drawn with (LY-8). */
export function useLayoutFor(face: CardFace): LayoutDesign {
  const choose = useLayoutChooser();
  return useMemo(() => choose(face), [choose, face]);
}
