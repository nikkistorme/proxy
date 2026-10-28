import type { StoredItem } from '../storage/storage';
import { faceValue, type CardFace } from './card';

/** A card is 63 mm wide: 178.58 pt. Text sizes are points on the printed card (LY-4). */
export const CARD_WIDTH_PT = (63 / 25.4) * 72;

export type LayoutOrientation = 'portrait' | 'landscape';

/** What a box shows: a column as text or image (LY-3), fixed text or a solid colour (LY-5). */
export type BoxContent =
  | {
      kind: 'column';
      /** The first column that isn't empty is shown. The built-in default lists several; the editor sets one. */
      columns: string[];
      as: 'text' | 'image';
    }
  | { kind: 'text'; text: string }
  | { kind: 'color' };

/** How a box looks (LY-4). Colour boxes use only the background. */
export interface BoxStyle {
  /** Font size in points on the printed card, so it scales with the card. */
  size: number;
  weight: 400 | 500 | 600 | 700;
  align: 'left' | 'center' | 'right';
  valign: 'top' | 'middle' | 'bottom';
  /** `mono` is the bundled numbers font, so digits never shift. */
  font: 'sans' | 'mono';
  /** CSS colours. */
  color: string;
  background?: string;
}

/** A box on the card. Position and size are percentages of the card (LY-6). */
export interface LayoutBox {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  content: BoxContent;
  style: BoxStyle;
  /** Read before the box's text by screen readers, such as "Cost". */
  label?: string;
}

/** What a layout draws: everything but the saved item's fields. */
export interface LayoutDesign {
  name: string;
  orientation: LayoutOrientation;
  /** In drawing order: later boxes sit on top. */
  boxes: LayoutBox[];
}

/** A user layout, saved as its own item (AR-4, AR-6). */
export interface Layout extends StoredItem, LayoutDesign {}

/** A box's position in the design's 240 × 336 px base card, as percentages. */
function at(x: number, y: number, width: number, height: number) {
  return { x: (x / 240) * 100, y: (y / 336) * 100, width: (width / 240) * 100, height: (height / 336) * 100 };
}

/** Base px from the design's sample card, as points on the printed card. */
function pt(px: number): number {
  return Math.round(((px * CARD_WIDTH_PT) / 240) * 10) / 10;
}

const INK = '#1e1c1a';
const FRAME = '#29303b';
const PLATE = '#e3e7ee';
const text = { weight: 500, align: 'left', valign: 'top', font: 'sans', color: INK } as const;

/**
 * The built-in layout (LY-8's last fallback), drawn like the design's sample
 * card (`Card.dc.html`): name and cost, art, type, rules text and stats.
 */
export const DEFAULT_LAYOUT: LayoutDesign = {
  name: 'Default',
  orientation: 'portrait',
  boxes: [
    { id: 'frame', ...at(0, 0, 240, 336), content: { kind: 'color' }, style: { ...text, size: pt(14), background: FRAME } },
    { id: 'bar', ...at(9, 9, 222, 30), content: { kind: 'color' }, style: { ...text, size: pt(14), background: PLATE } },
    {
      id: 'name',
      ...at(13, 9, 182, 30),
      content: { kind: 'column', columns: ['name'], as: 'text' },
      style: { ...text, size: pt(18), weight: 700, valign: 'middle' },
    },
    {
      id: 'cost',
      ...at(197, 12.5, 30, 23),
      content: { kind: 'column', columns: ['cost'], as: 'text' },
      style: { ...text, size: pt(14), weight: 700, align: 'center', valign: 'middle', font: 'mono', color: '#fff', background: FRAME },
      label: 'Cost',
    },
    {
      id: 'art',
      ...at(9, 45, 222, 140),
      content: { kind: 'column', columns: ['image', 'card art', 'art'], as: 'image' },
      style: { ...text, size: pt(14), background: '#8e9db6' },
    },
    {
      id: 'type',
      ...at(9, 191, 222, 22),
      content: { kind: 'column', columns: ['type'], as: 'text' },
      style: { ...text, size: pt(13), weight: 600, valign: 'middle', background: PLATE },
    },
    {
      id: 'text',
      ...at(9, 219, 222, 108),
      content: { kind: 'column', columns: ['text', 'rules', 'rules text', 'card text'], as: 'text' },
      style: { ...text, size: pt(14.5), background: '#fbf8f2' },
    },
    {
      id: 'stats',
      ...at(165, 299, 60, 22),
      content: { kind: 'column', columns: ['stats'], as: 'text' },
      style: { ...text, size: pt(15), weight: 700, align: 'center', valign: 'middle', font: 'mono', color: '#fff', background: FRAME },
    },
  ],
};

/** The value a column box shows: its first column that isn't empty. */
export function boxValue(face: CardFace, content: BoxContent): string {
  if (content.kind === 'text') return content.text.trim();
  if (content.kind === 'color') return '';
  for (const column of content.columns) {
    const value = faceValue(face, column);
    if (value) return value;
  }
  return '';
}

/** Boxes in reading order: top to bottom, then left to right. */
function readingOrder(boxes: readonly LayoutBox[]): LayoutBox[] {
  return [...boxes].sort((a, b) => a.y - b.y || a.x - b.x);
}

/** What the card says, read from its text boxes in reading order. Images are decorative. */
export function layoutLabel(face: CardFace, layout: LayoutDesign): string {
  return readingOrder(layout.boxes)
    .filter(({ content }) => content.kind === 'text' || (content.kind === 'column' && content.as === 'text'))
    .map((box) => {
      const value = boxValue(face, box.content);
      return value && (box.label ? `${box.label} ${value}` : value);
    })
    .filter(Boolean)
    .join('. ');
}

/** Text that overflows shrinks no smaller than this, in points on the printed card (LY-4). */
export const MIN_TEXT_PT = 6;

/** The size a text box's text is drawn at, and whether it still overflows there. */
export interface TextFit {
  size: number;
  clipped: boolean;
}

/**
 * Shrink-to-fit (LY-4): the largest size, to within a quarter point, from the
 * box's set size down to `min`, at which `overflowsAt` says the text fits. Text
 * that overflows even at `min` stays at `min` and clips. A box set below `min`
 * never grows.
 */
export function fitTextSize(size: number, overflowsAt: (size: number) => boolean, min = MIN_TEXT_PT): TextFit {
  if (!overflowsAt(size)) return { size, clipped: false };
  const floor = Math.min(size, min);
  if (overflowsAt(floor)) return { size: floor, clipped: true };
  let fits = floor;
  let overflows = size;
  while (overflows - fits > 0.25) {
    const mid = (fits + overflows) / 2;
    if (overflowsAt(mid)) overflows = mid;
    else fits = mid;
  }
  return { size: fits, clipped: false };
}
