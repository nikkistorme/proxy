import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { draw } from '../actions/pileActions';
import { gameWithDeck, testContext } from '../actions/testing';
import { createGameStore, GameStoreProvider } from '../store/gameStore';
import { TableTools } from './TableTools';

function setup() {
  const store = createGameStore(gameWithDeck(), testContext());
  render(
    <GameStoreProvider store={store}>
      <TableTools />
      <input aria-label="Field" />
    </GameStoreProvider>,
  );
  const drawOne = () => act(() => void store.getState().dispatch((g) => draw(g, { pileId: 'pile-p1-main' })));
  const handSize = () => store.getState().game.hands['seat-p1']?.length;
  return { store, drawOne, handSize };
}

describe('TT-15 undo and redo controls', () => {
  it('names the buttons and marks them unavailable with nothing to undo or redo', async () => {
    const { store, drawOne } = setup();
    expect(screen.getByRole('navigation', { name: 'Table tools' })).toBeInTheDocument();
    const undo = screen.getByRole('button', { name: 'Undo (Ctrl+Z), nothing to undo' });
    expect(undo).toHaveAttribute('aria-disabled', 'true');
    expect(screen.getByRole('button', { name: 'Redo (Ctrl+Shift+Z), nothing to redo' })).toHaveAttribute('aria-disabled', 'true');

    await userEvent.click(undo);
    expect(store.getState().announcement.text).toBe('Nothing to undo.');

    drawOne();
    expect(screen.getByRole('button', { name: 'Undo (Ctrl+Z)' })).not.toHaveAttribute('aria-disabled');
  });

  it('undoes and redoes from the buttons, keeping focus on the pressed button', async () => {
    const { drawOne, handSize } = setup();
    drawOne();
    const undo = screen.getByRole('button', { name: 'Undo (Ctrl+Z)' });
    await userEvent.click(undo);
    expect(handSize()).toBe(0);
    expect(undo).toHaveFocus();
    expect(undo).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Redo (Ctrl+Shift+Z)' }));
    expect(handSize()).toBe(1);
  });

  it('undoes with Ctrl or ⌘+Z and redoes with Ctrl or ⌘+Shift+Z and Ctrl+Y', async () => {
    const { drawOne, handSize } = setup();
    drawOne();
    await userEvent.keyboard('{Control>}z{/Control}');
    expect(handSize()).toBe(0);
    await userEvent.keyboard('{Control>}{Shift>}z{/Shift}{/Control}');
    expect(handSize()).toBe(1);
    await userEvent.keyboard('{Meta>}z{/Meta}');
    expect(handSize()).toBe(0);
    await userEvent.keyboard('{Meta>}{Shift>}z{/Shift}{/Meta}');
    expect(handSize()).toBe(1);
    await userEvent.keyboard('{Control>}z{/Control}{Control>}y{/Control}');
    expect(handSize()).toBe(1);
  });

  it('leaves the keys alone in a field, under an open dialog or menu, and without a modifier', async () => {
    const { drawOne, handSize } = setup();
    drawOne();
    await userEvent.click(screen.getByRole('textbox', { name: 'Field' }));
    await userEvent.keyboard('{Control>}z{/Control}');
    expect(handSize()).toBe(1);

    screen.getByRole('textbox', { name: 'Field' }).blur();
    const menu = document.body.appendChild(document.createElement('div'));
    menu.setAttribute('role', 'menu');
    await userEvent.keyboard('{Control>}z{/Control}');
    expect(handSize()).toBe(1);
    menu.remove();

    const dialog = document.body.appendChild(document.createElement('dialog'));
    dialog.setAttribute('open', '');
    await userEvent.keyboard('{Control>}z{/Control}');
    expect(handSize()).toBe(1);
    dialog.remove();

    await userEvent.keyboard('z');
    expect(handSize()).toBe(1);
    await userEvent.keyboard('{Control>}z{/Control}');
    expect(handSize()).toBe(0);
  });
});
