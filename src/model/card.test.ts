import { describe, expect, it } from 'vitest';
import { cardColumns, cardTypes, type ImportedCard } from './card';

describe('LY-3 column suggestions', () => {
  it('lists every column with a value on either face, sorted', () => {
    const cards: ImportedCard[] = [
      { row: 2, qty: 1, front: { name: 'Ember Scout', type: 'Unit', fields: { cost: '2', flavour: ' ' } } },
      { row: 3, qty: 1, front: { name: 'Gate', fields: {} }, back: { name: 'Gate', image: 'gate.png', fields: { power: '3' } } },
    ];
    expect(cardColumns(cards)).toEqual(['cost', 'image', 'name', 'power', 'type']);
    expect(cardColumns([])).toEqual([]);
  });
});

describe('LY-8 card types', () => {
  it('lists each type once, ignoring case and outer spaces, from fronts and backs, sorted', () => {
    const face = (name: string, type?: string) => ({ name, type, fields: {} });
    const cards: ImportedCard[] = [
      { row: 2, qty: 1, front: face('Imp', ' Monster ') },
      { row: 3, qty: 1, front: face('Ogre', 'monster'), back: face('Ogre lord', 'Boss') },
      { row: 4, qty: 1, front: face('Sword', 'Equipment') },
      { row: 5, qty: 1, front: face('Blank', '  ') },
    ];
    expect(cardTypes(cards)).toEqual(['Boss', 'Equipment', 'Monster']);
  });
});
