import type { ActionContext, ActionResult, CardSide, SessionState } from '../model/session';
import { freeSpot } from '../model/tablePlacement';
import { shownName } from './cardActions';
import { cardName, getPile, withPile } from './helpers';

/** Where a card is now. */
export type CardLocation = { zone: 'table' } | { zone: 'hand'; seatId: string } | { zone: 'pile'; pileId: string };

/** Where a card can be moved to (SP-8). */
export type Destination =
  | {
      zone: 'table';
      /** Top-left corner in table px. The first free spot when left out. */
      position?: { x: number; y: number };
    }
  | { zone: 'hand'; seatId: string }
  | {
      zone: 'pile';
      pileId: string;
      position: 'top' | 'bottom';
      /** Keep the card face up on the pile. Face down by default. */
      faceUp?: boolean;
    };

export function locateCard(state: SessionState, cardId: string): CardLocation {
  if (state.table.some((entry) => entry.cardId === cardId)) return { zone: 'table' };
  for (const [seatId, hand] of Object.entries(state.hands)) {
    if (hand.includes(cardId)) return { zone: 'hand', seatId };
  }
  const pile = state.piles.find((p) => p.cardIds.includes(cardId));
  if (pile) return { zone: 'pile', pileId: pile.id };
  throw new Error(`Card ${cardId} is not in play`);
}

function seatName(state: SessionState, seatId: string): string {
  const seat = state.seats.find((s) => s.id === seatId);
  if (!seat) throw new Error(`Unknown seat: ${seatId}`);
  return seat.name;
}

function describeLocation(state: SessionState, location: CardLocation): string {
  if (location.zone === 'table') return 'the table';
  if (location.zone === 'hand') return `${seatName(state, location.seatId)}'s hand`;
  return getPile(state, location.pileId).name;
}

function describeDestination(state: SessionState, to: Destination): string {
  if (to.zone !== 'pile') return describeLocation(state, to);
  return `the ${to.position} of ${getPile(state, to.pileId).name}`;
}

function without(ids: readonly string[], cardId: string): string[] {
  return ids.filter((id) => id !== cardId);
}

/**
 * SP-8: move one card to the table, a hand, or the top or bottom of a pile.
 * Cards left behind keep their order. A card lands front up on the table, at
 * `position` or the first free spot across the visible table, and face down on a pile unless `faceUp`
 * is set; in a hand its side is unchanged. A table card given a `position` just moves there.
 */
export function moveCard(state: SessionState, args: { cardId: string; to: Destination }, context?: Pick<ActionContext, 'placementColumns'>): ActionResult {
  const { cardId, to } = args;
  const from = locateCard(state, cardId);
  const name = cardName(state, cardId);

  // A card on the table moves to a new spot (A11Y-1), keeping its turn, side and layer.
  if (from.zone === 'table' && to.zone === 'table' && to.position) {
    const { x, y } = to.position;
    // A face-down card stays unnamed.
    const shown = shownName(state, cardId);
    const entry = state.table.find((e) => e.cardId === cardId);
    if (!entry || (entry.x === x && entry.y === y)) return { state, announcement: `${shown.charAt(0).toUpperCase()}${shown.slice(1)} is already there.` };
    const table = state.table.map((e) => (e.cardId === cardId ? { ...e, x, y } : e));
    return { state: { ...state, table }, announcement: `Moved ${shown} on the table.` };
  }

  const alreadyThere =
    (from.zone === 'table' && to.zone === 'table') ||
    (from.zone === 'hand' && to.zone === 'hand' && from.seatId === to.seatId);
  if (alreadyThere) {
    const where = from.zone === 'table' ? 'on the table' : `in ${describeLocation(state, from)}`;
    return { state, announcement: `${name} is already ${where}.` };
  }

  if (to.zone === 'hand') {
    const seat = state.seats.find((s) => s.id === to.seatId);
    if (!seat?.hasHand) throw new Error(`${seat?.name ?? to.seatId} has no hand`);
  }
  if (to.zone === 'pile') getPile(state, to.pileId);

  // Take the card out of where it is.
  let next: SessionState = state;
  if (from.zone === 'table') next = { ...next, table: next.table.filter((entry) => entry.cardId !== cardId) };
  if (from.zone === 'hand') next = { ...next, hands: { ...next.hands, [from.seatId]: without(next.hands[from.seatId] ?? [], cardId) } };
  if (from.zone === 'pile') {
    const pile = getPile(next, from.pileId);
    next = withPile(next, { ...pile, cardIds: without(pile.cardIds, cardId) });
  }

  // Put it where it's going, face up or down as it lands.
  const card = state.cards[cardId];
  if (!card) throw new Error(`Unknown card: ${cardId}`);
  let side: CardSide = card.side;
  if (to.zone === 'table') {
    side = 'front';
    const { x, y } = to.position ?? freeSpot(next, context?.placementColumns);
    next = { ...next, table: [...next.table, { cardId, x, y, rotation: 0 }] };
  }
  if (to.zone === 'hand') next = { ...next, hands: { ...next.hands, [to.seatId]: [...(next.hands[to.seatId] ?? []), cardId] } };
  if (to.zone === 'pile') {
    side = to.faceUp ? 'front' : 'down';
    const pile = getPile(next, to.pileId);
    const cardIds = to.position === 'top' ? [cardId, ...pile.cardIds] : [...pile.cardIds, cardId];
    next = withPile(next, { ...pile, cardIds });
  }
  if (side !== card.side) next = { ...next, cards: { ...next.cards, [cardId]: { ...card, side } } };

  return {
    state: next,
    announcement: `Moved ${name} from ${describeLocation(state, from)} to ${describeDestination(state, to)}.`,
  };
}
