import type { CSSProperties, KeyboardEvent } from 'react';
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
}

/**
 * A card on the table, at its position and rotation. Like the viewer's cards, the
 * face is a decorative layer under a transparent button that carries the name,
 * so a face full of text never becomes the button's name (A11Y-6).
 */
export function TableCard({ view, layer, tabbable, register, onFocus, onKeyDown }: TableCardProps) {
  const { entry, face, ownerSeatId, missing, label } = view;
  const identity = seatIdentity(ownerSeatId);
  const style = {
    left: entry.x,
    top: entry.y,
    zIndex: layer,
    transform: entry.rotation === 0 ? undefined : `rotate(${entry.rotation}deg)`,
  } as CSSProperties;

  return (
    <div className="table-card" style={style} data-card-id={entry.cardId}>
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
        onFocus={() => onFocus(entry.cardId)}
        onKeyDown={(event) => onKeyDown(entry.cardId, event)}
      />
    </div>
  );
}
