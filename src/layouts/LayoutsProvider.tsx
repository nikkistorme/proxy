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
}

const LayoutsContext = createContext<LayoutsContextValue>({ layouts: [], saveLayout: () => {} });

export function LayoutsProvider({ children }: { children: ReactNode }) {
  const storage = useStorage();
  const [layouts, setLayouts] = useState<LayoutItem[]>([]);
  const storageRef = useRef(storage);
  /** The latest unsaved version of each layout, and its timer, by id. */
  const pending = useRef(new Map<string, LayoutItem>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

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

  // Read the saved layouts once storage is ready. Anything changed meanwhile wins.
  useEffect(() => {
    storageRef.current = storage;
    if (!storage) return;
    let cancelled = false;
    void storage.list<Layout>('layout').then((saved) => {
      if (cancelled) return;
      setLayouts((current) => [...saved.filter((item) => !current.some((own) => own.id === item.id)), ...current]);
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

  const value = useMemo(() => ({ layouts, saveLayout }), [layouts, saveLayout]);
  return <LayoutsContext.Provider value={value}>{children}</LayoutsContext.Provider>;
}

/** Every layout in the app, and the way to change one. */
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
