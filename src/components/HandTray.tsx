import { useId } from 'react';
import type { CardFace as CardFaceData } from '../model/card';
import { CardFace } from './CardFace';
import './HandTray.css';
import { seatIdentity } from './seatIdentity';

interface HandTrayProps {
  seatId: string;
  seatName: string;
  cards: { id: string; face: CardFaceData }[];
  onDraw: () => void;
}

/** The active seat's hand (FS-3), with Draw (SP-6). Follows the Main board's hand tray. */
export function HandTray({ seatId, seatName, cards, onDraw }: HandTrayProps) {
  const headingId = useId();
  const identity = seatIdentity(seatId);
  const count = `${cards.length} ${cards.length === 1 ? 'card' : 'cards'}`;

  return (
    <section className="hand-tray" aria-labelledby={headingId} style={{ borderTopColor: identity.color }}>
      <div className="hand-tray__header">
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
          <path d={identity.shape} fill={identity.color} />
        </svg>
        <h2 id={headingId} className="hand-tray__title">
          {seatName}'s hand
        </h2>
        <span className="hand-tray__count">{count}</span>
        <button type="button" className="hand-tray__draw" aria-keyshortcuts="D" onClick={onDraw}>
          Draw{' '}
          <kbd className="hand-tray__kbd" aria-hidden="true">
            D
          </kbd>
        </button>
      </div>
      {cards.length === 0 ? (
        <p className="hand-tray__empty">No cards in hand. Draw from {seatName}'s deck to start.</p>
      ) : (
        <ul className="hand-tray__cards" aria-label={`${seatName}'s hand, ${count}`}>
          {cards.map((card) => (
            <li key={card.id}>
              <CardFace face={card.face} width={104} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
