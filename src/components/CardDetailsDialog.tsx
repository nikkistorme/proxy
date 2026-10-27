import type { CardFace } from '../model/card';
import type { GameState } from '../model/game';
import { Dialog } from './Dialog';
import './CardDetailsDialog.css';

interface CardDetailsDialogProps {
  game: GameState;
  /** The card to show, or undefined when closed. */
  cardId: string | undefined;
  onClose: () => void;
}

function FaceDetails({ face, heading }: { face: CardFace; heading?: string }) {
  const rows: [string, string][] = [['name', face.name]];
  if (face.type) rows.push(['type', face.type]);
  if (face.layout) rows.push(['layout', face.layout]);
  for (const [column, value] of Object.entries(face.fields)) if (value.trim()) rows.push([column, value]);
  return (
    <section className="card-details__face">
      {heading && <h3 className="card-details__heading">{heading}</h3>}
      <dl className="card-details__list">
        {rows.map(([column, value]) => (
          <div key={column} className="card-details__row">
            <dt>{column}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * A11Y-6 details: every column bound to a card, both faces of a double-faced
 * card. A face-down card stays hidden.
 */
export function CardDetailsDialog({ game, cardId, onClose }: CardDetailsDialogProps) {
  const card = cardId ? game.cards[cardId] : undefined;
  const definition = card && game.definitions[card.definitionId];
  const down = card?.side === 'down';
  const title = !definition ? '' : down ? 'Face-down card' : card?.side === 'back' && definition.back ? definition.back.name : definition.front.name;
  const notes = [definition?.missing && 'Not in the CSV any more.', card?.duplicate && 'A duplicate, made on the table.'].filter(Boolean);

  return (
    <Dialog open={Boolean(definition)} title={title} eyebrow="Card details" onClose={onClose} primaryLabel="Done" width="medium">
      {definition &&
        (down ? (
          <p className="card-details__note">Face-down card. Flip it to read it.</p>
        ) : (
          <>
            {notes.map((note) => (
              <p key={String(note)} className="card-details__note">
                {note}
              </p>
            ))}
            <FaceDetails face={definition.front} heading={definition.back ? 'Front' : undefined} />
            {definition.back && <FaceDetails face={definition.back} heading="Back" />}
          </>
        ))}
    </Dialog>
  );
}
