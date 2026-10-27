import { beforeEach, describe, expect, it, vi } from 'vitest';
import { canSave, indexedDbBackend, memoryBackend } from './backends';
import { createStorage, itemKey, newItemId, SAVE_VERSION, type ItemKind, type StorageBackend, type StoredItem } from './storage';

const idb = vi.hoisted(() => ({ data: new Map<IDBValidKey, unknown>() }));
vi.mock('idb-keyval', () => ({
  get: async (key: IDBValidKey) => idb.data.get(key),
  set: async (key: IDBValidKey, value: unknown) => void idb.data.set(key, value),
  del: async (key: IDBValidKey) => void idb.data.delete(key),
  keys: async () => [...idb.data.keys()],
}));

interface Note extends StoredItem {
  text: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const now = () => new Date('2026-10-27T12:00:00Z');

describe('PS-7 profile keys', () => {
  it('keeps the live site and a PR preview apart', () => {
    const live = itemKey('/proxy/', 'guest', 'layout', 'a');
    const preview = itemKey('/proxy/pr-preview/pr-12/', 'guest', 'layout', 'a');
    expect(live).not.toBe(preview);
    expect(preview.startsWith(live.slice(0, -1))).toBe(false);
  });

  it('puts the profile in every key', () => {
    expect(itemKey('/proxy/', 'guest', 'layout', 'a')).not.toBe(itemKey('/proxy/', 'someone', 'layout', 'a'));
  });

  it('lists only the items saved under the same base path and profile', async () => {
    const backend = memoryBackend();
    const live = createStorage(backend, { basePath: '/proxy/', now });
    const preview = createStorage(backend, { basePath: '/proxy/pr-preview/pr-12/', now });
    const other = createStorage(backend, { basePath: '/proxy/', profile: 'someone', now });
    await live.put<Note>('layout', { id: 'live', text: 'live' });
    await preview.put<Note>('layout', { id: 'preview', text: 'preview' });
    await other.put<Note>('layout', { id: 'other', text: 'other' });

    expect((await live.list<Note>('layout')).map((n) => n.id)).toEqual(['live']);
    expect((await preview.list<Note>('layout')).map((n) => n.id)).toEqual(['preview']);
    expect(await live.get('layout', 'preview')).toBeUndefined();
  });
});

describe('AR-6 item ids', () => {
  it('are random UUIDs', () => {
    const a = newItemId();
    expect(a).toMatch(UUID);
    expect(newItemId()).not.toBe(a);
  });
});

const backends: [string, () => StorageBackend][] = [
  ['memory', () => memoryBackend()],
  ['IndexedDB', () => indexedDbBackend()],
];

describe.each(backends)('AR-6 storage interface (%s)', (_, makeBackend) => {
  beforeEach(() => idb.data.clear());

  it('puts, gets, lists and deletes items by kind', async () => {
    const storage = createStorage(makeBackend(), { basePath: '/proxy/', now });
    const saved = await storage.put<Note>('layout', { id: 'one', text: 'Hello', gameId: 'game-1' });
    expect(saved).toEqual({ id: 'one', text: 'Hello', gameId: 'game-1', updatedAt: '2026-10-27T12:00:00.000Z', version: SAVE_VERSION });
    await storage.put<Note>('format', { id: 'two', text: 'Other kind' });

    expect(await storage.get<Note>('layout', 'one')).toEqual(saved);
    expect(await storage.list<Note>('layout')).toEqual([saved]);

    await storage.delete('layout', 'one');
    expect(await storage.get('layout', 'one')).toBeUndefined();
    expect(await storage.list('layout')).toEqual([]);
    expect(await storage.list('format')).toHaveLength(1);
  });

  it('stamps a new updatedAt on every save', async () => {
    let time = new Date('2026-10-27T12:00:00Z');
    const storage = createStorage(makeBackend(), { basePath: '/proxy/', now: () => time });
    await storage.put<Note>('layout', { id: 'one', text: 'First' });
    time = new Date('2026-10-27T12:05:00Z');
    await storage.put<Note>('layout', { id: 'one', text: 'Second' });
    expect(await storage.get<Note>('layout', 'one')).toMatchObject({ text: 'Second', updatedAt: '2026-10-27T12:05:00.000Z' });
  });
});

describe('PS-5 older saves before V1', () => {
  const key = (kind: ItemKind, id: string) => itemKey('/proxy/', 'guest', kind, id);

  it('drops an item written with an older version and reports it', async () => {
    const backend = memoryBackend({
      [key('layout', 'old')]: { id: 'old', updatedAt: '2026-01-01T00:00:00Z', version: SAVE_VERSION - 1 },
      [key('layout', 'older')]: { id: 'older', updatedAt: '2026-01-01T00:00:00Z', version: SAVE_VERSION - 1 },
    });
    const onDropped = vi.fn();
    const storage = createStorage(backend, { basePath: '/proxy/', now, onDropped });
    await storage.put<Note>('layout', { id: 'new', text: 'Current' });

    expect((await storage.list('layout')).map((item) => item.id)).toEqual(['new']);
    expect(onDropped).toHaveBeenCalledTimes(2);
    expect(onDropped).toHaveBeenCalledWith('layout');
    expect(backend.data.has(key('layout', 'old'))).toBe(false);
  });

  it('drops an older item read by id', async () => {
    const backend = memoryBackend({ [key('settings', 'account')]: { id: 'account', updatedAt: '', version: SAVE_VERSION - 1 } });
    const onDropped = vi.fn();
    const storage = createStorage(backend, { basePath: '/proxy/', onDropped });
    expect(await storage.get('settings', 'account')).toBeUndefined();
    expect(onDropped).toHaveBeenCalledOnce();
  });

  it('leaves an item from a newer version alone without reading it', async () => {
    const backend = memoryBackend({ [key('layout', 'next')]: { id: 'next', updatedAt: '', version: SAVE_VERSION + 1 } });
    const onDropped = vi.fn();
    const storage = createStorage(backend, { basePath: '/proxy/', onDropped });
    expect(await storage.get('layout', 'next')).toBeUndefined();
    expect(backend.data.has(key('layout', 'next'))).toBe(true);
    expect(onDropped).not.toHaveBeenCalled();
  });
});

describe('PS-6 storage unavailable', () => {
  it('reports whether the store can save', async () => {
    expect(await canSave(memoryBackend())).toBe(true);
    const blocked: StorageBackend = { ...memoryBackend(), set: () => Promise.reject(new DOMException('blocked', 'SecurityError')) };
    expect(await canSave(blocked)).toBe(false);
  });

  it('treats a store that throws straight away as unavailable', async () => {
    const throwing: StorageBackend = {
      ...memoryBackend(),
      set: () => {
        throw new ReferenceError('indexedDB is not defined');
      },
    };
    expect(await canSave(throwing)).toBe(false);
  });
});
