import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { gameWithDeck, namesOf, testContext } from '../actions/testing';
import { createGameStore, GameStoreProvider } from '../store/gameStore';
import { PeekDialog } from './PeekDialog';

const csv = 'name\nImp\nOgre\nTroll\nWisp\n';

function renderPeek(count = 3) {
  const user = userEvent.setup();
  const store = createGameStore(gameWithDeck(csv), testContext());
  const cardIds = store.getState().game.piles[0]?.cardIds.slice(0, count) ?? [];
  const onClose = vi.fn();
  render(
    <GameStoreProvider store={store}>
      <PeekDialog request={{ pileId: 'pile-p1-main', cardIds }} onClose={onClose} />
    </GameStoreProvider>,
  );
  const dialog = screen.getByRole('dialog', { name: `Top ${count} of P1 main deck` });
  const state = () => store.getState().game;
  const pileNames = () => namesOf(state(), state().piles[0]?.cardIds);
  const shown = () => within(screen.getByRole('list', { name: 'Top cards, top first' })).getAllByRole('img').map((c) => c.getAttribute('aria-label'));
  return { user, dialog, onClose, state, pileNames, shown };
}

describe('SP-9 peek', () => {
  it('shows the top cards face up, top first', () => {
    const { dialog, shown } = renderPeek();
    expect(dialog).toHaveTextContent('Shown face up to you only');
    expect(shown()).toEqual(['Imp', 'Ogre', 'Troll']);
    expect(screen.getByRole('button', { name: 'Up: Imp' })).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'Down: Troll' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('reorders with Up and Down, announcing each step and keeping focus on the moved card', async () => {
    const { user, dialog, shown } = renderPeek();
    await user.click(screen.getByRole('button', { name: 'Up: Troll' }));
    expect(shown()).toEqual(['Imp', 'Troll', 'Ogre']);
    expect(screen.getByRole('button', { name: 'Up: Troll' })).toHaveFocus();
    expect(within(dialog).getByText('Troll is now 2 of 3.')).toBeInTheDocument();

    await user.keyboard('{Enter}');
    expect(shown()).toEqual(['Troll', 'Imp', 'Ogre']);
    expect(screen.getByRole('button', { name: 'Up: Troll' })).toHaveFocus();
    expect(within(dialog).getByText('Troll is now 1 of 3, the top.')).toBeInTheDocument();

    // At the top, Up does nothing.
    await user.keyboard('{Enter}');
    expect(shown()).toEqual(['Troll', 'Imp', 'Ogre']);
  });

  it('Done puts the cards back in the order shown', async () => {
    const { user, onClose, pileNames } = renderPeek();
    await user.click(screen.getByRole('button', { name: 'Down: Imp' }));
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(pileNames()).toEqual(['Ogre', 'Imp', 'Troll', 'Wisp']);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closing with × also keeps the order shown', async () => {
    const { user, pileNames } = renderPeek(2);
    await user.click(screen.getByRole('button', { name: 'Down: Imp' }));
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(pileNames()).toEqual(['Ogre', 'Imp', 'Troll', 'Wisp']);
  });

  it('changes nothing when the order is unchanged', async () => {
    const { user, state } = renderPeek();
    const before = state();
    await user.click(screen.getByRole('button', { name: 'Done' }));
    // No action ran, so the game is the very same object.
    expect(state()).toBe(before);
  });

  it('moves a card away with Move to…, then puts the rest back in order', async () => {
    const { user, dialog, shown, state, pileNames } = renderPeek();
    await user.click(screen.getByRole('button', { name: 'Down: Imp' }));
    await user.click(screen.getByRole('button', { name: 'Move to…: Ogre' }));
    const move = screen.getByRole('dialog', { name: 'Ogre' });
    // The pile's own top is left out: reordering does that.
    expect(within(move).queryByRole('option', { name: /^P1 main deck — top/ })).not.toBeInTheDocument();
    await user.click(within(move).getByRole('option', { name: /^Table/ }));
    await user.click(within(move).getByRole('button', { name: 'Move to Table' }));

    expect(namesOf(state(), state().table)).toEqual(['Ogre']);
    expect(shown()).toEqual(['Imp', 'Troll']);
    // Regression: closing the Move dialog must not close the Peek dialog.
    expect(dialog).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Move to…: Imp' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(pileNames()).toEqual(['Imp', 'Troll', 'Wisp']);
  });

  it('moves a card to the bottom of its own pile, and focuses Done when none are left', async () => {
    const { user, dialog, pileNames } = renderPeek(1);
    await user.click(screen.getByRole('button', { name: 'Move to…: Imp' }));
    await user.type(screen.getByRole('combobox', { name: 'Find a destination' }), 'main deck{Enter}');
    expect(pileNames()).toEqual(['Ogre', 'Troll', 'Wisp', 'Imp']);
    expect(dialog).toHaveTextContent('No cards left to put back.');
    expect(screen.getByRole('button', { name: 'Done' })).toHaveFocus();
  });
});
