import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { loadPile } from '../actions/loadPile';
import { draw } from '../actions/pileActions';
import { cardsFrom, tableIds, testContext } from '../actions/testing';
import { createSoloSession } from '../model/session';
import { createSessionStore, SessionStoreProvider } from '../store/sessionStore';
import { HandTray } from './HandTray';

const csv = 'name,id,back_of,text\nImp,,,Small.\nMoonrise Hunter,,hunter,Night side.\nDaylight Hunter,hunter,,Day side.\nOgre,,,Big.\n';

/** Imp, Daylight Hunter and Ogre drawn into Player 1's hand, in that order. */
function setup(drawn = 3) {
  let session = loadPile(createSoloSession(), { pileId: 'pile-p1-main', sourceName: 'd.csv', cards: cardsFrom(csv), keepOrder: true }, testContext()).state;
  if (drawn > 0) session = draw(session, { pileId: 'pile-p1-main', count: drawn }).state;
  const store = createSessionStore(session, testContext());
  const onDraw = vi.fn();
  render(
    <SessionStoreProvider store={store}>
      <button type="button">Before</button>
      <HandTray seatId="seat-p1" seatName="Player 1" onDraw={onDraw} />
    </SessionStoreProvider>,
  );
  return { store, onDraw };
}

const hand = () => screen.getByRole('region', { name: "Player 1's hand" });
const card = (name: string) => within(hand()).getByRole('button', { name });

describe('FS-3 hand tray', () => {
  it("shows the seat's cards by name, and the count", () => {
    setup();
    expect(within(hand()).getByText('3 cards')).toBeInTheDocument();
    const list = within(hand()).getByRole('list', { name: "Player 1's hand, 3 cards. Arrow keys move between cards." });
    expect(within(list).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Imp', 'Daylight Hunter, double-faced', 'Ogre']);
  });

  it('says when the hand is empty, and draws from the Draw button', async () => {
    const { onDraw } = setup(0);
    expect(screen.getByText("No cards in hand. Draw from Player 1's deck to start.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Draw' }));
    expect(onDraw).toHaveBeenCalledTimes(1);
  });
});

describe('A11Y-3 hand focus', () => {
  it('is one Tab stop, with ←, →, Home and End between cards', async () => {
    setup();
    await userEvent.tab();
    await userEvent.tab();
    await userEvent.tab();
    expect(card('Imp')).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(card('Daylight Hunter, double-faced')).toHaveFocus();
    await userEvent.keyboard('{End}');
    expect(card('Ogre')).toHaveFocus();
    await userEvent.keyboard('{ArrowRight}');
    expect(card('Ogre')).toHaveFocus();
    await userEvent.keyboard('{Home}');
    expect(card('Imp')).toHaveFocus();
    expect(card('Ogre')).toHaveAttribute('tabindex', '-1');
  });
});

describe('TT-4 and SP-8 hand card menu', () => {
  it('opens on click, Enter or right-click, and Esc returns to the card', async () => {
    setup();
    await userEvent.click(card('Ogre'));
    const menu = screen.getByRole('menu', { name: 'Actions for Ogre' });
    expect(within(menu).getAllByRole('menuitem').map((i) => i.textContent)).toEqual(['Play to tableP', 'Move to…M', 'Details…']);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(card('Ogre')).toHaveFocus();

    await userEvent.keyboard('{Enter}');
    expect(screen.getByRole('menu', { name: 'Actions for Ogre' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    fireEvent.contextMenu(card('Imp'));
    expect(screen.getByRole('menu', { name: 'Actions for Imp' })).toBeInTheDocument();
  });

  it('plays a card to the table from the menu, and focus moves to the next card', async () => {
    const { store } = setup();
    await userEvent.click(card('Imp'));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Play to table' }));
    expect(tableIds(store.getState().session)).toHaveLength(1);
    expect(store.getState().announcement.text).toBe("Moved Imp from Player 1's hand to the table.");
    expect(card('Daylight Hunter, double-faced')).toHaveFocus();
  });

  it('plays with P, and goes to Draw when the hand is empty; Undo brings the card back', async () => {
    const { store } = setup(1);
    card('Imp').focus();
    await userEvent.keyboard('p');
    expect(screen.getByRole('button', { name: 'Draw' })).toHaveFocus();
    store.getState().undo();
    await waitFor(() => expect(card('Imp')).toBeInTheDocument());
  });

  it('opens Move to… with M, and moving the card focuses the next one', async () => {
    const { store } = setup();
    card('Daylight Hunter, double-faced').focus();
    await userEvent.keyboard('m');
    const dialog = screen.getByRole('dialog', { name: 'Daylight Hunter' });
    expect(dialog).toHaveTextContent("from Player 1's hand");
    await userEvent.click(within(dialog).getByRole('option', { name: /^Board cards — top/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Move to Board cards — top' }));
    expect(store.getState().session.piles.find((p) => p.id === 'pile-board')?.cardIds).toHaveLength(1);
    await waitFor(() => expect(card('Ogre')).toHaveFocus());
  });

  it("shows a hand card's details, even though it was drawn face down", async () => {
    setup();
    await userEvent.click(card('Daylight Hunter, double-faced'));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Details…' }));
    const details = screen.getByRole('dialog', { name: 'Daylight Hunter' });
    expect(details).toHaveTextContent('Day side.');
    expect(details).toHaveTextContent('Night side.');
    await userEvent.click(within(details).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(card('Daylight Hunter, double-faced')).toHaveFocus());
  });
});
