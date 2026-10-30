import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { testContext } from '../actions/testing';
import { createSession } from '../model/session';
import { SOLO_PVE } from '../model/format';
import { createSessionStore, SessionStoreProvider } from '../store/sessionStore';
import { LiveRegion } from './LiveRegion';
import { SessionScreen } from './SessionScreen';
import { timeAgo } from './SessionLog';

function renderScreen(session = createSession(SOLO_PVE)) {
  const store = createSessionStore(session, testContext());
  const user = userEvent.setup();
  render(
    <SessionStoreProvider store={store}>
      <SessionScreen />
      <LiveRegion />
    </SessionStoreProvider>,
  );
  return { store, user };
}

const dice = () => screen.getByRole('dialog', { name: 'Dice & coins' });
const log = () => screen.getByRole('dialog', { name: 'Session log' });

describe('TT-14 Dice & coins', () => {
  it('rolls with focus on d20 first, shows the result and announces it', async () => {
    const { store, user } = renderScreen();
    await user.click(screen.getByRole('button', { name: 'Dice & coins' }));
    expect(screen.getByRole('button', { name: 'Roll d20' })).toHaveFocus();
    expect(within(dice()).getByText('Pick a die to roll.')).toBeInTheDocument();
    await user.keyboard('{Enter}');
    const { lastRoll } = store.getState();
    expect(lastRoll?.die).toBe('d20');
    expect(within(dice()).getByText(lastRoll?.result ?? '')).toBeInTheDocument();
    expect(store.getState().announcement.text).toBe(`Rolled d20: ${lastRoll?.result}.`);
    expect(screen.getByRole('button', { name: 'Roll d20' })).toHaveFocus();
  });

  it('flips a coin and goes back to the button on close', async () => {
    const { store, user } = renderScreen();
    const opener = screen.getByRole('button', { name: 'Dice & coins' });
    await user.click(opener);
    await user.click(screen.getByRole('button', { name: 'Flip a coin' }));
    expect(store.getState().lastRoll?.result).toMatch(/^(Heads|Tails)$/);
    expect(within(dice()).getByText('Coin flip')).toBeInTheDocument();
    await user.click(within(dice()).getByRole('button', { name: 'Done' }));
    expect(opener).toHaveFocus();
  });

  it('is hidden when the session doesn’t use dice', () => {
    renderScreen({ ...createSession(SOLO_PVE), usesDice: false });
    expect(screen.queryByRole('button', { name: 'Dice & coins' })).not.toBeInTheDocument();
  });
});

describe('TT-14 session log', () => {
  it('opens from the This session menu and says when it is empty', async () => {
    const { user } = renderScreen();
    const opener = screen.getByRole('button', { name: 'This session' });
    await user.click(opener);
    expect(opener).toHaveAttribute('aria-expanded', 'true');
    await user.click(screen.getByRole('menuitem', { name: 'Session log' }));
    expect(within(log()).getByText('Nothing logged yet. Rolls and coin flips show here.')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(opener).toHaveFocus();
  });

  it('lists rolls newest first', async () => {
    const { store, user } = renderScreen();
    store.getState().roll('d6');
    store.getState().roll('Coin');
    await user.click(screen.getByRole('button', { name: 'This session' }));
    await user.click(screen.getByRole('menuitem', { name: 'Session log' }));
    const items = within(log()).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent(/^Flipped a coin: (heads|tails)just now$/);
    expect(items[1]).toHaveTextContent(/^Rolled d6: [1-6]just now$/);
  });

  it('words times like the board', () => {
    expect(timeAgo(0, 59_000)).toBe('just now');
    expect(timeAgo(0, 3 * 60_000)).toBe('3 min ago');
    expect(timeAgo(0, 125 * 60_000)).toBe('2 h ago');
  });
});
