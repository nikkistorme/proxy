import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadPile } from '../actions/loadPile';
import { moveCard } from '../actions/moveCard';
import { draw } from '../actions/pileActions';
import { cardsFrom, testContext, pilesOutOfTheWay } from '../actions/testing';
import { createSoloSession, type SessionState } from '../model/session';
import { snapToGrid } from '../model/tableView';
import { createSessionStore, SessionStoreProvider } from '../store/sessionStore';
import { TOUCH_HOLD_MS } from './cardDrag';
import { HandTray } from './HandTray';
import { TableSurface } from './TableSurface';

const csv = 'name,type\nTroll,Creature\nOgre,Creature\nImp,Creature\n';
/** Where the hand's cards sit on screen in these tests. jsdom has no layout. */
const HAND_TOP = 600;

/** Troll and Ogre on the table at (16, 16) and (158, 16), Imp in Player 1's hand, and a stand-in pile to drop on. */
function setup() {
  let session: SessionState = pilesOutOfTheWay(loadPile(createSoloSession(), { pileId: 'pile-p1-main', sourceName: 'd.csv', cards: cardsFrom(csv), keepOrder: true }, testContext()).state);
  for (const name of ['Troll', 'Ogre']) session = moveCard(session, { cardId: idOf(session, name), to: { zone: 'table' } }).state;
  session = draw(session, { pileId: 'pile-p1-main' }).state;
  const store = createSessionStore(session, testContext());
  render(
    <SessionStoreProvider store={store}>
      <div data-drop-zone="pile" data-pile-id="pile-board" data-testid="board-pile" />
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
const handCard = (name: string) => within(screen.getByRole('list', { name: /hand/i })).getByRole('button', { name });
const status = (store: Store) => store.getState().announcement.text;
const spotOf = (store: Store, name: string) => {
  const { session } = store.getState();
  const entry = session.table.find((e) => e.cardId === idOf(session, name));
  return entry && { x: entry.x, y: entry.y };
};
const ghost = () => document.querySelector('.drag-ghost');

/** What's under the pointer: the stand-in pile, the hand, nothing, or else the table. */
let hit: 'table' | 'pile' | 'hand' | 'nothing' = 'table';

beforeEach(() => {
  hit = 'table';
  document.elementFromPoint = () => {
    if (hit === 'pile') return screen.getByTestId('board-pile');
    if (hit === 'hand') return document.querySelector('.hand-tray');
    if (hit === 'nothing') return document.body;
    return table();
  };
  // Table cards are where their style puts them; hand cards are 104 × 145 at the bottom; the table is at (0, 0).
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const { left, top, width, height } = this.style;
    if (this.classList.contains('table-card')) return new DOMRect(parseFloat(left), parseFloat(top), parseFloat(width), parseFloat(height));
    if (this.parentElement?.classList.contains('hand-tray__card')) return new DOMRect(0, HAND_TOP, 104, 145);
    return new DOMRect(0, 0, 0, 0);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** A mouse press at `from`, dragged to `to` and let go. */
function mouseDrag(element: HTMLElement, from: [number, number], to: [number, number], { release = true } = {}) {
  const at = (x: number, y: number) => ({ clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', button: 0 });
  fireEvent.pointerDown(element, at(...from));
  fireEvent.pointerMove(document, at(from[0] + 10, from[1]));
  fireEvent.pointerMove(document, at(...to));
  if (release) fireEvent.pointerUp(document, at(...to));
}

describe('TT-4 drag and drop', () => {
  it('drags a table card to a new spot in one undo step, showing where it will land, and keeps focus on it', async () => {
    const store = setup();
    const steps = store.getState().past.length;
    // Taken hold of 14px into the card, so its corner lands 14px up and left of the pointer.
    mouseDrag(card('Troll'), [30, 30], [330, 330], { release: false });
    expect(status(store)).toBe('Dragging Troll. Escape cancels.');
    expect(ghost()).toHaveAttribute('aria-hidden', 'true');
    expect(ghost()?.querySelector('button')).toBeNull();
    expect(document.querySelector('.table-drop')).toHaveStyle({ left: '316px', top: '316px' });
    expect(document.querySelector('.card-drag-origin')).not.toBeNull();

    fireEvent.pointerUp(document, { clientX: 330, clientY: 330, pointerId: 1, pointerType: 'mouse' });
    expect(spotOf(store, 'Troll')).toEqual({ x: 316, y: 316 });
    expect(store.getState().past).toHaveLength(steps + 1);
    expect(status(store)).toBe('Moved Troll on the table.');
    expect(ghost()).toBeNull();
    expect(document.querySelector('.table-drop')).toBeNull();
    expect(store.getState().drag).toBeUndefined();
    await waitFor(() => expect(card('Troll')).toHaveFocus());
  });

  it('snaps to the grid with snap on, and never goes past the top or left edge', () => {
    const store = setup();
    store.getState().setView({ snap: true });
    mouseDrag(card('Troll'), [30, 30], [330, 330]);
    expect(spotOf(store, 'Troll')).toEqual(snapToGrid({ x: 316, y: 316 }));
    store.getState().setView({ snap: false });
    mouseDrag(card('Ogre'), [300, 30], [20, 5]);
    expect(spotOf(store, 'Ogre')).toEqual({ x: 0, y: 0 });
  });

  it('drops a table card on top of a pile, and focus goes to the next card', async () => {
    const store = setup();
    hit = 'pile';
    mouseDrag(card('Troll'), [30, 30], [400, 400]);
    expect(store.getState().session.piles.find((p) => p.id === 'pile-board')?.cardIds).toEqual([idOf(store.getState().session, 'Troll')]);
    expect(status(store)).toMatch(/^Moved Troll from the table to the top of Board cards/);
    await waitFor(() => expect(card('Ogre')).toHaveFocus());
  });

  it('drops a table card in the hand, which shows it as the drop target first', () => {
    const store = setup();
    hit = 'hand';
    mouseDrag(card('Troll'), [30, 30], [50, HAND_TOP + 20], { release: false });
    expect(document.querySelector('.hand-tray')).toHaveClass('hand-tray--drop-target');
    expect(screen.getByText("Drop: Player 1's hand")).toBeInTheDocument();
    fireEvent.pointerUp(document, { clientX: 50, clientY: HAND_TOP + 20, pointerId: 1, pointerType: 'mouse' });
    expect(store.getState().session.hands['seat-p1']).toHaveLength(2);
  });

  it('drags a hand card to the table, and focus follows it there', async () => {
    const store = setup();
    mouseDrag(handCard('Imp'), [52, HAND_TOP + 10], [400, 300]);
    expect(store.getState().session.hands['seat-p1']).toEqual([]);
    expect(status(store)).toBe("Moved Imp from Player 1's hand to the table.");
    // The hand card is 104px wide, so the pointer 52px in is the middle of the table card too.
    expect(spotOf(store, 'Imp')).toEqual({ x: 400 - 63, y: Math.round(300 - (10 / 145) * 176) });
    await waitFor(() => expect(card('Imp')).toHaveFocus());
  });

  it('drags a hand card to a pile', () => {
    const store = setup();
    hit = 'pile';
    mouseDrag(handCard('Imp'), [52, HAND_TOP + 10], [400, 300]);
    expect(store.getState().session.piles.find((p) => p.id === 'pile-board')?.cardIds).toHaveLength(1);
  });

  it('puts the card back on Escape, or when dropped outside any target', async () => {
    const store = setup();
    const steps = store.getState().past.length;
    mouseDrag(card('Troll'), [30, 30], [330, 330], { release: false });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(status(store)).toBe('Put Troll back.');
    expect(ghost()).toBeNull();
    fireEvent.pointerUp(document, { clientX: 330, clientY: 330, pointerId: 1, pointerType: 'mouse' });
    expect(spotOf(store, 'Troll')).toEqual({ x: 16, y: 16 });
    await waitFor(() => expect(card('Troll')).toHaveFocus());

    hit = 'nothing';
    mouseDrag(handCard('Imp'), [52, HAND_TOP + 10], [400, 300]);
    expect(status(store)).toBe('Put Imp back.');
    expect(store.getState().session.hands['seat-p1']).toHaveLength(1);
    expect(store.getState().past).toHaveLength(steps);
    expect(handCard('Imp')).toHaveFocus();
  });

  it("doesn't treat its own hand as a target, and a click without a drag still opens the menu", async () => {
    const store = setup();
    hit = 'hand';
    mouseDrag(handCard('Imp'), [52, HAND_TOP + 10], [80, HAND_TOP + 30], { release: false });
    expect(document.querySelector('.hand-tray')).not.toHaveClass('hand-tray--drop-target');
    fireEvent.pointerUp(document, { clientX: 80, clientY: HAND_TOP + 30, pointerId: 1, pointerType: 'mouse' });
    expect(status(store)).toBe('Put Imp back.');
    // The drag's own click doesn't open the menu.
    fireEvent.click(handCard('Imp'), { detail: 1 });
    expect(screen.queryByRole('menu')).toBeNull();

    await act(() => new Promise((resolve) => window.setTimeout(resolve)));
    fireEvent.pointerDown(handCard('Imp'), { clientX: 52, clientY: HAND_TOP + 10, pointerId: 2, pointerType: 'mouse', button: 0 });
    fireEvent.pointerUp(document, { clientX: 52, clientY: HAND_TOP + 10, pointerId: 2, pointerType: 'mouse' });
    fireEvent.click(handCard('Imp'), { detail: 1 });
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('touch: a swipe scrolls, but resting on a card lifts it, and then the page stays still', async () => {
    const store = setup();
    const touch = (x: number, y: number) => ({ clientX: x, clientY: y, pointerId: 3, pointerType: 'touch' });
    fireEvent.pointerDown(card('Troll'), touch(30, 30));
    fireEvent.pointerMove(document, touch(30, 60));
    await act(() => new Promise((resolve) => window.setTimeout(resolve, TOUCH_HOLD_MS + 50)));
    expect(store.getState().drag).toBeUndefined();
    expect(ghost()).toBeNull();

    fireEvent.pointerDown(card('Troll'), touch(30, 30));
    await act(() => new Promise((resolve) => window.setTimeout(resolve, TOUCH_HOLD_MS + 50)));
    expect(store.getState().drag?.cardId).toBe(idOf(store.getState().session, 'Troll'));
    const scroll = new Event('touchmove', { cancelable: true });
    document.dispatchEvent(scroll);
    expect(scroll.defaultPrevented).toBe(true);
    fireEvent.pointerMove(document, touch(330, 330));
    fireEvent.pointerUp(document, touch(330, 330));
    expect(spotOf(store, 'Troll')).toEqual({ x: 316, y: 316 });
  });

  it("doesn't start while a card is being placed", () => {
    const store = setup();
    store.getState().setPlacing({ cardId: idOf(store.getState().session, 'Ogre') });
    mouseDrag(card('Troll'), [30, 30], [330, 330]);
    expect(store.getState().drag).toBeUndefined();
    expect(spotOf(store, 'Troll')).toEqual({ x: 16, y: 16 });
  });
});
