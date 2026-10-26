import { describe, expect, it } from 'vitest';
import type { GameState } from '../model/game';
import { locateCard, moveCard } from './moveCard';
import { draw, revealTop } from './pileActions';
import { gameWithDeck, namesOf, tableIds } from './testing';

const MAIN = 'pile-p1-main';
const BOARD = 'pile-board';

const pileOf = (state: GameState, pileId: string) => namesOf(state, state.piles.find((p) => p.id === pileId)?.cardIds);
const idOf = (state: GameState, name: string) =>
  Object.values(state.cards).find((card) => state.definitions[card.definitionId]?.front.name === name)?.id ?? '';

describe('SP-8 move a card', () => {
  it('moves a card from the middle of a pile to the table, face up', () => {
    const game = gameWithDeck();
    const ogre = idOf(game, 'Ogre');
    const { state, announcement } = moveCard(game, { cardId: ogre, to: { zone: 'table' } });
    expect(pileOf(state, MAIN)).toEqual(['Imp', 'Troll']);
    expect(namesOf(state, tableIds(state))).toEqual(['Ogre']);
    expect(state.cards[ogre]?.side).toBe('front');
    expect(announcement).toBe('Moved Ogre from P1 main deck to the table.');
  });

  it('moves a card to a hand without changing its face', () => {
    const game = gameWithDeck();
    const troll = idOf(game, 'Troll');
    const { state, announcement } = moveCard(game, { cardId: troll, to: { zone: 'hand', seatId: 'seat-p1' } });
    expect(namesOf(state, state.hands['seat-p1'])).toEqual(['Troll']);
    expect(state.cards[troll]?.side).toBe('down');
    expect(announcement).toBe("Moved Troll from P1 main deck to Player 1's hand.");
  });

  it('puts a card on the top or bottom of a pile, face down unless kept face up', () => {
    const onTable = moveCard(gameWithDeck(), { cardId: idOf(gameWithDeck(), 'Imp'), to: { zone: 'table' } }).state;
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
    const game = gameWithDeck();
    const { state, announcement } = moveCard(game, { cardId: idOf(game, 'Imp'), to: { zone: 'pile', pileId: MAIN, position: 'bottom' } });
    expect(pileOf(state, MAIN)).toEqual(['Ogre', 'Troll', 'Imp']);
    expect(announcement).toBe('Moved Imp from P1 main deck to the bottom of P1 main deck.');
  });

  it('moves a card from a hand, keeping the rest of the hand in order', () => {
    const drawn = draw(gameWithDeck(), { pileId: MAIN, count: 3 }).state;
    const { state, announcement } = moveCard(drawn, { cardId: idOf(drawn, 'Ogre'), to: { zone: 'pile', pileId: MAIN, position: 'top' } });
    expect(namesOf(state, state.hands['seat-p1'])).toEqual(['Imp', 'Troll']);
    expect(pileOf(state, MAIN)).toEqual(['Ogre']);
    expect(announcement).toBe("Moved Ogre from Player 1's hand to the top of P1 main deck.");
  });

  it('leaves the state alone when the card is already on the table or in that hand', () => {
    const game = gameWithDeck();
    const onTable = moveCard(game, { cardId: idOf(game, 'Imp'), to: { zone: 'table' } }).state;
    const again = moveCard(onTable, { cardId: idOf(game, 'Imp'), to: { zone: 'table' } });
    expect(again.state).toBe(onTable);
    expect(again.announcement).toBe('Imp is already on the table.');

    const inHand = draw(game, { pileId: MAIN }).state;
    const same = moveCard(inHand, { cardId: idOf(game, 'Imp'), to: { zone: 'hand', seatId: 'seat-p1' } });
    expect(same.state).toBe(inHand);
    expect(same.announcement).toBe("Imp is already in Player 1's hand.");
  });

  it('turns a revealed card face down when it moves to a pile', () => {
    const revealed = revealTop(gameWithDeck(), { pileId: MAIN }).state;
    const imp = idOf(revealed, 'Imp');
    const toPile = moveCard(revealed, { cardId: imp, to: { zone: 'pile', pileId: BOARD, position: 'top' } }).state;
    expect(toPile.cards[imp]?.side).toBe('down');
  });

  it('refuses unknown cards, seats without a hand, and unknown piles or seats', () => {
    const game = gameWithDeck();
    const imp = idOf(game, 'Imp');
    expect(() => moveCard(game, { cardId: 'nope', to: { zone: 'table' } })).toThrow('Card nope is not in play');
    expect(() => moveCard(game, { cardId: imp, to: { zone: 'hand', seatId: 'seat-env' } })).toThrow('Environment has no hand');
    expect(() => moveCard(game, { cardId: imp, to: { zone: 'hand', seatId: 'ghost' } })).toThrow('ghost has no hand');
    expect(() => moveCard(game, { cardId: imp, to: { zone: 'pile', pileId: 'nope', position: 'top' } })).toThrow('Unknown pile: nope');
  });

  it('finds where a card is', () => {
    const game = gameWithDeck();
    const imp = idOf(game, 'Imp');
    expect(locateCard(game, imp)).toEqual({ zone: 'pile', pileId: MAIN });
    const inHand = draw(game, { pileId: MAIN }).state;
    expect(locateCard(inHand, imp)).toEqual({ zone: 'hand', seatId: 'seat-p1' });
    expect(locateCard(moveCard(game, { cardId: imp, to: { zone: 'table' } }).state, imp)).toEqual({ zone: 'table' });
  });

  it('never changes the state it was given', () => {
    const game = gameWithDeck();
    const copy = structuredClone(game);
    moveCard(game, { cardId: idOf(game, 'Ogre'), to: { zone: 'table' } });
    expect(game).toEqual(copy);
  });
});

describe('TT-4 cards on the table', () => {
  it('places cards in the first free spot, or at a given position', () => {
    let game = gameWithDeck();
    game = moveCard(game, { cardId: idOf(game, 'Imp'), to: { zone: 'table' } }).state;
    game = moveCard(game, { cardId: idOf(game, 'Ogre'), to: { zone: 'table', position: { x: 400, y: 300 } } }).state;
    game = moveCard(game, { cardId: idOf(game, 'Troll'), to: { zone: 'table' } }).state;
    expect(game.table).toEqual([
      { cardId: idOf(game, 'Imp'), x: 16, y: 16, rotation: 0 },
      { cardId: idOf(game, 'Ogre'), x: 400, y: 300, rotation: 0 },
      { cardId: idOf(game, 'Troll'), x: 158, y: 16, rotation: 0 },
    ]);
    expect(locateCard(game, idOf(game, 'Ogre'))).toEqual({ zone: 'table' });
  });

  it('takes a card off the table, keeping the others where they are', () => {
    let game = gameWithDeck();
    game = moveCard(game, { cardId: idOf(game, 'Imp'), to: { zone: 'table' } }).state;
    game = moveCard(game, { cardId: idOf(game, 'Ogre'), to: { zone: 'table' } }).state;
    game = moveCard(game, { cardId: idOf(game, 'Imp'), to: { zone: 'hand', seatId: 'seat-p1' } }).state;
    expect(game.table).toEqual([{ cardId: idOf(game, 'Ogre'), x: 158, y: 16, rotation: 0 }]);
  });
});

describe('TT-6 card sides', () => {
  it('a card on the table shows its front, even if it was showing its back', () => {
    const game = gameWithDeck();
    const imp = idOf(game, 'Imp');
    const card = game.cards[imp];
    if (!card) throw new Error('No Imp');
    const backUp: GameState = { ...game, cards: { ...game.cards, [imp]: { ...card, side: 'back' } } };
    expect(moveCard(backUp, { cardId: imp, to: { zone: 'table' } }).state.cards[imp]?.side).toBe('front');
  });
});
