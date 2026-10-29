import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { testContext } from '../actions/testing';
import { PVP_1V1, SOLO_PVE } from '../model/format';
import { createSession } from '../model/session';
import { createSessionStore, SessionStoreProvider } from '../store/sessionStore';
import { LiveRegion } from './LiveRegion';
import { SessionScreen } from './SessionScreen';

function renderScreen(format = PVP_1V1) {
  const store = createSessionStore(createSession(format), testContext());
  render(
    <SessionStoreProvider store={store}>
      <SessionScreen />
      <LiveRegion />
    </SessionStoreProvider>,
  );
  return store;
}

const seats = () => within(screen.getByRole('region', { name: 'Seats' }));

describe('FS-3 seat switcher', () => {
  it('shows each seat as a button that says which one is active', () => {
    renderScreen();
    expect(seats().getByRole('button', { name: 'Player 1, active seat' })).toHaveAttribute('aria-pressed', 'true');
    expect(seats().getByRole('button', { name: 'Player 2, switch to this seat' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('swaps the hand tray on a click, keeping focus on the switcher', async () => {
    const user = userEvent.setup();
    const store = renderScreen();
    const p2 = seats().getByRole('button', { name: 'Player 2, switch to this seat' });
    await user.click(p2);
    expect(screen.getByRole('heading', { name: "Player 2's hand" })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: "Player 1's hand" })).not.toBeInTheDocument();
    expect(p2).toHaveAccessibleName('Player 2, active seat');
    expect(p2).toHaveFocus();
    expect(store.getState().announcement.text).toBe('Player 2 is the active seat. Hand: 0 cards.');
    expect(store.getState().past).toHaveLength(0);
  });

  it('switches with Enter on a focused seat button', async () => {
    const user = userEvent.setup();
    renderScreen();
    seats().getByRole('button', { name: 'Player 2, switch to this seat' }).focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('heading', { name: "Player 2's hand" })).toBeInTheDocument();
    expect(seats().getByRole('button', { name: 'Player 2, active seat' })).toHaveFocus();
  });

  it('S and Shift+S switch to the next and previous seat, keeping focus in the hand', async () => {
    const user = userEvent.setup();
    renderScreen();
    screen.getByRole('button', { name: /^Draw/ }).focus();
    await user.keyboard('s');
    expect(seats().getByRole('button', { name: 'Player 2, active seat' })).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: "Player 2's hand" })).getByRole('button', { name: /^Draw/ })).toHaveFocus();
    await user.keyboard('{Shift>}S{/Shift}');
    expect(screen.getByRole('heading', { name: "Player 1's hand" })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Draw/ })).toHaveFocus();
  });

  it('moves focus from the hand to the table when the new seat has no hand', async () => {
    const user = userEvent.setup();
    renderScreen(SOLO_PVE);
    screen.getByRole('button', { name: /^Draw/ }).focus();
    await user.keyboard('s');
    expect(seats().getByRole('button', { name: 'Environment, active seat' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: "Player 1's hand" })).not.toBeInTheDocument();
    const table = screen.getByRole('group', { name: /^Table/ });
    expect(table).toHaveFocus();
    await user.keyboard('S');
    expect(screen.getByRole('heading', { name: "Player 1's hand" })).toBeInTheDocument();
    expect(table).toHaveFocus();
  });

  it('S does nothing while focus is in the seat bar (WCAG 2.1.4)', async () => {
    const user = userEvent.setup();
    renderScreen();
    seats().getByRole('button', { name: 'Player 1, active seat' }).focus();
    await user.keyboard('s');
    expect(seats().getByRole('button', { name: 'Player 1, active seat' })).toBeInTheDocument();
  });
});
