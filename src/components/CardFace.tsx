import type { CSSProperties } from 'react';
import type { CardFace as CardFaceData } from '../model/card';
import { boxValue, CARD_WIDTH_PT, DEFAULT_LAYOUT, layoutLabel, type LayoutBox, type LayoutDesign } from '../model/layout';
import { CardArt } from './CardArt';
import './CardFace.css';

interface CardFaceProps {
  face: CardFaceData;
  /** Rendered width in CSS px. Height follows the 63 × 88 mm card ratio. */
  width?: number;
  /** The layout to draw with. Defaults to the built-in layout. */
  layout?: LayoutDesign;
}

/** What the card says, in the order its layout shows it. */
export function cardFaceLabel(face: CardFaceData, layout: LayoutDesign = DEFAULT_LAYOUT): string {
  return layoutLabel(face, layout);
}

// `safe` keeps the first line in view when text overflows; until 5d shrinks it, the end clips.
const JUSTIFY = { top: 'flex-start', middle: 'safe center', bottom: 'safe flex-end' } as const;

function Box({ box, face }: { box: LayoutBox; face: CardFaceData }) {
  const { content, style } = box;
  const value = boxValue(face, content);
  // A column box with nothing to show is left out, background and all. Art keeps its placeholder (CD-6).
  if (content.kind !== 'color' && !value && !(content.kind === 'column' && content.as === 'image')) return null;

  const position: CSSProperties = {
    left: `${box.x}%`,
    top: `${box.y}%`,
    width: `${box.width}%`,
    height: `${box.height}%`,
    background: style.background,
  };

  if (content.kind === 'color') return <div className="card-face__box" style={position} />;
  if (content.kind === 'column' && content.as === 'image') {
    return (
      <div className="card-face__box" style={position}>
        <CardArt name={face.name} image={value || undefined} decorative />
      </div>
    );
  }
  return (
    <div
      className={`card-face__box card-face__box--text${style.font === 'mono' ? ' card-face__box--mono' : ''}`}
      style={{
        ...position,
        justifyContent: JUSTIFY[style.valign],
        textAlign: style.align,
        color: style.color,
        fontSize: `calc(${style.size} * var(--card-pt))`,
        fontWeight: style.weight,
      }}
    >
      <span>{value}</span>
    </div>
  );
}

/**
 * A card face drawn from a layout's boxes (LY-3, LY-5, LY-6). Positions are
 * percentages of the card and text sizes points on it, so the face looks the
 * same at any `width`.
 */
export function CardFace({ face, width = 126, layout = DEFAULT_LAYOUT }: CardFaceProps) {
  const style = { '--card-pt': `${width / CARD_WIDTH_PT}px`, width, height: Math.round((width * 336) / 240) } as CSSProperties;

  return (
    <div className="card-face" role="img" aria-label={cardFaceLabel(face, layout)} style={style}>
      {layout.boxes.map((box) => (
        <Box key={box.id} box={box} face={face} />
      ))}
    </div>
  );
}
