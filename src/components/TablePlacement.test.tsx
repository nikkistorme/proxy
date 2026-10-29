import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { loadPile } from '../actions/loadPile';
import { moveCard } from '../actions/moveCard';
import { draw } from '../actions/pileActions';
import { cardsFrom, testContext, pilesOutOfTheWay } from '../actions/testing';
import { createSession, type SessionState } from '../model/session';
import { SOLO_PVE } from '../model/format';
import { CARD_H, CARD_W } from '../model/tablePlacement';
import { createSessionStore, SessionStoreProvider } from '../store/sessionStore';
import { HandTray } from './HandTray';
import { TableSurface } from './TableSurface';

const csv = 'name,type\nTroll,Creature\nOgre,Creature\nImp,Creature\n';

/** Troll and Ogre on the table at (16, 16) and (158, 16), and Imp in Player 1's hand. */
function setup() {
  let session: SessionState = pilesOutOfTheWay(loadPile(createSession(SOLO_PVE), { pileId: 'pile-p1-main', cardSetId: 'set-1', sourceName: 'd.csv', cards: cardsFrom(csv), keepOrder: true }, testContext()).state);
  for (const name of ['Troll', 'Ogre']) session = moveCard(session, { cardId: idOf(session, name), to: { zone: 'table' } }).state;
  session = draw(session, { pileId: 'pile-p1-main' }).state;
  const store = createSessionStore(session, testContext());
  render(
    <SessionStoreProvider store={store}>
      <TableSurface />
      <HandTray seatId="seat-p1" seatName="Player 1" onDraw={() => undefined} />
    </SessionStoreProvider>,
  );
  return store;
}

function idOf(session: SessionState, name: string) {
  return Object.values(session.cards).find((c) => session.definitions[c.definitionId]?.front.name === name)?.id ?? '';
}

type Store = ReturnType<typeof setup>;
const table = () => screen.getByRole('group', { name: /^Table, / });
const card = (name: string) => within(table()).getByRole('button', { name });
const outline = () => screen.getByRole('button', { name: /^Placing / });
const status = (store: Store) => store.getState().announcement.text;
const spotOf = (store: Store, name: string) => {
  const { session } = store.getState();
  const entry = session.table.find((e) => e.cardId === idOf(session, name));
  return entry && { x: entry.x, y: entry.y };
};

describe('A11Y-1 keyboard and single-pointer placement', () => {
  it('Space picks up a table card, arrows move it, Enter places it in one undo step', async () => {
    const store = setup();
    card('Troll').focus();
    await userEvent.keyboard(' ');
    await waitFor(() => expect(outline()).toHaveFocus());
    expect(status(store)).toBe('Picked up Troll. Row 1, column 1. Arrow keys move it, Enter places it, Escape cancels.');
    expect(screen.getByRole('group', { name: 'Placing Troll' })).toBeInTheDocument();

    await userEvent.keyboard('{ArrowRight}{ArrowRight}');
    // It says what it's over.
    expect(status(store)).toBe('Row 1, near column 1, over Ogre.');
    // Shift moves a whole card.
    await userEvent.keyboard('{Shift>}{ArrowRight}{/Shift}');
    expect(status(store)).toBe('Row 1, near column 2, over Ogre.');
    await userEvent.keyboard('{Shift>}{ArrowDown}{/Shift}');
    expect(spotOf(store, 'Troll')).toEqual({ x: 16, y: 16 });

    const steps = store.getState().past.length;
    await userEvent.keyboard('{Enter}');
    expect(spotOf(store, 'Troll')).toEqual({ x: 16 + 32 + CARD_W + 16, y: 16 + CARD_H + 16 });
    expect(store.getState().past).toHaveLength(steps + 1);
    expect(status(store)).toBe('Moved Troll on the table.');
    expect(screen.queryByRole('button', { name: /^Placing / })).toBeNull();
    await waitFor(() => expect(card('Troll')).toHaveFocus());
  });

  it('Space places the card too, without picking it up again', async () => {
    const store = setup();
    card('Troll').focus();
    await userEvent.keyboard(' ');
    await waitFor(() => expect(outline()).toHaveFocus());
    await userEvent.keyboard('{ArrowDown} ');
    expect(spotOf(store, 'Troll')).toEqual({ x: 16, y: 32 });
    await waitFor(() => expect(card('Troll')).toHaveFocus());
    expect(store.getState().placing).toBeUndefined();
    expect(screen.queryByRole('button', { name: /^Placing / })).toBeNull();
  });

  it('Escape puts the card back and returns focus to it', async () => {
    const store = setup();
    card('Troll').focus();
    await userEvent.keyboard(' ');
    await waitFor(() => expect(outline()).toHaveFocus());
    await userEvent.keyboard('{ArrowDown}{Escape}');
    expect(spotOf(store, 'Troll')).toEqual({ x: 16, y: 16 });
    expect(status(store)).toBe('Put Troll back.');
    await waitFor(() => expect(card('Troll')).toHaveFocus());
  });

  it('never goes past the top or left edge, and steps a grid cell with snap on', async () => {
    const store = setup();
    store.getState().setView({ snap: true });
    card('Troll').focus();
    await userEvent.keyboard(' ');
    await waitFor(() => expect(outline()).toHaveFocus());
    await userEvent.keyboard('{ArrowLeft}{ArrowUp}');
    expect(status(store)).toBe('Row 1, column 1.');
    await userEvent.keyboard('{ArrowRight}{Enter}');
    expect(spotOf(store, 'Troll')).toEqual({ x: 16 + (CARD_W + 16) / 2, y: 16 });
  });

  it('a click on the table moves the outline there, and Place confirms', async () => {
    const store = setup();
    card('Troll').focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.click(screen.getByRole('menuitem', { name: 'Move on table' }));
    await waitFor(() => expect(outline()).toHaveFocus());
    // jsdom puts the table at (0, 0), so the outline centres on the click.
    fireEvent.pointerDown(table(), { clientX: 400, clientY: 300 });
    fireEvent.click(table(), { clientX: 400, clientY: 300, detail: 1 });
    expect(spotOf(store, 'Troll')).toEqual({ x: 16, y: 16 });
    await userEvent.click(screen.getByRole('button', { name: 'Place' }));
    expect(spotOf(store, 'Troll')).toEqual({ x: 400 - CARD_W / 2, y: 300 - CARD_H / 2 });
  });

  it('a click on another card while placing moves the outline instead of picking that card', async () => {
    const store = setup();
    card('Troll').focus();
    await userEvent.keyboard(' ');
    await waitFor(() => expect(outline()).toHaveFocus());
    fireEvent.pointerDown(card('Ogre'), { clientX: 221, clientY: 104 });
    fireEvent.click(card('Ogre'), { clientX: 221, clientY: 104, detail: 1 });
    expect(status(store)).toBe('Row 1, column 2, over Ogre.');
    expect(outline()).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(spotOf(store, 'Troll')).toEqual({ x: 16, y: 16 });
  });

  it('Move to… "Table — choose a spot" places a card from the hand, and Cancel returns to the hand', async () => {
    const store = setup();
    const hand = screen.getByRole('list', { name: /hand/i });
    await userEvent.click(within(hand).getByRole('button', { name: 'Imp' }));
    await userEvent.click(screen.getByRole('menuitem', { name: /Move to/ }));
    const dialog = screen.getByRole('dialog', { name: 'Imp' });
    await userEvent.click(within(dialog).getByRole('option', { name: /^Table — choose a spot/ }));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Choose a spot' }));
    await waitFor(() => expect(outline()).toHaveFocus());
    // It starts at the next free spot.
    expect(status(store)).toBe('Picked up Imp. Row 1, column 3. Arrow keys move it, Enter places it, Escape cancels.');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(within(hand).getByRole('button', { name: 'Imp' })).toHaveFocus());

    await userEvent.click(within(hand).getByRole('button', { name: 'Imp' }));
    await userEvent.click(screen.getByRole('menuitem', { name: /Move to/ }));
    await userEvent.type(screen.getByRole('combobox', { name: 'Find a destination' }), 'choose{Enter}');
    await waitFor(() => expect(outline()).toHaveFocus());
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(spotOf(store, 'Imp')).toEqual({ x: 16 + 2 * (CARD_W + 16), y: 32 });
    expect(store.getState().session.hands['seat-p1']).toEqual([]);
    await waitFor(() => expect(card('Imp')).toHaveFocus());
  });

  it('stops placing when the card leaves the table some other way, like an undo', async () => {
    const store = setup();
    card('Troll').focus();
    await userEvent.keyboard(' ');
    await waitFor(() => expect(outline()).toHaveFocus());
    const troll = idOf(store.getState().session, 'Troll');
    act(() => {
      store.getState().dispatch((g) => moveCard(g, { cardId: troll, to: { zone: 'pile', pileId: 'pile-board', position: 'top' } }));
    });
    await waitFor(() => expect(screen.queryByRole('button', { name: /^Placing / })).toBeNull());
    expect(store.getState().placing).toBeUndefined();
  });
});
