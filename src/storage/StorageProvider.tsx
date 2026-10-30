import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { resolveOption, type OptionName, type Options } from '../options/resolver';
import { canSave, indexedDbBackend, memoryBackend } from './backends';
import type { Bundle } from '../model/bundle';
import { createStorage, setImportNote, type NewItem, type Storage, type StorageBackend, type StoredItem } from './storage';

/** The account's options, saved as one settings item per profile (AR-7). */
export interface AccountSettings extends StoredItem {
  options: Partial<Options>;
  /** The session to reopen (PS-2). App state rather than an option, so it skips the resolver. */
  currentSessionId?: string;
}

/**
 * The settings item's id. It's one per profile rather than a new UUID, so the
 * same item on two devices is the same item when sync arrives (#45).
 */
export const ACCOUNT_SETTINGS_ID = 'account';

interface StorageContextValue {
  /** Undefined until the startup check has run. */
  storage?: Storage;
  /** False when the browser can't save, so progress is kept in memory only (PS-6). */
  available: boolean;
  /** Older saves were removed on load (PS-5). */
  dropped: boolean;
  account: Partial<Options>;
  setOption: SetOption;
  currentSessionId?: string;
  setCurrentSessionId: (id: string) => void;
  /** Writes a bundle's items and reloads the page (PS-4). Needs `available`. */
  importBundle: (bundle: Bundle, fileName: string) => Promise<void>;
}

/** Sets an option at the account level, the only level in V1 (AR-7). */
export type SetOption = <K extends OptionName>(name: K, value: Options[K]) => void;

const StorageContext = createContext<StorageContextValue>({ available: true, dropped: false, account: {}, setOption: () => {}, setCurrentSessionId: () => {}, importBundle: () => Promise.resolve() });

/** The same storage with writes switched off while `frozen` is set, so nothing the app saves can land after an import's writes (PS-4). */
function guarded(storage: Storage, frozen: { current: boolean }): Storage {
  return {
    get: (kind, id) => storage.get(kind, id),
    list: (kind) => storage.list(kind),
    put: async <T extends StoredItem>(kind: Parameters<Storage['put']>[0], item: NewItem<T>) => (frozen.current ? ({ ...item, updatedAt: '', version: 0 } as T) : storage.put<T>(kind, item)),
    delete: async (kind, id) => {
      if (!frozen.current) await storage.delete(kind, id);
    },
  };
}

interface StorageProviderProps {
  backend?: StorageBackend;
  /** Reloads the page after an import; tests swap it out. */
  reload?: () => void;
  children: ReactNode;
}

export function StorageProvider({ backend, reload = () => window.location.reload(), children }: StorageProviderProps) {
  const [value, setValue] = useState<Omit<StorageContextValue, 'setOption' | 'setCurrentSessionId' | 'importBundle'>>({ available: true, dropped: false, account: {} });
  /** The latest account options and storage, so quick changes in a row each save on top of the last. */
  const account = useRef<Partial<Options>>({});
  const currentId = useRef<string>(undefined);
  const storageRef = useRef<Storage>(undefined);
  /** The unguarded storage and the switch that stops the app's own saves, for an import (PS-4). */
  const rawRef = useRef<Storage>(undefined);
  const frozen = useRef(false);
  const reloadRef = useRef(reload);
  useEffect(() => {
    reloadRef.current = reload;
  });

  /** Writes both parts of the settings item, so saving one never drops the other. */
  const saveSettings = useCallback(() => {
    // A failed save keeps the setting in the app for this visit, like layouts.
    storageRef.current?.put<AccountSettings>('settings', { id: ACCOUNT_SETTINGS_ID, options: account.current, currentSessionId: currentId.current }).catch(() => {});
  }, []);

  const setOption = useCallback<SetOption>(
    (name, option) => {
      account.current = { ...account.current, [name]: option };
      setValue((current) => ({ ...current, account: account.current }));
      saveSettings();
    },
    [saveSettings],
  );

  const setCurrentSessionId = useCallback(
    (id: string) => {
      currentId.current = id;
      setValue((current) => ({ ...current, currentSessionId: id }));
      saveSettings();
    },
    [saveSettings],
  );

  const importBundle = useCallback(async (bundle: Bundle, fileName: string) => {
    const raw = rawRef.current;
    if (!raw) throw new Error('Storage is not ready.');
    // Stop the app's own saves first: a waiting debounced save or the pagehide flush must not overwrite what is written next.
    frozen.current = true;
    try {
      const write = <T extends StoredItem>(kind: Parameters<Storage['put']>[0], items: readonly NewItem<T>[]) => Promise.all(items.map((item) => raw.put<T>(kind, item)));
      await Promise.all([write('cardSet', bundle.cardSets), write('layout', bundle.layouts), write('format', bundle.formats), write('snapshot', bundle.snapshots), write('session', [bundle.session])]);
      // Last, so the current session only changes once its item is there.
      await raw.put<AccountSettings>('settings', { id: ACCOUNT_SETTINGS_ID, options: bundle.settings.options, currentSessionId: bundle.session.id });
    } catch (error) {
      frozen.current = false;
      throw error;
    }
    setImportNote(fileName);
    reloadRef.current();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const markDropped = () => {
      if (!cancelled) setValue((current) => ({ ...current, dropped: true }));
    };
    void (async () => {
      const preferred = backend ?? indexedDbBackend();
      const available = await canSave(preferred);
      const storage = createStorage(available ? preferred : memoryBackend(), { onDropped: markDropped });
      const settings = await storage.get<AccountSettings>('settings', ACCOUNT_SETTINGS_ID).catch(() => undefined);
      if (cancelled) return;
      // An option set before the startup check finished wins over the saved one.
      account.current = { ...settings?.options, ...account.current };
      currentId.current ??= settings?.currentSessionId;
      rawRef.current = storage;
      const guard = guarded(storage, frozen);
      storageRef.current = guard;
      setValue((current) => ({ ...current, storage: guard, available, account: account.current, currentSessionId: currentId.current }));
    })();
    return () => {
      cancelled = true;
    };
  }, [backend]);

  const context = useMemo(() => ({ ...value, setOption, setCurrentSessionId, importBundle }), [value, setOption, setCurrentSessionId, importBundle]);
  return <StorageContext.Provider value={context}>{children}</StorageContext.Provider>;
}

export function useStorageStatus(): Pick<StorageContextValue, 'available' | 'dropped'> {
  const { available, dropped } = useContext(StorageContext);
  return { available, dropped };
}

/** The storage interface, once the startup check has run (AR-6). */
export function useStorage(): Storage | undefined {
  return useContext(StorageContext).storage;
}

/** Sets an option and saves it in the settings item (AR-7). It reaches every reader at once. */
export function useSetOption(): SetOption {
  return useContext(StorageContext).setOption;
}

/** An option's value through the resolver (AR-7). Components never read stored options directly. */
export function useOption<K extends OptionName>(name: K): Options[K] {
  const { account } = useContext(StorageContext);
  return useMemo(() => resolveOption(name, { account }), [name, account]);
}

/** The id of the session to reopen (PS-2), once storage is ready, and a way to record the current one. */
export function useCurrentSession(): Pick<StorageContextValue, 'currentSessionId' | 'setCurrentSessionId'> {
  const { currentSessionId, setCurrentSessionId } = useContext(StorageContext);
  return { currentSessionId, setCurrentSessionId };
}

/** Writes a bundle's items to storage, stops the app's own saves, and reloads the page (PS-4). */
export function useImportBundle(): Pick<StorageContextValue, 'importBundle' | 'available'> {
  const { importBundle, available } = useContext(StorageContext);
  return { importBundle, available };
}

/** The account's saved options and current session id, as last saved, for an export (PS-4). */
export function useAccountSettings(): { options: Partial<Options>; currentSessionId?: string } {
  const { account, currentSessionId } = useContext(StorageContext);
  return { options: account, currentSessionId };
}
