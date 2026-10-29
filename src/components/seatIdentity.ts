import type { Seat, SeatPlace } from '../model/session';

/**
 * Seat identity from the design system: colour, shape and card-back pattern,
 * so seats never rely on colour alone. It follows the seat's place, not its id
 * or name: the design's first seat (triangle, stripes) goes to the first
 * player, its second (circle, dots) to the second player, and the
 * environment's (square, fine rules) to the environment. Shared piles are neutral.
 */
export interface SeatIdentity {
  /** CSS colour for text and marks, from the seat tokens. */
  color: string;
  /** 16 × 16 SVG path. */
  shape: string;
  /** Card-back class from SeatIdentity.css. */
  backClass: string;
  /** Spoken shape name, for labels that must not rely on colour. */
  shapeName: string;
}

const SHAPES = {
  triangle: 'M8 2l6.5 11.5h-13z',
  circle: 'M8 2a6 6 0 1 0 .01 0z',
  square: 'M2.5 2.5h11v11h-11z',
  diamond: 'M8 1.5l6.5 6.5-6.5 6.5-6.5-6.5z',
};

const IDENTITIES: Record<SeatPlace, SeatIdentity> = {
  'player-1': { color: 'var(--seat-a)', shape: SHAPES.triangle, backClass: 'card-back--a', shapeName: 'triangle' },
  'player-2': { color: 'var(--seat-b)', shape: SHAPES.circle, backClass: 'card-back--b', shapeName: 'circle' },
  environment: { color: 'var(--seat-env)', shape: SHAPES.square, backClass: 'card-back--env', shapeName: 'square' },
};

const SHARED: SeatIdentity = { color: 'var(--muted)', shape: SHAPES.diamond, backClass: 'card-back--shared', shapeName: 'diamond' };

export function seatIdentity(place: SeatPlace | undefined): SeatIdentity {
  return place ? IDENTITIES[place] : SHARED;
}

/** The place of a seat by id, or undefined for a shared pile or an unknown seat. */
export function seatPlace(seats: readonly Seat[], seatId: string | undefined): SeatPlace | undefined {
  return seatId === undefined ? undefined : seats.find((seat) => seat.id === seatId)?.place;
}
