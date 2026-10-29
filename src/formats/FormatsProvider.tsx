import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { Format, FormatItem } from '../model/format';
import type { StoredItem } from '../storage/storage';
import { useSavedItems } from '../storage/useSavedItems';

/** Autosave waits this long after a format's first unsaved change, so each item saves at most once a second (PS-1). */
export const FORMAT_SAVE_DELAY = 1000;

interface FormatsContextValue {
  formats: FormatItem[];
  /** True once the saved formats have been listed, so a saved default can be told from a deleted one. */
  loaded: boolean;
  /** Adds or replaces a format; its item autosaves (PS-1). */
  saveFormat: (format: FormatItem) => void;
  /** Removes a format and its item (FS-2). Running sessions keep their seats and piles. */
  deleteFormat: (id: string) => void;
}

const FormatsContext = createContext<FormatsContextValue>({ formats: [], loaded: true, saveFormat: () => {}, deleteFormat: () => {} });

export function FormatsProvider({ children }: { children: ReactNode }) {
  const { items: formats, loaded, save: saveFormat, remove: deleteFormat } = useSavedItems<Format & StoredItem>('format', FORMAT_SAVE_DELAY);
  const value = useMemo(() => ({ formats, loaded, saveFormat, deleteFormat }), [formats, loaded, saveFormat, deleteFormat]);
  return <FormatsContext.Provider value={value}>{children}</FormatsContext.Provider>;
}

/** The saved formats (the presets are in `PRESETS`), and the ways to change them. */
export function useFormats(): FormatsContextValue {
  return useContext(FormatsContext);
}
