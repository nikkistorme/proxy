import { describe, expect, it } from 'vitest';
import { createSoloGame } from './game';
import { nearestInDirection, readingOrder, tableItems, type TableItem } from './tableNavigation';

const at = (id: string, x: number, y: number): TableItem => ({ id, x, y });

// a b
// c d    and e far off to the right, a little lower than b
const table = [at('a', 0, 0), at('b', 150, 0), at('c', 0, 200), at('d', 150, 200), at('e', 600, 60)];

describe('A11Y-3 table navigation', () => {
  it('moves to the neighbouring card in each direction', () => {
    expect(nearestInDirection(table, 'a', 'right')).toBe('b');
    expect(nearestInDirection(table, 'a', 'down')).toBe('c');
    expect(nearestInDirection(table, 'd', 'left')).toBe('c');
    expect(nearestInDirection(table, 'd', 'up')).toBe('b');
  });

  it('prefers a card in the same row over a nearer one off to the side', () => {
    expect(nearestInDirection(table, 'b', 'right')).toBe('e');
    expect(nearestInDirection(table, 'e', 'left')).toBe('b');
  });

  it('stays put when no card lies that way', () => {
    expect(nearestInDirection(table, 'a', 'left')).toBeUndefined();
    expect(nearestInDirection(table, 'a', 'up')).toBeUndefined();
    expect(nearestInDirection(table, 'missing', 'up')).toBeUndefined();
  });

  it('lists cards in reading order, treating slightly offset cards as one row', () => {
    expect(readingOrder([at('d', 150, 200), at('b', 150, 10), at('a', 0, 0), at('c', 0, 200)])).toEqual(['a', 'b', 'c', 'd']);
  });

  it('moves between piles and cards alike', () => {
    const game = { ...createSoloGame(), table: [{ cardId: 'imp', x: 16, y: 208, rotation: 0 as const }] };
    const items = tableItems(game);
    expect(readingOrder(items)).toEqual(['pile-p1-main', 'pile-env', 'pile-board', 'imp']);
    expect(nearestInDirection(items, 'pile-p1-main', 'down')).toBe('imp');
    expect(nearestInDirection(items, 'imp', 'up')).toBe('pile-p1-main');
  });
});
