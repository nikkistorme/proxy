import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { moveCard } from '../actions/moveCard';
import { gameWithDeck, testContext, pilesOutOfTheWay } from '../actions/testing';
import type { GameState } from '../model/game';
import { createGameStore, GameStoreProvider } from '../store/gameStore';
import { TableSurface } from './TableSurface';

const idOf = (state: GameState, name: string) =>
  Object.values(state.cards).find((card) => state.definitions[card.definitionId]?.front.name === name)?.id ?? '';

/** Imp, Ogre and Troll in a row on the table, with a button before and after it. */
function setup() {
  let game = pilesOutOfTheWay(gameWithDeck());
  for (const name of ['Imp', 'Ogre', 'Troll']) game = moveCard(game, { cardId: idOf(game, name), to: { zone: 'table' } }).state;
  const store = createGameStore(game, testContext());
  render(
    <GameStoreProvider store={store}>
      <button type="button">Before</button>
      <TableSurface />
      <button type="button">After</button>
    </GameStoreProvider>,
  );
  return store;
}

const card = (name: string) => screen.getByRole('button', { name });

describe('A11Y-3 table focus', () => {
  it('is one Tab stop, with the cards in a named group', async () => {
    setup();
    expect(screen.getByRole('group', { name: 'Table, 3 cards. Arrow keys move between cards. Shift and arrow keys pan.' })).toBeInTheDocument();
    await userEvent.tab();
    await userEvent.tab();
    expect(card('Imp')).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(card('Imp')).toHaveFocus();
    // Firefox would otherwise make the scrolling viewport a second Tab stop.
    expect(document.querySelector('.table-viewport')).toHaveAttribute('tabindex', '-1');
  });

  it('moves focus between cards with the arrow keys, staying put at the edge', async () => {
    setup();
    card('Imp').focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(card('Ogre')).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    expect(card('Troll')).toHaveFocus();
    await userEvent.keyboard('{ArrowUp}');
    expect(card('Troll')).toHaveFocus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(card('Ogre')).toHaveFocus();
  });

  it('returns to the last card focused, or the first card once that one has left', async () => {
    const store = setup();
    card('Ogre').focus();
    await userEvent.tab();
    await userEvent.tab({ shift: true });
    expect(card('Ogre')).toHaveFocus();
    expect(card('Imp')).toHaveAttribute('tabindex', '-1');

    await userEvent.tab();
    act(() => void store.getState().dispatch((g) => moveCard(g, { cardId: idOf(g, 'Ogre'), to: { zone: 'hand', seatId: 'seat-p1' } })));
    await userEvent.tab({ shift: true });
    expect(card('Imp')).toHaveFocus();
  });

  it('shows the empty table with no Tab stop', async () => {
    render(
      <GameStoreProvider store={createGameStore(gameWithDeck(), testContext())}>
        <TableSurface />
      </GameStoreProvider>,
    );
    expect(screen.getByRole('group', { name: 'Table, 0 cards' })).toHaveTextContent('No cards on the table yet.');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('draws cards at their positions, later cards on top', () => {
    setup();
    const cards = document.querySelectorAll<HTMLElement>('.table-card');
    expect([...cards].map((c) => [c.style.left, c.style.top, c.style.zIndex])).toEqual([
      ['16px', '16px', '1'],
      ['158px', '16px', '2'],
      ['300px', '16px', '3'],
    ]);
  });
});

describe('TT-1 panning and zooming the table', () => {
  const viewport = () => document.querySelector<HTMLElement>('.table-viewport') as HTMLElement;

  it('zooms with Ctrl or ⌘ and the wheel, and leaves a plain wheel to scroll', () => {
    const store = setup();
    fireEvent.wheel(viewport(), { deltaY: 100 });
    expect(store.getState().view.zoom).toBe(1);
    fireEvent.wheel(viewport(), { deltaY: -100, ctrlKey: true });
    expect(store.getState().view.zoom).toBe(2);
    fireEvent.wheel(viewport(), { deltaY: 30, metaKey: true });
    expect(store.getState().view.zoom).toBeCloseTo(2 * Math.exp(-0.3));
    expect(store.getState().past).toEqual([]);
  });

  it('scales the mat and keeps the sizer matched, so the scrollbars fit', () => {
    const store = setup();
    act(() => store.getState().setView({ zoom: 0.5 }));
    const surface = screen.getByRole('group');
    expect(surface.style.transform).toBe('scale(0.5)');
    const sizer = surface.parentElement as HTMLElement;
    expect(parseFloat(sizer.style.width)).toBeCloseTo(parseFloat(surface.style.width) * 0.5);
  });

  it('pans with Shift and the arrow keys, keeping focus on the card', async () => {
    setup();
    card('Imp').focus();
    await userEvent.keyboard('{Shift>}{ArrowRight}{ArrowDown}{/Shift}');
    expect(viewport().scrollLeft).toBe(64);
    expect(viewport().scrollTop).toBe(64);
    expect(card('Imp')).toHaveFocus();
  });

  it('pans by dragging empty table space with the mouse, but not by dragging a card', () => {
    setup();
    const surface = screen.getByRole('group');
    viewport().scrollLeft = 100;
    fireEvent.pointerDown(card('Ogre'), { pointerType: 'mouse', button: 0, clientX: 300, clientY: 300 });
    fireEvent.pointerMove(viewport(), { pointerType: 'mouse', clientX: 250, clientY: 300 });
    expect(viewport().scrollLeft).toBe(100);
    fireEvent.pointerDown(surface, { pointerType: 'mouse', button: 0, clientX: 300, clientY: 300 });
    fireEvent.pointerMove(viewport(), { pointerType: 'mouse', clientX: 250, clientY: 280 });
    expect(viewport().scrollLeft).toBe(150);
    expect(viewport().scrollTop).toBe(20);
    fireEvent.pointerUp(viewport(), { pointerType: 'mouse' });
    fireEvent.pointerMove(viewport(), { pointerType: 'mouse', clientX: 0, clientY: 0 });
    expect(viewport().scrollLeft).toBe(150);
  });

  it('says so when there is nothing to fit', () => {
    const store = createGameStore(gameWithDeck(), testContext());
    render(
      <GameStoreProvider store={store}>
        <TableSurface />
      </GameStoreProvider>,
    );
    act(() => store.getState().tableViewport?.fitAll());
    expect(store.getState().announcement.text).toBe('No cards on the table to fit.');
  });
});
