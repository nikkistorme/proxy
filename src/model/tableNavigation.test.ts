import { describe, expect, it } from 'vitest';
import type { TableEntry } from './game';
import { nearestInDirection, readingOrder } from './tableNavigation';

const at = (cardId: string, x: number, y: number): TableEntry => ({ cardId, x, y, rotation: 0 });

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
});
