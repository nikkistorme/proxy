import { useCallback, useRef, useState, type KeyboardEvent } from 'react';
import { cardBox, CARD_H, TABLE_GAP } from '../model/tablePlacement';
import { nearestInDirection, readingOrder, type Direction } from '../model/tableNavigation';
import { useGameStore } from '../store/gameStore';
import { TableCard } from './TableCard';
import { tableCardView } from './tableCardView';
import './TableSurface.css';

const ARROWS: Record<string, Direction> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };

/**
 * The free-form table (A11Y-3): cards at their positions, one Tab stop, and
 * arrow keys that move focus to the nearest card in that direction. The mat
 * grows to fit its cards and scrolls inside its own area.
 */
export function TableSurface() {
  const game = useGameStore((s) => s.game);
  const [activeId, setActiveId] = useState<string>();
  const buttons = useRef<Record<string, HTMLButtonElement | null>>({});

  const register = useCallback((cardId: string, element: HTMLButtonElement | null) => {
    buttons.current[cardId] = element;
  }, []);

  const onKeyDown = useCallback(
    (cardId: string, event: KeyboardEvent<HTMLButtonElement>) => {
      const direction = ARROWS[event.key];
      if (!direction || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      event.preventDefault();
      const next = nearestInDirection(game.table, cardId, direction);
      if (next) buttons.current[next]?.focus();
    },
    [game.table],
  );

  const count = game.table.length;
  const label = `Table, ${count} ${count === 1 ? 'card' : 'cards'}`;
  if (count === 0) {
    return (
      <div className="table-surface table-surface--empty" role="group" aria-label={label}>
        <p className="table-surface__empty">No cards on the table yet.</p>
      </div>
    );
  }

  // The Tab stop is the last card focused, or the first in reading order once that card has gone.
  const tabbableId = activeId && game.table.some((e) => e.cardId === activeId) ? activeId : readingOrder(game.table)[0];
  const boxes = game.table.map(cardBox);
  const width = Math.max(...boxes.map((b) => b.right)) + TABLE_GAP;
  const height = Math.max(CARD_H, ...boxes.map((b) => b.bottom)) + TABLE_GAP;

  return (
    <div className="table-surface__scroll">
      <div className="table-surface" role="group" aria-label={`${label}. Arrow keys move between cards.`} style={{ width, height }}>
        {game.table.map((entry, index) => (
          <TableCard
            key={entry.cardId}
            view={tableCardView(game, entry)}
            layer={index + 1}
            tabbable={entry.cardId === tabbableId}
            register={register}
            onFocus={setActiveId}
            onKeyDown={onKeyDown}
          />
        ))}
      </div>
    </div>
  );
}
