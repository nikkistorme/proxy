import type { Rotation, TableEntry } from './game';

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

function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/**
 * Where a card goes when it's put on the table without a position: the first
 * grid cell, left to right in rows `columns` cards wide and then top to
 * bottom, that no card covers.
 */
export function freeSpot(table: readonly TableEntry[], columns = PLACEMENT_COLUMNS): { x: number; y: number } {
  const boxes = table.map(cardBox);
  for (let row = 0; ; row++) {
    for (let column = 0; column < columns; column++) {
      const spot = { x: TABLE_GAP + column * (CARD_W + TABLE_GAP), y: TABLE_GAP + row * (CARD_H + TABLE_GAP) };
      const box = cardBox({ ...spot, rotation: 0 as Rotation });
      if (!boxes.some((b) => overlaps(b, box))) return spot;
    }
  }
}
