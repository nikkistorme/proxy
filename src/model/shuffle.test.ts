import { describe, expect, it } from 'vitest';
import { cryptoRandomInt, seededRandomInt } from './random';
import { shuffled } from './shuffle';

describe('SP-6 shuffle (Fisher–Yates)', () => {
  it('swaps each position with a random earlier one, from the end', () => {
    const maxes: number[] = [];
    const alwaysZero = (max: number) => {
      maxes.push(max);
      return 0;
    };
    expect(shuffled(['a', 'b', 'c', 'd'], alwaysZero)).toEqual(['b', 'c', 'd', 'a']);
    expect(maxes).toEqual([4, 3, 2]);
  });

  it('returns a new array with the same items and leaves the input alone', () => {
    const input = Object.freeze(['a', 'b', 'c', 'd', 'e', 'f']);
    const result = shuffled(input, seededRandomInt(7));
    expect(result).not.toBe(input);
    expect([...result].sort()).toEqual([...input]);
  });

  it('handles empty and single-item lists', () => {
    expect(shuffled([], seededRandomInt(1))).toEqual([]);
    expect(shuffled(['a'], seededRandomInt(1))).toEqual(['a']);
  });

  it('acceptance: produces a uniform random order with the crypto source', () => {
    const runs = 60_000;
    const counts = new Map<string, number>();
    for (let i = 0; i < runs; i++) {
      const key = shuffled(['a', 'b', 'c'], cryptoRandomInt).join('');
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect([...counts.keys()].sort()).toEqual(['abc', 'acb', 'bac', 'bca', 'cab', 'cba']);

    // Chi-square with 5 degrees of freedom. 35 is far past the 1-in-a-million
    // level, so this only fails for a genuinely biased shuffle.
    const expected = runs / 6;
    const chiSquare = [...counts.values()].reduce((sum, n) => sum + (n - expected) ** 2 / expected, 0);
    expect(chiSquare).toBeLessThan(35);
  });
});
