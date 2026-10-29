import type { CardFace } from '../model/card';
import type { SeatPlace, SessionState, TableEntry } from '../model/session';
import { seatPlace } from './seatIdentity';

/** What a table card shows and how it's named (A11Y-6). */
export interface TableCardView {
  entry: TableEntry;
  /** The face shown, or undefined when the card is face down. */
  face?: CardFace;
  ownerSeatId?: string;
  /** The owning seat's place, for its card back. Undefined for a shared pile. */
  ownerPlace?: SeatPlace;
  /** Its definition is no longer in the pile's CSV. */
  missing: boolean;
  /** It has two faces and is face up, so it shows the double-faced badge (TT-6). */
  doubleFaced: boolean;
  label: string;
}

export function tableCardView(state: SessionState, entry: TableEntry): TableCardView {
  const card = state.cards[entry.cardId];
  const definition = card && state.definitions[card.definitionId];
  if (!card || !definition) throw new Error(`Unknown card: ${entry.cardId}`);
  const ownerSeatId = card.ownerSeatId;
  const ownerPlace = seatPlace(state.seats, ownerSeatId);
  const rotated = entry.rotation === 0 ? '' : `, rotated ${entry.rotation}°`;
  // Counters sit on top of the card, so they show face down too (TT-8).
  const counters = entry.counters?.length ? `, counters: ${entry.counters.map((c) => `${c.name} ${c.value}`).join(', ')}` : '';

  if (card.side === 'down') {
    // Face down hides the card, but not whose it is: its back shows the owner's seat.
    const owner = state.seats.find((s) => s.id === ownerSeatId)?.name ?? 'shared';
    return { entry, ownerSeatId, ownerPlace, missing: false, doubleFaced: false, label: `Face-down card, ${owner}${rotated}${counters}` };
  }

  // A back lost on re-import falls back to the front.
  const showsBack = card.side === 'back' && definition.back !== undefined;
  const face = showsBack && definition.back ? definition.back : definition.front;
  const side = definition.back ? (showsBack ? ', back face' : ', front face') : '';
  const missing = definition.missing === true;
  const gone = missing ? ', not in the CSV any more' : '';
  return { entry, face, ownerSeatId, ownerPlace, missing, doubleFaced: definition.back !== undefined, label: `${face.name}${side}${rotated}${gone}${counters}` };
}
