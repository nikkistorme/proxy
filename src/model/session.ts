import type { CardDefinition } from './card';
import type { RandomInt } from './random';

export interface Seat {
  id: string;
  name: string;
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
  /** File or sheet the pile was last loaded from (SP-2). */
  sourceName?: string;
  /** This pile's deck: every definition loaded into it, including missing ones. */
  definitionIds: string[];
  /** Top-left corner on the table, in table px. Piles are card-sized and never turn. */
  x: number;
  y: number;
}

export interface SessionState {
  seats: Seat[];
  activeSeatId: string;
  definitions: Record<string, CardDefinition>;
  cards: Record<string, CardInstance>;
  piles: Pile[];
  /** Card instance ids in each player seat's hand, keyed by seat id. */
  hands: Record<string, string[]>;
  /** Cards on the table, bottom of the stacking order first (TT-10). */
  table: TableEntry[];
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

/**
 * The Solo PvE preset (FS-1), fixed in code until formats arrive in Phase 5.
 */
export function createSoloSession(): SessionState {
  return {
    seats: [
      {
        id: 'seat-p1',
        name: 'Player 1',
        hasHand: true,
        counters: [
          { id: 'p1-life', name: 'Life', value: 20 },
          { id: 'p1-energy', name: 'Energy', value: 0 },
        ],
      },
      { id: 'seat-env', name: 'Environment', hasHand: false, counters: [] },
    ],
    activeSeatId: 'seat-p1',
    definitions: {},
    cards: {},
    piles: [
      // Along the top of the table, so cards placed later go below them.
      { id: 'pile-p1-main', name: 'P1 main deck', ownerSeatId: 'seat-p1', cardIds: [], definitionIds: [], x: 16, y: 16 },
      { id: 'pile-env', name: 'Environment deck', ownerSeatId: 'seat-env', cardIds: [], definitionIds: [], x: 158, y: 16 },
      { id: 'pile-board', name: 'Board cards', cardIds: [], definitionIds: [], x: 300, y: 16 },
    ],
    hands: { 'seat-p1': [] },
    table: [],
  };
}
