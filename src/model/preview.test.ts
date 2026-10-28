import { describe, expect, it } from 'vitest';
import { loadPile } from '../actions/loadPile';
import { cardsFrom, sessionWithDeck, testContext } from '../actions/testing';
import { previewAt, previewCardSets } from './preview';

const labels = (set: { faces: { label: string }[] } | undefined) => set?.faces.map((face) => face.label);

/** Definition ids env-1, env-2, … for a second load. */
function envIds() {
  let next = 0;
  return () => `env-${++next}`;
}

describe('LY-7 preview card sets', () => {
  it('lists a loaded card set with its cards in file order', () => {
    const sets = previewCardSets(sessionWithDeck('name,cost\nImp,1\nOgre,3\n'));
    expect(sets).toHaveLength(1);
    expect(sets[0]).toMatchObject({ id: 'set-1', name: 'deck.csv' });
    expect(labels(sets[0])).toEqual(['Imp', 'Ogre']);
    expect(sets[0]?.faces[1]?.face.fields.cost).toBe('3');
  });

  it('follows a double-faced card with its back', () => {
    const sets = previewCardSets(sessionWithDeck('id,name,back_of\nw,Werewolf,\n,Wolf form,w\ni,Imp,\n'));
    expect(labels(sets[0])).toEqual(['Werewolf', 'Wolf form, back', 'Imp']);
  });

  it('leaves out cards no longer in the CSV, and piles with nothing loaded', () => {
    const first = sessionWithDeck('name\nImp\nOgre\n');
    const reloaded = loadPile(
      first,
      { pileId: 'pile-p1-main', cardSetId: 'set-1', sourceName: 'deck.csv', cards: cardsFrom('name\nOgre\n'), keepOrder: true },
      testContext(7),
    ).state;
    expect(previewCardSets(reloaded).map(labels)).toEqual([['Ogre']]);
  });

  it('lists each pile’s set, telling sets from same-named files apart by pile', () => {
    const one = sessionWithDeck('name\nImp\n');
    const pile = one.piles.find((p) => p.id !== 'pile-p1-main' && !p.cardSetId);
    if (!pile) throw new Error('no second pile');
    const two = loadPile(
      one,
      { pileId: pile.id, cardSetId: 'set-2', sourceName: 'deck.csv', cards: cardsFrom('name\nStorm\n'), keepOrder: true },
      // Its own ids, so the second deck's definitions don't replace the first's.
      { ...testContext(3), newId: envIds() },
    ).state;
    const sets = previewCardSets(two);
    expect(sets.map((set) => set.name)).toEqual(two.piles.filter((p) => p.cardSetId).map((p) => `deck.csv (${p.name})`));
  });

  it('finds the set and card to show, wrapping past either end', () => {
    const sets = previewCardSets(sessionWithDeck('name\nImp\nOgre\nTroll\n'));
    expect(previewAt(sets, { index: 0 })?.index).toBe(0);
    expect(previewAt(sets, { setId: 'gone', index: 4 })).toMatchObject({ set: { id: 'set-1' }, index: 1 });
    expect(previewAt(sets, { setId: 'set-1', index: -1 })?.index).toBe(2);
    expect(previewAt([], { index: 0 })).toBeUndefined();
  });
});
