import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { sessionWithDeck, testContext } from '../actions/testing';
import { PVP_1V1, SOLO_PVE } from '../model/format';
import { createSession } from '../model/session';
import { memoryBackend } from '../storage/backends';
import { StorageProvider, useOption } from '../storage/StorageProvider';
import { createSessionStore, SessionStoreProvider } from '../store/sessionStore';
import { DefaultFormat } from './DefaultFormat';
import { LiveRegion } from './LiveRegion';
import { SessionScreen } from './SessionScreen';

function Saved() {
  return <span data-testid="saved-format">{useOption('defaultFormat')}</span>;
}

function renderScreen(session = createSession(SOLO_PVE)) {
  const store = createSessionStore(session, testContext());
  render(
    <StorageProvider backend={memoryBackend()}>
      <SessionStoreProvider store={store}>
        <DefaultFormat />
        <SessionScreen />
        <LiveRegion />
        <Saved />
      </SessionStoreProvider>
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
          <DefaultFormat />
        </SessionStoreProvider>
      </StorageProvider>,
    );
    expect(store.getState().session.formatId).toBe(SOLO_PVE.id);
  });
});
