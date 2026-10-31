import { describe, expect, it } from 'vitest';
import { cardsFrom } from '../actions/testing';
import { cardSetItem, cardSetSummary } from './cardSet';
import { mergeImport } from './mergeImport';

describe('AR-4 card set', () => {
  it('is named after its file, and holds the cards in the CSV as last loaded', () => {
    let next = 0;
    const newId = () => `def-${++next}`;
    const first = mergeImport([], cardsFrom('name\nImp\nOgre\n'), newId);
    const reload = mergeImport(first.definitions, cardsFrom('name\nImp\n'), newId);

    const item = cardSetItem(cardSetSummary('set-1', { kind: 'file', name: 'deck.csv' }), reload.definitions);
    expect(item).toMatchObject({ id: 'set-1', name: 'deck.csv', source: { kind: 'file', name: 'deck.csv' } });
    // Ogre is missing from the CSV now: it stays in the session for copies in play, not in the set.
    expect(item.definitions.map((d) => [d.id, d.front.name])).toEqual([['def-1', 'Imp']]);
  });
});
