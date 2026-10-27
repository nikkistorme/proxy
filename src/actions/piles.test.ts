import { describe, expect, it } from 'vitest';
import { createSoloSession } from '../model/session';
import { draw, mill } from './pileActions';
import { addPile, deletePile, mergePiles, movePile, renamePile, validatePileName } from './piles';
import { sessionWithDeck, namesOf, testContext } from './testing';

const MAIN = 'pile-p1-main';
const BOARD = 'pile-board';

describe('SP-4 add a pile', () => {
  it('adds an empty pile owned by a seat', () => {
    const { state, announcement, pileId } = addPile(createSoloSession(), { name: '  Discard ', ownerSeatId: 'seat-p1' }, testContext());
    // On the table, at the first spot after the three piles already there.
    expect(state.piles.at(-1)).toEqual({ id: pileId, name: 'Discard', ownerSeatId: 'seat-p1', cardIds: [], definitionIds: [], x: 442, y: 16 });
    expect(announcement).toBe('Added pile Discard (Player 1).');
  });

  it('adds a shared pile', () => {
    const { state, announcement } = addPile(createSoloSession(), { name: 'Tokens' }, testContext());
    expect(state.piles.at(-1)).not.toHaveProperty('ownerSeatId');
    expect(announcement).toBe('Added pile Tokens (shared).');
  });

  it('refuses a blank name, a name already used, and an unknown seat', () => {
    const session = createSoloSession();
    expect(() => addPile(session, { name: '   ' }, testContext())).toThrow('A pile needs a name');
    expect(() => addPile(session, { name: ' board CARDS ' }, testContext())).toThrow('There is already a pile called Board cards');
    expect(() => addPile(session, { name: 'Discard', ownerSeatId: 'ghost' }, testContext())).toThrow('Unknown seat: ghost');
  });
});

describe('SP-4 rename a pile', () => {
  it('renames a pile', () => {
    const { state, announcement } = renamePile(createSoloSession(), { pileId: BOARD, name: 'Shared board' });
    expect(state.piles.find((p) => p.id === BOARD)?.name).toBe('Shared board');
    expect(announcement).toBe('Renamed Board cards to Shared board.');
  });

  it('allows a change of case on its own name, and leaves an identical name alone', () => {
    const session = createSoloSession();
    expect(renamePile(session, { pileId: BOARD, name: 'Board Cards' }).state.piles.find((p) => p.id === BOARD)?.name).toBe('Board Cards');
    const same = renamePile(session, { pileId: BOARD, name: ' Board cards ' });
    expect(same.state).toBe(session);
    expect(same.announcement).toBe('Board cards is already called that.');
  });

  it("refuses another pile's name", () => {
    expect(() => renamePile(createSoloSession(), { pileId: BOARD, name: 'p1 main deck' })).toThrow(
      'There is already a pile called P1 main deck',
    );
  });
});

describe('SP-4 delete a pile', () => {
  it('deletes an empty pile', () => {
    const { state, announcement } = deletePile(createSoloSession(), { pileId: BOARD });
    expect(state.piles.map((p) => p.id)).toEqual([MAIN, 'pile-env']);
    expect(announcement).toBe('Deleted Board cards.');
  });

  it('moves the cards of a pile it deletes to the bottom of another pile, in order', () => {
    const session = sessionWithDeck();
    const withEnv = { ...session, piles: session.piles.map((p) => (p.id === 'pile-env' ? { ...p, cardIds: ['env-1'] } : p)) };
    const { state, announcement } = deletePile(withEnv, { pileId: MAIN, moveCardsToPileId: 'pile-env' });
    expect(state.piles.find((p) => p.id === MAIN)).toBeUndefined();
    expect(state.piles.find((p) => p.id === 'pile-env')?.cardIds.slice(1)).toEqual(session.piles.find((p) => p.id === MAIN)?.cardIds);
    expect(announcement).toBe('Deleted P1 main deck. Moved 3 cards to the bottom of Environment deck.');
  });

  it('keeps cards drawn from a deleted pile in play', () => {
    const drawn = draw(sessionWithDeck(), { pileId: MAIN }).state;
    const { state } = deletePile(drawn, { pileId: MAIN, moveCardsToPileId: BOARD });
    expect(namesOf(state, state.hands['seat-p1'])).toEqual(['Imp']);
    expect(namesOf(state, state.piles.find((p) => p.id === BOARD)?.cardIds)).toEqual(['Ogre', 'Troll']);
  });

  it('refuses to delete a pile with cards without somewhere to put them', () => {
    const session = sessionWithDeck();
    expect(() => deletePile(session, { pileId: MAIN })).toThrow('P1 main deck still has cards; choose a pile to move them to');
    expect(() => deletePile(session, { pileId: MAIN, moveCardsToPileId: MAIN })).toThrow("Cannot move a pile's cards into itself");
    expect(() => deletePile(session, { pileId: MAIN, moveCardsToPileId: 'nope' })).toThrow('Unknown pile: nope');
  });
});

describe('SP-4 pile names', () => {
  it('explains why a name cannot be used, and accepts a good one', () => {
    const session = createSoloSession();
    expect(validatePileName(session, '  ')).toBe('A pile needs a name');
    expect(validatePileName(session, 'board cards')).toBe('There is already a pile called Board cards');
    expect(validatePileName(session, 'Discard')).toBeUndefined();
    expect(validatePileName(session, 'BOARD CARDS', BOARD)).toBeUndefined();
  });
});

describe('TT-4 move a pile on the table', () => {
  it('moves a pile to a spot, keeping its cards', () => {
    const session = sessionWithDeck();
    const { state, announcement } = movePile(session, { pileId: MAIN, position: { x: 300, y: 250 } });
    const pile = state.piles.find((p) => p.id === MAIN);
    expect(pile).toMatchObject({ x: 300, y: 250, cardIds: session.piles.find((p) => p.id === MAIN)?.cardIds });
    expect(announcement).toBe('Moved P1 main deck on the table.');
  });

  it('keeps the pile inside the table’s top and left edges', () => {
    const { state } = movePile(sessionWithDeck(), { pileId: MAIN, position: { x: -40, y: -10 } });
    expect(state.piles.find((p) => p.id === MAIN)).toMatchObject({ x: 0, y: 0 });
  });

  it('never puts a pile over another pile', () => {
    expect(() => movePile(sessionWithDeck(), { pileId: MAIN, position: { x: 250, y: 40 } })).toThrow(
      'P1 main deck would cover Board cards; merge them instead',
    );
  });

  it('changes nothing when the pile is already there', () => {
    const session = sessionWithDeck();
    const { x, y } = session.piles.find((p) => p.id === MAIN) ?? { x: 0, y: 0 };
    const result = movePile(session, { pileId: MAIN, position: { x, y } });
    expect(result.state).toBe(session);
    expect(result.announcement).toBe('P1 main deck is already there.');
  });
});

describe('TT-4 merging piles', () => {
  /** Ogre and Troll left in P1 main deck, and Imp in Board cards. */
  function twoPiles() {
    return mill(sessionWithDeck(), { pileId: MAIN, count: 1, toPileId: BOARD }).state;
  }

  it('deletes one pile and puts its cards on top of the other, in order', () => {
    const session = twoPiles();
    const board = session.piles.find((p) => p.id === BOARD);
    const { state, announcement } = mergePiles(session, { fromPileId: MAIN, intoPileId: BOARD, end: 'top' });
    expect(state.piles.map((p) => p.id)).not.toContain(MAIN);
    expect(namesOf(state, state.piles.find((p) => p.id === BOARD)?.cardIds)).toEqual(['Ogre', 'Troll', 'Imp']);
    // The kept pile stays where it was, with its name and deck.
    expect(state.piles.find((p) => p.id === BOARD)).toMatchObject({ x: board?.x, y: board?.y, name: 'Board cards', definitionIds: board?.definitionIds });
    expect(announcement).toBe('Merged P1 main deck into Board cards. 3 cards.');
  });

  it('can put them on the bottom', () => {
    const { state } = mergePiles(twoPiles(), { fromPileId: MAIN, intoPileId: BOARD, end: 'bottom' });
    expect(namesOf(state, state.piles.find((p) => p.id === BOARD)?.cardIds)).toEqual(['Imp', 'Ogre', 'Troll']);
  });

  it('merges either way round', () => {
    const { state, announcement } = mergePiles(twoPiles(), { fromPileId: BOARD, intoPileId: MAIN, end: 'top' });
    expect(state.piles.map((p) => p.id)).not.toContain(BOARD);
    expect(namesOf(state, state.piles.find((p) => p.id === MAIN)?.cardIds)).toEqual(['Imp', 'Ogre', 'Troll']);
    expect(announcement).toBe('Merged Board cards into P1 main deck. 3 cards.');
  });

  it('refuses to merge a pile into itself', () => {
    expect(() => mergePiles(twoPiles(), { fromPileId: MAIN, intoPileId: MAIN, end: 'top' })).toThrow('Cannot merge a pile into itself');
  });
});
