import { describe, expect, it } from 'vitest';
import type { SessionState } from '../model/session';
import { locateCard, moveCard } from './moveCard';
import { draw, revealTop } from './pileActions';
import { sessionWithDeck, namesOf, tableIds } from './testing';

const MAIN = 'pile-p1-main';
const BOARD = 'pile-board';

const pileOf = (state: SessionState, pileId: string) => namesOf(state, state.piles.find((p) => p.id === pileId)?.cardIds);
const idOf = (state: SessionState, name: string) =>
  Object.values(state.cards).find((card) => state.definitions[card.definitionId]?.front.name === name)?.id ?? '';

describe('SP-8 move a card', () => {
  it('moves a card from the middle of a pile to the table, face up', () => {
    const session = sessionWithDeck();
    const ogre = idOf(session, 'Ogre');
    const { state, announcement } = moveCard(session, { cardId: ogre, to: { zone: 'table' } });
    expect(pileOf(state, MAIN)).toEqual(['Imp', 'Troll']);
    expect(namesOf(state, tableIds(state))).toEqual(['Ogre']);
    expect(state.cards[ogre]?.side).toBe('front');
    expect(announcement).toBe('Moved Ogre from P1 main deck to the table.');
  });

  it('moves a card to a hand without changing its face', () => {
    const session = sessionWithDeck();
    const troll = idOf(session, 'Troll');
    const { state, announcement } = moveCard(session, { cardId: troll, to: { zone: 'hand', seatId: 'seat-p1' } });
    expect(namesOf(state, state.hands['seat-p1'])).toEqual(['Troll']);
    expect(state.cards[troll]?.side).toBe('down');
    expect(announcement).toBe("Moved Troll from P1 main deck to Player 1's hand.");
  });

  it('puts a card on the top or bottom of a pile, face down unless kept face up', () => {
    const onTable = moveCard(sessionWithDeck(), { cardId: idOf(sessionWithDeck(), 'Imp'), to: { zone: 'table' } }).state;
    const imp = idOf(onTable, 'Imp');

    const top = moveCard(onTable, { cardId: imp, to: { zone: 'pile', pileId: BOARD, position: 'top' } });
    expect(pileOf(top.state, BOARD)).toEqual(['Imp']);
    expect(top.state.cards[imp]?.side).toBe('down');
    expect(top.announcement).toBe('Moved Imp from the table to the top of Board cards.');

    const bottom = moveCard(top.state, { cardId: imp, to: { zone: 'pile', pileId: MAIN, position: 'bottom', faceUp: true } });
    expect(pileOf(bottom.state, MAIN)).toEqual(['Ogre', 'Troll', 'Imp']);
    expect(pileOf(bottom.state, BOARD)).toEqual([]);
    expect(bottom.state.cards[imp]?.side).toBe('front');
  });

  it('moves a card within the same pile', () => {
    const session = sessionWithDeck();
    const { state, announcement } = moveCard(session, { cardId: idOf(session, 'Imp'), to: { zone: 'pile', pileId: MAIN, position: 'bottom' } });
    expect(pileOf(state, MAIN)).toEqual(['Ogre', 'Troll', 'Imp']);
    expect(announcement).toBe('Moved Imp from P1 main deck to the bottom of P1 main deck.');
  });

  it('moves a card from a hand, keeping the rest of the hand in order', () => {
    const drawn = draw(sessionWithDeck(), { pileId: MAIN, count: 3 }).state;
    const { state, announcement } = moveCard(drawn, { cardId: idOf(drawn, 'Ogre'), to: { zone: 'pile', pileId: MAIN, position: 'top' } });
    expect(namesOf(state, state.hands['seat-p1'])).toEqual(['Imp', 'Troll']);
    expect(pileOf(state, MAIN)).toEqual(['Ogre']);
    expect(announcement).toBe("Moved Ogre from Player 1's hand to the top of P1 main deck.");
  });

  it('leaves the state alone when the card is already on the table or in that hand', () => {
    const session = sessionWithDeck();
    const onTable = moveCard(session, { cardId: idOf(session, 'Imp'), to: { zone: 'table' } }).state;
    const again = moveCard(onTable, { cardId: idOf(session, 'Imp'), to: { zone: 'table' } });
    expect(again.state).toBe(onTable);
    expect(again.announcement).toBe('Imp is already on the table.');

    const inHand = draw(session, { pileId: MAIN }).state;
    const same = moveCard(inHand, { cardId: idOf(session, 'Imp'), to: { zone: 'hand', seatId: 'seat-p1' } });
    expect(same.state).toBe(inHand);
    expect(same.announcement).toBe("Imp is already in Player 1's hand.");
  });

  it('turns a revealed card face down when it moves to a pile', () => {
    const revealed = revealTop(sessionWithDeck(), { pileId: MAIN }).state;
    const imp = idOf(revealed, 'Imp');
    const toPile = moveCard(revealed, { cardId: imp, to: { zone: 'pile', pileId: BOARD, position: 'top' } }).state;
    expect(toPile.cards[imp]?.side).toBe('down');
  });

  it('refuses unknown cards, seats without a hand, and unknown piles or seats', () => {
    const session = sessionWithDeck();
    const imp = idOf(session, 'Imp');
    expect(() => moveCard(session, { cardId: 'nope', to: { zone: 'table' } })).toThrow('Card nope is not in play');
    expect(() => moveCard(session, { cardId: imp, to: { zone: 'hand', seatId: 'seat-env' } })).toThrow('Environment has no hand');
    expect(() => moveCard(session, { cardId: imp, to: { zone: 'hand', seatId: 'ghost' } })).toThrow('ghost has no hand');
    expect(() => moveCard(session, { cardId: imp, to: { zone: 'pile', pileId: 'nope', position: 'top' } })).toThrow('Unknown pile: nope');
  });

  it('finds where a card is', () => {
    const session = sessionWithDeck();
    const imp = idOf(session, 'Imp');
    expect(locateCard(session, imp)).toEqual({ zone: 'pile', pileId: MAIN });
    const inHand = draw(session, { pileId: MAIN }).state;
    expect(locateCard(inHand, imp)).toEqual({ zone: 'hand', seatId: 'seat-p1' });
    expect(locateCard(moveCard(session, { cardId: imp, to: { zone: 'table' } }).state, imp)).toEqual({ zone: 'table' });
  });

  it('never changes the state it was given', () => {
    const session = sessionWithDeck();
    const copy = structuredClone(session);
    moveCard(session, { cardId: idOf(session, 'Ogre'), to: { zone: 'table' } });
    expect(session).toEqual(copy);
  });
});

describe('TT-4 cards on the table', () => {
  // The Solo session's three piles take the first three spots of the top row.
  it('places cards in the first free spot, or at a given position', () => {
    let session = sessionWithDeck();
    session = moveCard(session, { cardId: idOf(session, 'Imp'), to: { zone: 'table' } }).state;
    session = moveCard(session, { cardId: idOf(session, 'Ogre'), to: { zone: 'table', position: { x: 400, y: 300 } } }).state;
    session = moveCard(session, { cardId: idOf(session, 'Troll'), to: { zone: 'table' } }).state;
    expect(session.table).toEqual([
      { cardId: idOf(session, 'Imp'), x: 442, y: 16, rotation: 0 },
      { cardId: idOf(session, 'Ogre'), x: 400, y: 300, rotation: 0 },
      { cardId: idOf(session, 'Troll'), x: 584, y: 16, rotation: 0 },
    ]);
    expect(locateCard(session, idOf(session, 'Ogre'))).toEqual({ zone: 'table' });
  });

  it('A11Y-1 moves a table card to a new spot, keeping its turn, side and layer', () => {
    let session = sessionWithDeck();
    session = moveCard(session, { cardId: idOf(session, 'Imp'), to: { zone: 'table' } }).state;
    session = moveCard(session, { cardId: idOf(session, 'Ogre'), to: { zone: 'table' } }).state;
    const imp = idOf(session, 'Imp');
    session = { ...session, table: session.table.map((e) => (e.cardId === imp ? { ...e, rotation: 90 } : e)) };
    const { state, announcement } = moveCard(session, { cardId: imp, to: { zone: 'table', position: { x: 300, y: 200 } } });
    expect(state.table).toEqual([
      { cardId: imp, x: 300, y: 200, rotation: 90 },
      { cardId: idOf(session, 'Ogre'), x: 584, y: 16, rotation: 0 },
    ]);
    expect(state.cards[imp]).toBe(session.cards[imp]);
    expect(announcement).toBe('Moved Imp on the table.');

    const same = moveCard(state, { cardId: imp, to: { zone: 'table', position: { x: 300, y: 200 } } });
    expect(same.state).toBe(state);
    expect(same.announcement).toBe('Imp is already there.');
  });

  it('A11Y-1 keeps a face-down table card unnamed when it moves', () => {
    let session = sessionWithDeck();
    const imp = idOf(session, 'Imp');
    session = moveCard(session, { cardId: imp, to: { zone: 'table' } }).state;
    const card = session.cards[imp];
    if (card) session = { ...session, cards: { ...session.cards, [imp]: { ...card, side: 'down' } } };
    expect(moveCard(session, { cardId: imp, to: { zone: 'table', position: { x: 300, y: 200 } } }).announcement).toBe('Moved a face-down card on the table.');
  });

  it('takes a card off the table, keeping the others where they are', () => {
    let session = sessionWithDeck();
    session = moveCard(session, { cardId: idOf(session, 'Imp'), to: { zone: 'table' } }).state;
    session = moveCard(session, { cardId: idOf(session, 'Ogre'), to: { zone: 'table' } }).state;
    session = moveCard(session, { cardId: idOf(session, 'Imp'), to: { zone: 'hand', seatId: 'seat-p1' } }).state;
    expect(session.table).toEqual([{ cardId: idOf(session, 'Ogre'), x: 584, y: 16, rotation: 0 }]);
  });
});

describe('TT-6 card sides', () => {
  it('a card on the table shows its front, even if it was showing its back', () => {
    const session = sessionWithDeck();
    const imp = idOf(session, 'Imp');
    const card = session.cards[imp];
    if (!card) throw new Error('No Imp');
    const backUp: SessionState = { ...session, cards: { ...session.cards, [imp]: { ...card, side: 'back' } } };
    expect(moveCard(backUp, { cardId: imp, to: { zone: 'table' } }).state.cards[imp]?.side).toBe('front');
  });
});
