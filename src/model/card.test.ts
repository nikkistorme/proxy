import { describe, expect, it } from 'vitest';
import { cardColumns, type ImportedCard } from './card';

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
