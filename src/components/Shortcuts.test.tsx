import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { sessionWithDeck, testContext } from '../actions/testing';
import { createSessionStore, SessionStoreProvider } from '../store/sessionStore';
import { LiveRegion } from './LiveRegion';
import { SessionScreen } from './SessionScreen';

function renderScreen() {
  const store = createSessionStore(sessionWithDeck(), testContext());
  const user = userEvent.setup();
  render(
    <SessionStoreProvider store={store}>
      <SessionScreen />
      <LiveRegion />
    </SessionStoreProvider>,
  );
  return { store, user };
}

const table = () => screen.getByRole('group', { name: /^Table, / });
const reference = () => screen.getByRole('dialog', { name: 'Keyboard shortcuts' });

describe('A11Y-4 shortcut reference', () => {
  it('opens from the toolbar button with focus on the list, and goes back on close', async () => {
    const { user } = renderScreen();
    const opener = screen.getByRole('button', { name: 'Keyboard shortcuts (?)' });
    await user.click(opener);
    expect(within(reference()).getByRole('region', { name: 'Shortcuts' })).toHaveFocus();
    expect(within(reference()).getByRole('heading', { name: 'Card on the table' })).toBeInTheDocument();
    await user.click(within(reference()).getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog', { name: 'Keyboard shortcuts' })).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  // jsdom's dialog has no Escape; the E2E covers it.
  it('opens with ? from the table and focus goes back there', async () => {
    const { user } = renderScreen();
    table().focus();
    await user.keyboard('?');
    await user.click(within(reference()).getByRole('button', { name: 'Done' }));
    expect(table()).toHaveFocus();
  });
});

describe('A11Y-4 single-key shortcuts only in the table, hand and toolbar (WCAG 2.1.4)', () => {
  it('ignores D, ? and G with focus outside them', async () => {
    const { store, user } = renderScreen();
    const outside = screen.getByRole('button', { name: 'This session' });
    outside.focus();
    await user.keyboard('d?g');
    expect(store.getState().past).toHaveLength(0);
    expect(store.getState().view.snap).toBe(false);
    expect(screen.queryByRole('dialog', { name: 'Keyboard shortcuts' })).not.toBeInTheDocument();
  });

  it('draws with D and snaps with G from the table', async () => {
    const { store, user } = renderScreen();
    table().focus();
    await user.keyboard('d');
    expect(store.getState().announcement.text).toMatch(/drew Imp/);
    await user.keyboard('g');
    expect(store.getState().view.snap).toBe(true);
  });

  it('draws with D from the hand and toolbar', async () => {
    const { store, user } = renderScreen();
    screen.getByRole('button', { name: /^Draw/ }).focus();
    await user.keyboard('d');
    screen.getByRole('button', { name: /^Undo/ }).focus();
    await user.keyboard('d');
    expect(store.getState().past).toHaveLength(2);
  });

  it('keeps Ctrl+Z working anywhere', async () => {
    const { store, user } = renderScreen();
    table().focus();
    await user.keyboard('d');
    screen.getByRole('button', { name: 'This session' }).focus();
    await user.keyboard('{Control>}z{/Control}');
    expect(store.getState().past).toHaveLength(0);
  });
});
