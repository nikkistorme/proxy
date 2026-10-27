import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { testContext } from '../actions/testing';
import { createSoloSession } from '../model/session';
import { createSessionStore, SessionStoreProvider } from '../store/sessionStore';
import { LiveRegion } from './LiveRegion';
import { SessionScreen } from './SessionScreen';

function renderScreen() {
  const store = createSessionStore(createSoloSession(), testContext());
  render(
    <SessionStoreProvider store={store}>
      <SessionScreen />
      <LiveRegion />
    </SessionStoreProvider>,
  );
  return store;
}

describe('TT-13 seat counters', () => {
  it('shows each seat counter in the seat bar with its value', () => {
    renderScreen();
    expect(screen.getByRole('group', { name: 'Player 1 Life' })).toHaveTextContent('20');
    expect(screen.getByRole('group', { name: 'Player 1 Energy' })).toHaveTextContent('0');
  });

  it('steps with the buttons and announces each change', async () => {
    const user = userEvent.setup();
    const store = renderScreen();
    await user.click(screen.getByRole('button', { name: 'Decrease Player 1 Life' }));
    expect(screen.getByRole('group', { name: 'Player 1 Life' })).toHaveTextContent('19');
    expect(store.getState().announcement.text).toBe('Player 1 Life 20 → 19.');
    await user.click(screen.getByRole('button', { name: 'Increase Player 1 Energy' }));
    expect(screen.getByRole('group', { name: 'Player 1 Energy' })).toHaveTextContent('1');
  });

  it('steps with arrow keys, + and − on a focused button, keeping focus', async () => {
    const user = userEvent.setup();
    renderScreen();
    const increase = screen.getByRole('button', { name: 'Increase Player 1 Life' });
    increase.focus();
    await user.keyboard('{ArrowUp}{ArrowUp}+');
    expect(screen.getByRole('group', { name: 'Player 1 Life' })).toHaveTextContent('23');
    await user.keyboard('{ArrowDown}-');
    expect(screen.getByRole('group', { name: 'Player 1 Life' })).toHaveTextContent('21');
    await user.keyboard('{Enter}');
    expect(screen.getByRole('group', { name: 'Player 1 Life' })).toHaveTextContent('22');
    expect(increase).toHaveFocus();
  });
});
