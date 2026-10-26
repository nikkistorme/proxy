import { importCards } from '../csv/importCards';
import type { ImportedCard } from '../model/card';
import type { ActionContext } from '../model/game';
import { seededRandomInt } from '../model/random';

/** Deterministic context for action tests: seeded randomness, ids id-1, id-2, … */
export function testContext(seed = 42): ActionContext {
  let next = 0;
  return { randomInt: seededRandomInt(seed), newId: () => `id-${++next}` };
}

export function cardsFrom(csv: string): ImportedCard[] {
  return importCards(csv).cards;
}
