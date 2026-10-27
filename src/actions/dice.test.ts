import { describe, expect, it } from 'vitest';
import { seededRandomInt } from '../model/random';
import { DICE, roll } from './dice';

describe('TT-14 dice and coin', () => {
  it('rolls every die from 1 to its sides, reaching both ends', () => {
    const randomInt = seededRandomInt(7);
    for (const die of DICE.filter((d) => d !== 'Coin')) {
      const sides = Number(die.slice(1));
      const seen = new Set(Array.from({ length: sides * 40 }, () => Number(roll(die, randomInt).result)));
      expect([...seen].sort((a, b) => a - b)).toEqual(Array.from({ length: sides }, (_, i) => i + 1));
    }
  });

  it('announces a roll and a coin flip', () => {
    expect(roll('d20', () => 13)).toEqual({ die: 'd20', result: '14', announcement: 'Rolled d20: 14.' });
    expect(roll('Coin', () => 0)).toEqual({ die: 'Coin', result: 'Heads', announcement: 'Flipped a coin: heads.' });
    expect(roll('Coin', () => 1).result).toBe('Tails');
  });

  it('asks the random source for the right range', () => {
    const asked: number[] = [];
    for (const die of DICE)
      roll(die, (max) => {
        asked.push(max);
        return 0;
      });
    expect(asked).toEqual([4, 6, 8, 10, 12, 20, 2]);
  });
});
