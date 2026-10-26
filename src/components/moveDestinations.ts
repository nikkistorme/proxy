import { locateCard, type Destination } from '../actions/moveCard';
import type { GameState } from '../model/game';

export type DestinationGroup = 'Table' | 'Hands' | 'Piles';

/** One row in the Move to… list. */
export interface MoveOption {
  /** Stable within one list, for option element ids. */
  key: string;
  group: DestinationGroup;
  label: string;
  /** Right-hand detail, like "4 cards". */
  meta: string;
  /** Seat that owns the hand or pile, for its shape and colour; undefined for shared piles and the table. */
  seatId?: string;
  destination: Destination;
}

/** An option that matches the search, with where the match is in its label. */
export interface MatchedOption {
  option: MoveOption;
  /** Start and end of the matched text in the label; [0, 0] for an empty search. */
  hit: [number, number];
}

function cardsWord(count: number): string {
  return `${count} ${count === 1 ? 'card' : 'cards'}`;
}

/**
 * SP-8: every place a card can move to, grouped Table, Hands, then Piles.
 * The card's current table or hand is left out, since moving there does
 * nothing. Its own pile stays in, since its top and bottom are real moves.
 */
export function moveDestinations(state: GameState, cardId: string): MoveOption[] {
  const from = locateCard(state, cardId);
  const options: MoveOption[] = [];

  if (from.zone !== 'table') {
    options.push({ key: 'table', group: 'Table', label: 'Table', meta: cardsWord(state.table.length), destination: { zone: 'table' } });
  }
  for (const seat of state.seats) {
    if (!seat.hasHand || (from.zone === 'hand' && from.seatId === seat.id)) continue;
    options.push({
      key: `hand-${seat.id}`,
      group: 'Hands',
      label: `${seat.name}'s hand`,
      meta: cardsWord(state.hands[seat.id]?.length ?? 0),
      seatId: seat.id,
      destination: { zone: 'hand', seatId: seat.id },
    });
  }
  for (const pile of state.piles) {
    for (const position of ['top', 'bottom'] as const) {
      options.push({
        key: `pile-${pile.id}-${position}`,
        group: 'Piles',
        label: `${pile.name} — ${position}`,
        meta: cardsWord(pile.cardIds.length),
        ...(pile.ownerSeatId !== undefined && { seatId: pile.ownerSeatId }),
        destination: { zone: 'pile', pileId: pile.id, position },
      });
    }
  }
  return options;
}

/** The options whose label contains the search, ignoring case and surrounding spaces. Keeps their order. */
export function matchDestinations(options: readonly MoveOption[], search: string): MatchedOption[] {
  const query = search.trim().toLowerCase();
  return options.flatMap((option) => {
    if (!query) return [{ option, hit: [0, 0] as [number, number] }];
    const start = option.label.toLowerCase().indexOf(query);
    return start === -1 ? [] : [{ option, hit: [start, start + query.length] as [number, number] }];
  });
}
