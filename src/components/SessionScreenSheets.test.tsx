import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadPile } from '../actions/loadPile';
import { cardsFrom, testContext } from '../actions/testing';
import { FormatsProvider } from '../formats/FormatsProvider';
import { SOLO_PVE, type Format } from '../model/format';
import { createSession } from '../model/session';
import { memoryBackend } from '../storage/backends';
import { itemKey, SAVE_VERSION } from '../storage/storage';
import { StorageProvider } from '../storage/StorageProvider';
import { createSessionStore, SessionStoreProvider } from '../store/sessionStore';
import { LiveRegion } from './LiveRegion';
import { SessionPersistence } from './SessionPersistence';
import { SessionScreen } from './SessionScreen';

const A = 'https://example.com/a.csv';
const B = 'https://example.com/b.csv';
const withUrls = (id = 'f-urls'): Format => ({
  ...SOLO_PVE,
  id,
  name: 'With sheets',
  piles: SOLO_PVE.piles.map((p) => (p.id === 'pile-p1-main' ? { ...p, sheetUrl: A } : p.id === 'pile-env' ? { ...p, sheetUrl: B } : p)),
});
const saved = (format: Format) => ({ ...format, updatedAt: '', version: SAVE_VERSION });
const formatKey = (id: string) => itemKey(import.meta.env.BASE_URL, 'guest', 'format', id);

const csv = (body: string) => new Response(body, { headers: { 'content-type': 'text/csv; charset=utf-8' } });
const tile = (name: RegExp) => screen.getByRole('button', { name });

/** Answers each URL from a table; a missing entry is a 404. */
function serve(table: Record<string, () => Response | Promise<Response>>) {
  const fetchMock = vi.fn((url: string) => Promise.resolve(table[url]?.() ?? new Response('', { status: 404 })));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function setup(items: Record<string, unknown> = {}, session = createSession(SOLO_PVE), persistence = false) {
  const store = createSessionStore(session, testContext());
  const body = <SessionScreen />;
  render(
    <StorageProvider backend={memoryBackend(items)}>
      <FormatsProvider>
        <SessionStoreProvider store={store}>
          {persistence ? <SessionPersistence>{body}</SessionPersistence> : body}
          <LiveRegion />
        </SessionStoreProvider>
      </FormatsProvider>
    </StorageProvider>,
  );
  return { store, user: userEvent.setup() };
}

afterEach(() => vi.unstubAllGlobals());

describe('CD-12 a session start fetches the format sheets', () => {
  it('loads every pile with a URL, together, as one undo step, and only announces a clean start', async () => {
    serve({ [A]: () => csv('name\nImp\nOgre\n'), [B]: () => csv('name\nStorm\n') });
    const { store } = setup();
    act(() => store.getState().startSession(withUrls()));
    expect(await screen.findByRole('button', { name: /^P1 main deck, 2 cards/ })).toBeInTheDocument();
    expect(tile(/^Environment deck, 1 card/)).toBeInTheDocument();
    expect(store.getState().past).toHaveLength(1);
    expect(store.getState().announcement.text).toBe('Loaded 2 of 2 sheets.');
    expect(screen.queryByRole('dialog', { name: 'Sheet results' })).not.toBeInTheDocument();
    expect(Object.values(store.getState().session.cardSets).map((s) => s.source.kind)).toEqual(['url', 'url']);
    store.getState().undo();
    expect(store.getState().session.piles.every((p) => p.cardIds.length === 0)).toBe(true);
  });

  it('shows Loading… on the waiting piles, in text and in the label', async () => {
    let answer: (r: Response) => void = () => undefined;
    serve({ [A]: () => new Promise<Response>((resolve) => (answer = resolve)) });
    const { store } = setup();
    act(() => store.getState().startSession({ ...SOLO_PVE, piles: SOLO_PVE.piles.map((p) => (p.id === 'pile-p1-main' ? { ...p, sheetUrl: A } : p)) }));
    const loading = await screen.findByRole('button', { name: /^P1 main deck, Loading…/ });
    expect(loading).toHaveTextContent('Loading…');
    expect(tile(/^Environment deck, empty/)).toHaveTextContent('Empty');
    await act(async () => answer(csv('name\nImp\n')));
    expect(await screen.findByRole('button', { name: /^P1 main deck, 1 card/ })).toBeInTheDocument();
  });

  it('a failed pile stays empty with a warning, its label has the error, and Load from URL… opens ready to retry', async () => {
    serve({ [A]: () => csv('name\nImp\n') });
    const format = withUrls();
    const { store, user } = setup({ [formatKey(format.id)]: saved(format) });
    await screen.findByRole('button', { name: 'This session' });
    act(() => store.getState().startSession(format));
    const dialog = await screen.findByRole('dialog', { name: 'Sheet results' });
    expect(dialog).toHaveTextContent('Environment deck');
    expect(dialog).toHaveTextContent('The server answered 404');
    expect(dialog).toHaveTextContent('P1 main deck');
    expect(store.getState().announcement.text).toBe('Loaded 1 of 2 sheets. Failed: Environment deck.');
    await user.click(within(dialog).getByRole('button', { name: 'Done' }));

    const failed = tile(/^Environment deck, empty, couldn't load: .*404/);
    await user.pointer({ keys: '[MouseRight]', target: failed });
    await user.click(screen.getByRole('menuitem', { name: 'Load from URL…' }));
    const load = await screen.findByRole('dialog', { name: 'Load from URL' });
    expect(within(load).getByRole('textbox')).toHaveValue(B);
    expect(load).toHaveTextContent('The server answered 404');

    serve({ [B]: () => csv('name\nStorm\n') });
    await user.click(within(load).getByRole('button', { name: 'Load' }));
    await user.click(await screen.findByRole('button', { name: 'Done' }));
    expect(tile(/^Environment deck, 1 card/)).toBeInTheDocument();
    expect(screen.queryByText(/couldn't load/)).not.toBeInTheDocument();
  });

  it('when every sheet fails nothing changes and there is no undo step', async () => {
    serve({});
    const { store } = setup();
    act(() => store.getState().startSession(withUrls()));
    expect(await screen.findByRole('dialog', { name: 'Sheet results' })).toBeInTheDocument();
    expect(store.getState().past).toHaveLength(0);
    expect(store.getState().announcement.text).toBe('Loaded 0 of 2 sheets. Failed: P1 main deck, Environment deck.');
  });

  it('opens the results for row problems, but not for a clean start', async () => {
    serve({ [A]: () => csv('name,qty\nImp,2\nOgre,lots\n'), [B]: () => csv('name\nStorm\n') });
    const { store } = setup();
    act(() => store.getState().startSession(withUrls()));
    expect(await screen.findByRole('dialog', { name: 'Sheet results' })).toHaveTextContent('1 problem');
  });

  it('counts a stored address that is no longer valid as a failure for that pile', async () => {
    serve({ [B]: () => csv('name\nStorm\n') });
    const { store } = setup();
    const bad = withUrls();
    bad.piles = bad.piles.map((p) => (p.id === 'pile-p1-main' ? { ...p, sheetUrl: 'ftp://nope' } : p));
    act(() => store.getState().startSession(bad));
    expect(await screen.findByRole('dialog', { name: 'Sheet results' })).toHaveTextContent('http');
    expect(tile(/^Environment deck, 1 card/)).toBeInTheDocument();
  });

  it('does not open the dialog during a drag or placement, but still badges and announces', async () => {
    serve({});
    const { store } = setup();
    act(() => {
      store.getState().startSession(withUrls());
      store.getState().setPlacing({ pileId: 'pile-env' });
    });
    await waitFor(() => expect(store.getState().announcement.text).toContain('Failed'));
    expect(screen.queryByRole('dialog', { name: 'Sheet results' })).not.toBeInTheDocument();
    expect(tile(/^P1 main deck, empty, couldn't load/)).toBeInTheDocument();
  });

  it('drops late answers after a new session, for a deleted pile, and for a pile the player loaded meanwhile', async () => {
    const answers: Record<string, (r: Response) => void> = {};
    serve({ [A]: () => new Promise<Response>((resolve) => (answers.a = resolve)), [B]: () => new Promise<Response>((resolve) => (answers.b = resolve)) });
    const { store } = setup();
    act(() => store.getState().startSession(withUrls()));
    // The player loads the main deck themselves, and deletes the environment deck.
    act(() => {
      store.getState().dispatch((g, c) => loadPile(g, { pileId: 'pile-p1-main', cardSetId: 'mine', source: { kind: 'file', name: 'mine.csv' }, cards: cardsFrom('name\nMine\n') }, c));
      store.getState().dispatch((g) => ({ state: { ...g, piles: g.piles.filter((p) => p.id !== 'pile-env') }, announcement: 'gone' }));
    });
    const before = store.getState().session;
    await act(async () => {
      answers.a?.(csv('name\nImp\n'));
      answers.b?.(csv('name\nStorm\n'));
    });
    expect(store.getState().session).toBe(before);
    expect(screen.queryByRole('dialog', { name: 'Sheet results' })).not.toBeInTheDocument();

    // A new session drops the answers of the old one.
    act(() => store.getState().startSession(withUrls()));
    const fresh = store.getState().session;
    act(() => store.getState().startSession(SOLO_PVE));
    const latest = store.getState().session;
    await act(async () => {
      answers.a?.(csv('name\nImp\n'));
      answers.b?.(csv('name\nStorm\n'));
    });
    expect(store.getState().session).toBe(latest);
    expect(latest).not.toBe(fresh);
  });

  it('a restored session does not fetch', async () => {
    const fetchMock = serve({ [A]: () => csv('name\nImp\n') });
    const { store } = setup();
    act(() => store.getState().restoreSession({ id: 'saved', session: createSession(withUrls()), log: [], zoom: 1, snap: false }));
    await act(async () => undefined);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('a silent start from the default format fetches too', async () => {
    serve({ [A]: () => csv('name\nImp\n'), [B]: () => csv('name\nStorm\n') });
    const format = withUrls();
    setup(
      { [formatKey(format.id)]: saved(format), [itemKey(import.meta.env.BASE_URL, 'guest', 'settings', 'account')]: { id: 'account', options: { defaultFormat: format.id }, updatedAt: '', version: SAVE_VERSION } },
      undefined,
      true,
    );
    expect(await screen.findByRole('button', { name: /^P1 main deck, 1 card/ }, { timeout: 3000 })).toBeInTheDocument();
  });
});

describe('CD-12 Reload all', () => {
  it('is hidden when no pile has a sheet', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'This session' }));
    expect(screen.queryByRole('menuitem', { name: /Reload all|Reloading/ })).not.toBeInTheDocument();
  });

  it('refetches every URL pile at once, always shows the results, and is one undo step', async () => {
    let a = 'name,rules\nImp,Old\n';
    serve({ [A]: () => csv(a), [B]: () => csv('name\nStorm\n') });
    const { store, user } = setup();
    act(() => store.getState().startSession(withUrls()));
    await screen.findByRole('button', { name: /^P1 main deck, 1 card/ });
    const stepsBefore = store.getState().past.length;

    a = 'name,rules\nImp,New\n';
    await user.click(screen.getByRole('button', { name: 'This session' }));
    await user.click(screen.getByRole('menuitem', { name: 'Reload all' }));
    const dialog = await screen.findByRole('dialog', { name: 'Sheet results' });
    expect(dialog).toHaveTextContent('Reloaded 2 of 2 sheets');
    expect(store.getState().past).toHaveLength(stepsBefore + 1);
    expect(Object.values(store.getState().session.definitions).map((d) => d.front.fields.rules)).toContain('New');
    await user.click(within(dialog).getByRole('button', { name: 'Done' }));
    expect(screen.getByRole('button', { name: 'This session' })).toHaveFocus();
  });

  it('keeps the last good data of a pile that fails, and says so', async () => {
    const table: Record<string, () => Response> = { [A]: () => csv('name\nImp\n'), [B]: () => csv('name\nStorm\n') };
    serve(table);
    const { store, user } = setup();
    act(() => store.getState().startSession(withUrls()));
    await screen.findByRole('button', { name: /^Environment deck, 1 card/ });
    table[B] = () => new Response('', { status: 404 });
    await user.click(screen.getByRole('button', { name: 'This session' }));
    await user.click(screen.getByRole('menuitem', { name: 'Reload all' }));
    const dialog = await screen.findByRole('dialog', { name: 'Sheet results' });
    expect(dialog).toHaveTextContent('Environment deck keeps its last good data.');
    expect(dialog).toHaveTextContent('Reloaded 1 of 2 sheets');
    expect(store.getState().announcement.text).toBe('Reloaded 1 of 2 sheets. Failed: Environment deck.');
    expect(tile(/^Environment deck, 1 card/)).toBeInTheDocument();
  });

  it('is disabled and reads Reloading… while it runs, and retries an empty pile with a format URL after a reload', async () => {
    const format = withUrls();
    let answer: (r: Response) => void = () => undefined;
    serve({ [A]: () => new Promise<Response>((resolve) => (answer = resolve)), [B]: () => csv('name\nStorm\n') });
    const { user } = setup({ [formatKey(format.id)]: saved(format) }, createSession(format));
    await user.click(await screen.findByRole('button', { name: 'This session' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Reload all' }));
    await user.click(screen.getByRole('button', { name: 'This session' }));
    expect(screen.getByRole('menuitem', { name: 'Reloading…' })).toHaveAttribute('aria-disabled', 'true');
    await user.keyboard('{Escape}');
    await act(async () => answer(csv('name\nImp\n')));
    expect(await screen.findByRole('dialog', { name: 'Sheet results' })).toHaveTextContent('Reloaded 2 of 2 sheets');
  });

  it('Load from URL… on an empty pile with no card set fills in the format address', async () => {
    const format = withUrls();
    const { user } = setup({ [formatKey(format.id)]: saved(format) }, createSession(format));
    await waitFor(async () => {
      await user.pointer({ keys: '[MouseRight]', target: tile(/^P1 main deck,/) });
      await user.click(screen.getByRole('menuitem', { name: 'Load from URL…' }));
      expect(within(screen.getByRole('dialog', { name: 'Load from URL' })).getByRole('textbox')).toHaveValue(A);
    });
  });
});
