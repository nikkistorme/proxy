import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { CardFace as CardFaceData } from '../model/card';
import {
  boxValue,
  CARD_WIDTH_PT,
  DEFAULT_LAYOUT,
  fitTextSize,
  layoutLabel,
  type LayoutBox,
  type LayoutDesign,
  type TextFit,
} from '../model/layout';
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
  /** Called with each text box's fitted size once drawn, so the editor can warn about clipped text (LY-4). */
  onFit?: (boxId: string, fit: TextFit) => void;
}

/** What the card says, in the order its layout shows it. */
export function cardFaceLabel(face: CardFaceData, layout: LayoutDesign = DEFAULT_LAYOUT): string {
  return layoutLabel(face, layout);
}

// `safe` keeps the first line in view when text clips at the minimum size, so the end clips.
const JUSTIFY = { top: 'flex-start', middle: 'safe center', bottom: 'safe flex-end' } as const;

const fontSize = (pt: number) => `calc(${pt} * var(--card-pt))`;

/** Whether a text box's text is taller or wider than the box. A pixel of slack absorbs rounding. */
function overflows(el: HTMLElement): boolean {
  return el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
}

/** Bumps once the bundled fonts finish loading, so text measured with a fallback font is measured again. */
function useFontsLoaded(): number {
  const [loaded, setLoaded] = useState(0);
  useEffect(() => {
    const fonts = typeof document === 'undefined' ? undefined : document.fonts;
    if (!fonts || fonts.status === 'loaded') return;
    let live = true;
    void fonts.ready.then(() => live && setLoaded((n) => n + 1));
    return () => {
      live = false;
    };
  }, []);
  return loaded;
}

interface BoxProps {
  box: LayoutBox;
  face: CardFaceData;
  width: number;
  onFit?: CardFaceProps['onFit'];
}

function Box({ box, face, width, onFit }: BoxProps) {
  const { content, style } = box;
  const value = boxValue(face, content);
  const isText = content.kind === 'text' || (content.kind === 'column' && content.as === 'text');
  const ref = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<TextFit | null>(null);
  const fontsLoaded = useFontsLoaded();

  // Shrink-to-fit (LY-4): try sizes on the drawn box before it paints, then keep the largest that fits.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !isText) return;
    const next = fitTextSize(style.size, (pt) => {
      el.style.fontSize = fontSize(pt);
      return overflows(el);
    });
    el.style.fontSize = fontSize(next.size);
    setFit(next);
  }, [isText, value, width, fontsLoaded, style.size, style.weight, style.font, box.width, box.height]);

  useEffect(() => {
    if (fit) onFit?.(box.id, fit);
  }, [fit, onFit, box.id]);

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
  const size = fit?.size ?? style.size;
  return (
    <div
      ref={ref}
      className={`card-face__box card-face__box--text${style.font === 'mono' ? ' card-face__box--mono' : ''}`}
      data-fit={fit?.clipped ? 'clipped' : size < style.size ? 'shrunk' : undefined}
      style={
        {
          ...position,
          justifyContent: JUSTIFY[style.valign],
          textAlign: style.align,
          color: style.color,
          '--box-size': fontSize(style.size),
          fontSize: fontSize(size),
          fontWeight: style.weight,
        } as CSSProperties
      }
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
 * card is turned on the table; `upright` shows it unturned instead. Text that
 * overflows its box shrinks to fit, down to `MIN_TEXT_PT`, then clips (LY-4).
 */
export function CardFace({ face, width = 126, layout: given, upright = false, onFit }: CardFaceProps) {
  const chosen = useLayoutFor(face);
  const layout = given ?? chosen;
  const height = Math.round((width * 336) / 240);
  const landscape = layout.orientation === 'landscape';
  const size = landscape && upright ? { width: height, height: width } : { width, height };
  const style = { '--card-pt': `${width / CARD_WIDTH_PT}px`, ...size } as CSSProperties;
  const boxes = layout.boxes.map((box) => <Box key={box.id} box={box} face={face} width={width} onFit={onFit} />);

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
