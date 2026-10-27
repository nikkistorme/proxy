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
  /** A11Y-1: choose the spot on the table yourself, by keyboard or a tap, instead of moving at once. */
  chooseSpot?: true;
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
 * The card's current hand, and the table's next free spot for a table card, are
 * left out, since moving there does nothing. Choosing a spot is always offered. Its own pile stays in, since its top and bottom are real moves.
 * `exceptTopOf` leaves out one pile's top, where reordering does the same job (SP-9).
 */
export function moveDestinations(state: GameState, cardId: string, { exceptTopOf }: { exceptTopOf?: string } = {}): MoveOption[] {
  const from = locateCard(state, cardId);
  const options: MoveOption[] = [];

  const onTable = cardsWord(state.table.length);
  if (from.zone !== 'table') {
    options.push({ key: 'table', group: 'Table', label: 'Table — next free spot', meta: onTable, destination: { zone: 'table' } });
  }
  options.push({ key: 'table-spot', group: 'Table', label: 'Table — choose a spot', meta: onTable, destination: { zone: 'table' }, chooseSpot: true });
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
      if (position === 'top' && pile.id === exceptTopOf) continue;
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
