/** Returns a whole number from 0 up to, but not including, `maxExclusive` (AR-3). */
export type RandomInt = (maxExclusive: number) => number;

const RANGE = 2 ** 32;

function checkMax(maxExclusive: number): void {
  if (!Number.isInteger(maxExclusive) || maxExclusive < 1 || maxExclusive > RANGE) {
    throw new RangeError(`maxExclusive must be a whole number from 1 to 2^32, got ${maxExclusive}`);
  }
}

/**
 * Uniform random integers from the Web Crypto API. Values in the uneven tail
 * of the 32-bit range are rejected and redrawn, so every result is equally likely.
 */
export const cryptoRandomInt: RandomInt = (maxExclusive) => {
  checkMax(maxExclusive);
  const limit = RANGE - (RANGE % maxExclusive);
  const buffer = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buffer);
    const value = buffer[0] ?? 0;
    if (value < limit) return value % maxExclusive;
  }
};

/** Repeatable random integers for tests (QA-3). Not for real games. */
export function seededRandomInt(seed: number): RandomInt {
  // mulberry32
  let state = seed >>> 0;
  return (maxExclusive) => {
    checkMax(maxExclusive);
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const unit = ((t ^ (t >>> 14)) >>> 0) / RANGE;
    return Math.floor(unit * maxExclusive);
  };
}
