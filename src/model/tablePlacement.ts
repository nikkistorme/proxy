import type { GameState, Pile, Rotation, TableEntry } from './game';

/** Card size on the table at 100% zoom, from the design (`--card-w`, `--card-h`). */
export const CARD_W = 126;
export const CARD_H = 176;
/** Space around the table's edge and between auto-placed cards. */
export const TABLE_GAP = 16;
/** Auto-placed cards fill rows this many cards wide when the table's width isn't known. */
export const PLACEMENT_COLUMNS = 6;

/** How many auto-placed cards fit across a table this wide (in table px), at least one. */
export function columnsFor(tableWidth: number): number {
  return Math.max(1, Math.floor((tableWidth - TABLE_GAP) / (CARD_W + TABLE_GAP)));
}

export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** The area a table card covers. A quarter turn swaps its width and height around its centre. */
export function cardBox(entry: Pick<TableEntry, 'x' | 'y' | 'rotation'>): Box {
  const sideways = entry.rotation === 90 || entry.rotation === 270;
  const cx = entry.x + CARD_W / 2;
  const cy = entry.y + CARD_H / 2;
  const w = sideways ? CARD_H : CARD_W;
  const h = sideways ? CARD_W : CARD_H;
  return { left: cx - w / 2, top: cy - h / 2, right: cx + w / 2, bottom: cy + h / 2 };
}

export function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/** The area a pile covers on the table. Piles are card-sized and never turn. */
export function pileBox(pile: Pick<Pile, 'x' | 'y'>): Box {
  return cardBox({ x: pile.x, y: pile.y, rotation: 0 });
}

/**
 * TT-4: the pile a pile at `box` would cover the most of, leaving out `exceptId`.
 * Piles never overlap, so landing there merges the two (#56).
 */
export function pileUnder<P extends Pick<Pile, 'id' | 'x' | 'y'>>(piles: readonly P[], box: Box, exceptId?: string): P | undefined {
  let best: P | undefined;
  let bestArea = 0;
  for (const pile of piles) {
    if (pile.id === exceptId) continue;
    const other = pileBox(pile);
    const area = Math.max(0, Math.min(box.right, other.right) - Math.max(box.left, other.left)) * Math.max(0, Math.min(box.bottom, other.bottom) - Math.max(box.top, other.top));
    if (area > bestArea) {
      best = pile;
      bestArea = area;
    }
  }
  return best;
}

/**
 * Where a card or pile goes when it's put on the table without a position: the
 * first grid cell, left to right in rows `columns` cards wide and then top to
 * bottom, that no card or pile covers.
 */
export function freeSpot(state: Pick<GameState, 'table' | 'piles'>, columns = PLACEMENT_COLUMNS): { x: number; y: number } {
  const boxes = [...state.table.map(cardBox), ...state.piles.map(pileBox)];
  for (let row = 0; ; row++) {
    for (let column = 0; column < columns; column++) {
      const spot = { x: TABLE_GAP + column * (CARD_W + TABLE_GAP), y: TABLE_GAP + row * (CARD_H + TABLE_GAP) };
      const box = cardBox({ ...spot, rotation: 0 as Rotation });
      if (!boxes.some((b) => overlaps(b, box))) return spot;
    }
  }
}

/** The spot nearest `position` that keeps the whole card, turned or not, inside the table's top and left edges. */
export function clampToTable(position: { x: number; y: number }, rotation: Rotation): { x: number; y: number } {
  const box = cardBox({ ...position, rotation });
  return { x: position.x - Math.min(0, box.left), y: position.y - Math.min(0, box.top) };
}

/**
 * A11Y-1: where a card being placed sits, for the announcement, in the rows and
 * columns cards are auto-placed in: "Row 1, column 2", or "between columns 2 and 3".
 */
export function describeSpot(position: { x: number; y: number }): string {
  const part = (value: number, step: number, word: string) => {
    const index = (value - TABLE_GAP) / step + 1;
    const nearest = Math.round(index);
    if (Math.abs(index - nearest) < 0.01) return `${word} ${Math.max(1, nearest)}`;
    const half = Math.floor(index);
    if (Math.abs(index - half - 0.5) < 0.01 && half >= 1) return `between ${word}s ${half} and ${half + 1}`;
    return `near ${word} ${Math.max(1, nearest)}`;
  };
  const text = `${part(position.y, CARD_H + TABLE_GAP, 'row')}, ${part(position.x, CARD_W + TABLE_GAP, 'column')}`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
