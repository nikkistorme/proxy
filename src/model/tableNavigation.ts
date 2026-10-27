import type { GameState } from './game';
import { CARD_H, CARD_W } from './tablePlacement';

export type Direction = 'left' | 'right' | 'up' | 'down';

/** Something on the table that takes focus: a card or a pile, by its top-left corner. */
export interface TableItem {
  id: string;
  x: number;
  y: number;
}

/** A11Y-3: everything on the table that arrow keys move between, piles and cards alike. */
export function tableItems(state: Pick<GameState, 'table' | 'piles'>): TableItem[] {
  return [...state.piles.map(({ id, x, y }) => ({ id, x, y })), ...state.table.map(({ cardId, x, y }) => ({ id: cardId, x, y }))];
}

const centre = (item: TableItem) => ({ x: item.x + CARD_W / 2, y: item.y + CARD_H / 2 });

/**
 * A11Y-3: the card or pile an arrow key moves focus to. Only those whose centre
 * lies that way count; the nearest wins, with sideways distance counting double
 * so focus prefers one in the same row or column. Undefined when none lie that way.
 */
export function nearestInDirection(items: readonly TableItem[], fromId: string, direction: Direction): string | undefined {
  const from = items.find((item) => item.id === fromId);
  if (!from) return undefined;
  const origin = centre(from);
  let best: { id: string; score: number } | undefined;
  for (const item of items) {
    if (item.id === fromId) continue;
    const c = centre(item);
    const dx = c.x - origin.x;
    const dy = c.y - origin.y;
    const ahead = direction === 'right' ? dx : direction === 'left' ? -dx : direction === 'down' ? dy : -dy;
    const aside = direction === 'left' || direction === 'right' ? Math.abs(dy) : Math.abs(dx);
    if (ahead <= 0) continue;
    const score = ahead + 2 * aside;
    if (!best || score < best.score) best = { id: item.id, score };
  }
  return best?.id;
}

/** Cards and piles in reading order: by row, then left to right. Those within half a card's height share a row. */
export function readingOrder(items: readonly TableItem[]): string[] {
  return [...items].sort((a, b) => (Math.abs(a.y - b.y) < CARD_H / 2 ? a.x - b.x : a.y - b.y)).map((item) => item.id);
}
