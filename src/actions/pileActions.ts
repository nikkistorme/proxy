import type { ActionContext, ActionResult, SessionState } from '../model/session';
import { shuffled } from '../model/shuffle';
import { activeSeat, cardName, checkCount, getPile, nameList, plural, withPile } from './helpers';

/** SP-6: shuffle a pile. Every card in it ends face down. */
export function shuffle(state: SessionState, args: { pileId: string }, context: ActionContext): ActionResult {
  const pile = getPile(state, args.pileId);
  const cards = { ...state.cards };
  for (const id of pile.cardIds) {
    const card = cards[id];
    if (card && card.side !== 'down') cards[id] = { ...card, side: 'down' };
  }
  const next = withPile({ ...state, cards }, { ...pile, cardIds: shuffled(pile.cardIds, context.randomInt) });
  return { state: next, announcement: `Shuffled ${pile.name}. ${plural(pile.cardIds.length, 'card')}.` };
}

/** SP-6: draw the top cards of a pile into the active seat's hand. */
export function draw(state: SessionState, args: { pileId: string; count?: number }): ActionResult {
  const count = args.count ?? 1;
  checkCount(count);
  const pile = getPile(state, args.pileId);
  const seat = activeSeat(state);
  const hand = state.hands[seat.id];
  if (!hand) throw new Error(`${seat.name} has no hand`);

  if (pile.cardIds.length === 0) {
    return { state, announcement: `${pile.name} is empty. No cards drawn.` };
  }

  const drawn = pile.cardIds.slice(0, count);
  const rest = pile.cardIds.slice(drawn.length);
  const next = withPile({ ...state, hands: { ...state.hands, [seat.id]: [...hand, ...drawn] } }, { ...pile, cardIds: rest });
  const short = drawn.length < count ? ` Only ${plural(drawn.length, 'card was', 'cards were')} left.` : '';
  const names = nameList(drawn.map((id) => cardName(state, id)));
  return {
    state: next,
    announcement: `${seat.name} drew ${names} from ${pile.name}.${short} ${plural(rest.length, 'card')} left.`,
  };
}

/** SP-6: turn a pile's top card face up. */
export function revealTop(state: SessionState, args: { pileId: string }): ActionResult {
  const pile = getPile(state, args.pileId);
  const topId = pile.cardIds[0];
  const top = topId === undefined ? undefined : state.cards[topId];
  if (!topId || !top) return { state, announcement: `${pile.name} is empty. Nothing to reveal.` };

  const next = top.side === 'front' ? state : { ...state, cards: { ...state.cards, [topId]: { ...top, side: 'front' as const } } };
  return { state: next, announcement: `Top of ${pile.name}: ${cardName(state, topId)}.` };
}

/**
 * SP-6: move the top cards of one pile onto another, one at a time, as if dealt
 * by hand. The first card moved ends up deepest.
 */
export function mill(state: SessionState, args: { pileId: string; count: number; toPileId: string }): ActionResult {
  checkCount(args.count);
  if (args.pileId === args.toPileId) throw new Error('Cannot mill a pile onto itself');
  const from = getPile(state, args.pileId);
  const to = getPile(state, args.toPileId);

  if (from.cardIds.length === 0) {
    return { state, announcement: `${from.name} is empty. No cards moved.` };
  }

  const moved = from.cardIds.slice(0, args.count);
  const next = withPile(
    withPile(state, { ...from, cardIds: from.cardIds.slice(moved.length) }),
    { ...to, cardIds: [...[...moved].reverse(), ...to.cardIds] },
  );
  const names = nameList(moved.map((id) => cardName(state, id)));
  return { state: next, announcement: `Moved ${names} from ${from.name} to ${to.name}.` };
}
