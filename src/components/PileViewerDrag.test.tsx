import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sessionWithDeck, namesOf, testContext } from '../actions/testing';
import { createSessionStore, SessionStoreProvider } from '../store/sessionStore';
import { TOUCH_HOLD_MS } from './cardDrag';
import { PileViewer } from './PileViewer';

const csv = 'name,type\nTroll,Creature\nOgre,Creature\nImp,Creature\n';

/** The viewer over P1 main deck (Troll, Ogre, Imp, top first), with stand-in drop zones behind it. */
function setup() {
  const store = createSessionStore(sessionWithDeck(csv), testContext());
  const onClose = vi.fn();
  render(
    <SessionStoreProvider store={store}>
      <div data-drop-zone="table" data-testid="table" />
      <div data-drop-zone="hand" data-seat-id="seat-p1" data-testid="hand" />
      <div data-drop-zone="pile" data-pile-id="pile-board" data-testid="board-pile" />
      <div data-drop-zone="pile" data-pile-id="pile-p1-main" data-testid="own-pile" />
      <PileViewer pileId="pile-p1-main" onClose={onClose} />
    </SessionStoreProvider>,
  );
  const dialog = screen.getByRole('dialog', { name: 'P1 main deck' }) as HTMLDialogElement;
  const session = () => store.getState().session;
  const names = (pileId: string) => namesOf(session(), session().piles.find((p) => p.id === pileId)?.cardIds ?? []);
  return { store, dialog, onClose, session, names };
}

const card = (dialog: HTMLElement, name: string) => within(dialog).getByRole('button', { name: new RegExp(`^${name}\\. `) });
const ghost = () => document.querySelector('.drag-ghost');

/** What's under the pointer. */
let hit: 'table' | 'hand' | 'board-pile' | 'own-pile' | 'nothing' = 'table';

beforeEach(() => {
  hit = 'table';
  document.elementFromPoint = () => (hit === 'nothing' ? document.body : screen.getByTestId(hit));
  // Viewer cards are 150 × 210 at the top left; the table is at (0, 0).
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    if (this.parentElement?.classList.contains('pile-viewer__frame')) return new DOMRect(0, 0, 150, 210);
    return new DOMRect(0, 0, 0, 0);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

const at = (x: number, y: number, pointerType = 'mouse') => ({ clientX: x, clientY: y, pointerId: 1, pointerType, button: 0 });

/** A mouse press on the card, dragged away; let go unless told not to. */
function mouseDrag(element: HTMLElement, { release = true } = {}) {
  fireEvent.pointerDown(element, at(75, 105));
  fireEvent.pointerMove(document, at(85, 105));
  fireEvent.pointerMove(document, at(400, 300));
  if (release) fireEvent.pointerUp(document, at(400, 300));
}

describe('TT-4 dragging from the pile viewer', () => {
  it('steps aside while a card is dragged, then drops it on the table in one undo step and comes back', async () => {
    const { store, dialog, onClose, session, names } = setup();
    const steps = store.getState().past.length;
    mouseDrag(card(dialog, 'Ogre'), { release: false });
    expect(dialog.open).toBe(false);
    expect(store.getState().announcement.text).toBe('Dragging Ogre. Escape cancels.');
    expect(ghost()?.querySelector('button')).toBeNull();

    fireEvent.pointerUp(document, at(400, 300));
    expect(session().table).toHaveLength(1);
    expect(names('pile-p1-main')).toEqual(['Troll', 'Imp']);
    expect(store.getState().past).toHaveLength(steps + 1);
    expect(store.getState().announcement.text).toMatch(/^Moved Ogre from P1 main deck to the table/);
    expect(dialog.open).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
    expect(ghost()).toBeNull();
    // Focus goes to the card that took its place, as after To table.
    await waitFor(() => expect(card(dialog, 'Imp')).toHaveFocus());
  });

  it('drops a card in a hand or on another pile', () => {
    const { dialog, session, names } = setup();
    hit = 'hand';
    mouseDrag(card(dialog, 'Imp'));
    expect(namesOf(session(), session().hands['seat-p1'] ?? [])).toEqual(['Imp']);
    hit = 'board-pile';
    mouseDrag(card(dialog, 'Troll'));
    expect(names('pile-board')).toEqual(['Troll']);
    expect(names('pile-p1-main')).toEqual(['Ogre']);
    expect(dialog.open).toBe(true);
  });

  it('a card dropped on its own pile goes to the top, but the top card is just put back', () => {
    const { store, dialog, names } = setup();
    hit = 'own-pile';
    mouseDrag(card(dialog, 'Imp'));
    expect(names('pile-p1-main')).toEqual(['Imp', 'Troll', 'Ogre']);
    const steps = store.getState().past.length;
    mouseDrag(card(dialog, 'Imp'));
    expect(store.getState().announcement.text).toBe('Put Imp back.');
    expect(store.getState().past).toHaveLength(steps);
  });

  it('Escape, or a drop on nothing, puts the card back and focuses it in the viewer', async () => {
    const { store, dialog, onClose, names } = setup();
    mouseDrag(card(dialog, 'Ogre'), { release: false });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(store.getState().announcement.text).toBe('Put Ogre back.');
    expect(dialog.open).toBe(true);
    expect(card(dialog, 'Ogre')).toHaveFocus();
    fireEvent.pointerUp(document, at(400, 300));

    await act(() => new Promise((resolve) => window.setTimeout(resolve)));
    hit = 'nothing';
    mouseDrag(card(dialog, 'Troll'));
    expect(store.getState().announcement.text).toBe('Put Troll back.');
    expect(names('pile-p1-main')).toEqual(['Troll', 'Ogre', 'Imp']);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('a click without a drag only chooses the card, and the viewer stays open', () => {
    const { dialog, names } = setup();
    fireEvent.pointerDown(card(dialog, 'Ogre'), at(75, 105));
    fireEvent.pointerUp(document, at(75, 105));
    fireEvent.click(card(dialog, 'Ogre'), { detail: 1 });
    expect(dialog.open).toBe(true);
    expect(names('pile-p1-main')).toEqual(['Troll', 'Ogre', 'Imp']);
    expect(within(dialog).getByRole('button', { name: 'To hand: Ogre' })).toBeInTheDocument();
  });

  it('touch: resting on a card lifts it, and it can be dropped in the hand', async () => {
    const { store, dialog, session } = setup();
    hit = 'hand';
    fireEvent.pointerDown(card(dialog, 'Troll'), at(75, 105, 'touch'));
    await act(() => new Promise((resolve) => window.setTimeout(resolve, TOUCH_HOLD_MS + 50)));
    expect(dialog.open).toBe(false);
    expect(store.getState().drag?.cardId).toBe(session().piles[0]?.cardIds[0]);
    fireEvent.pointerMove(document, at(200, 500, 'touch'));
    fireEvent.pointerUp(document, at(200, 500, 'touch'));
    expect(namesOf(session(), session().hands['seat-p1'] ?? [])).toEqual(['Troll']);
    expect(dialog.open).toBe(true);
  });
});
