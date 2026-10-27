import { describe, expect, it } from 'vitest';
import type { TableEntry } from './game';
import { CARD_H, CARD_W, cardBox, clampToTable, columnsFor, describeSpot, freeSpot, PLACEMENT_COLUMNS, TABLE_GAP } from './tablePlacement';

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

  it('fills rows as wide as the visible table', () => {
    // Regression: rows always wrapped after 6 cards, leaving a wide table half empty.
    expect(columnsFor(1248)).toBe(8);
    expect(columnsFor(343)).toBe(2);
    expect(columnsFor(50)).toBe(1);
    const row = Array.from({ length: 7 }, (_, i) => at(`c${i}`, column(i), TABLE_GAP));
    expect(freeSpot(row, 8)).toEqual({ x: column(7), y: TABLE_GAP });
    expect(freeSpot(row.slice(0, 2), 2)).toEqual({ x: column(0), y: TABLE_GAP + CARD_H + TABLE_GAP });
  });

  it('counts a quarter-turned card by its turned size', () => {
    expect(cardBox(at('a', 0, 0, 90))).toEqual({ left: -25, top: 25, right: 151, bottom: 151 });
    // Turned sideways in the first cell, it reaches into the second.
    expect(freeSpot([at('a', column(0), row(0), 90)])).toEqual({ x: column(2), y: row(0) });
  });
});

describe('A11Y-1 placing a card by keyboard', () => {
  it('keeps the card inside the top and left edges, turned or not', () => {
    expect(clampToTable({ x: -40, y: -10 }, 0)).toEqual({ x: 0, y: 0 });
    expect(clampToTable({ x: 50, y: 60 }, 0)).toEqual({ x: 50, y: 60 });
    // A quarter turn reaches 25px further left and 25px less far up.
    const turned = clampToTable({ x: 0, y: -40 }, 90);
    const box = cardBox({ ...turned, rotation: 90 });
    expect([box.left, box.top]).toEqual([0, 0]);
  });

  it('describes the spot in auto-placement rows and columns', () => {
    expect(describeSpot({ x: column(0), y: row(0) })).toBe('Row 1, column 1');
    expect(describeSpot({ x: column(2), y: row(1) })).toBe('Row 2, column 3');
    expect(describeSpot({ x: (column(1) + column(2)) / 2, y: row(0) })).toBe('Row 1, between columns 2 and 3');
    expect(describeSpot({ x: column(1) + 16, y: 0 })).toBe('Near row 1, near column 2');
  });
});
