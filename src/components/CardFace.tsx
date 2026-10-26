import type { CSSProperties } from 'react';
import type { CardFace as CardFaceData } from '../model/card';
import { CardArt } from './CardArt';
import './CardFace.css';

/** Columns the default face reads, in order of preference, until layouts arrive (Phase 4). */
const TEXT_COLUMNS = ['text', 'rules', 'rules text'];

interface CardFaceProps {
  face: CardFaceData;
  /** Rendered width in CSS px. Height follows the 63 × 88 mm card ratio. */
  width?: number;
}

function cardText(face: CardFaceData): string | undefined {
  for (const column of TEXT_COLUMNS) {
    const value = face.fields[column]?.trim();
    if (value) return value;
  }
  return undefined;
}

/** What the card says, in the order it shows it: name, cost, type, text and stats. */
export function cardFaceLabel(face: CardFaceData): string {
  const cost = face.fields.cost?.trim();
  return [face.name, cost && `Cost ${cost}`, face.type, cardText(face), face.fields.stats?.trim()].filter(Boolean).join('. ');
}

/**
 * The default card rendering, laid out like the design's sample card
 * (`Card.dc.html`) at its 240 × 336 base size and scaled to `width`.
 */
export function CardFace({ face, width = 126 }: CardFaceProps) {
  const cost = face.fields.cost?.trim();
  const stats = face.fields.stats?.trim();
  const text = cardText(face);
  const style = { '--card-scale': width / 240, width, height: Math.round((width * 336) / 240) } as CSSProperties;

  return (
    <div className="card-face" role="img" aria-label={cardFaceLabel(face)} style={style}>
      <div className="card-face__base">
        <div className="card-face__bar">
          <span className="card-face__name">{face.name}</span>
          {cost && <span className="card-face__cost">{cost}</span>}
        </div>
        <div className="card-face__art">
          <CardArt name={face.name} image={face.image} decorative />
        </div>
        {face.type && <div className="card-face__type">{face.type}</div>}
        <div className="card-face__text">
          {text && <span>{text}</span>}
          {stats && <span className="card-face__stats">{stats}</span>}
        </div>
      </div>
    </div>
  );
}
