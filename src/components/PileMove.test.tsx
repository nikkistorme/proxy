import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { moveCard } from '../actions/moveCard';
import { sessionWithDeck, testContext } from '../actions/testing';
import type { SessionState } from '../model/session';
import { snapToGrid } from '../model/tableView';
import { createSessionStore, SessionStoreProvider } from '../store/sessionStore';
import { TOUCH_HOLD_MS } from './cardDrag';
import { SessionScreen } from './SessionScreen';

const MAIN = 'pile-p1-main';

function idOf(session: SessionState, name: string) {
  return Object.values(session.cards).find((c) => session.definitions[c.definitionId]?.front.name === name)?.id ?? '';
}

/** The Solo session's piles along the top row, from (16, 16), with Imp under P1 main deck and Ogre and Troll left in it. */
function setup() {
  let session = sessionWithDeck();
  session = moveCard(session, { cardId: idOf(session, 'Imp'), to: { zone: 'table', position: { x: 16, y: 208 } } }).state;
  const store = createSessionStore(session, testContext());
  const user = userEvent.setup();
  render(
    <SessionStoreProvider store={store}>
      <SessionScreen />
    </SessionStoreProvider>,
  );
  return { store, user };
}

type Store = ReturnType<typeof setup>['store'];
const table = () => screen.getByRole('group', { name: /^Table, / });
const pile = (name: string) => within(table()).getByRole('button', { name: new RegExp(`^${name},`) });
const status = (store: Store) => store.getState().announcement.text;
const spotOf = (store: Store, pileId = MAIN) => {
  const found = store.getState().session.piles.find((p) => p.id === pileId);
  return found && { x: found.x, y: found.y };
};
const hand = (store: Store) => store.getState().session.hands['seat-p1'] ?? [];

/** What's under the pointer: another pile, the hand, or else the table. */
let hit: 'table' | 'pile' | 'hand' = 'table';

beforeEach(() => {
  hit = 'table';
  document.elementFromPoint = () => {
    if (hit === 'pile') return pile('Board cards');
    if (hit === 'hand') return document.querySelector('.hand-tray');
    return table();
  };
  // Piles are card-sized where their style puts them, and the table is at (0, 0). jsdom has no layout.
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (this.classList.contains('table-pile')) return new DOMRect(parseFloat(this.style.left), parseFloat(this.style.top), 126, 176);
    return new DOMRect(0, 0, 0, 0);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

const mouse = (x: number, y: number) => ({ clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', button: 0 });
const touch = (x: number, y: number) => ({ clientX: x, clientY: y, pointerId: 2, pointerType: 'touch' });
const hold = () => act(() => new Promise((resolve) => window.setTimeout(resolve, TOUCH_HOLD_MS + 50)));

/** A mouse press on the pile at `from`, dragged to `to`. */
function mouseDrag(element: HTMLElement, from: [number, number], to: [number, number], { release = true } = {}) {
  fireEvent.pointerDown(element, mouse(...from));
  fireEvent.pointerMove(document, mouse(from[0] + 10, from[1]));
  fireEvent.pointerMove(document, mouse(...to));
  if (release) fireEvent.pointerUp(document, mouse(...to));
}

describe('SP-6 pressing a pile', () => {
  it('draws the top card into the hand on click, in one undo step', async () => {
    const { store, user } = setup();
    const steps = store.getState().past.length;
    await user.click(pile('P1 main deck'));
    expect(hand(store)).toEqual([idOf(store.getState().session, 'Ogre')]);
    expect(status(store)).toBe('Player 1 drew Ogre from P1 main deck. 1 card left.');
    expect(store.getState().past).toHaveLength(steps + 1);
    expect(pile('P1 main deck')).toHaveFocus();
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('says how to use it', () => {
    setup();
    expect(pile('P1 main deck')).toHaveAccessibleDescription('Click draws the top card. Enter, right-click, or a touch held and let go, opens actions. Space moves the pile.');
  });

  it('opens its menu on Enter, without drawing', async () => {
    const { store, user } = setup();
    pile('P1 main deck').focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('menu', { name: 'Actions for P1 main deck' })).toBeInTheDocument();
    expect(hand(store)).toEqual([]);
  });
});

describe('A11Y-1 moving a pile by keyboard', () => {
  it('picks a pile up with Space, moves the outline with arrows and places it with Enter, in one undo step', async () => {
    const { store, user } = setup();
    const steps = store.getState().past.length;
    pile('P1 main deck').focus();
    await user.keyboard(' ');
    const outline = await screen.findByRole('button', { name: /^Placing P1 main deck, Row 1, column 1\./ });
    await waitFor(() => expect(outline).toHaveFocus());
    expect(status(store)).toBe('Picked up P1 main deck. Row 1, column 1. Arrow keys move it, Enter places it, Escape cancels.');
    // Space didn't click the pile, so nothing was drawn.
    expect(hand(store)).toEqual([]);

    await user.keyboard('{Shift>}{ArrowDown}{/Shift}');
    expect(status(store)).toBe('Row 2, column 1, over Imp.');
    await user.keyboard('{Shift>}{ArrowRight}{/Shift}');
    // The pile doesn't count itself as under the outline, but Environment deck is there.
    await user.keyboard('{Shift>}{ArrowUp}{/Shift}');
    expect(status(store)).toBe('Row 1, column 2, over Environment deck. Enter merges them.');
    await user.keyboard('{Shift>}{ArrowDown}{/Shift}{Enter}');

    expect(spotOf(store)).toEqual({ x: 158, y: 208 });
    expect(status(store)).toBe('Moved P1 main deck on the table.');
    expect(store.getState().past).toHaveLength(steps + 1);
    await waitFor(() => expect(pile('P1 main deck')).toHaveFocus());
    expect(pile('P1 main deck').closest('.table-pile')).toHaveStyle({ left: '158px', top: '208px' });

    await user.keyboard('{Control>}z{/Control}');
    expect(spotOf(store)).toEqual({ x: 16, y: 16 });
  });

  it('puts the pile back on Escape', async () => {
    const { store, user } = setup();
    pile('P1 main deck').focus();
    await user.keyboard(' ');
    await waitFor(() => expect(screen.getByRole('button', { name: /^Placing P1 main deck/ })).toHaveFocus());
    await user.keyboard('{ArrowRight}{Escape}');
    expect(status(store)).toBe('Put P1 main deck back.');
    expect(spotOf(store)).toEqual({ x: 16, y: 16 });
    await waitFor(() => expect(pile('P1 main deck')).toHaveFocus());
  });

  it('starts from Move on table in the pile menu, and a tap then Place moves it', async () => {
    const { store, user } = setup();
    await user.pointer({ keys: '[MouseRight]', target: pile('Board cards') });
    await user.click(screen.getByRole('menuitem', { name: /^Move on table/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: /^Placing Board cards, Row 1, column 3\./ })).toHaveFocus());
    // A tap on the table moves the outline there, centred on the pointer.
    fireEvent.pointerDown(table(), { clientX: 563, clientY: 488 });
    fireEvent.click(table(), { clientX: 563, clientY: 488, detail: 1 });
    await user.click(screen.getByRole('button', { name: 'Place' }));
    expect(spotOf(store, 'pile-board')).toEqual({ x: 500, y: 400 });
  });
});

describe('TT-4 dragging a pile', () => {
  it('moves the whole pile on the table in one undo step, and the drag doesn’t draw', async () => {
    const { store } = setup();
    const steps = store.getState().past.length;
    // Taken hold of 14px into the pile, so its corner lands 14px up and left of the pointer.
    mouseDrag(pile('P1 main deck'), [30, 30], [330, 330], { release: false });
    expect(status(store)).toBe('Dragging P1 main deck. Escape cancels.');
    expect(store.getState().drag).toEqual({ pileId: MAIN, over: { zone: 'table', position: { x: 316, y: 316 } } });
    expect(pile('P1 main deck').closest('.table-pile')).toHaveClass('card-drag-origin');
    // The copy under the pointer keeps the name plate, and can't be found or dropped on.
    const ghost = document.querySelector('.drag-ghost');
    expect(ghost).toHaveTextContent('P1 main deck');
    expect(ghost?.querySelector('button, [data-drop-zone], [data-pile-id]')).toBeNull();

    fireEvent.pointerUp(document, mouse(330, 330));
    fireEvent.click(pile('P1 main deck'), { detail: 1 });
    expect(spotOf(store)).toEqual({ x: 316, y: 316 });
    expect(status(store)).toBe('Moved P1 main deck on the table.');
    expect(store.getState().past).toHaveLength(steps + 1);
    expect(hand(store)).toEqual([]);
    await waitFor(() => expect(pile('P1 main deck')).toHaveFocus());
  });

  it('lands on the table when dropped over another pile, and goes back when dropped on the hand or on Escape', () => {
    const { store } = setup();
    hit = 'pile';
    mouseDrag(pile('P1 main deck'), [30, 30], [330, 330]);
    expect(spotOf(store)).toEqual({ x: 316, y: 316 });
    expect(spotOf(store, 'pile-board')).toEqual({ x: 300, y: 16 });

    hit = 'hand';
    mouseDrag(pile('Board cards'), [310, 30], [100, 700]);
    expect(status(store)).toBe('Put Board cards back.');
    expect(spotOf(store, 'pile-board')).toEqual({ x: 300, y: 16 });

    hit = 'table';
    mouseDrag(pile('Board cards'), [310, 30], [600, 600], { release: false });
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.pointerUp(document, mouse(600, 600));
    expect(status(store)).toBe('Put Board cards back.');
    expect(spotOf(store, 'pile-board')).toEqual({ x: 300, y: 16 });
  });

  it('snaps to the grid with snap on, and never goes past the top or left edge', () => {
    const { store } = setup();
    store.getState().setView({ snap: true });
    mouseDrag(pile('P1 main deck'), [30, 30], [330, 330]);
    expect(spotOf(store)).toEqual(snapToGrid({ x: 316, y: 316 }));
    // Snapped, a drag past the corner lands on the first grid lines; unsnapped, at the very edge.
    mouseDrag(pile('P1 main deck'), [320, 320], [-50, -50]);
    expect(spotOf(store)).toEqual({ x: 16, y: 16 });
    store.getState().setView({ snap: false });
    mouseDrag(pile('P1 main deck'), [30, 30], [-50, -50]);
    expect(spotOf(store)).toEqual({ x: 0, y: 0 });
  });

  it('touch: a tap draws, a held finger moved drags, and a held finger let go in place opens the menu', async () => {
    const { store } = setup();
    fireEvent.pointerDown(pile('P1 main deck'), touch(30, 30));
    await hold();
    expect(store.getState().drag).toMatchObject({ pileId: MAIN });
    fireEvent.pointerUp(document, touch(31, 31));
    expect(screen.getByRole('menu', { name: 'Actions for P1 main deck' })).toBeInTheDocument();
    expect(spotOf(store)).toEqual({ x: 16, y: 16 });
    // The hold's own click comes a little later, and neither closes the menu nor draws.
    await act(() => new Promise((resolve) => window.setTimeout(resolve, 30)));
    fireEvent.click(pile('P1 main deck'), { detail: 1 });
    expect(screen.getByRole('menu', { name: 'Actions for P1 main deck' })).toBeInTheDocument();
    expect(hand(store)).toEqual([]);
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });

    fireEvent.pointerDown(pile('P1 main deck'), touch(30, 30));
    await hold();
    fireEvent.pointerMove(document, touch(330, 330));
    fireEvent.pointerUp(document, touch(330, 330));
    expect(spotOf(store)).toEqual({ x: 316, y: 316 });
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

describe('TT-4 merging piles', () => {
  const ENV = 'pile-env';
  const pileIds = (store: Store) => store.getState().session.piles.map((p) => p.id);

  it('dropping a pile on another asks how to merge them, and the merge is one undo step', async () => {
    const { store, user } = setup();
    const steps = store.getState().past.length;
    // P1 main deck's corner lands at (166, 26), over Environment deck at (158, 16).
    mouseDrag(pile('P1 main deck'), [30, 30], [180, 40], { release: false });
    expect(store.getState().drag).toEqual({ pileId: MAIN, over: { zone: 'pile', pileId: ENV, position: 'top' } });
    const target = pile('Environment deck').closest('.pile-tile');
    expect(target).toHaveClass('pile-tile--drop-target');
    expect(target).toHaveTextContent('Drop: merge');

    fireEvent.pointerUp(document, mouse(180, 40));
    const dialog = await screen.findByRole('dialog', { name: 'Merge P1 main deck and Environment deck?' });
    // Nothing has moved yet.
    expect(spotOf(store)).toEqual({ x: 16, y: 16 });
    await waitFor(() => expect(within(dialog).getByRole('radio', { name: 'P1 main deck 2 cards' })).toHaveFocus());
    await user.keyboard('{Enter}');

    expect(pileIds(store)).not.toContain(MAIN);
    expect(store.getState().session.piles.find((p) => p.id === ENV)?.cardIds).toHaveLength(2);
    expect(status(store)).toBe('Merged P1 main deck into Environment deck. 2 cards.');
    expect(store.getState().past).toHaveLength(steps + 1);
    await waitFor(() => expect(pile('Environment deck')).toHaveFocus());

    await user.keyboard('{Control>}z{/Control}');
    expect(pileIds(store)).toContain(MAIN);
    expect(spotOf(store)).toEqual({ x: 16, y: 16 });
  });

  it('Cancel leaves both piles where they were, with focus on the dragged pile', async () => {
    const { store, user } = setup();
    const steps = store.getState().past.length;
    mouseDrag(pile('P1 main deck'), [30, 30], [180, 40]);
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(pileIds(store)).toEqual([MAIN, ENV, 'pile-board']);
    expect(spotOf(store)).toEqual({ x: 16, y: 16 });
    expect(store.getState().past).toHaveLength(steps);
    await waitFor(() => expect(pile('P1 main deck')).toHaveFocus());
  });

  it('by keyboard: Enter with the outline over a pile asks how to merge them', async () => {
    const { store, user } = setup();
    pile('Environment deck').focus();
    await user.keyboard(' ');
    await waitFor(() => expect(screen.getByRole('button', { name: /^Placing Environment deck/ })).toHaveFocus());
    await user.keyboard('{Shift>}{ArrowLeft}{/Shift}');
    expect(status(store)).toBe('Row 1, column 1, over P1 main deck. Enter merges them.');
    expect(pile('P1 main deck').closest('.pile-tile')).toHaveTextContent('Drop: merge');
    await user.keyboard('{Enter}');

    await screen.findByRole('dialog', { name: 'Merge Environment deck and P1 main deck?' });
    // Keep the dragged pile this time, and put P1 main deck's cards on its bottom.
    await user.click(screen.getByRole('radio', { name: 'P1 main deck 2 cards' }));
    await user.click(screen.getByRole('radio', { name: 'Bottom' }));
    await user.click(screen.getByRole('button', { name: 'Merge piles' }));

    expect(pileIds(store)).toEqual([ENV, 'pile-board']);
    // The kept pile stays where it was.
    expect(spotOf(store, ENV)).toEqual({ x: 158, y: 16 });
    expect(status(store)).toBe('Merged P1 main deck into Environment deck. 2 cards.');
    await waitFor(() => expect(pile('Environment deck')).toHaveFocus());
  });
});
