import { describe, expect, it } from 'vitest';
import { createSoloGame } from '../model/game';
import { draw } from './pileActions';
import { addPile, deletePile, movePile, renamePile, validatePileName } from './piles';
import { gameWithDeck, namesOf, testContext } from './testing';

const MAIN = 'pile-p1-main';
const BOARD = 'pile-board';

describe('SP-4 add a pile', () => {
  it('adds an empty pile owned by a seat', () => {
    const { state, announcement, pileId } = addPile(createSoloGame(), { name: '  Discard ', ownerSeatId: 'seat-p1' }, testContext());
    // On the table, at the first spot after the three piles already there.
    expect(state.piles.at(-1)).toEqual({ id: pileId, name: 'Discard', ownerSeatId: 'seat-p1', cardIds: [], definitionIds: [], x: 442, y: 16 });
    expect(announcement).toBe('Added pile Discard (Player 1).');
  });

  it('adds a shared pile', () => {
    const { state, announcement } = addPile(createSoloGame(), { name: 'Tokens' }, testContext());
    expect(state.piles.at(-1)).not.toHaveProperty('ownerSeatId');
    expect(announcement).toBe('Added pile Tokens (shared).');
  });

  it('refuses a blank name, a name already used, and an unknown seat', () => {
    const game = createSoloGame();
    expect(() => addPile(game, { name: '   ' }, testContext())).toThrow('A pile needs a name');
    expect(() => addPile(game, { name: ' board CARDS ' }, testContext())).toThrow('There is already a pile called Board cards');
    expect(() => addPile(game, { name: 'Discard', ownerSeatId: 'ghost' }, testContext())).toThrow('Unknown seat: ghost');
  });
});

describe('SP-4 rename a pile', () => {
  it('renames a pile', () => {
    const { state, announcement } = renamePile(createSoloGame(), { pileId: BOARD, name: 'Shared board' });
    expect(state.piles.find((p) => p.id === BOARD)?.name).toBe('Shared board');
    expect(announcement).toBe('Renamed Board cards to Shared board.');
  });

  it('allows a change of case on its own name, and leaves an identical name alone', () => {
    const game = createSoloGame();
    expect(renamePile(game, { pileId: BOARD, name: 'Board Cards' }).state.piles.find((p) => p.id === BOARD)?.name).toBe('Board Cards');
    const same = renamePile(game, { pileId: BOARD, name: ' Board cards ' });
    expect(same.state).toBe(game);
    expect(same.announcement).toBe('Board cards is already called that.');
  });

  it("refuses another pile's name", () => {
    expect(() => renamePile(createSoloGame(), { pileId: BOARD, name: 'p1 main deck' })).toThrow(
      'There is already a pile called P1 main deck',
    );
  });
});

describe('SP-4 delete a pile', () => {
  it('deletes an empty pile', () => {
    const { state, announcement } = deletePile(createSoloGame(), { pileId: BOARD });
    expect(state.piles.map((p) => p.id)).toEqual([MAIN, 'pile-env']);
    expect(announcement).toBe('Deleted Board cards.');
  });

  it('moves the cards of a pile it deletes to the bottom of another pile, in order', () => {
    const game = gameWithDeck();
    const withEnv = { ...game, piles: game.piles.map((p) => (p.id === 'pile-env' ? { ...p, cardIds: ['env-1'] } : p)) };
    const { state, announcement } = deletePile(withEnv, { pileId: MAIN, moveCardsToPileId: 'pile-env' });
    expect(state.piles.find((p) => p.id === MAIN)).toBeUndefined();
    expect(state.piles.find((p) => p.id === 'pile-env')?.cardIds.slice(1)).toEqual(game.piles.find((p) => p.id === MAIN)?.cardIds);
    expect(announcement).toBe('Deleted P1 main deck. Moved 3 cards to the bottom of Environment deck.');
  });

  it('keeps cards drawn from a deleted pile in play', () => {
    const drawn = draw(gameWithDeck(), { pileId: MAIN }).state;
    const { state } = deletePile(drawn, { pileId: MAIN, moveCardsToPileId: BOARD });
    expect(namesOf(state, state.hands['seat-p1'])).toEqual(['Imp']);
    expect(namesOf(state, state.piles.find((p) => p.id === BOARD)?.cardIds)).toEqual(['Ogre', 'Troll']);
  });

  it('refuses to delete a pile with cards without somewhere to put them', () => {
    const game = gameWithDeck();
    expect(() => deletePile(game, { pileId: MAIN })).toThrow('P1 main deck still has cards; choose a pile to move them to');
    expect(() => deletePile(game, { pileId: MAIN, moveCardsToPileId: MAIN })).toThrow("Cannot move a pile's cards into itself");
    expect(() => deletePile(game, { pileId: MAIN, moveCardsToPileId: 'nope' })).toThrow('Unknown pile: nope');
  });
});

describe('SP-4 pile names', () => {
  it('explains why a name cannot be used, and accepts a good one', () => {
    const game = createSoloGame();
    expect(validatePileName(game, '  ')).toBe('A pile needs a name');
    expect(validatePileName(game, 'board cards')).toBe('There is already a pile called Board cards');
    expect(validatePileName(game, 'Discard')).toBeUndefined();
    expect(validatePileName(game, 'BOARD CARDS', BOARD)).toBeUndefined();
  });
});

describe('TT-4 move a pile on the table', () => {
  it('moves a pile to a spot, keeping its cards', () => {
    const game = gameWithDeck();
    const { state, announcement } = movePile(game, { pileId: MAIN, position: { x: 300, y: 250 } });
    const pile = state.piles.find((p) => p.id === MAIN);
    expect(pile).toMatchObject({ x: 300, y: 250, cardIds: game.piles.find((p) => p.id === MAIN)?.cardIds });
    expect(announcement).toBe('Moved P1 main deck on the table.');
  });

  it('keeps the pile inside the table’s top and left edges', () => {
    const { state } = movePile(gameWithDeck(), { pileId: MAIN, position: { x: -40, y: -10 } });
    expect(state.piles.find((p) => p.id === MAIN)).toMatchObject({ x: 0, y: 0 });
  });

  it('changes nothing when the pile is already there', () => {
    const game = gameWithDeck();
    const { x, y } = game.piles.find((p) => p.id === MAIN) ?? { x: 0, y: 0 };
    const result = movePile(game, { pileId: MAIN, position: { x, y } });
    expect(result.state).toBe(game);
    expect(result.announcement).toBe('P1 main deck is already there.');
  });
});
