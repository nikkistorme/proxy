import type { CardDefinition } from './card';
import type { RandomInt } from './random';

export interface Seat {
  id: string;
  name: string;
  /** Player seats have a hand; the environment doesn't (FS-3). */
  hasHand: boolean;
}

/** One physical copy of a card. Its look comes from its definition (AR-4). */
export interface CardInstance {
  id: string;
  definitionId: string;
  /** Face up on the table or on top of a pile. */
  faceUp: boolean;
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
}

export interface GameState {
  seats: Seat[];
  activeSeatId: string;
  definitions: Record<string, CardDefinition>;
  cards: Record<string, CardInstance>;
  piles: Pile[];
  /** Card instance ids in each player seat's hand, keyed by seat id. */
  hands: Record<string, string[]>;
  /** Card instance ids on the table. Positions arrive in Phase 3. */
  table: string[];
}

/** Everything an action needs from outside the state, injectable for tests (AR-3). */
export interface ActionContext {
  randomInt: RandomInt;
  newId: () => string;
}

/** Every action returns the next state and what the live region should say (AR-1, AR-2). */
export interface ActionResult {
  state: GameState;
  announcement: string;
}

/**
 * The Solo PvE preset (FS-1), fixed in code until formats arrive in Phase 5.
 */
export function createSoloGame(): GameState {
  return {
    seats: [
      { id: 'seat-p1', name: 'Player 1', hasHand: true },
      { id: 'seat-env', name: 'Environment', hasHand: false },
    ],
    activeSeatId: 'seat-p1',
    definitions: {},
    cards: {},
    piles: [
      { id: 'pile-p1-main', name: 'P1 main deck', ownerSeatId: 'seat-p1', cardIds: [], definitionIds: [] },
      { id: 'pile-env', name: 'Environment deck', ownerSeatId: 'seat-env', cardIds: [], definitionIds: [] },
      { id: 'pile-board', name: 'Board cards', cardIds: [], definitionIds: [] },
    ],
    hands: { 'seat-p1': [] },
    table: [],
  };
}
