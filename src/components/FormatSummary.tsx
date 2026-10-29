import type { Format } from '../model/format';
import type { SeatPlace } from '../model/session';
import { seatIdentity } from './seatIdentity';
import './FormatSummary.css';

/** The place of each seat in a format, as `createSession` gives it. */
export function seatPlaces(format: Format): SeatPlace[] {
  let players = 0;
  return format.seats.map((seat) => (seat.kind === 'environment' ? 'environment' : players++ === 0 ? 'player-1' : 'player-2'));
}

/** A format's seats (shape and colour from their place) and piles, in the setup dialog and the Formats screen (SP-1, FS-2). */
export function FormatSummary({ format }: { format: Format }) {
  const places = seatPlaces(format);
  return (
    <>
      <span className="format-summary__seats">
        {format.seats.map((seat, i) => {
          const identity = seatIdentity(places[i]);
          return (
            <span key={seat.id} className="format-summary__seat" style={{ color: identity.color }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d={identity.shape} />
              </svg>
              <span className="format-summary__seat-name">{seat.name}</span>
              <span className="visually-hidden"> ({identity.shapeName})</span>
            </span>
          );
        })}
      </span>
      <span className="format-summary__piles">Piles: {format.piles.map((pile) => pile.name).join(', ')}</span>
    </>
  );
}
