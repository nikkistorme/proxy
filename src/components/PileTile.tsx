import { useCallback, useRef, useState, type DragEvent } from 'react';
import type { CardFace as CardFaceData } from '../model/card';
import type { Pile } from '../model/game';
import { CardFace } from './CardFace';
import './PileTile.css';
import { seatIdentity } from './seatIdentity';
import './SeatIdentity.css';

interface PileTileProps {
  pile: Pile;
  /** Owning seat's name, or undefined for a shared pile. */
  ownerName: string | undefined;
  /** The top card's front, when it has been revealed. */
  revealedTop: CardFaceData | undefined;
  menuOpen: boolean;
  onOpenMenu: () => void;
  /** Gives the parent this tile's button, for returning focus to it. */
  registerTile: (pileId: string, element: HTMLButtonElement | null) => void;
  /** SP-1: a file dropped on the pile. Load CSV… in the menu is the non-drag way. */
  onDropFile: (pileId: string, file: File) => void;
  /** TT-4: a dragged card is over this pile, and would go on top. */
  cardOver?: boolean;
}

/**
 * SP-5: a pile shows its name, card count and top card, face down unless revealed.
 *
 * The card back or revealed face is a decorative layer under the button, and
 * the button holds only the plate text. Its label then always starts with the
 * text you can see (WCAG 2.5.3), whatever the top card says.
 */
export function PileTile({ pile, ownerName, revealedTop, menuOpen, onOpenMenu, registerTile, onDropFile, cardOver = false }: PileTileProps) {
  const ref = useCallback((element: HTMLButtonElement | null) => registerTile(pile.id, element), [registerTile, pile.id]);
  const [dropTarget, setDropTarget] = useState(false);
  // dragenter and dragleave fire for every child, so count them to know when the drag really leaves.
  const dragDepth = useRef(0);

  const isFileDrag = (event: DragEvent) => event.dataTransfer.types.includes('Files');
  const dragHandlers = {
    onDragEnter: (event: DragEvent) => {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      dragDepth.current += 1;
      setDropTarget(true);
    },
    onDragOver: (event: DragEvent) => {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'copy';
    },
    onDragLeave: () => {
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDropTarget(false);
    },
    onDrop: (event: DragEvent) => {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      dragDepth.current = 0;
      setDropTarget(false);
      const file = event.dataTransfer.files[0];
      if (file) onDropFile(pile.id, file);
    },
  };
  const identity = seatIdentity(pile.ownerSeatId);
  const count = pile.cardIds.length;
  const label = [
    pile.name,
    count === 0 ? 'empty' : undefined,
    `${count} ${count === 1 ? 'card' : 'cards'}`,
    ownerName ?? 'shared',
    revealedTop ? `top card face up: ${revealedTop.name}` : undefined,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div
      className={dropTarget || cardOver ? 'pile-tile pile-tile--drop-target' : 'pile-tile'}
      data-drop-zone="pile"
      data-pile-id={pile.id}
      {...dragHandlers}
    >
      {count > 2 && <div className={`pile-tile__layer pile-tile__layer--2 ${identity.backClass}`} aria-hidden="true" />}
      {count > 1 && <div className={`pile-tile__layer pile-tile__layer--1 ${identity.backClass}`} aria-hidden="true" />}
      {count > 0 && (
        <div className={`pile-tile__top ${revealedTop ? '' : identity.backClass}`} aria-hidden="true">
          {revealedTop ? (
            <CardFace face={revealedTop} />
          ) : (
            <>
              <span className="pile-tile__frame" />
              <span className="pile-tile__mark">
                <svg width="22" height="22" viewBox="0 0 16 16">
                  <path d={identity.shape} fill={identity.color} />
                </svg>
              </span>
            </>
          )}
        </div>
      )}
      <button
        ref={ref}
        type="button"
        className={count === 0 ? 'pile-tile__button pile-tile__button--empty' : 'pile-tile__button'}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        onClick={onOpenMenu}
      >
        {count === 0 ? (
          <span className="pile-tile__empty">
            <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true">
              <path d={identity.shape} fill="none" stroke={identity.color} strokeWidth="1.5" />
            </svg>
            <span className="pile-tile__empty-name">{pile.name}</span>{' '}
            {/* The dot is drawn in CSS so the text matches the label: "empty, 0". */}
            <span className="pile-tile__empty-count">
              Empty <span className="pile-tile__empty-zero">0</span>
            </span>
          </span>
        ) : (
          <span className="pile-tile__plate">
            {/* Spaces between the spans keep words apart for assistive tech; flex layout ignores them. */}
            <span className="pile-tile__name">{pile.name}</span>{' '}
            <span className="pile-tile__count">{count}</span>
          </span>
        )}
      </button>
      {(dropTarget || cardOver) && (
        // A dragged card covers the middle, so its label sits above the pile, as on CardStates.
        <span className={dropTarget ? 'pile-tile__drop-label' : 'pile-tile__drop-label pile-tile__drop-label--above'} aria-hidden="true">
          {dropTarget ? 'Drop to load' : 'Drop: top'}
        </span>
      )}
    </div>
  );
}
