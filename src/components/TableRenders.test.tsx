import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadPile } from '../actions/loadPile';
import { moveCard } from '../actions/moveCard';
import { cardsFrom, pilesOutOfTheWay, testContext } from '../actions/testing';
import { flip } from '../actions/cardActions';
import { SOLO_PVE } from '../model/format';
import { createSession, type SessionState } from '../model/session';
import { createSessionStore, SessionStoreProvider } from '../store/sessionStore';
import { TableSurface } from './TableSurface';

/** How many times each card's face has drawn, by card name: a stand-in for the card re-rendering. */
const faceRenders = vi.hoisted(() => new Map<string, number>());

vi.mock('./CardFace', async (importOriginal) => {
  const original = await importOriginal<typeof import('./CardFace')>();
  return {
    ...original,
    CardFace: (props: Parameters<typeof original.CardFace>[0]) => {
      faceRenders.set(props.face.name, (faceRenders.get(props.face.name) ?? 0) + 1);
      return original.CardFace(props);
    },
  };
});

const csv = 'name,type\nTroll,Creature\nOgre,Creature\nImp,Creature\n';

function idOf(session: SessionState, name: string) {
  return Object.values(session.cards).find((c) => session.definitions[c.definitionId]?.front.name === name)?.id ?? '';
}

/** Troll, Ogre and Imp face up on the table, in a row from (16, 16). */
function setup() {
  let session: SessionState = pilesOutOfTheWay(loadPile(createSession(SOLO_PVE), { pileId: 'pile-p1-main', cardSetId: 'set-1', source: { kind: 'file', name: 'd.csv' }, cards: cardsFrom(csv), keepOrder: true }, testContext()).state);
  for (const name of ['Troll', 'Ogre', 'Imp']) {
    session = moveCard(session, { cardId: idOf(session, name), to: { zone: 'table' } }).state;
    if (session.cards[idOf(session, name)]?.side === 'down') session = flip(session, { cardId: idOf(session, name) }).state;
  }
  const store = createSessionStore(session, testContext());
  render(
    <SessionStoreProvider store={store}>
      <div data-drop-zone="pile" data-pile-id="pile-board" data-testid="board-pile" />
      <TableSurface />
    </SessionStoreProvider>,
  );
  faceRenders.clear();
  return store;
}

const table = () => screen.getByRole('group', { name: /^Table, / });
const card = (name: RegExp) => within(table()).getByRole('button', { name });
const at = (x: number, y: number) => ({ clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', button: 0 });

/** What's under the pointer: the stand-in pile, or else the table. */
let hit: 'table' | 'pile' = 'table';

beforeEach(() => {
  hit = 'table';
  document.elementFromPoint = () => (hit === 'pile' ? screen.getByTestId('board-pile') : table());
  // Table cards are where their style puts them; the table is at (0, 0). jsdom has no layout.
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const { left, top, width, height } = this.style;
    if (this.classList.contains('table-card')) return new DOMRect(parseFloat(left), parseFloat(top), parseFloat(width), parseFloat(height));
    return new DOMRect(0, 0, 0, 0);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PF-2 dragging doesn’t re-render cards that aren’t moving', () => {
  it('drags one card over empty table and onto a pile without re-rendering the others', () => {
    const store = setup();
    fireEvent.pointerDown(card(/^Troll/), at(30, 30));
    // Past the drag threshold, then across empty table: every move changes where it would land.
    for (let x = 40; x <= 600; x += 40) fireEvent.pointerMove(document, at(x, 500));
    expect(store.getState().drag?.over).toMatchObject({ zone: 'table' });
    // A new drop target: the pile.
    hit = 'pile';
    fireEvent.pointerMove(document, at(620, 500));
    expect(store.getState().drag?.over).toMatchObject({ zone: 'pile', pileId: 'pile-board' });
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(faceRenders.get('Ogre') ?? 0).toBe(0);
    expect(faceRenders.get('Imp') ?? 0).toBe(0);
    // The dragged card shows where it came from as the drag starts and ends, and nothing else.
    expect(faceRenders.get('Troll')).toBeLessThanOrEqual(2);
  });

  it('runs an action on one card without re-rendering the others', () => {
    setup();
    const troll = card(/^Troll/);
    act(() => troll.focus());
    fireEvent.keyDown(troll, { key: 'r' });
    expect(card(/^Troll, rotated 90°/)).toBeInTheDocument();

    expect(faceRenders.get('Ogre') ?? 0).toBe(0);
    expect(faceRenders.get('Imp') ?? 0).toBe(0);
    expect(faceRenders.get('Troll')).toBe(1);
  });
});
