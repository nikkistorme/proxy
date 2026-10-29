import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import type { CardFace } from '../model/card';
import type { Layout, LayoutDesign } from '../model/layout';
import { chooseLayout } from '../model/layoutChoice';
import type { NewItem } from '../storage/storage';
import { useOption } from '../storage/StorageProvider';
import { useSavedItems } from '../storage/useSavedItems';

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
  const { items: layouts, save: saveLayout, remove: deleteLayout } = useSavedItems<Layout>('layout', LAYOUT_SAVE_DELAY);
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
