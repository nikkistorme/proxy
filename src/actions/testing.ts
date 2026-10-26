import { importCards } from '../csv/importCards';
import type { ImportedCard } from '../model/card';
import { createSoloGame, type ActionContext, type GameState } from '../model/game';
import { seededRandomInt } from '../model/random';
import { loadPile } from './loadPile';

/** Deterministic context for action tests: seeded randomness, ids id-1, id-2, … */
export function testContext(seed = 42): ActionContext {
  let next = 0;
  return { randomInt: seededRandomInt(seed), newId: () => `id-${++next}` };
}

export function cardsFrom(csv: string): ImportedCard[] {
  return importCards(csv).cards;
}

/** Card names for a list of card ids, for readable assertions. */
export function namesOf(state: GameState, ids: readonly string[] | undefined): string[] {
  return (ids ?? []).map((id) => state.definitions[state.cards[id]?.definitionId ?? '']?.front.name ?? '?');
}

/** A Solo game with the given cards in P1 main deck, top to bottom in CSV order. */
export function gameWithDeck(csv = 'name\nImp\nOgre\nTroll\n'): GameState {
  return loadPile(createSoloGame(), { pileId: 'pile-p1-main', sourceName: 'deck.csv', cards: cardsFrom(csv), keepOrder: true }, testContext()).state;
}
