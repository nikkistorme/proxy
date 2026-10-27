import { importCards } from '../csv/importCards';
import type { ImportedCard } from '../model/card';
import { createSoloSession, type ActionContext, type SessionState } from '../model/session';
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
export function namesOf(state: SessionState, ids: readonly string[] | undefined): string[] {
  return (ids ?? []).map((id) => state.definitions[state.cards[id]?.definitionId ?? '']?.front.name ?? '?');
}

/** Card ids on the table, bottom of the stacking order first. */
export function tableIds(state: SessionState): string[] {
  return state.table.map((entry) => entry.cardId);
}

/** A Solo session with the given cards in P1 main deck, top to bottom in CSV order. */
export function sessionWithDeck(csv = 'name\nImp\nOgre\nTroll\n'): SessionState {
  return loadPile(createSoloSession(), { pileId: 'pile-p1-main', cardSetId: 'set-1', sourceName: 'deck.csv', cards: cardsFrom(csv), keepOrder: true }, testContext()).state;
}

/**
 * The session with its piles moved well below the top rows of the table, so tests
 * that only draw the table see cards auto-placed from the top-left corner.
 */
export function pilesOutOfTheWay(state: SessionState): SessionState {
  return { ...state, piles: state.piles.map((pile, i) => ({ ...pile, x: 16 + i * 142, y: 2000 })) };
}
