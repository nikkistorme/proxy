// The key-value stores under the storage interface (AR-6). This is the only
// file that touches IndexedDB.

import { del, get, keys, set } from 'idb-keyval';
import type { StorageBackend } from './storage';

/** IndexedDB through idb-keyval, the only V1 implementation. */
export function indexedDbBackend(): StorageBackend {
  return {
    get: (key) => get(key),
    set: (key, value) => set(key, value),
    del: (key) => del(key),
    keys: async () => (await keys()).filter((key): key is string => typeof key === 'string'),
  };
}

/** An in-memory store, for tests and for when IndexedDB is unavailable (PS-6). Values are cloned like IndexedDB does. */
export function memoryBackend(initial: Record<string, unknown> = {}): StorageBackend & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>(Object.entries(initial).map(([key, value]) => [key, structuredClone(value)]));
  return {
    data,
    get: async (key) => structuredClone(data.get(key)),
    set: async (key, value) => {
      data.set(key, structuredClone(value));
    },
    del: async (key) => {
      data.delete(key);
    },
    keys: async () => [...data.keys()],
  };
}

const PROBE_KEY = 'proxy-storage-probe';

/** Whether the store can save at all. Private windows and blocked site data fail here (PS-6). */
export async function canSave(backend: StorageBackend): Promise<boolean> {
  try {
    await backend.set(PROBE_KEY, 1);
    await backend.del(PROBE_KEY);
    return true;
  } catch {
    return false;
  }
}
