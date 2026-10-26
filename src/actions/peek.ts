import type { ActionResult, GameState } from '../model/game';
import { cardName, checkCount, getPile, nameList, withPile } from './helpers';

export interface PeekResult {
  /** The top cards, top first. Fewer than asked for if the pile is short. */
  cardIds: string[];
  announcement: string;
}

/**
 * SP-9: look at the top N cards of a pile. Looking changes nothing, so this is
 * a read, not an action. Move peeked cards with `moveCard`.
 */
export function peekTop(state: GameState, args: { pileId: string; count: number }): PeekResult {
  checkCount(args.count);
  const pile = getPile(state, args.pileId);
  const cardIds = pile.cardIds.slice(0, args.count);
  if (cardIds.length === 0) return { cardIds, announcement: `${pile.name} is empty.` };
  const names = nameList(cardIds.map((id) => cardName(state, id)));
  return { cardIds, announcement: `Top ${cardIds.length} of ${pile.name}, top first: ${names}.` };
}

/** SP-9: put the top cards of a pile back in a new order. `cardIds` must be exactly the top N, top first. */
export function reorderTop(state: GameState, args: { pileId: string; cardIds: readonly string[] }): ActionResult {
  const pile = getPile(state, args.pileId);
  const top = pile.cardIds.slice(0, args.cardIds.length);
  const sameCards = top.length === args.cardIds.length && [...top].sort().join() === [...args.cardIds].sort().join();
  if (args.cardIds.length === 0 || !sameCards) {
    throw new Error(`Reorder must use exactly the top ${args.cardIds.length} cards of ${pile.name}`);
  }

  const next = withPile(state, { ...pile, cardIds: [...args.cardIds, ...pile.cardIds.slice(args.cardIds.length)] });
  const names = nameList(args.cardIds.map((id) => cardName(state, id)));
  return { state: next, announcement: `Put back the top ${args.cardIds.length} of ${pile.name}, top first: ${names}.` };
}
