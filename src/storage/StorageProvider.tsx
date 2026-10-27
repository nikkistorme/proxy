import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
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
}

const StorageContext = createContext<StorageContextValue>({ available: true, dropped: false, account: {} });

export function StorageProvider({ backend, children }: { backend?: StorageBackend; children: ReactNode }) {
  const [value, setValue] = useState<StorageContextValue>({ available: true, dropped: false, account: {} });

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
      if (!cancelled) setValue((current) => ({ ...current, storage, available, account: settings?.options ?? {} }));
    })();
    return () => {
      cancelled = true;
    };
  }, [backend]);

  return <StorageContext.Provider value={value}>{children}</StorageContext.Provider>;
}

export function useStorageStatus(): Pick<StorageContextValue, 'available' | 'dropped'> {
  const { available, dropped } = useContext(StorageContext);
  return { available, dropped };
}

/** The storage interface, once the startup check has run (AR-6). */
export function useStorage(): Storage | undefined {
  return useContext(StorageContext).storage;
}

/** An option's value through the resolver (AR-7). Components never read stored options directly. */
export function useOption<K extends OptionName>(name: K): Options[K] {
  const { account } = useContext(StorageContext);
  return useMemo(() => resolveOption(name, { account }), [name, account]);
}
