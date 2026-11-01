import type { ImportedCard } from '../model/card';
import type { CardSetSource } from '../model/cardSet';
import type { SessionState, ActionContext, ActionResult } from '../model/session';
import { plural } from './helpers';
import { loadPile, type LoadPileResult } from './loadPile';

export interface DemoPileLoad {
  pileId: string;
  cardSetId: string;
  source: CardSetSource;
  cards: readonly ImportedCard[];
  keepOrder: boolean;
}

export interface LoadDemoResult extends ActionResult {
  /** Each pile's merge, in the same order as `piles`. */
  results: LoadPileResult[];
}

/**
 * DM-5: fills every demo pile as one action, so Load demo is one undo step and
 * one log entry. Each pile follows loadPile (SP-3, CD-5).
 */
export function loadDemo(state: SessionState, args: { piles: readonly DemoPileLoad[] }, context: ActionContext): LoadDemoResult {
  let next = state;
  const results: LoadPileResult[] = [];
  for (const pile of args.piles) {
    const result = loadPile(next, pile, context);
    next = result.state;
    results.push(result);
  }
  const cards = next.piles.filter((p) => args.piles.some((load) => load.pileId === p.id)).reduce((sum, p) => sum + p.cardIds.length, 0);
  const first = next.seats.find((seat) => seat.id === next.activeSeatId);
  const announcement = `Demo loaded: ${next.formatName} session with ${plural(cards, 'card')} in ${plural(args.piles.length, 'pile')}. ${first?.name ?? 'The first seat'} is the active seat.`;
  return { state: next, announcement, results };
}
