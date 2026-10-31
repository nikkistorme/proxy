import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadPile } from '../actions/loadPile';
import { moveCard } from '../actions/moveCard';
import { draw } from '../actions/pileActions';
import { changeSeatCounter } from '../actions/seatCounters';
import { cardsFrom, sessionWithDeck, testContext } from '../actions/testing';
import { FormatsProvider } from '../formats/FormatsProvider';
import { PVP_1V1, SOLO_PVE } from '../model/format';
import { createSession } from '../model/session';
import { memoryBackend } from '../storage/backends';
import { itemKey, SAVE_VERSION, setImportNote, type StorageBackend } from '../storage/storage';
import { StorageProvider, useCurrentSession, useSetOption } from '../storage/StorageProvider';
import { createSessionStore, SessionStoreProvider } from '../store/sessionStore';
import type { SessionItem } from '../store/sessionItem';
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

function lastSaved(backend: ReturnType<typeof memoryBackend>, id: string) {
  act(() => void window.dispatchEvent(new Event('pagehide')));
  return waitFor(() => expect(backend.data.get(sessionKey(id))).toBeDefined()).then(() => backend.data.get(sessionKey(id)) as SessionItem);
}

describe('PS-2 undo history in the save', () => {
  it('brings back past, future and announcements, and steps through them as before', async () => {
    const backend = memoryBackend();
    const first = renderPersistence(backend, createSessionStore(sessionWithDeck(), testContext()));
    await loaded();
    const { store } = first;
    act(() => {
      store.getState().dispatch((g) => draw(g, { pileId: 'pile-p1-main' }));
      store.getState().dispatch((g) => draw(g, { pileId: 'pile-p1-main' }));
      store.getState().dispatch((g) => draw(g, { pileId: 'pile-p1-main' }));
      store.getState().undo();
    });
    const { past, future, session } = store.getState();
    expect([past.length, future.length]).toEqual([2, 1]);
    const id = store.getState().sessionId;
    await lastSaved(backend, id);
    first.unmount();

    const second = renderPersistence(backend);
    await loaded();
    const state = second.store.getState();
    expect(state.session).toEqual(session);
    expect(state.past).toEqual(past);
    expect(state.future).toEqual(future);
    expect(state.past.map((step) => step.announcement)).toEqual(past.map((step) => step.announcement));

    act(() => state.redo());
    expect(second.store.getState().announcement.text).toBe(`Redone: ${future[0]?.announcement}`);
    expect(second.store.getState().session.hands['seat-p1']).toHaveLength(3);
    act(() => second.store.getState().undo());
    act(() => second.store.getState().undo());
    act(() => second.store.getState().undo());
    expect(second.store.getState().session.hands['seat-p1']).toHaveLength(0);
    act(() => second.store.getState().undo());
    expect(second.store.getState().announcement.text).toBe('Nothing to undo.');
  });

  it('FS-3 undo after a restore still makes the acting seat active', async () => {
    const backend = memoryBackend();
    const first = renderPersistence(backend);
    await loaded();
    const { store } = first;
    act(() => store.getState().startSession(PVP_1V1));
    act(() => {
      store.getState().switchSeat('seat-p2');
      store.getState().dispatch((g) => changeSeatCounter(g, { seatId: 'seat-p2', counterId: 'p2-life', delta: -1 }));
    });
    act(() => store.getState().switchSeat('seat-p1'));
    await lastSaved(backend, store.getState().sessionId);
    first.unmount();

    const second = renderPersistence(backend);
    await loaded();
    expect(second.store.getState().session.activeSeatId).toBe('seat-p1');
    act(() => second.store.getState().undo());
    expect(second.store.getState().session.activeSeatId).toBe('seat-p2');
  });

  it('undo after a CSV reload brings back the old card text across a restore', async () => {
    const backend = memoryBackend();
    const context = testContext();
    const first = renderPersistence(backend, createSessionStore(createSession(SOLO_PVE), context));
    await loaded();
    const { store } = first;
    const load = (csv: string) =>
      store.getState().dispatch((g) => loadPile(g, { pileId: 'pile-p1-main', cardSetId: 'set-1', source: { kind: 'file', name: 'deck.csv' }, cards: cardsFrom(csv), keepOrder: true }, context));
    act(() => void load('name,rules\nImp,Old\nOgre,Big\n'));
    act(() => void load('name,rules\nImp,New\nOgre,Big\n'));
    await lastSaved(backend, store.getState().sessionId);
    first.unmount();

    const second = renderPersistence(backend);
    await loaded();
    const rules = () => Object.values(second.store.getState().session.definitions).find((d) => d.front.name === 'Imp')?.front.fields.rules;
    expect(rules()).toBe('New');
    act(() => second.store.getState().undo());
    expect(rules()).toBe('Old');
  });

  it('keeps shared parts shared after a restore, so the next save stays compact', async () => {
    const backend = memoryBackend();
    const first = renderPersistence(backend, createSessionStore(sessionWithDeck(), testContext()));
    await loaded();
    const { store } = first;
    act(() => void store.getState().dispatch((g) => draw(g, { pileId: 'pile-p1-main' })));
    const before = await lastSaved(backend, store.getState().sessionId);
    first.unmount();

    const second = renderPersistence(backend);
    await loaded();
    const { past, session } = second.store.getState();
    expect(past[0]?.session.definitions).toBe(session.definitions);
    act(() => void second.store.getState().dispatch((g) => draw(g, { pileId: 'pile-p1-main' })));
    const after = await lastSaved(backend, second.store.getState().sessionId);
    expect(after.history?.nodes.length).toBeLessThan((before.history?.nodes.length ?? 0) + 40);
  });

  it('restores the session with empty history when the history can’t be decoded', async () => {
    const backend = memoryBackend({
      [sessionKey('s')]: savedSession('s', { history: { nodes: [[[7]]], root: [0] } }),
      [settingsKey]: { id: 'account', options: {}, currentSessionId: 's', updatedAt: '', version: SAVE_VERSION },
    });
    const { store } = renderPersistence(backend);
    await loaded();
    expect(store.getState().sessionId).toBe('s');
    expect(store.getState().session.formatId).toBe(PVP_1V1.id);
    expect([store.getState().past, store.getState().future]).toEqual([[], []]);
  });

  it('restores the session with empty history when the history has the wrong shape', async () => {
    const backend = memoryBackend({
      [sessionKey('s')]: savedSession('s', { history: { nodes: [], root: 5 } }),
      [settingsKey]: { id: 'account', options: {}, currentSessionId: 's', updatedAt: '', version: SAVE_VERSION },
    });
    const { store } = renderPersistence(backend);
    await loaded();
    expect([store.getState().sessionId, store.getState().past]).toEqual(['s', []]);
  });

  it('loads an item saved without history', async () => {
    const backend = memoryBackend({
      [sessionKey('s')]: savedSession('s'),
      [settingsKey]: { id: 'account', options: {}, currentSessionId: 's', updatedAt: '', version: SAVE_VERSION },
    });
    const { store } = renderPersistence(backend);
    await loaded();
    expect([store.getState().sessionId, store.getState().past, store.getState().future]).toEqual(['s', [], []]);
  });

  it('stays within the size budget for a 60-card session and 200 table moves', async () => {
    const backend = memoryBackend();
    const deck = `name,qty,rules\n${Array.from({ length: 60 }, (_, i) => `Card ${i},1,Does thing number ${i} to a target creature`).join('\n')}\n`;
    const context = testContext();
    const start = loadPile(createSession(SOLO_PVE), { pileId: 'pile-p1-main', cardSetId: 'set-1', source: { kind: 'file', name: 'deck.csv' }, cards: cardsFrom(deck), keepOrder: true }, context).state;
    const { store } = renderPersistence(backend, createSessionStore(start, context));
    await loaded();
    act(() => void store.getState().dispatch((g) => draw(g, { pileId: 'pile-p1-main', count: 60 })));
    const ids = store.getState().session.hands['seat-p1'] ?? [];
    for (let i = 0; i < 200; i++) {
      act(() => void store.getState().dispatch((g) => moveCard(g, { cardId: ids[i % ids.length] as string, to: Math.floor(i / ids.length) % 2 === 0 ? { zone: 'table' } : { zone: 'hand', seatId: 'seat-p1' } }, context)));
    }
    expect(store.getState().past).toHaveLength(200);
    const saved = await lastSaved(backend, store.getState().sessionId);
    const size = JSON.stringify(saved).length;
    // Measured: 244,659 characters (60 cards, 200 steps), well under plain JSON, which repeats the card list in every step. The budget is about twice that.
    expect(size).toBeLessThanOrEqual(500_000);
  });
});

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
    expect(state.past).toHaveLength(1);
    expect(state.announcement.text).toBe('');
  });

  it('does not save the scroll columns or the last roll', async () => {
    const backend = memoryBackend();
    const { store } = renderPersistence(backend);
    await loaded();
    store.getState().roll('d6');
    act(() => void window.dispatchEvent(new Event('pagehide')));
    await waitFor(() => expect(backend.data.get(sessionKey(store.getState().sessionId))).toBeDefined());
    expect(Object.keys(backend.data.get(sessionKey(store.getState().sessionId)) as object).sort()).toEqual(['history', 'id', 'log', 'snap', 'state', 'updatedAt', 'version', 'zoom']);
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

describe('PS-4 after an import', () => {
  afterEach(() => sessionStorage.clear());

  it('announces the import once the session is back, and only once', async () => {
    const backend = memoryBackend({ [sessionKey('s1')]: savedSession('s1'), [settingsKey]: { id: 'account', options: {}, currentSessionId: 's1', updatedAt: '', version: SAVE_VERSION } });
    setImportNote('basic.json');
    const { store } = renderPersistence(backend);
    await loaded();
    expect(store.getState().session.formatId).toBe(PVP_1V1.id);
    expect(store.getState().announcement.text).toBe('Imported basic.json.');
    expect(sessionStorage.length).toBe(0);
  });

  it('announces nothing without the note', async () => {
    const backend = memoryBackend({ [sessionKey('s1')]: savedSession('s1'), [settingsKey]: { id: 'account', options: {}, currentSessionId: 's1', updatedAt: '', version: SAVE_VERSION } });
    const { store } = renderPersistence(backend);
    await loaded();
    expect(store.getState().announcement.text).not.toMatch(/^Imported/);
  });

  it('removes the session it replaced at the next start', async () => {
    const backend = memoryBackend({
      [sessionKey('old')]: savedSession('old'),
      [sessionKey('imported')]: savedSession('imported'),
      [settingsKey]: { id: 'account', options: {}, currentSessionId: 'imported', updatedAt: '', version: SAVE_VERSION },
    });
    renderPersistence(backend);
    await loaded();
    await waitFor(() => expect(savedIds(backend)).toEqual([sessionKey('imported')]));
  });
});
