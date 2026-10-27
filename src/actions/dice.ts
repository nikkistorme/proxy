import type { RandomInt } from '../model/random';

/** The dice TT-14 asks for, plus a coin. */
export const DICE = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'Coin'] as const;
export type Die = (typeof DICE)[number];

export interface Roll {
  die: Die;
  /** The number rolled, or Heads or Tails. */
  result: string;
  announcement: string;
}

/**
 * TT-14: roll a die or flip a coin with the injectable random source (AR-3).
 * A roll doesn't change the session, so it's logged rather than undone.
 */
export function roll(die: Die, randomInt: RandomInt): Roll {
  if (die === 'Coin') {
    const result = randomInt(2) === 0 ? 'Heads' : 'Tails';
    return { die, result, announcement: `Flipped a coin: ${result.toLowerCase()}.` };
  }
  const result = String(randomInt(Number(die.slice(1))) + 1);
  return { die, result, announcement: `Rolled ${die}: ${result}.` };
}
