import { describe, expect, it } from 'vitest';
import type { ActionContext, ActionResult, SessionState } from '../model/session';
import { bringToFront, deleteCard, duplicate, flip, rotate, sendToBack } from './cardActions';
import { addCounter, removeCounter, renameCounter, setCounter } from './counters';
import { reorderHand } from './handActions';
import { loadDemo } from './loadDemo';
import { loadPile } from './loadPile';
import { loadPiles } from './loadPiles';
import { moveCard } from './moveCard';
import { reorderTop } from './peek';
import { draw, mill, revealTop, shuffle } from './pileActions';
import { addPile, deletePile, mergePiles, movePile, renamePile } from './piles';
import { changeSeatCounter } from './seatCounters';
import { cardsFrom, sessionWithDeck, testContext } from './testing';

/** Player 1 with Imp, Ogre and Troll in hand, Wisp on the table holding a Damage counter, and six cards left in the deck. */
function midTurn(): { state: SessionState; context: ActionContext } {
  const context = testContext();
  let state = sessionWithDeck('name\nImp\nOgre\nTroll\nWisp\nGolem\nHydra\nSprite\nWyrm\nGhoul\nDrake\n');
  state = draw(state, { pileId: 'pile-p1-main', count: 4 }).state;
  const wisp = state.hands['seat-p1']?.at(-1) ?? '';
  state = moveCard(state, { cardId: wisp, to: { zone: 'table' } }, context).state;
  state = addCounter(state, { cardId: wisp, name: 'Damage' }, context).state;
  return { state, context };
}

const hand = (state: SessionState) => state.hands['seat-p1'] ?? [];
const tableCard = (state: SessionState) => state.table[0]?.cardId ?? '';
const counterId = (state: SessionState) => state.table[0]?.counters?.[0]?.id ?? '';
const first = (ids: readonly string[]) => ids[0] ?? '';
const deck = (state: SessionState) => state.piles[0]?.cardIds ?? [];

// Every action that changes the session, as the UI calls it.
const ACTIONS: Record<string, (state: SessionState, context: ActionContext) => ActionResult> = {
  'load a pile': (s, c) => loadPile(s, { pileId: 'pile-env', cardSetId: 'set-1', source: { kind: 'file', name: 'env.csv' }, cards: cardsFrom('name\nStorm\n'), keepOrder: false }, c),
  'load several piles': (s, c) =>
    loadPiles(s, { loads: [{ pileId: 'pile-env', cardSetId: 'set-1', source: { kind: 'file', name: 'env.csv' }, cards: cardsFrom('name\nStorm\n') }], failed: [], verb: 'Loaded' }, c),
  'load the demo': (s, c) => loadDemo(s, { piles: [{ pileId: 'pile-env', cardSetId: 'set-1', source: { kind: 'file', name: 'env.csv' }, cards: cardsFrom('name\nStorm\n'), keepOrder: false }] }, c),
  shuffle: (s, c) => shuffle(s, { pileId: 'pile-p1-main' }, c),
  draw: (s) => draw(s, { pileId: 'pile-p1-main' }),
  'reveal the top card': (s) => revealTop(s, { pileId: 'pile-p1-main' }),
  mill: (s) => mill(s, { pileId: 'pile-p1-main', count: 1, toPileId: 'pile-board' }),
  'reorder the top after a peek': (s) => reorderTop(s, { pileId: 'pile-p1-main', cardIds: [...deck(s)].reverse() }),
  'add a pile': (s, c) => addPile(s, { name: 'Discard' }, c),
  'rename a pile': (s) => renamePile(s, { pileId: 'pile-board', name: 'Graveyard' }),
  'move a pile': (s) => movePile(s, { pileId: 'pile-board', position: { x: 600, y: 400 } }),
  'merge piles': (s) => mergePiles(s, { fromPileId: 'pile-p1-main', intoPileId: 'pile-board', end: 'top' }),
  'delete a pile': (s) => deletePile(s, { pileId: 'pile-p1-main', moveCardsToPileId: 'pile-board' }),
  'play a hand card to the table': (s, c) => moveCard(s, { cardId: first(hand(s)), to: { zone: 'table' } }, c),
  'place a table card': (s, c) => moveCard(s, { cardId: tableCard(s), to: { zone: 'table', position: { x: 500, y: 300 } } }, c),
  'move a card to a pile': (s, c) => moveCard(s, { cardId: tableCard(s), to: { zone: 'pile', pileId: 'pile-board', position: 'top' } }, c),
  'move a card to the hand': (s, c) => moveCard(s, { cardId: tableCard(s), to: { zone: 'hand', seatId: 'seat-p1' } }, c),
  'reorder the hand': (s) => reorderHand(s, { seatId: 'seat-p1', cardId: first(hand(s)), toIndex: 2 }),
  rotate: (s) => rotate(s, { cardId: tableCard(s), direction: 'clockwise' }),
  'rotate back': (s) => rotate(s, { cardId: tableCard(s), direction: 'counter-clockwise' }),
  flip: (s) => flip(s, { cardId: tableCard(s) }),
  'bring to front': (s, c) => bringToFront(moveCard(s, { cardId: first(hand(s)), to: { zone: 'table' } }, c).state, { cardId: tableCard(s) }),
  'send to back': (s, c) => {
    const played = moveCard(s, { cardId: first(hand(s)), to: { zone: 'table' } }, c).state;
    return sendToBack(played, { cardId: played.table[1]?.cardId ?? '' });
  },
  duplicate: (s, c) => duplicate(s, { cardId: tableCard(s) }, c),
  'delete a card': (s) => deleteCard(s, { cardId: tableCard(s) }),
  'add a counter': (s, c) => addCounter(s, { cardId: tableCard(s), name: 'Shield' }, c),
  'set a counter': (s) => setCounter(s, { cardId: tableCard(s), counterId: counterId(s), value: 3 }),
  'rename a counter': (s) => renameCounter(s, { cardId: tableCard(s), counterId: counterId(s), name: 'Wounds' }),
  'remove a counter': (s) => removeCounter(s, { cardId: tableCard(s), counterId: counterId(s) }),
  'change a seat counter': (s) => changeSeatCounter(s, { seatId: 'seat-p1', counterId: 'p1-life', delta: -1 }),
};

describe('A11Y-5 every game action is announced', () => {
  it.each(Object.entries(ACTIONS))('%s', (_name, action) => {
    const { state, context } = midTurn();
    const result = action(state, context);
    expect(result.state).not.toEqual(state);
    // A whole sentence, so the live region reads it as one.
    expect(result.announcement).toMatch(/^\S.*[.!]$/);
  });
});
