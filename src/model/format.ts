/** Player seats have a hand; the environment doesn't (FS-3). */
export type SeatKind = 'player' | 'environment';

/** A seat counter's name and starting value, set per format (FS-4). */
export interface FormatCounter {
  id: string;
  name: string;
  value: number;
}

export interface FormatSeat {
  /** Unique within the format; the session's seat gets the same id. */
  id: string;
  name: string;
  kind: SeatKind;
  counters: FormatCounter[];
}

export interface FormatPile {
  /** Unique within the format; the session's pile gets the same id. */
  id: string;
  name: string;
  /** Owning seat id, or undefined for a shared pile (SP-4). */
  ownerSeatId?: string;
}

/** The seats at the table, the piles each starts with, and whether the session uses dice. */
export interface Format {
  id: string;
  name: string;
  seats: FormatSeat[];
  /** In table order, left to right along the top. */
  piles: FormatPile[];
  /** Shows Dice & coins (TT-14). */
  usesDice: boolean;
}

function player(n: 1 | 2): FormatSeat {
  return {
    id: `seat-p${n}`,
    name: `Player ${n}`,
    kind: 'player',
    counters: [
      { id: `p${n}-life`, name: 'Life', value: 20 },
      { id: `p${n}-energy`, name: 'Energy', value: 0 },
    ],
  };
}

const ENVIRONMENT: FormatSeat = { id: 'seat-env', name: 'Environment', kind: 'environment', counters: [] };

const P1_MAIN: FormatPile = { id: 'pile-p1-main', name: 'P1 main deck', ownerSeatId: 'seat-p1' };
const P2_MAIN: FormatPile = { id: 'pile-p2-main', name: 'P2 main deck', ownerSeatId: 'seat-p2' };
const ENV_DECK: FormatPile = { id: 'pile-env', name: 'Environment deck', ownerSeatId: 'seat-env' };
const BOARD: FormatPile = { id: 'pile-board', name: 'Board cards' };

/** The three presets (FS-1). */
export const SOLO_PVE: Format = {
  id: 'preset-solo-pve',
  name: 'Solo PvE',
  seats: [player(1), ENVIRONMENT],
  piles: [P1_MAIN, ENV_DECK, BOARD],
  usesDice: true,
};

export const COOP_PVE: Format = {
  id: 'preset-coop-pve',
  name: 'Co-op PvE',
  seats: [player(1), player(2), ENVIRONMENT],
  piles: [P1_MAIN, P2_MAIN, ENV_DECK, BOARD],
  usesDice: true,
};

export const PVP_1V1: Format = {
  id: 'preset-1v1-pvp',
  name: '1v1 PvP',
  seats: [player(1), player(2)],
  piles: [P1_MAIN, P2_MAIN, BOARD],
  usesDice: true,
};

export const PRESETS: readonly Format[] = [SOLO_PVE, COOP_PVE, PVP_1V1];
