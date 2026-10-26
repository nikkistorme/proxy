import { describe, expect, it } from 'vitest';
import type { TableEntry } from './game';
import { CARD_H, CARD_W, cardBox, freeSpot, PLACEMENT_COLUMNS, TABLE_GAP } from './tablePlacement';

const at = (cardId: string, x: number, y: number, rotation: TableEntry['rotation'] = 0): TableEntry => ({ cardId, x, y, rotation });
const column = (n: number) => TABLE_GAP + n * (CARD_W + TABLE_GAP);
const row = (n: number) => TABLE_GAP + n * (CARD_H + TABLE_GAP);

describe('TT-4 placing a card on the table', () => {
  it('starts at the top-left corner and fills the row left to right', () => {
    expect(freeSpot([])).toEqual({ x: column(0), y: row(0) });
    expect(freeSpot([at('a', column(0), row(0))])).toEqual({ x: column(1), y: row(0) });
  });

  it('takes the first gap, so a card never lands on another', () => {
    expect(freeSpot([at('a', column(0), row(0)), at('c', column(2), row(0))])).toEqual({ x: column(1), y: row(0) });
    // A card dropped between two cells blocks both.
    expect(freeSpot([at('a', column(0) + CARD_W / 2, row(0))])).toEqual({ x: column(2), y: row(0) });
  });

  it(`starts a new row after ${PLACEMENT_COLUMNS} cards`, () => {
    const full = Array.from({ length: PLACEMENT_COLUMNS }, (_, i) => at(`c${i}`, column(i), row(0)));
    expect(freeSpot(full)).toEqual({ x: column(0), y: row(1) });
  });

  it('counts a quarter-turned card by its turned size', () => {
    expect(cardBox(at('a', 0, 0, 90))).toEqual({ left: -25, top: 25, right: 151, bottom: 151 });
    // Turned sideways in the first cell, it reaches into the second.
    expect(freeSpot([at('a', column(0), row(0), 90)])).toEqual({ x: column(2), y: row(0) });
  });
});
