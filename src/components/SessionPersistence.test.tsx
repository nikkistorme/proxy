import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { draw } from '../actions/pileActions';
import { sessionWithDeck, testContext } from '../actions/testing';
import { FormatsProvider } from '../formats/FormatsProvider';
import { PVP_1V1, SOLO_PVE } from '../model/format';
import { createSession } from '../model/session';
import { memoryBackend } from '../storage/backends';
import { itemKey, SAVE_VERSION, type StorageBackend } from '../storage/storage';
import { StorageProvider, useCurrentSession, useSetOption } from '../storage/StorageProvider';
import { createSessionStore, SessionStoreProvider } from '../store/sessionStore';
import { SessionPersistence } from './SessionPersistence';

const base = import.meta.env.BASE_URL;
const sessionKey = (id: string) => itemKey(base, 'guest', 'session', id);
const settingsKey = itemKey(base, 'guest', 'settings', 'account');

function savedSession(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    state: createSession(PVP_1V1),
    log: [{ id: 1, text: 'Rolled a d6: 4', at: 1 }],
    zoom: 1.5,
    snap: true,
    updatedAt: '',
    version: SAVE_VERSION,
    ...extra,
  };
}

function Probe() {
  const { currentSessionId } = useCurrentSession();
  const setOption = useSetOption();
  return (
    <>
      <span data-testid="current">{currentSessionId ?? 'none'}</span>
      <button onClick={() => setOption('defaultFormat', PVP_1V1.id)}>set option</button>
      <p>the app</p>
    </>
  );
}

function renderPersistence(backend: StorageBackend, store = createSessionStore(createSession(SOLO_PVE), testContext())) {
  const view = render(
    <StorageProvider backend={backend}>
      <FormatsProvider>
        <SessionStoreProvider store={store}>
          <SessionPersistence>
            <Probe />
          </SessionPersistence>
        </SessionStoreProvider>
      </FormatsProvider>
    </StorageProvider>,
  );
  return { store, ...view };
}

const loaded = () => waitFor(() => expect(screen.queryByText('Loading your session…')).not.toBeInTheDocument());
const savedIds = (backend: ReturnType<typeof memoryBackend>) => [...backend.data.keys()].filter((key) => key.includes('|session|'));

afterEach(() => vi.useRealTimers());

describe('PS-2 loading overlay', () => {
  it('covers the app and makes it inert until the session is read', async () => {
    const backend = memoryBackend();
    const { container } = renderPersistence(backend);
    expect(screen.getByRole('status')).toHaveTextContent('Loading your session…');
    expect(container.querySelector('.session-shell')).toHaveAttribute('inert');
    await loaded();
    expect(container.querySelector('.session-shell')).not.toHaveAttribute('inert');
  });

  it('gives up after the safety timeout and falls back to a new session from the default format', async () => {
    vi.useFakeTimers();
    // A storage that never answers.
    const stuck: StorageBackend = {
      get: () => new Promise(() => {}),
      set: () => new Promise(() => {}),
      del: () => new Promise(() => {}),
      keys: () => new Promise(() => {}),
    };
    const { container } = renderPersistence(stuck);
    expect(screen.getByRole('status')).toBeInTheDocument();
    await act(() => vi.advanceTimersByTimeAsync(5000));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(container.querySelector('.session-shell')).not.toHaveAttribute('inert');
  });
});

describe('PS-2 restore and save through the storage interface (AR-6)', () => {
  it('saves a change, then restores it in a new visit', async () => {
    const backend = memoryBackend();
    const first = renderPersistence(backend, createSessionStore(sessionWithDeck(), testContext()));
    await loaded();
    first.store.getState().roll('d6');
    first.store.getState().dispatch((g) => draw(g, { pileId: 'pile-p1-main' }));
    first.store.getState().setView({ zoom: 1.25, snap: true });
    act(() => void window.dispatchEvent(new Event('pagehide')));
    const id = first.store.getState().sessionId;
    await waitFor(() =>
      expect(backend.data.get(sessionKey(id))).toMatchObject({
        id,
        zoom: 1.25,
        snap: true,
        log: [expect.objectContaining({ id: 1 })],
      }),
    );
    expect(backend.data.get(settingsKey)).toMatchObject({
      currentSessionId: id,
    });
    first.unmount();

    const second = renderPersistence(backend);
    await loaded();
    const state = second.store.getState();
    expect(state.sessionId).toBe(id);
    expect(state.session.hands['seat-p1']).toHaveLength(1);
    expect([state.view.zoom, state.view.snap, state.log]).toEqual([1.25, true, [expect.objectContaining({ id: 1 })]]);
    expect([state.past, state.future]).toEqual([[], []]);
    expect(state.announcement.text).toBe('');
  });

  it('does not save the scroll columns or the last roll', async () => {
    const backend = memoryBackend();
    const { store } = renderPersistence(backend);
    await loaded();
    store.getState().roll('d6');
    act(() => void window.dispatchEvent(new Event('pagehide')));
    await waitFor(() => expect(backend.data.get(sessionKey(store.getState().sessionId))).toBeDefined());
    expect(Object.keys(backend.data.get(sessionKey(store.getState().sessionId)) as object).sort()).toEqual(['id', 'log', 'snap', 'state', 'updatedAt', 'version', 'zoom']);
  });

  it('keeps the session in memory when it was touched before storage was ready, and saves it as current', async () => {
    const backend = memoryBackend({
      [sessionKey('old')]: savedSession('old'),
      [settingsKey]: {
        id: 'account',
        options: {},
        currentSessionId: 'old',
        updatedAt: '',
        version: SAVE_VERSION,
      },
    });
    const store = createSessionStore(sessionWithDeck(), testContext());
    store.getState().dispatch((g) => draw(g, { pileId: 'pile-p1-main' }));
    const mine = store.getState().session;
    renderPersistence(backend, store);
    await loaded();
    expect(store.getState().session).toBe(mine);
    act(() => void window.dispatchEvent(new Event('pagehide')));
    await waitFor(() =>
      expect(backend.data.get(settingsKey)).toMatchObject({
        currentSessionId: store.getState().sessionId,
      }),
    );
    await waitFor(() => expect(savedIds(backend)).toEqual([sessionKey(store.getState().sessionId)]));
  });

  it('starts a new session from the default format when none is saved', async () => {
    const backend = memoryBackend({
      [settingsKey]: {
        id: 'account',
        options: { defaultFormat: PVP_1V1.id },
        updatedAt: '',
        version: SAVE_VERSION,
      },
    });
    const { store } = renderPersistence(backend);
    await loaded();
    expect(store.getState().session.formatId).toBe(PVP_1V1.id);
    expect(store.getState().announcement.text).toBe('');
    act(() => void window.dispatchEvent(new Event('pagehide')));
    await waitFor(() => expect(savedIds(backend)).toEqual([sessionKey(store.getState().sessionId)]));
  });

  it('deletes session items that are not the current one', async () => {
    const backend = memoryBackend({
      [sessionKey('current')]: savedSession('current'),
      [sessionKey('stray')]: savedSession('stray'),
      [settingsKey]: {
        id: 'account',
        options: {},
        currentSessionId: 'current',
        updatedAt: '',
        version: SAVE_VERSION,
      },
    });
    const { store } = renderPersistence(backend);
    await loaded();
    expect(store.getState().sessionId).toBe('current');
    await waitFor(() => expect(savedIds(backend)).toEqual([sessionKey('current')]));
  });

  it('makes a new session current and deletes the old item when New session… starts one', async () => {
    const backend = memoryBackend();
    const { store } = renderPersistence(backend);
    await loaded();
    const old = store.getState().sessionId;
    act(() => void window.dispatchEvent(new Event('pagehide')));
    await waitFor(() => expect(backend.data.has(sessionKey(old))).toBe(true));
    act(() => store.getState().startSession(PVP_1V1));
    const fresh = store.getState().sessionId;
    act(() => void window.dispatchEvent(new Event('pagehide')));
    await waitFor(() => expect(savedIds(backend)).toEqual([sessionKey(fresh)]));
    expect(backend.data.get(settingsKey)).toMatchObject({
      currentSessionId: fresh,
    });
    expect(screen.getByTestId('current')).toHaveTextContent(fresh);
  });

  it('drops a session saved with an older version, with the notice flag, and starts a new one', async () => {
    const onDroppedBackend = memoryBackend({
      [sessionKey('old')]: savedSession('old', { version: SAVE_VERSION - 1 }),
      [settingsKey]: {
        id: 'account',
        options: {},
        currentSessionId: 'old',
        updatedAt: '',
        version: SAVE_VERSION,
      },
    });
    const { store } = renderPersistence(onDroppedBackend);
    await loaded();
    expect(store.getState().sessionId).not.toBe('old');
    expect(onDroppedBackend.data.has(sessionKey('old'))).toBe(false);
  });

  it('keeps options and the current session id when either is written', async () => {
    const backend = memoryBackend({
      [settingsKey]: {
        id: 'account',
        options: { theme: 'dark' },
        updatedAt: '',
        version: SAVE_VERSION,
      },
    });
    const { store } = renderPersistence(backend);
    await loaded();
    await waitFor(() =>
      expect(backend.data.get(settingsKey)).toMatchObject({
        options: { theme: 'dark' },
        currentSessionId: store.getState().sessionId,
      }),
    );
    act(() => screen.getByRole('button', { name: 'set option' }).click());
    await waitFor(() =>
      expect(backend.data.get(settingsKey)).toMatchObject({
        options: { theme: 'dark', defaultFormat: PVP_1V1.id },
        currentSessionId: store.getState().sessionId,
      }),
    );
    act(() => store.getState().startSession(SOLO_PVE));
    await waitFor(() =>
      expect(backend.data.get(settingsKey)).toMatchObject({
        options: { theme: 'dark', defaultFormat: PVP_1V1.id },
        currentSessionId: store.getState().sessionId,
      }),
    );
  });

  it('PS-6 still works when the browser can’t save', async () => {
    const blocked: StorageBackend = {
      ...memoryBackend(),
      set: () => Promise.reject(new DOMException('blocked', 'SecurityError')),
    };
    const { store } = renderPersistence(blocked);
    await loaded();
    expect(screen.getByText('the app')).toBeInTheDocument();
    expect(store.getState().session.formatId).toBe(SOLO_PVE.id);
  });
});
