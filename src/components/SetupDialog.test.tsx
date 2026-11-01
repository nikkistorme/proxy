import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { sessionWithDeck, testContext } from '../actions/testing';
import { loadDemoData } from '../demo/loadDemoData';
import { LayoutsProvider } from '../layouts/LayoutsProvider';
import { FormatsProvider, useFormats } from '../formats/FormatsProvider';
import { PVP_1V1, SOLO_PVE, type Format } from '../model/format';
import { createSession } from '../model/session';
import { memoryBackend } from '../storage/backends';
import { itemKey, SAVE_VERSION } from '../storage/storage';
import { StorageProvider, useOption } from '../storage/StorageProvider';
import { createSessionStore, SessionStoreProvider } from '../store/sessionStore';
import { LiveRegion } from './LiveRegion';
import { SessionPersistence } from './SessionPersistence';
import { SessionScreen } from './SessionScreen';
import { SetupDialog } from './SetupDialog';

vi.mock('../demo/loadDemoData', () => ({ loadDemoData: vi.fn() }));

function Saved() {
  return <span data-testid="saved-format">{useOption('defaultFormat')}</span>;
}

function SavedNames() {
  return <span data-testid="saved-names">{useFormats().formats.map((format) => format.name).join(', ')}</span>;
}

const formatKey = (id: string) => itemKey(import.meta.env.BASE_URL, 'guest', 'format', id);
const settingsKey = itemKey(import.meta.env.BASE_URL, 'guest', 'settings', 'account');
const mine = { ...PVP_1V1, id: 'f-mine', name: 'My duel', updatedAt: '', version: SAVE_VERSION };

function renderScreen(session = createSession(SOLO_PVE), items: Record<string, unknown> = {}) {
  const store = createSessionStore(session, testContext());
  render(
    <StorageProvider backend={memoryBackend(items)}>
      <FormatsProvider>
        <SessionStoreProvider store={store}>
          <SessionPersistence>
            <SessionScreen />
          </SessionPersistence>
          <LiveRegion />
          <Saved />
        </SessionStoreProvider>
      </FormatsProvider>
    </StorageProvider>,
  );
  return { store, user: userEvent.setup() };
}

async function openSetup(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'This session' }));
  await user.click(screen.getByRole('menuitem', { name: 'New session…' }));
  return screen.getByRole('dialog', { name: 'New session' });
}

describe('SP-1 setup dialog', () => {
  it('lists the three presets with their seats and piles, the current one selected', async () => {
    const { user } = renderScreen();
    const dialog = await openSetup(user);
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByRole('radio', { name: /^Solo PvE/ })).toBeChecked();
    expect(dialog).toHaveTextContent('Player 1');
    expect(dialog).toHaveTextContent('Environment');
    expect(screen.getByRole('radio', { name: /^1v1 PvP/ })).toHaveAccessibleName(/Piles: P1 main deck, P2 main deck, Board cards/);
    expect(screen.getByRole('radio', { name: /^Solo PvE/ })).toHaveFocus();
  });

  it('starts an empty session at once, announces it and focuses the table', async () => {
    const { store, user } = renderScreen();
    await openSetup(user);
    await user.click(screen.getByRole('radio', { name: /^1v1 PvP/ }));
    await user.click(screen.getByRole('button', { name: 'Start session' }));
    expect(store.getState().session.formatId).toBe(PVP_1V1.id);
    expect(screen.getAllByRole('status').map((el) => el.textContent)).toContain('New 1v1 PvP session started. Player 1 is the active seat.');
    expect(screen.getByTestId('saved-format')).toHaveTextContent(PVP_1V1.id);
    expect(document.querySelector('.table-surface')).toHaveFocus();
  });

  it('asks first when the session has cards, and Back returns to the choices', async () => {
    const { store, user } = renderScreen(sessionWithDeck());
    await openSetup(user);
    await user.click(screen.getByRole('radio', { name: /^1v1 PvP/ }));
    await user.click(screen.getByRole('button', { name: 'Start session' }));
    const dialog = screen.getByRole('dialog', { name: 'Start a new 1v1 PvP session?' });
    expect(dialog).toHaveTextContent('The cards in this session will be cleared.');
    expect(store.getState().session.formatId).toBe(SOLO_PVE.id);
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('radio', { name: /^1v1 PvP/ })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Start session' }));
    await user.click(screen.getByRole('button', { name: 'Start new session' }));
    expect(store.getState().session.formatId).toBe(PVP_1V1.id);
    expect(Object.keys(store.getState().session.cards)).toHaveLength(0);
  });

  it('Cancel changes nothing and returns focus to the menu button', async () => {
    const { store, user } = renderScreen(sessionWithDeck());
    await openSetup(user);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(store.getState().session.formatId).toBe(SOLO_PVE.id);
    expect(screen.getByRole('button', { name: 'This session' })).toHaveFocus();
  });
});

describe('SP-1 saved default format', () => {
  it('applies an option set before storage loaded only through the setup dialog, not a touched session', () => {
    const store = createSessionStore(sessionWithDeck(), testContext());
    render(
      <StorageProvider backend={memoryBackend({})}>
        <SessionStoreProvider store={store}>
          <SessionPersistence>{null}</SessionPersistence>
        </SessionStoreProvider>
      </StorageProvider>,
    );
    expect(store.getState().session.formatId).toBe(SOLO_PVE.id);
  });
});

describe('SP-1 saved formats in the setup dialog', () => {
  it('lists saved formats after the presets and starts a session from one', async () => {
    const { store, user } = renderScreen(createSession(SOLO_PVE), { [formatKey('f-mine')]: mine });
    await screen.findByRole('button', { name: 'This session' });
    await waitFor(() => expect(store.getState().session.formatId).toBe(SOLO_PVE.id));
    await user.click(screen.getByRole('button', { name: 'This session' }));
    await user.click(screen.getByRole('menuitem', { name: 'New session…' }));
    // The saved format is read a moment after the page starts.
    await user.click(await screen.findByRole('radio', { name: /^My duel/ }));
    expect(screen.getAllByRole('radio').map((r) => r.closest('label')?.querySelector('.form-choice__name')?.textContent)).toEqual(['Solo PvE', 'Co-op PvE', '1v1 PvP', 'My duel']);
    await user.click(screen.getByRole('button', { name: 'Start session' }));
    expect(store.getState().session.formatId).toBe('f-mine');
    expect(store.getState().session.formatName).toBe('My duel');
    expect(store.getState().session.seats.map((s) => s.name)).toEqual(['Player 1', 'Player 2']);
    expect(screen.getByTestId('saved-format')).toHaveTextContent('f-mine');
  });

  it('starts on the current format when it is a saved one', async () => {
    const session = { ...createSession(PVP_1V1), formatId: 'f-mine', formatName: 'My duel' };
    const { user } = renderScreen(session, { [formatKey('f-mine')]: mine, [settingsKey]: { id: 'account', options: { defaultFormat: 'f-mine' }, updatedAt: '', version: SAVE_VERSION } });
    await user.click(screen.getByRole('button', { name: 'This session' }));
    await user.click(screen.getByRole('menuitem', { name: 'New session…' }));
    expect(await screen.findByRole('radio', { name: /^My duel/ })).toBeChecked();
  });

  it('starts on Solo PvE when the current format has been deleted', async () => {
    const session = { ...createSession(PVP_1V1), formatId: 'f-gone', formatName: 'Gone' };
    const { user } = renderScreen(session);
    await openSetup(user);
    expect(screen.getByRole('radio', { name: /^Solo PvE/ })).toBeChecked();
  });
});

describe('SP-1 Edit a copy', () => {
  // The setup dialog's part only: it saves the copy and hands it on. Opening it in
  // the format editor is the Formats screen's test, and the whole path is in
  // e2e/format-editor.spec.ts.
  it('shows for presets only, saves a copy of the chosen preset and hands it on', async () => {
    const onEditCopy = vi.fn();
    const user = userEvent.setup();
    render(
      <StorageProvider backend={memoryBackend({ [formatKey(mine.id)]: mine })}>
        <FormatsProvider>
          <SessionStoreProvider store={createSessionStore(createSession(SOLO_PVE), testContext())}>
            <SetupDialog open onClose={() => {}} onEditFormats={() => {}} onEditCopy={onEditCopy} />
            <SavedNames />
          </SessionStoreProvider>
        </FormatsProvider>
      </StorageProvider>,
    );
    await user.click(await screen.findByRole('radio', { name: /^My duel/ }));
    expect(screen.queryByRole('button', { name: /^Edit a copy/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /^Co-op PvE/ }));
    await user.click(screen.getByRole('button', { name: 'Edit a copy of Co-op PvE' }));
    expect(onEditCopy).toHaveBeenCalledOnce();
    const [copy, message] = onEditCopy.mock.calls[0] as [Format, string];
    expect(copy.name).toBe('Co-op PvE copy');
    expect(copy.seats.map((seat) => seat.name)).toEqual(['Player 1', 'Player 2', 'Environment']);
    expect(message).toBe('Duplicated Co-op PvE as Co-op PvE copy. Editing Co-op PvE copy.');
    expect(screen.getByTestId('saved-names')).toHaveTextContent('My duel, Co-op PvE copy');
  });
});

describe('SP-1 default format with saved formats', () => {
  it('switches an untouched session to a saved default once the formats have loaded', async () => {
    const { store } = renderScreen(createSession(SOLO_PVE), {
      [formatKey('f-mine')]: mine,
      [settingsKey]: { id: 'account', options: { defaultFormat: 'f-mine' }, updatedAt: '', version: SAVE_VERSION },
    });
    await waitFor(() => expect(store.getState().session.formatId).toBe('f-mine'));
    expect(store.getState().session.formatName).toBe('My duel');
  });

  it('uses Solo PvE when the saved default was deleted', async () => {
    const { store } = renderScreen(createSession(PVP_1V1), {
      [settingsKey]: { id: 'account', options: { defaultFormat: 'f-gone' }, updatedAt: '', version: SAVE_VERSION },
    });
    await waitFor(() => expect(store.getState().session.formatId).toBe(SOLO_PVE.id));
  });
});

describe('DM-5 Load demo in the setup dialog', () => {
  const realChunk = () => vi.importActual<typeof import('../demo/demoData')>('../demo/demoData');

  function renderDialog(session = createSession(SOLO_PVE)) {
    const store = createSessionStore(session, testContext());
    const onClose = vi.fn();
    const items = {};
    render(
      <StorageProvider backend={memoryBackend(items)}>
        <FormatsProvider>
          <LayoutsProvider>
            <SessionStoreProvider store={store}>
              <SetupDialog open onClose={onClose} onEditFormats={() => {}} onEditCopy={() => {}} />
              <LiveRegion />
              <Saved />
            </SessionStoreProvider>
          </LayoutsProvider>
        </FormatsProvider>
      </StorageProvider>,
    );
    return { store, onClose, user: userEvent.setup() };
  }

  it('starts Co-op PvE with the piles filled, announces it, leaves options alone and closes as started', async () => {
    vi.mocked(loadDemoData).mockImplementation(realChunk);
    const { store, onClose, user } = renderDialog();
    await user.click(screen.getByRole('button', { name: 'Load demo' }));
    await waitFor(() => expect(onClose).toHaveBeenCalledWith(true));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(store.getState().session.formatId).toBe('preset-coop-pve');
    expect(store.getState().session.piles.map((p) => p.cardIds.length)).toEqual([30, 30, 20, 6]);
    expect(screen.getAllByRole('status').map((el) => el.textContent)).toContain('Demo loaded: Co-op PvE session with 86 cards in 4 piles. Player 1 is the active seat.');
    expect(screen.getByTestId('saved-format')).toHaveTextContent(SOLO_PVE.id);
    expect(store.getState().past).toHaveLength(1);
  });

  it('asks first when the session has cards, and Back returns to the choices', async () => {
    vi.mocked(loadDemoData).mockImplementation(realChunk);
    const { store, onClose, user } = renderDialog(sessionWithDeck());
    await user.click(screen.getByRole('button', { name: 'Load demo' }));
    const dialog = await screen.findByRole('dialog', { name: 'Load the demo?' });
    expect(dialog).toHaveTextContent('Load the demo? The cards in this session will be cleared.');
    expect(store.getState().session.formatId).toBe(SOLO_PVE.id);
    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('button', { name: 'Load demo' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Load demo' }));
    await user.click(await screen.findByRole('button', { name: 'Load demo', description: '' }));
    expect(store.getState().session.formatId).toBe('preset-coop-pve');
    expect(Object.keys(store.getState().session.cards)).toHaveLength(86);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledWith(true);
  });

  it('shows an error and changes nothing when the download fails', async () => {
    vi.mocked(loadDemoData).mockRejectedValue(new Error('offline'));
    const { store, onClose, user } = renderDialog(sessionWithDeck());
    const before = store.getState().session;
    await user.click(screen.getByRole('button', { name: 'Load demo' }));
    expect(await screen.findByText(/Couldn't load the demo\. Check your connection, then reload the page\./)).toBeInTheDocument();
    expect(store.getState().session).toBe(before);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Load demo' })).toBeEnabled();
    expect(screen.queryByRole('dialog', { name: 'Load the demo?' })).not.toBeInTheDocument();
  });

  it('says Loading demo… while it downloads, keeps focus, and ignores repeat clicks', async () => {
    let finish: (chunk: Awaited<ReturnType<typeof realChunk>>) => void = () => {};
    vi.mocked(loadDemoData).mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const { store, user } = renderDialog();
    await user.click(screen.getByRole('button', { name: 'Load demo' }));
    const button = screen.getByRole('button', { name: 'Loading demo…' });
    expect(button).not.toBeDisabled();
    await user.click(button);
    expect(vi.mocked(loadDemoData)).toHaveBeenCalledTimes(1);
    finish(await realChunk());
    await waitFor(() => expect(store.getState().session.formatId).toBe('preset-coop-pve'));
  });

  it('starts nothing when the dialog is closed while it downloads', async () => {
    let finish: (chunk: Awaited<ReturnType<typeof realChunk>>) => void = () => {};
    vi.mocked(loadDemoData).mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const { store, onClose, user } = renderDialog(sessionWithDeck());
    const before = store.getState().session;
    await user.click(screen.getByRole('button', { name: 'Load demo' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledWith(false);
    finish(await realChunk());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(store.getState().session).toBe(before);
    expect(screen.queryByRole('dialog', { name: 'Load the demo?' })).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
