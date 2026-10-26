import { afterEach, describe, expect, it, vi } from 'vitest';
import { cryptoRandomInt, seededRandomInt } from './random';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AR-3 random source', () => {
  it('crypto source rejects values from the uneven tail and draws again', () => {
    // 2^32 % 3 === 1, so the single top value 2^32 - 1 must be rejected for max 3.
    const values = [2 ** 32 - 1, 5];
    const spy = vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
      (array as Uint32Array)[0] = values.shift() ?? 0;
      return array;
    });
    expect(cryptoRandomInt(3)).toBe(2);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('crypto source stays in range', () => {
    for (let i = 0; i < 1000; i++) {
      const value = cryptoRandomInt(7);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(7);
    }
    expect(cryptoRandomInt(1)).toBe(0);
  });

  it('rejects a max that is not a whole number from 1 to 2^32', () => {
    for (const bad of [0, -1, 1.5, 2 ** 32 + 1, Number.NaN]) {
      expect(() => cryptoRandomInt(bad)).toThrow(RangeError);
      expect(() => seededRandomInt(1)(bad)).toThrow(RangeError);
    }
  });

  it('seeded source repeats for the same seed and stays in range', () => {
    const a = seededRandomInt(42);
    const b = seededRandomInt(42);
    const first = Array.from({ length: 50 }, () => a(10));
    expect(Array.from({ length: 50 }, () => b(10))).toEqual(first);
    expect(first.every((n) => n >= 0 && n < 10)).toBe(true);
    expect(new Set(first).size).toBeGreaterThan(5);
  });
});
