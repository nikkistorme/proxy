import type { ActionResult, SessionState } from '../model/session';
import { cardName } from './helpers';

/**
 * TT-12: move a card to a new place in its seat's hand. `toIndex` is where it
 * ends up, counted from the left, and is kept within the hand.
 */
export function reorderHand(state: SessionState, args: { seatId: string; cardId: string; toIndex: number }): ActionResult {
  const { seatId, cardId } = args;
  const hand = state.hands[seatId] ?? [];
  const from = hand.indexOf(cardId);
  if (from < 0) throw new Error(`Card ${cardId} is not in ${seatId}'s hand`);
  if (!Number.isInteger(args.toIndex)) throw new RangeError(`toIndex must be a whole number, got ${args.toIndex}`);
  const to = Math.max(0, Math.min(hand.length - 1, args.toIndex));
  const seat = state.seats.find((s) => s.id === seatId);
  const where = `${to + 1} of ${hand.length} in ${seat?.name ?? seatId}'s hand`;
  const name = cardName(state, cardId);
  if (to === from) return { state, announcement: `${name} is already at position ${where}.` };

  const next = hand.filter((id) => id !== cardId);
  next.splice(to, 0, cardId);
  return {
    state: { ...state, hands: { ...state.hands, [seatId]: next } },
    announcement: `Moved ${name} to position ${where}.`,
  };
}
