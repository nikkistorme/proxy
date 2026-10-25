import { describe, expect, it } from 'vitest';
import { createSoloGame, type GameState } from '../model/game';
import { loadPile } from './loadPile';
import { draw, mill, revealTop, shuffle } from './pileActions';
import { cardsFrom, testContext } from './testing';

const MAIN = 'pile-p1-main';
const BOARD = 'pile-board';

/** A game with Imp, Ogre, Troll (top to bottom) in P1 main deck. */
function game(csv = 'name\nImp\nOgre\nTroll\n'): GameState {
  return loadPile(createSoloGame(), { pileId: MAIN, sourceName: 'deck.csv', cards: cardsFrom(csv), keepOrder: true }, testContext()).state;
}

function names(state: GameState, ids: readonly string[] | undefined): string[] {
  return (ids ?? []).map((id) => state.definitions[state.cards[id]?.definitionId ?? '']?.front.name ?? '?');
}

const pileOf = (state: GameState, pileId: string) => names(state, state.piles.find((p) => p.id === pileId)?.cardIds);
const handOf = (state: GameState) => names(state, state.hands['seat-p1']);

describe('SP-6 shuffle', () => {
  it('reorders the pile and turns every card face down', () => {
    const csv = `name\n${Array.from({ length: 10 }, (_, i) => `Card ${i}`).join('\n')}\n`;
    const revealed = revealTop(game(csv), { pileId: MAIN }).state;
    const { state, announcement } = shuffle(revealed, { pileId: MAIN }, testContext());
    expect(pileOf(state, MAIN)).not.toEqual(pileOf(revealed, MAIN));
    expect([...pileOf(state, MAIN)].sort()).toEqual([...pileOf(revealed, MAIN)].sort());
    expect(Object.values(state.cards).some((card) => card.faceUp)).toBe(false);
    expect(announcement).toBe('Shuffled P1 main deck. 10 cards.');
  });
});

describe('SP-6 draw', () => {
  it('moves the top card to the active seat\'s hand', () => {
    const { state, announcement } = draw(game(), { pileId: MAIN });
    expect(handOf(state)).toEqual(['Imp']);
    expect(pileOf(state, MAIN)).toEqual(['Ogre', 'Troll']);
    expect(announcement).toBe('Player 1 drew Imp from P1 main deck. 2 cards left.');
  });

  it('draws N cards in order and adds them after the cards already in hand', () => {
    const one = draw(game(), { pileId: MAIN }).state;
    const { state, announcement } = draw(one, { pileId: MAIN, count: 2 });
    expect(handOf(state)).toEqual(['Imp', 'Ogre', 'Troll']);
    expect(announcement).toBe('Player 1 drew Ogre and Troll from P1 main deck. 0 cards left.');
  });

  it('draws what is left when asked for more', () => {
    const { state, announcement } = draw(game(), { pileId: MAIN, count: 5 });
    expect(handOf(state)).toEqual(['Imp', 'Ogre', 'Troll']);
    expect(announcement).toBe('Player 1 drew Imp, Ogre and Troll from P1 main deck. Only 3 cards were left. 0 cards left.');
  });

  it('says so when the pile is empty', () => {
    const empty = createSoloGame();
    const { state, announcement } = draw(empty, { pileId: MAIN });
    expect(state).toBe(empty);
    expect(announcement).toBe('P1 main deck is empty. No cards drawn.');
  });

  it('refuses a count below 1 and a seat without a hand', () => {
    expect(() => draw(game(), { pileId: MAIN, count: 0 })).toThrow(RangeError);
    expect(() => draw({ ...game(), activeSeatId: 'seat-env' }, { pileId: MAIN })).toThrow('Environment has no hand');
    expect(() => draw({ ...game(), activeSeatId: 'nobody' }, { pileId: MAIN })).toThrow('Unknown active seat: nobody');
  });
});

describe('SP-6 reveal top card', () => {
  it('turns the top card face up and names it', () => {
    const { state, announcement } = revealTop(game(), { pileId: MAIN });
    const topId = state.piles.find((p) => p.id === MAIN)?.cardIds[0] ?? '';
    expect(state.cards[topId]?.faceUp).toBe(true);
    expect(announcement).toBe('Top of P1 main deck: Imp.');
  });

  it('leaves the state alone when the top card is already face up', () => {
    const revealed = revealTop(game(), { pileId: MAIN }).state;
    expect(revealTop(revealed, { pileId: MAIN }).state).toBe(revealed);
  });

  it('says so when the pile is empty', () => {
    expect(revealTop(createSoloGame(), { pileId: MAIN }).announcement).toBe('P1 main deck is empty. Nothing to reveal.');
  });
});

describe('SP-6 mill', () => {
  it('moves the top N cards onto another pile one at a time', () => {
    const { state, announcement } = mill(game(), { pileId: MAIN, count: 2, toPileId: BOARD });
    expect(pileOf(state, MAIN)).toEqual(['Troll']);
    expect(pileOf(state, BOARD)).toEqual(['Ogre', 'Imp']);
    expect(announcement).toBe('Moved Imp and Ogre from P1 main deck to Board cards.');
  });

  it('puts milled cards on top of what the target pile already holds', () => {
    const once = mill(game(), { pileId: MAIN, count: 1, toPileId: BOARD }).state;
    const { state } = mill(once, { pileId: MAIN, count: 5, toPileId: BOARD });
    expect(pileOf(state, BOARD)).toEqual(['Troll', 'Ogre', 'Imp']);
    expect(pileOf(state, MAIN)).toEqual([]);
  });

  it('says so when the pile is empty, and refuses bad targets and counts', () => {
    expect(mill(createSoloGame(), { pileId: MAIN, count: 1, toPileId: BOARD }).announcement).toBe(
      'P1 main deck is empty. No cards moved.',
    );
    expect(() => mill(game(), { pileId: MAIN, count: 1, toPileId: MAIN })).toThrow('Cannot mill a pile onto itself');
    expect(() => mill(game(), { pileId: MAIN, count: 1.5, toPileId: BOARD })).toThrow(RangeError);
  });
});

describe('AR-1 actions are pure', () => {
  it('never change the state they are given', () => {
    const before = game();
    const copy = structuredClone(before);
    shuffle(before, { pileId: MAIN }, testContext());
    draw(before, { pileId: MAIN, count: 2 });
    revealTop(before, { pileId: MAIN });
    mill(before, { pileId: MAIN, count: 2, toPileId: BOARD });
    expect(before).toEqual(copy);
  });
});
