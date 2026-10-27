import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { loadPile } from '../actions/loadPile';
import { moveCard } from '../actions/moveCard';
import { cardsFrom, tableIds, testContext } from '../actions/testing';
import { createSoloGame, type GameState } from '../model/game';
import { createGameStore, GameStoreProvider } from '../store/gameStore';
import { TableSurface } from './TableSurface';
import { Toast } from './Toast';

const csv = 'name,id,back_of,type,text\nTroll,,,Creature,Smash.\nMoonrise Hunter,,hunter,Creature,Night side.\nDaylight Hunter,hunter,,Creature,Day side.\n';

/** Troll and Daylight Hunter on the table, with the toast. */
function setup() {
  let game: GameState = loadPile(createSoloGame(), { pileId: 'pile-p1-main', sourceName: 'd.csv', cards: cardsFrom(csv), keepOrder: true }, testContext()).state;
  for (const name of ['Troll', 'Daylight Hunter']) {
    const card = Object.values(game.cards).find((c) => game.definitions[c.definitionId]?.front.name === name);
    if (card) game = moveCard(game, { cardId: card.id, to: { zone: 'table' } }).state;
  }
  const store = createGameStore(game, testContext());
  render(
    <GameStoreProvider store={store}>
      <TableSurface />
      <Toast />
    </GameStoreProvider>,
  );
  return store;
}

const table = () => screen.getByRole('group', { name: /^Table, / });
const card = (name: string) => within(table()).getByRole('button', { name });
const status = (store: ReturnType<typeof setup>) => store.getState().announcement.text;

describe('TT-5, TT-6, TT-10 and TT-11 card menu', () => {
  it('opens with Enter, lists the actions with their keys, and Esc returns to the card', async () => {
    setup();
    card('Troll').focus();
    await userEvent.keyboard('{Enter}');
    const menu = screen.getByRole('menu', { name: 'Actions for Troll' });
    expect(within(menu).getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      'Rotate 90° clockwiseR',
      'Rotate 90° counter-clockwiseShift+R',
      'Flip face downF',
      'Move on tableSpace',
      'Move to…M',
      'Counters…C',
      'EnlargeI',
      'Details…',
      'DuplicateCtrl+D',
      'Bring to front',
      'Send to back',
      'DeleteDel',
    ]);
    // Troll is already at the back.
    expect(within(menu).getByRole('menuitem', { name: 'Send to back' })).toHaveAttribute('aria-disabled', 'true');
    expect(within(menu).getByRole('menuitem', { name: 'Rotate 90° clockwise' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(card('Troll')).toHaveFocus();
  });

  it('opens on right-click and from the Actions button, and runs an action', async () => {
    const store = setup();
    fireEvent.contextMenu(card('Daylight Hunter, front face'));
    const menu = screen.getByRole('menu', { name: 'Actions for Daylight Hunter' });
    await userEvent.click(within(menu).getByRole('menuitem', { name: 'Flip to back' }));
    expect(status(store)).toBe('Flipped Daylight Hunter to its back: Moonrise Hunter.');
    expect(card('Moonrise Hunter, back face')).toHaveFocus();

    await userEvent.click(screen.getByRole('button', { name: 'Actions for Moonrise Hunter, back face (Enter)' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Rotate 90° clockwise' }));
    expect(card('Moonrise Hunter, back face, rotated 90°')).toHaveFocus();
    expect(store.getState().past).toHaveLength(2);
  });

  it('rotates with R and Shift+R, and flips with F, on a focused card', async () => {
    const store = setup();
    card('Troll').focus();
    await userEvent.keyboard('r');
    expect(card('Troll, rotated 90°')).toHaveFocus();
    await userEvent.keyboard('R');
    await userEvent.keyboard('R');
    expect(status(store)).toBe('Rotated Troll to 270°.');
    await userEvent.keyboard('f');
    expect(card('Face-down card, Player 1, rotated 270°')).toHaveFocus();
    expect(status(store)).toBe('Turned Troll face down.');
  });

  it('brings a card to the front and keeps focus on it', async () => {
    const store = setup();
    fireEvent.contextMenu(card('Troll'));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Bring to front' }));
    const trollId = store.getState().past[0]?.game.table[0]?.cardId;
    expect(tableIds(store.getState().game).at(-1)).toBe(trollId);
    expect(status(store)).toBe('Brought Troll to the front.');
    expect(card('Troll')).toHaveFocus();
  });

  it('duplicates with Ctrl+D and focuses the copy', async () => {
    const store = setup();
    card('Troll').focus();
    await userEvent.keyboard('{Control>}d{/Control}');
    expect(within(table()).getAllByRole('button', { name: 'Troll' })).toHaveLength(2);
    const copyId = tableIds(store.getState().game).at(-1);
    expect(document.activeElement?.closest('[data-card-id]')?.getAttribute('data-card-id')).toBe(copyId);
  });

  it('deletes with Delete, focuses the next card, and offers Undo in a toast', async () => {
    const store = setup();
    card('Troll').focus();
    await userEvent.keyboard('{Delete}');
    expect(within(table()).queryByRole('button', { name: 'Troll' })).toBeNull();
    expect(card('Daylight Hunter, front face')).toHaveFocus();
    expect(status(store)).toBe('Deleted Troll from the table.');
    expect(document.querySelector('.toast')).toHaveTextContent('Deleted Troll.');

    // The last card: focus goes to the toast's Undo, which brings it back.
    await userEvent.keyboard('{Backspace}');
    expect(screen.getByRole('button', { name: 'Undo' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(card('Daylight Hunter, front face')).toBeInTheDocument();
    expect(document.querySelector('.toast')).toBeNull();
  });

  it('opens Move to… with M, and moving the card focuses the next one', async () => {
    const store = setup();
    card('Troll').focus();
    await userEvent.keyboard('m');
    const dialog = screen.getByRole('dialog', { name: 'Troll' });
    expect(within(dialog).queryByRole('option', { name: /^Table — next free spot/ })).toBeNull();
    expect(within(dialog).getByRole('option', { name: /^Table — choose a spot/ })).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('option', { name: /^Board cards — top/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Move to Board cards — top' }));
    expect(store.getState().game.piles.find((p) => p.id === 'pile-board')?.cardIds).toHaveLength(1);
    await waitFor(() => expect(card('Daylight Hunter, front face')).toHaveFocus());
  });

  it('keeps a face-down card hidden in Move to… and Details', async () => {
    setup();
    card('Troll').focus();
    await userEvent.keyboard('f');
    await userEvent.keyboard('m');
    expect(screen.getByRole('dialog', { name: 'Face-down card' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(card('Face-down card, Player 1')).toHaveFocus());

    fireEvent.contextMenu(card('Face-down card, Player 1'));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Details…' }));
    const details = screen.getByRole('dialog', { name: 'Face-down card' });
    expect(details).toHaveTextContent('Face-down card. Flip it to read it.');
    expect(details).not.toHaveTextContent('Smash.');
  });
});

describe('A11Y-6 card details', () => {
  it('reads every column of both faces, and returns focus to the card', async () => {
    setup();
    fireEvent.contextMenu(card('Daylight Hunter, front face'));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Details…' }));
    const details = screen.getByRole('dialog', { name: 'Daylight Hunter' });
    const terms = within(details).getAllByRole('term').map((t) => t.textContent);
    expect(terms).toEqual(['name', 'type', 'text', 'name', 'type', 'text']);
    expect(details).toHaveTextContent('Day side.');
    expect(details).toHaveTextContent('Night side.');
    expect(within(details).getByRole('heading', { name: 'Back' })).toBeInTheDocument();
    await userEvent.click(within(details).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(card('Daylight Hunter, front face')).toHaveFocus());
  });
});
