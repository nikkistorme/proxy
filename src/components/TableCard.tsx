import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react';
import { cardBox } from '../model/tablePlacement';
import { CardFace } from './CardFace';
import { seatIdentity } from './seatIdentity';
import './SeatIdentity.css';
import './TableCard.css';
import type { TableCardView } from './tableCardView';

interface TableCardProps {
  view: TableCardView;
  /** Stacking order: later cards are drawn on top (TT-10). */
  layer: number;
  /** The table's one Tab stop (A11Y-3). */
  tabbable: boolean;
  register: (cardId: string, element: HTMLButtonElement | null) => void;
  onFocus: (cardId: string) => void;
  onKeyDown: (cardId: string, event: KeyboardEvent<HTMLButtonElement>) => void;
  onKeyUp: (cardId: string, event: KeyboardEvent<HTMLButtonElement>) => void;
  menuOpen: boolean;
  /** Opens this card's action menu (right-click, or the Actions button). */
  onOpenMenu: (cardId: string) => void;
  /** TT-4: a press that may become a drag. */
  onPointerDown: (cardId: string, event: PointerEvent<HTMLButtonElement>) => void;
  /** TT-4: this card is being dragged, so it shows where it came from. */
  dragging: boolean;
}

/**
 * A card on the table, at its position and rotation. Like the viewer's cards, the
 * face is a decorative layer under a transparent button that carries the name,
 * so a face full of text never becomes the button's name (A11Y-6).
 */
export function TableCard({ view, layer, tabbable, register, onFocus, onKeyDown, onKeyUp, menuOpen, onOpenMenu, onPointerDown, dragging }: TableCardProps) {
  const { entry, face, ownerSeatId, missing, label } = view;
  const identity = seatIdentity(ownerSeatId);
  // The outer box is the area the card covers on screen, turned or not, so the
  // Actions button sits at its bottom-right corner. Only the card inside turns.
  const box = cardBox(entry);
  const style = { left: box.left, top: box.top, width: box.right - box.left, height: box.bottom - box.top, zIndex: layer } as CSSProperties;
  const bodyStyle = entry.rotation === 0 ? undefined : { transform: `rotate(${entry.rotation}deg)` };

  return (
    <div className={menuOpen ? 'table-card card-drag-source table-card--menu-open' : 'table-card card-drag-source'} style={style} data-card-id={entry.cardId}>
      <div className={dragging ? 'table-card__body card-drag-origin' : 'table-card__body'} style={bodyStyle}>
        <div className={face ? 'table-card__face' : `table-card__face ${identity.backClass}`} aria-hidden="true">
          {face ? (
            <CardFace face={face} />
          ) : (
            <>
              <span className="table-card__frame" />
              <span className="table-card__mark">
                <svg width="22" height="22" viewBox="0 0 16 16">
                  <path d={identity.shape} fill={identity.color} />
                </svg>
              </span>
            </>
          )}
        </div>
        {missing && (
          <span className="table-card__badge" aria-hidden="true">
            Not in CSV
          </span>
        )}
        <button
          ref={(element) => register(entry.cardId, element)}
          type="button"
          className="table-card__button"
          aria-label={label}
          tabIndex={tabbable ? 0 : -1}
          // Safari doesn't focus a button on click, and a clicked card must become the current one.
          onClick={(event) => event.currentTarget.focus()}
          onFocus={() => onFocus(entry.cardId)}
          onKeyDown={(event) => onKeyDown(entry.cardId, event)}
          onKeyUp={(event) => onKeyUp(entry.cardId, event)}
          onPointerDown={(event) => onPointerDown(entry.cardId, event)}
          onContextMenu={(event) => {
            event.preventDefault();
            event.currentTarget.focus();
            onOpenMenu(entry.cardId);
          }}
        />
      </div>
      {/*
        The board's round Actions button, shown on the current card so touch and mouse
        can open the menu in a tap. Keyboard users press Enter on the card instead, so
        it stays out of the Tab order.
      */}
      <button
        type="button"
        className="table-card__actions"
        tabIndex={-1}
        aria-label={`Actions for ${label} (Enter)`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        // Keep focus on the card (Safari would drop it), and stop the open menu's
        // outside-press check, so a second press closes it rather than reopening.
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onClick={() => onOpenMenu(entry.cardId)}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5.5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="18.5" cy="12" r="1.8" />
        </svg>
      </button>
    </div>
  );
}
