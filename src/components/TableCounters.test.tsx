import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { addCounter } from '../actions/counters';
import { moveCard } from '../actions/moveCard';
import { gameWithDeck, pilesOutOfTheWay, testContext } from '../actions/testing';
import type { ActionContext, GameState } from '../model/game';
import { createGameStore, GameStoreProvider } from '../store/gameStore';
import { TableSurface } from './TableSurface';

/** Imp on the table. */
function setup() {
  let game = gameWithDeck();
  game = pilesOutOfTheWay(
    moveCard(game, {
      cardId: game.piles[0]?.cardIds[0] ?? '',
      to: { zone: 'table' },
    }).state,
  );
  const store = createGameStore(game, testContext());
  render(
    <GameStoreProvider store={store}>
      <TableSurface />
    </GameStoreProvider>,
  );
  return store;
}

const table = () => screen.getByRole('group', { name: /^Table, / });
const card = (name: RegExp | string) => within(table()).getByRole('button', { name });
const dialog = () => screen.getByRole('dialog', { name: 'Counters on Imp' });
function addTo(game: GameState, name: string, context: ActionContext) {
  return addCounter(game, { cardId: game.table[0]?.cardId ?? '', name }, context);
}

const counters = (store: ReturnType<typeof setup>) => store.getState().game.table[0]?.counters?.map((c) => `${c.name} ${c.value}`);

describe('TT-8 card counters', () => {
  it('adds, steps and removes a counter by keyboard alone, announcing each change', async () => {
    const store = setup();
    card('Imp').focus();
    await userEvent.keyboard('c');
    expect(within(dialog()).getByRole('textbox', { name: 'New counter name' })).toHaveFocus();
    await userEvent.keyboard('Damage{Enter}');
    expect(counters(store)).toEqual(['Damage 1']);
    expect(within(dialog()).getByRole('status')).toHaveTextContent('Added Damage 1 to Imp.');
    // The new counter's value takes focus, and + and − step it.
    expect(within(dialog()).getByRole('textbox', { name: 'Damage' })).toHaveFocus();
    await userEvent.keyboard('++');
    expect(counters(store)).toEqual(['Damage 3']);
    expect(within(dialog()).getByRole('status')).toHaveTextContent('Damage on Imp: 3.');
    await userEvent.keyboard('{ArrowDown}');
    expect(counters(store)).toEqual(['Damage 2']);
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Remove counter' }));
    expect(counters(store)).toBeUndefined();
    expect(within(dialog()).getByRole('textbox', { name: 'New counter name' })).toHaveFocus();
    // jsdom's stand-in dialog has no Escape, so Done closes it here; the E2E covers Escape.
    await userEvent.click(within(dialog()).getByRole('button', { name: 'Done' }));
    expect(card('Imp')).toHaveFocus();
  });

  it('shows pills on the card and names them in its label', async () => {
    const store = setup();
    card('Imp').focus();
    await userEvent.keyboard('c');
    await userEvent.keyboard('Damage{Enter}+{Tab}');
    expect(card('Imp, counters: Damage 2')).toBeInTheDocument();
    expect(within(table()).getByRole('button', { name: 'Damage 2' })).toHaveAttribute('tabindex', '-1');
    // Typing a value keeps it on Escape.
    within(dialog()).getByRole('textbox', { name: 'Damage' }).focus();
    await userEvent.keyboard('{Control>}a{/Control}7{Escape}');
    expect(counters(store)).toEqual(['Damage 7']);
  });

  it('opens at the pressed pill, and collapses four or more into "+N more"', async () => {
    const store = setup();
    act(() => {
      for (const name of ['Damage', 'Shield', 'Poison', 'Charge']) {
        store.getState().dispatch((g, context) => addTo(g, name, context));
      }
    });
    const pills = within(table()).getAllByRole('button', {
      name: /^(Damage|Shield|Poison|Charge) 1$|more$/,
    });
    expect(pills.map((p) => p.textContent)).toEqual(['Damage 1', 'Shield 1', '+2 more']);
    fireEvent.click(within(table()).getByRole('button', { name: 'Shield 1' }));
    expect(within(dialog()).getByRole('textbox', { name: 'Shield' })).toHaveFocus();
  });

  it('refuses a name the card already has', async () => {
    setup();
    card('Imp').focus();
    await userEvent.keyboard('c');
    await userEvent.keyboard('Damage{Enter}');
    within(dialog()).getByRole('textbox', { name: 'New counter name' }).focus();
    await userEvent.keyboard('damage{Enter}');
    expect(within(dialog()).getByText('This card already has a damage counter.')).toBeInTheDocument();
  });

  it('opens from the card menu, and each change is undone on its own', async () => {
    const store = setup();
    card('Imp').focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.click(screen.getByRole('menuitem', { name: 'Counters…' }));
    await userEvent.keyboard('Damage{Enter}+{Escape}');
    expect(counters(store)).toEqual(['Damage 2']);
    act(() => store.getState().undo());
    expect(counters(store)).toEqual(['Damage 1']);
    act(() => store.getState().undo());
    expect(counters(store)).toBeUndefined();
  });
});
