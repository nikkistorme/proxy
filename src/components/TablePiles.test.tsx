import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { moveCard } from '../actions/moveCard';
import { sessionWithDeck, testContext } from '../actions/testing';
import type { SessionState } from '../model/session';
import { createSessionStore, SessionStoreProvider } from '../store/sessionStore';
import { SessionScreen } from './SessionScreen';

function idOf(session: SessionState, name: string) {
  return Object.values(session.cards).find((c) => session.definitions[c.definitionId]?.front.name === name)?.id ?? '';
}

/** The Solo session's piles along the top of the table, Imp under P1 main deck, and Ogre after Board cards. */
function setup() {
  let session = sessionWithDeck();
  session = moveCard(session, { cardId: idOf(session, 'Imp'), to: { zone: 'table', position: { x: 16, y: 208 } } }).state;
  session = moveCard(session, { cardId: idOf(session, 'Ogre'), to: { zone: 'table' } }).state;
  const store = createSessionStore(session, testContext());
  const user = userEvent.setup();
  render(
    <SessionStoreProvider store={store}>
      <SessionScreen />
    </SessionStoreProvider>,
  );
  return { store, user };
}

const table = () => screen.getByRole('group', { name: /^Table, / });
const pile = (name: string) => within(table()).getByRole('button', { name: new RegExp(`^${name},`) });
const card = (name: string) => within(table()).getByRole('button', { name });

describe('A11Y-3 piles on the table', () => {
  it('draws piles on the table with the cards, with no separate pile row', () => {
    setup();
    expect(table()).toHaveAccessibleName(/^Table, 2 cards, 3 piles\. Arrow keys move between cards and piles\./);
    expect(screen.queryByRole('list', { name: 'Piles' })).toBeNull();
    expect(pile('P1 main deck').closest('.table-pile')).toHaveStyle({ left: '16px', top: '16px' });
    // Ogre was auto-placed after the piles, not on one.
    expect(card('Ogre').closest('.table-card')).toHaveStyle({ left: '442px', top: '16px' });
  });

  it('shares the table’s one Tab stop, and arrow keys move between piles and cards', async () => {
    const { user } = setup();
    // The last control before the table is the last seat counter's + button.
    screen.getByRole('button', { name: 'Increase Player 1 Energy' }).focus();
    await user.tab();
    expect(pile('P1 main deck')).toHaveFocus();
    expect(pile('Environment deck')).toHaveAttribute('tabindex', '-1');
    expect(card('Imp')).toHaveAttribute('tabindex', '-1');

    await user.keyboard('{ArrowRight}');
    expect(pile('Environment deck')).toHaveFocus();
    await user.keyboard('{ArrowLeft}{ArrowDown}');
    expect(card('Imp')).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(pile('P1 main deck')).toHaveFocus();

    // The last one focused keeps the Tab stop.
    await user.keyboard('{ArrowRight}');
    await user.tab();
    expect(table()).not.toContainElement(document.activeElement as HTMLElement);
    await user.tab({ shift: true });
    expect(pile('Environment deck')).toHaveFocus();
  });

  it('keeps the pile’s own keys, and opens its menu outside the zoomed table', async () => {
    const { user } = setup();
    pile('P1 main deck').focus();
    await user.keyboard('{Enter}');
    const menu = screen.getByRole('menu', { name: 'Actions for P1 main deck' });
    expect(menu.closest('.pile-menu-anchor')).not.toBeNull();
    expect(table()).not.toContainElement(menu);
    await user.keyboard('{Escape}');
    expect(pile('P1 main deck')).toHaveFocus();

    await user.keyboard('v');
    expect(screen.getByRole('dialog', { name: 'P1 main deck' })).toBeInTheDocument();
  });

  it('after deleting a pile, focus goes to the next pile or card in reading order', async () => {
    const { user } = setup();
    await user.pointer({ keys: '[MouseRight]', target: pile('Board cards') });
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    await waitFor(() => expect(card('Ogre')).toHaveFocus());
    expect(table()).toHaveAccessibleName(/^Table, 2 cards, 2 piles\./);
  });

  it('puts a new pile on the table at the next free spot', async () => {
    const { user, store } = setup();
    await user.click(screen.getByRole('button', { name: 'Add pile' }));
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Discard{Enter}');
    expect(pile('Discard')).toHaveFocus();
    expect(store.getState().session.piles.at(-1)).toMatchObject({ name: 'Discard', x: 584, y: 16 });
  });
});
