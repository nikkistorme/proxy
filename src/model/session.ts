import type { CardDefinition } from './card';
import type { CardSetSummary } from './cardSet';
import type { Format } from './format';
import type { RandomInt } from './random';

/** A seat's place at the table, which sets its colour, shape and card back. */
export type SeatPlace = 'player-1' | 'player-2' | 'environment';

export interface Seat {
  id: string;
  name: string;
  /** First player, second player or environment, from the format's seat order. */
  place: SeatPlace;
  /** Player seats have a hand; the environment doesn't (FS-3). */
  hasHand: boolean;
  /** Seat counters like Life, always shown in the seat bar (TT-13, FS-4). */
  counters: Counter[];
}

/**
 * Which way up a card is (TT-6): its front, its back (double-faced cards only),
 * or face down, showing its owner's card back.
 */
export type CardSide = 'front' | 'back' | 'down';

/** One physical copy of a card. Its look comes from its definition (AR-4). */
export interface CardInstance {
  id: string;
  definitionId: string;
  side: CardSide;
  /** Seat of the pile it was loaded into, for its card back. Undefined for a shared pile. */
  ownerSeatId?: string;
  /** Made with Duplicate (TT-11), so reloading a pile doesn't count it as one of the deck's copies. */
  duplicate?: true;
}

/** Card rotation on the table, in 90° steps clockwise (TT-5). */
export type Rotation = 0 | 90 | 180 | 270;

/** A named number on a table card, like "Damage 3" (TT-8). */
export interface Counter {
  id: string;
  name: string;
  value: number;
}

/** A card on the table. Its top-left corner is at x, y in table px at 100% zoom. */
export interface TableEntry {
  cardId: string;
  x: number;
  y: number;
  rotation: Rotation;
  /** Counters belong to the card's place on the table, so they go when it leaves (TT-8). */
  counters?: Counter[];
}

export interface Pile {
  id: string;
  name: string;
  /** Owning seat, or undefined for a shared pile (SP-4). */
  ownerSeatId?: string;
  /** Card instance ids, top of the pile first. */
  cardIds: string[];
  /** The card set the pile was last loaded from (AR-4). Its source is offered for reload (SP-2). */
  cardSetId?: string;
  /** This pile's deck: every definition loaded into it, including missing ones. */
  definitionIds: string[];
  /** Top-left corner on the table, in table px. Piles are card-sized and never turn. */
  x: number;
  y: number;
}

export interface SessionState {
  /** The format the session was set up from, and its name for the header. */
  formatId: string;
  formatName: string;
  seats: Seat[];
  activeSeatId: string;
  /** The session's own copy of every definition it loaded, so it plays without the card sets (AR-4). */
  definitions: Record<string, CardDefinition>;
  /** Each card set the session loaded, by id. */
  cardSets: Record<string, CardSetSummary>;
  cards: Record<string, CardInstance>;
  piles: Pile[];
  /** Card instance ids in each player seat's hand, keyed by seat id. */
  hands: Record<string, string[]>;
  /** Cards on the table, bottom of the stacking order first (TT-10). */
  table: TableEntry[];
  /** Shows Dice & coins (TT-14), from the format. */
  usesDice: boolean;
}

/** Everything an action needs from outside the state, injectable for tests (AR-3). */
export interface ActionContext {
  randomInt: RandomInt;
  newId: () => string;
  /** How many cards fit across the visible table, so auto-placed cards fill its width (TT-4). */
  placementColumns?: number;
}

/** Every action returns the next state and what the live region should say (AR-1, AR-2). */
export interface ActionResult {
  state: SessionState;
  announcement: string;
}

/** Pile spacing along the top of the table: a card width plus a gap. */
const PILE_STEP = 142;

/**
 * A new session built from a format (FS-1): its seats with their starting
 * counters, an empty hand for each player seat, and its piles along the top of
 * the table, so cards placed later go below them.
 */
export function createSession(format: Format): SessionState {
  let players = 0;
  const seats: Seat[] = format.seats.map((seat) => ({
    id: seat.id,
    name: seat.name,
    place: seat.kind === 'environment' ? 'environment' : players++ === 0 ? 'player-1' : 'player-2',
    hasHand: seat.kind === 'player',
    counters: seat.counters.map((counter) => ({ ...counter })),
  }));
  return {
    formatId: format.id,
    formatName: format.name,
    seats,
    activeSeatId: (seats.find((seat) => seat.hasHand) ?? seats[0])?.id ?? '',
    definitions: {},
    cardSets: {},
    cards: {},
    piles: format.piles.map((pile, index) => ({
      id: pile.id,
      name: pile.name,
      ...(pile.ownerSeatId ? { ownerSeatId: pile.ownerSeatId } : {}),
      cardIds: [],
      definitionIds: [],
      x: 16 + index * PILE_STEP,
      y: 16,
    })),
    hands: Object.fromEntries(seats.filter((seat) => seat.hasHand).map((seat) => [seat.id, []])),
    table: [],
    usesDice: format.usesDice,
  };
}
