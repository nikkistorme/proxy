import type { CSSProperties } from 'react';
import type { CardFace as CardFaceData } from '../model/card';
import { boxValue, CARD_WIDTH_PT, DEFAULT_LAYOUT, layoutLabel, type LayoutBox, type LayoutDesign } from '../model/layout';
import { useLayoutFor } from '../layouts/LayoutsProvider';
import { CardArt } from './CardArt';
import './CardFace.css';

interface CardFaceProps {
  face: CardFaceData;
  /** Rendered width in CSS px. Height follows the 63 × 88 mm card ratio. */
  width?: number;
  /** The layout to draw with. Defaults to the one LY-8 chooses for the face. */
  layout?: LayoutDesign;
  /** Shows a landscape layout upright, in a card turned on its side (the enlarge preview, TT-9). */
  upright?: boolean;
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
 * same at any `width`. A landscape layout is drawn on an 88 × 63 mm canvas
 * turned 90° anticlockwise on the portrait card, so it reads upright once the
 * card is turned on the table; `upright` shows it unturned instead.
 */
export function CardFace({ face, width = 126, layout: given, upright = false }: CardFaceProps) {
  const chosen = useLayoutFor(face);
  const layout = given ?? chosen;
  const height = Math.round((width * 336) / 240);
  const landscape = layout.orientation === 'landscape';
  const size = landscape && upright ? { width: height, height: width } : { width, height };
  const style = { '--card-pt': `${width / CARD_WIDTH_PT}px`, ...size } as CSSProperties;
  const boxes = layout.boxes.map((box) => <Box key={box.id} box={box} face={face} />);

  return (
    <div className={`card-face${landscape ? ' card-face--landscape' : ''}`} role="img" aria-label={cardFaceLabel(face, layout)} style={style}>
      {landscape && !upright ? (
        <div
          className="card-face__canvas"
          style={{ width: height, height: width, left: (width - height) / 2, top: (height - width) / 2, transform: 'rotate(-90deg)' }}
        >
          {boxes}
        </div>
      ) : (
        boxes
      )}
    </div>
  );
}
