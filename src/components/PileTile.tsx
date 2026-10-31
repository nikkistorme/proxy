import { useCallback, useRef, useState, type DragEvent, type KeyboardEvent } from 'react';
import type { CardFace as CardFaceData } from '../model/card';
import type { Pile, SeatPlace } from '../model/session';
import { CardFace } from './CardFace';
import './PileTile.css';
import { seatIdentity } from './seatIdentity';
import './SeatIdentity.css';

interface PileTileProps {
  pile: Pile;
  /** Owning seat's name, or undefined for a shared pile. */
  ownerName: string | undefined;
  /** The owning seat's place, for its colour and shape. Undefined for a shared pile. */
  ownerPlace?: SeatPlace;
  /** The top card's front, when it has been revealed. */
  revealedTop: CardFaceData | undefined;
  menuOpen: boolean;
  /** Opens the menu, or closes it if it's open. */
  onOpenMenu: () => void;
  /** SP-6: a click or tap draws the top card into the active seat's hand. */
  onDraw: () => void;
  /** Gives the parent this tile's button, for returning focus to it. */
  registerTile: (pileId: string, element: HTMLButtonElement | null) => void;
  /** SP-1: a file dropped on the pile. Load CSV… in the menu is the non-drag way. */
  onDropFile: (pileId: string, file: File) => void;
  /** TT-4: a dragged card is over this pile, and would go on top. */
  cardOver?: boolean;
  /** TT-4: a pile being dragged or placed is over this pile, and would merge with it. */
  mergeTarget?: boolean;
  /** CD-12: a sheet is being fetched for this pile. */
  loading?: boolean;
  /** CD-12: why this pile's sheet couldn't load, shown as a warning badge on an empty pile. */
  loadError?: string;
  /** A11Y-3: on the table, only the current card or pile is in the Tab order. */
  tabbable?: boolean;
  onFocus?: () => void;
  onKeyDown?: (event: KeyboardEvent<HTMLButtonElement>) => void;
  onKeyUp?: (event: KeyboardEvent<HTMLButtonElement>) => void;
}

/** Says what a pile does when pressed, for every pile on the table. */
export const PILE_HINT_ID = 'pile-hint';
export const PILE_HINT = 'Click draws the top card. Enter, right-click, or a touch held and let go, opens actions. Space moves the pile.';

/**
 * SP-5: a pile shows its name, card count and top card, face down unless revealed.
 *
 * The card back or revealed face is a decorative layer under the button, and
 * the button holds only the plate text. Its label then always starts with the
 * text you can see (WCAG 2.5.3), whatever the top card says.
 *
 * A click draws, and right-click, Enter, the menu key or Shift+F10 open the menu,
 * like a table card's. The table adds dragging and Space to move the pile.
 */
export function PileTile({
  pile,
  ownerName,
  ownerPlace,
  revealedTop,
  menuOpen,
  onOpenMenu,
  onDraw,
  registerTile,
  onDropFile,
  cardOver = false,
  mergeTarget = false,
  loading = false,
  loadError,
  tabbable = true,
  onFocus,
  onKeyDown,
  onKeyUp,
}: PileTileProps) {
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
  const identity = seatIdentity(ownerPlace);
  const count = pile.cardIds.length;
  const label = [
    pile.name,
    count === 0 ? (loading ? 'Loading…' : 'empty') : undefined,
    count === 0 && !loading && loadError ? `couldn't load: ${loadError}` : undefined,
    `${count} ${count === 1 ? 'card' : 'cards'}`,
    ownerName ?? 'shared',
    revealedTop ? `top card face up: ${revealedTop.name}` : undefined,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div
      className={dropTarget || cardOver || mergeTarget ? 'pile-tile pile-tile--drop-target' : 'pile-tile'}
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
        aria-describedby={PILE_HINT_ID}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        tabIndex={tabbable ? 0 : -1}
        // Safari doesn't focus a button on click, and a clicked pile must become the table's current one.
        // With the menu open, a press closes it rather than drawing.
        onClick={(event) => {
          event.currentTarget.focus();
          if (menuOpen) onOpenMenu();
          else onDraw();
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          event.currentTarget.focus();
          onOpenMenu();
        }}
        onFocus={onFocus}
        onKeyDown={(event) => {
          const { key } = event;
          if (!event.altKey && !event.ctrlKey && !event.metaKey && (key === 'Enter' || key === 'ContextMenu' || (key === 'F10' && event.shiftKey))) {
            // Not a click, which would draw.
            event.preventDefault();
            onOpenMenu();
            return;
          }
          onKeyDown?.(event);
        }}
        onKeyUp={onKeyUp}
        // The menu opens outside the tile, so its outside-press check would close it
        // and this click reopen it. Pressing the pile with its menu open closes it instead.
        onPointerDown={(event) => {
          if (menuOpen) event.stopPropagation();
        }}
      >
        {count === 0 ? (
          <span className="pile-tile__empty">
            <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true">
              <path d={identity.shape} fill="none" stroke={identity.color} strokeWidth="1.5" />
            </svg>
            <span className="pile-tile__empty-name">{pile.name}</span>{' '}
            {/* The dot is drawn in CSS so the text matches the label: "empty, 0". */}
            <span className="pile-tile__empty-count">
              {loading ? (
                'Loading…'
              ) : (
                <>
                  Empty <span className="pile-tile__empty-zero">0</span>
                </>
              )}
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
      {count === 0 && !loading && loadError && (
        // Shape and an icon, never colour alone. The tile's label carries the error.
        <span className="pile-tile__warning" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3 2.5 20h19zM12 10v4.5M12 17.5v.01" />
          </svg>
        </span>
      )}
      {(dropTarget || cardOver || mergeTarget) && (
        // A dragged card covers the middle, so its label sits above the pile, as on CardStates.
        <span className={dropTarget ? 'pile-tile__drop-label' : 'pile-tile__drop-label pile-tile__drop-label--above'} aria-hidden="true">
          {dropTarget ? 'Drop to load' : mergeTarget ? 'Drop: merge' : 'Drop: top'}
        </span>
      )}
    </div>
  );
}
