import type { TableEntry } from './game';
import { CARD_H, CARD_W } from './tablePlacement';

export type Direction = 'left' | 'right' | 'up' | 'down';

const centre = (entry: TableEntry) => ({ x: entry.x + CARD_W / 2, y: entry.y + CARD_H / 2 });

/**
 * A11Y-3: the card an arrow key moves focus to. Only cards whose centre lies
 * that way count; the nearest wins, with sideways distance counting double so
 * focus prefers a card in the same row or column. Undefined when none lie that way.
 */
export function nearestInDirection(table: readonly TableEntry[], fromCardId: string, direction: Direction): string | undefined {
  const from = table.find((entry) => entry.cardId === fromCardId);
  if (!from) return undefined;
  const origin = centre(from);
  let best: { cardId: string; score: number } | undefined;
  for (const entry of table) {
    if (entry.cardId === fromCardId) continue;
    const c = centre(entry);
    const dx = c.x - origin.x;
    const dy = c.y - origin.y;
    const ahead = direction === 'right' ? dx : direction === 'left' ? -dx : direction === 'down' ? dy : -dy;
    const aside = direction === 'left' || direction === 'right' ? Math.abs(dy) : Math.abs(dx);
    if (ahead <= 0) continue;
    const score = ahead + 2 * aside;
    if (!best || score < best.score) best = { cardId: entry.cardId, score };
  }
  return best?.cardId;
}

/** Cards in reading order: by row, then left to right. Cards within half a card's height share a row. */
export function readingOrder(table: readonly TableEntry[]): string[] {
  return [...table]
    .sort((a, b) => (Math.abs(a.y - b.y) < CARD_H / 2 ? a.x - b.x : a.y - b.y))
    .map((entry) => entry.cardId);
}
