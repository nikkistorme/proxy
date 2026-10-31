import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { testContext } from '../actions/testing';
import { SOLO_PVE } from '../model/format';
import { createSessionStore, SessionStoreProvider } from '../store/sessionStore';
import { SessionScreen } from './SessionScreen';

const URL_ = 'https://example.com/deck.csv';
const mainTile = () => screen.getByRole('button', { name: /^P1 main deck,/ });

function csv(body: string, headers: Record<string, string> = {}) {
  return new Response(body, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename*=UTF-8''My%20Deck.csv`, ...headers } });
}

function setup() {
  const store = createSessionStore(undefined, testContext());
  const user = userEvent.setup();
  render(
    <SessionStoreProvider store={store}>
      <SessionScreen />
    </SessionStoreProvider>,
  );
  return { store, user };
}

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.pointer({ keys: '[MouseRight]', target: mainTile() });
}

async function loadUrl(user: ReturnType<typeof userEvent.setup>, url = URL_) {
  await openMenu(user);
  await user.click(screen.getByRole('menuitem', { name: 'Load from URL…' }));
  await user.type(screen.getByRole('textbox', { name: 'Published CSV address' }), url);
  await user.keyboard('{Enter}');
}

afterEach(() => vi.unstubAllGlobals());

describe('CD-7 Load from URL in the pile menu', () => {
  it('sits under Load CSV… and loads the pile, naming the set from the file name header', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(csv('name,qty\nImp,2\n')));
    const { user } = setup();
    await openMenu(user);
    const labels = screen.getAllByRole('menuitem').map((item) => item.textContent);
    expect(labels.slice(0, 2)).toEqual(['Load CSV…', 'Load from URL…']);
    expect(labels).not.toContain('Reload from URL');
    await user.keyboard('{Escape}');

    await loadUrl(user);
    const results = await screen.findByRole('dialog', { name: 'Import results' });
    expect(results).toHaveTextContent('My Deck.csv into P1 main deck');
    expect(results).toHaveTextContent('Google can take a few minutes');
    expect(mainTile()).toHaveAccessibleName('P1 main deck, 2 cards, Player 1');
  });

  it('CD-9 offers a one-click Reload from URL in place of a file reload, and re-fetches at once', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(csv('id,name,rules\na,Imp,Old\n')).mockResolvedValue(csv('id,name,rules\na,Imp,New\n'));
    vi.stubGlobal('fetch', fetchMock);
    const { user, store } = setup();
    await loadUrl(user);
    await user.click(await screen.findByRole('button', { name: 'Done' }));

    await openMenu(user);
    expect(screen.queryByRole('menuitem', { name: /^Reload My Deck/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: 'Reload from URL' }));
    expect(await screen.findByRole('dialog', { name: 'Import results' })).toHaveTextContent('1 updated');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(Object.values(store.getState().session.definitions).map((d) => d.front.fields.rules)).toEqual(['New']);
  });
});

describe('CD-11 a failed fetch keeps the last good data', () => {
  it('a failed Reload reopens the dialog with the URL, the error and no change or undo step', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(csv('name\nImp\n')).mockResolvedValue(new Response('', { status: 404 }));
    vi.stubGlobal('fetch', fetchMock);
    const { user, store } = setup();
    await loadUrl(user);
    await user.click(await screen.findByRole('button', { name: 'Done' }));
    const before = store.getState();

    await openMenu(user);
    await user.click(screen.getByRole('menuitem', { name: 'Reload from URL' }));
    const dialog = await screen.findByRole('dialog', { name: 'Load from URL' });
    expect(within(dialog).getByRole('textbox')).toHaveValue(URL_);
    expect(dialog).toHaveTextContent('The server answered 404');
    expect(dialog).toHaveTextContent('P1 main deck keeps its last good data.');
    expect(store.getState().session).toBe(before.session);
    expect(store.getState().past).toBe(before.past);
  });

  it('a CSV with no cards is a failed fetch: nothing reaches the pile, so no card goes missing', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(csv('name\nImp\n')).mockResolvedValue(csv('title\nImp\n'));
    vi.stubGlobal('fetch', fetchMock);
    const { user, store } = setup();
    await loadUrl(user);
    await user.click(await screen.findByRole('button', { name: 'Done' }));
    const before = store.getState().session;

    await openMenu(user);
    await user.click(screen.getByRole('menuitem', { name: 'Reload from URL' }));
    expect(await screen.findByRole('dialog', { name: 'Load from URL' })).toHaveTextContent('Missing name.');
    expect(store.getState().session).toBe(before);
    expect(Object.values(before.definitions).some((d) => d.missing)).toBe(false);
  });
});

describe('CD-9 a late response', () => {
  function slowFetch() {
    let answer: (response: Response) => void = () => undefined;
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise<Response>((resolve) => (answer = resolve))));
    return (response: Response) => answer(response);
  }

  it('is dropped when a new session started meanwhile, even though the pile id repeats', async () => {
    const answer = slowFetch();
    const { user, store } = setup();
    await loadUrl(user);
    act(() => store.getState().startSession(SOLO_PVE));
    const fresh = store.getState().session;
    await act(async () => answer(csv('name\nImp\n')));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Loading…' })).not.toBeInTheDocument());
    expect(store.getState().session).toBe(fresh);
    expect(screen.queryByRole('dialog', { name: 'Import results' })).not.toBeInTheDocument();
  });

  it('is dropped when the pile was deleted meanwhile', async () => {
    const answer = slowFetch();
    const { user, store } = setup();
    await loadUrl(user);
    act(() => store.getState().dispatch((g) => ({ state: { ...g, piles: g.piles.filter((p) => p.id !== 'pile-p1-main') }, announcement: 'gone' })));
    const after = store.getState().session;
    await act(async () => answer(csv('name\nImp\n')));
    expect(store.getState().session).toBe(after);
    expect(screen.queryByRole('dialog', { name: 'Import results' })).not.toBeInTheDocument();
  });
});
