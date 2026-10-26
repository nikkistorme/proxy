/**
 * Seat identity from the design system: colour, shape and card-back pattern,
 * so seats never rely on colour alone. The design's first seat (triangle,
 * stripes) goes to Player 1, its second (circle, dots) to Player 2, and the
 * environment's (square, fine rules) to Environment. Shared piles are neutral.
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

const IDENTITIES: Record<string, SeatIdentity> = {
  'seat-p1': { color: 'var(--seat-a)', shape: SHAPES.triangle, backClass: 'card-back--a', shapeName: 'triangle' },
  'seat-p2': { color: 'var(--seat-b)', shape: SHAPES.circle, backClass: 'card-back--b', shapeName: 'circle' },
  'seat-env': { color: 'var(--seat-env)', shape: SHAPES.square, backClass: 'card-back--env', shapeName: 'square' },
};

const SHARED: SeatIdentity = { color: 'var(--muted)', shape: SHAPES.diamond, backClass: 'card-back--shared', shapeName: 'diamond' };

export function seatIdentity(seatId: string | undefined): SeatIdentity {
  return (seatId && IDENTITIES[seatId]) || SHARED;
}
