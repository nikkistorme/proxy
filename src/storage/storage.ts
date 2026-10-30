// The one storage interface every save goes through (AR-6). Items are saved
// separately by kind, under keys built only here (PS-7), and stamped with the
// save format version so older ones can be dropped before V1 ships (PS-5).

export type ItemKind = 'session' | 'snapshot' | 'layout' | 'format' | 'cardSet' | 'settings';

/** The save format version. Bump it when a saved model changes shape (PS-5). */
export const SAVE_VERSION = 1;

/** V1 has only the guest profile (PS-7). Accounts become other profiles later (#45). */
export const GUEST_PROFILE = 'guest';

/** Fields every saved item has (AR-6). */
export interface StoredItem {
  /** A random UUID, so items made on different devices can't clash (#45). */
  id: string;
  /** ISO time of the last save. */
  updatedAt: string;
  /** The save format version it was written with (PS-5). */
  version: number;
  gameId?: string;
}

/** What callers hand to `put`: `put` stamps the time and version. */
export type NewItem<T extends StoredItem> = Omit<T, 'updatedAt' | 'version'>;

export interface Storage {
  get<T extends StoredItem>(kind: ItemKind, id: string): Promise<T | undefined>;
  put<T extends StoredItem>(kind: ItemKind, item: NewItem<T>): Promise<T>;
  list<T extends StoredItem>(kind: ItemKind): Promise<T[]>;
  delete(kind: ItemKind, id: string): Promise<void>;
}

/** A plain key-value store under the interface: IndexedDB in the app, memory in tests. */
export interface StorageBackend {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  del(key: string): Promise<void>;
  keys(): Promise<string[]>;
}

export interface StorageOptions {
  /** The app's base path, so a PR preview never shares the live site's saves (PS-7). */
  basePath?: string;
  profile?: string;
  now?: () => Date;
  /** Called once for each older item dropped on read (PS-5). */
  onDropped?: (kind: ItemKind) => void;
}

/** A new item id (AR-6). Never a counter. */
export function newItemId(): string {
  return crypto.randomUUID();
}

/** The key prefix for one kind, ending in the separator so `/proxy/` never matches `/proxy/pr-preview/…`. */
export function kindPrefix(basePath: string, profile: string, kind: ItemKind): string {
  return `${basePath}|${profile}|${kind}|`;
}

export function itemKey(basePath: string, profile: string, kind: ItemKind, id: string): string {
  return kindPrefix(basePath, profile, kind) + id;
}

export function createStorage(backend: StorageBackend, options: StorageOptions = {}): Storage {
  const basePath = options.basePath ?? import.meta.env.BASE_URL;
  const profile = options.profile ?? GUEST_PROFILE;
  const now = options.now ?? (() => new Date());

  /** The item if it's readable now. An older one is deleted and reported; a newer one is left alone. */
  async function readable<T extends StoredItem>(kind: ItemKind, key: string, value: unknown): Promise<T | undefined> {
    const item = value as T | undefined;
    if (!item || typeof item.version !== 'number') return undefined;
    if (item.version < SAVE_VERSION) {
      await backend.del(key);
      options.onDropped?.(kind);
      return undefined;
    }
    return item.version === SAVE_VERSION ? item : undefined;
  }

  return {
    async get<T extends StoredItem>(kind: ItemKind, id: string) {
      const key = itemKey(basePath, profile, kind, id);
      return readable<T>(kind, key, await backend.get(key));
    },
    async put<T extends StoredItem>(kind: ItemKind, item: NewItem<T>) {
      const saved = { ...item, updatedAt: now().toISOString(), version: SAVE_VERSION } as T;
      await backend.set(itemKey(basePath, profile, kind, item.id), saved);
      return saved;
    },
    async list<T extends StoredItem>(kind: ItemKind) {
      const prefix = kindPrefix(basePath, profile, kind);
      const keys = (await backend.keys()).filter((key) => key.startsWith(prefix));
      const items = await Promise.all(keys.map(async (key) => readable<T>(kind, key, await backend.get(key))));
      return items.filter((item): item is Awaited<T> => item !== undefined);
    },
    async delete(kind: ItemKind, id: string) {
      await backend.del(itemKey(basePath, profile, kind, id));
    },
  };
}

/** The key of the one-visit note an import leaves for the page that reloads after it (PS-4). Built here with the other keys (PS-7). */
function importNoteKey(): string {
  return `${import.meta.env.BASE_URL}|${GUEST_PROFILE}|import-note`;
}

/** Leaves the imported file's name for the next page load to announce. Session storage, so it lasts one visit. */
export function setImportNote(fileName: string): void {
  try {
    sessionStorage.setItem(importNoteKey(), fileName);
  } catch {
    // The import still worked; it just isn't announced.
  }
}

/** The file name left by an import, once: reading it removes it. */
export function takeImportNote(): string | undefined {
  try {
    const key = importNoteKey();
    const note = sessionStorage.getItem(key) ?? undefined;
    sessionStorage.removeItem(key);
    return note;
  } catch {
    return undefined;
  }
}
