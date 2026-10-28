import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { resolveOption, type OptionName, type Options } from '../options/resolver';
import { canSave, indexedDbBackend, memoryBackend } from './backends';
import { createStorage, type Storage, type StorageBackend, type StoredItem } from './storage';

/** The account's options, saved as one settings item per profile (AR-7). */
export interface AccountSettings extends StoredItem {
  options: Partial<Options>;
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
}

/** Sets an option at the account level, the only level in V1 (AR-7). */
export type SetOption = <K extends OptionName>(name: K, value: Options[K]) => void;

const StorageContext = createContext<StorageContextValue>({ available: true, dropped: false, account: {}, setOption: () => {} });

export function StorageProvider({ backend, children }: { backend?: StorageBackend; children: ReactNode }) {
  const [value, setValue] = useState<Omit<StorageContextValue, 'setOption'>>({ available: true, dropped: false, account: {} });
  /** The latest account options and storage, so quick changes in a row each save on top of the last. */
  const account = useRef<Partial<Options>>({});
  const storageRef = useRef<Storage>(undefined);

  const setOption = useCallback<SetOption>((name, option) => {
    const options = { ...account.current, [name]: option };
    account.current = options;
    setValue((current) => ({ ...current, account: options }));
    // A failed save keeps the option in the app for this visit, like layouts.
    storageRef.current?.put<AccountSettings>('settings', { id: ACCOUNT_SETTINGS_ID, options }).catch(() => {});
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
      const settings = await storage.get<AccountSettings>('settings', ACCOUNT_SETTINGS_ID);
      if (cancelled) return;
      // An option set before the startup check finished wins over the saved one.
      account.current = { ...settings?.options, ...account.current };
      storageRef.current = storage;
      setValue((current) => ({ ...current, storage, available, account: account.current }));
    })();
    return () => {
      cancelled = true;
    };
  }, [backend]);

  const context = useMemo(() => ({ ...value, setOption }), [value, setOption]);
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
