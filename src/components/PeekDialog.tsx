import { useEffect, useRef, useState } from 'react';
import { moveCard, type Destination } from '../actions/moveCard';
import { reorderTop } from '../actions/peek';
import { useGameStore } from '../store/gameStore';
import { CardFace } from './CardFace';
import { Dialog } from './Dialog';
import { LiveRegion } from './LiveRegion';
import { MoveDialog, type MoveRequest } from './MoveDialog';
import { moveDestinations } from './moveDestinations';
import './PeekDialog.css';

export interface PeekRequest {
  pileId: string;
  /** The peeked cards, top first, from `peekTop`. */
  cardIds: string[];
}

interface PeekDialogProps {
  /** Give each request its own `key`, so every opening starts fresh. */
  request: PeekRequest | undefined;
  /** Called once the dialog has closed and the cards are back in the order shown. */
  onClose: () => void;
}

const ICONS = {
  up: 'M12 19V5M6 11l6-6 6 6',
  down: 'M12 5v14M6 13l6 6 6-6',
};

/**
 * SP-9: look at the top N cards of a pile, reorder them, and move any of them
 * away. Closing it any way (Done, Esc or ×) puts the cards back in the order
 * shown, with one `reorderTop`. Moves happen at once, through `moveCard`.
 */
export function PeekDialog({ request, onClose }: PeekDialogProps) {
  const game = useGameStore((s) => s.game);
  const dispatch = useGameStore((s) => s.dispatch);
  const announce = useGameStore((s) => s.announce);

  const bodyRef = useRef<HTMLDivElement>(null);
  /** The button to focus once the page has updated: `${cardId}:${action}`, or 'done'. */
  const pendingFocusRef = useRef<string>(undefined);
  const [order, setOrder] = useState<string[]>(request?.cardIds ?? []);
  const [moveRequest, setMoveRequest] = useState<MoveRequest>();

  const pile = game.piles.find((p) => p.id === request?.pileId);
  const faceOf = (cardId: string) => {
    const card = game.cards[cardId];
    return card && game.definitions[card.definitionId]?.front;
  };
  const nameOf = (cardId: string) => faceOf(cardId)?.name ?? 'Card';

  // Focus the right button once a reorder or move has re-rendered the list,
  // and the Move dialog, if it was open, has closed.
  useEffect(() => {
    const pending = pendingFocusRef.current;
    if (!pending || moveRequest) return;
    pendingFocusRef.current = undefined;
    const dialog = bodyRef.current?.closest('dialog');
    if (pending === 'done') dialog?.querySelector<HTMLElement>('.dialog__footer .button--primary')?.focus();
    else dialog?.querySelector<HTMLElement>(`[data-peek="${pending}"]`)?.focus();
  });

  function shift(index: number, by: -1 | 1) {
    const to = index + by;
    const cardId = order[index];
    if (!cardId || to < 0 || to >= order.length) return;
    const next = [...order];
    next.splice(index, 1);
    next.splice(to, 0, cardId);
    setOrder(next);
    // Keep focus on the same button, so pressing it again keeps moving the card.
    pendingFocusRef.current = `${cardId}:${by < 0 ? 'up' : 'down'}`;
    announce(`${nameOf(cardId)} is now ${to + 1} of ${next.length}${to === 0 ? ', the top' : ''}.`);
  }

  function openMove(cardId: string) {
    const face = faceOf(cardId);
    if (!pile || !face) return;
    // Cancelling comes back to this button; a move replaces it.
    pendingFocusRef.current = `${cardId}:move`;
    setMoveRequest({ cardId, face, fromName: pile.name, options: moveDestinations(game, cardId, { exceptTopOf: pile.id }) });
  }

  function confirmMove(to: Destination) {
    const cardId = moveRequest?.cardId;
    if (!cardId) return;
    const index = order.indexOf(cardId);
    const rest = order.filter((id) => id !== cardId);
    dispatch((g, context) => moveCard(g, { cardId, to }, context));
    setOrder(rest);
    const next = rest[index] ?? rest[index - 1];
    pendingFocusRef.current = next ? `${next}:move` : 'done';
  }

  /** Puts the cards back in the order shown, if it changed, then reports the close. */
  function close() {
    const top = pile?.cardIds.slice(0, order.length) ?? [];
    const changed = order.some((id, i) => id !== top[i]);
    if (pile && order.length > 0 && changed) dispatch((g) => reorderTop(g, { pileId: pile.id, cardIds: order }));
    onClose();
  }

  const count = order.length;
  return (
    <Dialog
      open={request !== undefined}
      title={pile ? `Top ${count} of ${pile.name}` : ''}
      eyebrow="Shown face up to you only"
      hint="Up and Down reorder · Esc puts them back"
      primaryLabel="Done"
      width="medium"
      onClose={close}
    >
      <div ref={bodyRef}>
        {count === 0 ? (
          <p className="peek__empty">No cards left to put back.</p>
        ) : (
          <ol className="peek__list" aria-label="Top cards, top first">
            {order.map((cardId, index) => {
              const face = faceOf(cardId);
              const name = nameOf(cardId);
              const first = index === 0;
              const last = index === count - 1;
              return (
                <li key={cardId} className="peek__row">
                  <span className="peek__position">
                    <span className="peek__number">{index + 1}</span>
                    {first && ' · top'}
                  </span>
                  {face && <CardFace face={face} width={100} />}
                  <div className="peek__actions">
                    <button
                      type="button"
                      className="peek__button"
                      data-peek={`${cardId}:up`}
                      aria-label={`Up: ${name}`}
                      aria-disabled={first || undefined}
                      onClick={() => shift(index, -1)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d={ICONS.up} />
                      </svg>
                      Up
                    </button>
                    <button
                      type="button"
                      className="peek__button"
                      data-peek={`${cardId}:down`}
                      aria-label={`Down: ${name}`}
                      aria-disabled={last || undefined}
                      onClick={() => shift(index, 1)}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d={ICONS.down} />
                      </svg>
                      Down
                    </button>
                    <button
                      type="button"
                      className="peek__button"
                      data-peek={`${cardId}:move`}
                      aria-label={`Move to…: ${name}`}
                      onClick={() => openMove(cardId)}
                    >
                      Move to…
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
      <MoveDialog
        key={moveRequest?.cardId ?? 'closed'}
        request={moveRequest}
        onConfirm={confirmMove}
        onClose={() => setMoveRequest(undefined)}
      />
      {/* The page's live region is outside this modal, where screen readers may not hear it. */}
      <LiveRegion />
    </Dialog>
  );
}
