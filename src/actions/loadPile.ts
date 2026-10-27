import type { ImportedCard } from '../model/card';
import { fileCardSet } from '../model/cardSet';
import type { ActionContext, ActionResult, CardInstance, SessionState } from '../model/session';
import { mergeImport, type MergeResult } from '../model/mergeImport';
import { shuffled } from '../model/shuffle';
import { getPile, plural, withPile } from './helpers';

export interface LoadPileArgs {
  pileId: string;
  /** The card set to record on the pile: its current one on a reload, else a new UUID (AR-4). */
  cardSetId: string;
  /** File name, offered for reload (SP-2). */
  sourceName: string;
  cards: readonly ImportedCard[];
  /** SP-3: keep CSV order instead of shuffling. */
  keepOrder?: boolean;
}

/** A card with more copies in play than its new `qty`, because the extras aren't in this pile. */
export interface Shortfall {
  definitionId: string;
  name: string;
  /** Copies over the new qty that stay in play. */
  extra: number;
}

export interface LoadPileResult extends ActionResult {
  merge: MergeResult;
  shortfalls: Shortfall[];
}

/**
 * Loads a deck into a pile (SP-3), or reloads it (CD-5).
 *
 * Definitions are merged so cards in play update in place. Copies on the
 * table, in hands or in other piles are never touched: this pile adds or
 * removes its own copies so the total across the session matches each card's
 * new qty. New copies are shuffled in, or go to the bottom with `keepOrder`.
 * Cards already in the pile keep their order.
 */
export function loadPile(state: SessionState, args: LoadPileArgs, context: ActionContext): LoadPileResult {
  const pile = getPile(state, args.pileId);
  const existing = pile.definitionIds.flatMap((id) => state.definitions[id] ?? []);
  const merge = mergeImport(existing, args.cards, context.newId);

  const definitions = { ...state.definitions };
  for (const definition of merge.definitions) definitions[definition.id] = definition;

  const copiesByDefinition = new Map<string, number>();
  for (const card of Object.values(state.cards)) {
    if (card.duplicate) continue;
    copiesByDefinition.set(card.definitionId, (copiesByDefinition.get(card.definitionId) ?? 0) + 1);
  }

  const newCards: Record<string, CardInstance> = {};
  const removedIds = new Set<string>();
  let cardIds = [...pile.cardIds];
  const added: string[] = [];
  const shortfalls: Shortfall[] = [];

  for (const definition of merge.definitions) {
    const wanted = definition.missing ? 0 : definition.qty;
    const have = copiesByDefinition.get(definition.id) ?? 0;

    for (let i = have; i < wanted; i++) {
      const id = context.newId();
      newCards[id] = { id, definitionId: definition.id, side: 'down', ...(pile.ownerSeatId && { ownerSeatId: pile.ownerSeatId }) };
      added.push(id);
    }

    if (have > wanted) {
      // Take extras from the bottom of this pile, the least disturbing end.
      let toRemove = have - wanted;
      for (let i = cardIds.length - 1; i >= 0 && toRemove > 0; i--) {
        const id = cardIds[i] as string;
        if (state.cards[id]?.definitionId !== definition.id || state.cards[id]?.duplicate) continue;
        cardIds.splice(i, 1);
        removedIds.add(id);
        toRemove--;
      }
      if (toRemove > 0) shortfalls.push({ definitionId: definition.id, name: definition.front.name, extra: toRemove });
    }
  }

  if (args.keepOrder) {
    cardIds = [...cardIds, ...added];
  } else if (cardIds.length === 0) {
    cardIds = shuffled(added, context.randomInt);
  } else {
    // Each new copy goes to a uniformly random position among the cards already there.
    for (const id of added) cardIds.splice(context.randomInt(cardIds.length + 1), 0, id);
  }

  const cards = Object.fromEntries(
    Object.entries({ ...state.cards, ...newCards }).filter(([id]) => !removedIds.has(id)),
  );
  const next = withPile(
    { ...state, definitions, cardSets: { ...state.cardSets, [args.cardSetId]: fileCardSet(args.cardSetId, args.sourceName) }, cards },
    { ...pile, cardIds, cardSetId: args.cardSetId, definitionIds: merge.definitions.map((d) => d.id) },
  );

  const isReload = pile.definitionIds.length > 0;
  const order = args.keepOrder ? 'in CSV order' : 'shuffled';
  const announcement = isReload
    ? `Reloaded ${args.sourceName} into ${pile.name}: ${plural(added.length, 'copy', 'copies')} added, ${removedIds.size} removed. ${plural(cardIds.length, 'card')} in the pile.`
    : `Loaded ${args.sourceName} into ${pile.name}: ${plural(cardIds.length, 'card')}, ${order}.`;

  return { state: next, announcement, merge, shortfalls };
}
