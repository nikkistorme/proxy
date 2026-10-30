import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { memoryBackend } from './backends';
import basicJson from '../../tests/fixtures/bundles/basic.json?raw';
import { readBundle } from '../model/bundle';
import type { Layout } from '../model/layout';
import type { SessionItem } from '../store/sessionItem';
import { itemKey, SAVE_VERSION, takeImportNote, type Storage, type StorageBackend } from './storage';
import { StorageProvider, useImportBundle, useOption, useSetOption, useStorage, type SetOption } from './StorageProvider';

const settingsKey = itemKey(import.meta.env.BASE_URL, 'guest', 'settings', 'account');

// jsdom has no matchMedia; the system here is always light.
beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete document.documentElement.dataset.theme;
});

describe('AR-6 the app reads through the storage interface', () => {
  it('uses the swapped-in memory storage for the account settings (AR-7)', async () => {
    const backend = memoryBackend({ [settingsKey]: { id: 'account', updatedAt: '', version: SAVE_VERSION, options: { theme: 'dark' } } });
    render(<App storageBackend={backend} />);
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'));
    expect(screen.queryByRole('note')).not.toBeInTheDocument();
  });
});

describe('PS-5 older saves notice', () => {
  it('says older saves were removed', async () => {
    const backend = memoryBackend({ [settingsKey]: { id: 'account', updatedAt: '', version: SAVE_VERSION - 1, options: { theme: 'dark' } } });
    render(<App storageBackend={backend} />);
    expect(await screen.findByRole('note')).toHaveTextContent('Saves from an older version of Proxy were removed.');
    // The old item was dropped; the session id is then written to a fresh one without its options.
    await waitFor(() => expect(backend.data.get(settingsKey)).toMatchObject({ options: {}, currentSessionId: expect.any(String) }));
    expect(document.documentElement.dataset.theme).not.toBe('dark');
  });
});

describe('PS-6 storage unavailable', () => {
  it('still works and says progress won’t be saved', async () => {
    const blocked: StorageBackend = { ...memoryBackend(), set: () => Promise.reject(new DOMException('blocked', 'SecurityError')) };
    render(<App storageBackend={blocked} />);
    expect(await screen.findByRole('note')).toHaveTextContent('progress won’t be saved');
    expect(screen.getByRole('button', { name: /^P1 main deck,/ })).toBeInTheDocument();
  });
});

describe('AR-7 setting an option', () => {
  it('reaches readers at once and saves the settings item, keeping the other options', async () => {
    const backend = memoryBackend({ [settingsKey]: { id: 'account', updatedAt: '', version: SAVE_VERSION, options: { theme: 'dark' } } });
    let setOption: SetOption = () => {};
    function Reader() {
      setOption = useSetOption();
      return (
        <p>
          {useOption('theme')}, {useOption('defaultLayout') ?? 'built in'}
        </p>
      );
    }
    render(
      <StorageProvider backend={backend}>
        <Reader />
      </StorageProvider>,
    );
    // The saved theme shows once the startup check has run, so saves go to this backend.
    expect(await screen.findByText('dark, built in')).toBeInTheDocument();
    act(() => setOption('defaultLayout', 'l-hero'));
    expect(screen.getByText('dark, l-hero')).toBeInTheDocument();
    act(() => setOption('layoutByType', { hero: 'l-hero' }));
    await waitFor(() =>
      expect(backend.data.get(settingsKey)).toMatchObject({
        id: 'account',
        version: SAVE_VERSION,
        options: { theme: 'dark', defaultLayout: 'l-hero', layoutByType: { hero: 'l-hero' } },
      }),
    );
  });
});

describe('PS-4 importing a bundle', () => {
  const read = readBundle(basicJson);
  if ('error' in read) throw new Error(read.error);
  const { bundle } = read;
  const key = (kind: Parameters<typeof itemKey>[2], id: string) => itemKey(import.meta.env.BASE_URL, 'guest', kind, id);

  function renderImporter(backend: ReturnType<typeof memoryBackend>) {
    const reload = vi.fn();
    const seen: { importBundle?: ReturnType<typeof useImportBundle>['importBundle']; storage?: Storage } = {};
    function Importer() {
      seen.importBundle = useImportBundle().importBundle;
      seen.storage = useStorage();
      return null;
    }
    render(
      <StorageProvider backend={backend} reload={reload}>
        <Importer />
      </StorageProvider>,
    );
    /** The import and the app's storage, once the startup check has run. */
    const started = async () => {
      await waitFor(() => expect(seen.storage).toBeDefined());
      if (!seen.importBundle || !seen.storage) throw new Error('Storage did not start.');
      return { importBundle: seen.importBundle, storage: seen.storage };
    };
    return { reload, started };
  }

  afterEach(() => sessionStorage.clear());

  it('writes every item with its own id and the current session, reloads, and leaves a note', async () => {
    const backend = memoryBackend({ [key('layout', 'keep-me')]: { id: 'keep-me', name: 'Old', updatedAt: '', version: SAVE_VERSION } });
    const { reload, started } = renderImporter(backend);
    const { importBundle } = await started();
    await act(() => importBundle(bundle, 'basic.json'));

    expect(reload).toHaveBeenCalledTimes(1);
    expect(backend.data.get(key('session', bundle.session.id))).toMatchObject({ id: bundle.session.id, version: SAVE_VERSION, zoom: bundle.session.zoom });
    expect(backend.data.get(key('session', bundle.session.id))).not.toHaveProperty('history');
    expect(backend.data.get(key('snapshot', bundle.snapshots.map((snapshot) => snapshot.id)[0] ?? ''))).toBeDefined();
    expect(backend.data.get(key('cardSet', bundle.cardSets.map((set) => set.id)[0] ?? ''))).toBeDefined();
    expect(backend.data.get(key('layout', 'l-hero'))).toMatchObject({ name: 'Hero', version: SAVE_VERSION });
    expect(backend.data.get(key('format', 'f-duel'))).toBeDefined();
    expect(backend.data.get(settingsKey)).toMatchObject({ options: bundle.settings.options, currentSessionId: bundle.session.id });
    // Items the bundle does not have stay.
    expect(backend.data.get(key('layout', 'keep-me'))).toBeDefined();
    expect(takeImportNote()).toBe('basic.json');
    expect(takeImportNote()).toBeUndefined();
  });

  it('replaces an item with the same id', async () => {
    const backend = memoryBackend({ [key('layout', 'l-hero')]: { id: 'l-hero', name: 'Old name', orientation: 'portrait', boxes: [], updatedAt: '', version: SAVE_VERSION } });
    const { started } = renderImporter(backend);
    const { importBundle } = await started();
    await act(() => importBundle(bundle, 'basic.json'));
    expect(backend.data.get(key('layout', 'l-hero'))).toMatchObject({ name: 'Hero' });
  });

  it('stops the app’s own saves once it starts, so a waiting save cannot overwrite the import', async () => {
    const backend = memoryBackend();
    const { started } = renderImporter(backend);
    const { importBundle, storage } = await started();
    await act(() => importBundle(bundle, 'basic.json'));
    await storage.put<Layout>('layout', { id: 'l-hero', name: 'Late save', orientation: 'portrait', boxes: [] });
    await storage.put<SessionItem>('session', { id: 'late', state: bundle.session.state, log: [], zoom: 1, snap: false });
    await storage.delete('format', 'f-duel');
    expect(backend.data.get(key('layout', 'l-hero'))).toMatchObject({ name: 'Hero' });
    expect(backend.data.get(key('session', 'late'))).toBeUndefined();
    expect(backend.data.get(key('format', 'f-duel'))).toBeDefined();
  });

  it('keeps saving, and does not reload, when a write fails', async () => {
    const backend = memoryBackend();
    const failing: StorageBackend = { ...backend, set: (k, v) => (k.includes('|snapshot|') ? Promise.reject(new Error('full')) : backend.set(k, v)) };
    const { reload, started } = renderImporter(Object.assign(failing, { data: backend.data }));
    const { importBundle, storage } = await started();
    await expect(act(() => importBundle(bundle, 'basic.json'))).rejects.toThrow('full');
    expect(reload).not.toHaveBeenCalled();
    expect(backend.data.get(settingsKey)).toBeUndefined();
    await storage.put<Layout>('layout', { id: 'after', name: 'After', orientation: 'portrait', boxes: [] });
    expect(backend.data.get(key('layout', 'after'))).toBeDefined();
  });
});
