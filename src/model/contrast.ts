import type { LayoutBox } from './layout';
import { parseHexColor } from './layoutBoxes';

/** What's under a box with no background of its own or below it: an empty card is drawn white. */
const CARD_COLOR = '#ffffff';

/** A hex colour's relative luminance (WCAG 2.2). */
function luminance(hex: string): number {
  const linear = (at: number) => {
    const channel = parseInt(hex.slice(at, at + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(1) + 0.7152 * linear(3) + 0.0722 * linear(5);
}

/** The contrast ratio of two colours, from 1 to 21, or undefined if either isn't a hex colour. */
export function contrastRatio(a: string, b: string): number | undefined {
  const first = parseHexColor(a);
  const second = parseHexColor(b);
  if (!first || !second) return undefined;
  const [x, y] = [luminance(first), luminance(second)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** WCAG large text: 18 pt, or 14 pt and bold. Large text needs 3:1, other text 4.5:1 (1.4.3). */
export function minimumContrast(style: LayoutBox['style']): number {
  const large = style.size >= 18 || (style.size >= 14 && style.weight >= 700);
  return large ? 3 : 4.5;
}

const covers = (outer: LayoutBox, inner: LayoutBox) =>
  outer.x <= inner.x && outer.y <= inner.y && outer.x + outer.width >= inner.x + inner.width && outer.y + outer.height >= inner.y + inner.height;

/**
 * The colour behind a box's text: its own background, else that of the
 * nearest box drawn below it that covers it, else the card's. Undefined when
 * that's an image, whose colours can't be known.
 */
function backdrop(boxes: readonly LayoutBox[], text: LayoutBox, index: number): string | undefined {
  for (let at = index; at >= 0; at--) {
    const box = boxes[at];
    if (!box || (at !== index && !covers(box, text))) continue;
    if (box.content.kind === 'column' && box.content.as === 'image') return undefined;
    if (box.style.background) return box.style.background;
  }
  return CARD_COLOR;
}

export interface ContrastWarning {
  ratio: number;
  minimum: number;
}

/** A text box whose text fails contrast against what's behind it (A11Y-9), or undefined if it passes or can't be checked. */
export function contrastWarning(boxes: readonly LayoutBox[], index: number): ContrastWarning | undefined {
  const box = boxes[index];
  if (!box || !(box.content.kind === 'text' || (box.content.kind === 'column' && box.content.as === 'text'))) return undefined;
  const behind = backdrop(boxes, box, index);
  if (!behind) return undefined;
  const ratio = contrastRatio(box.style.color, behind);
  if (ratio === undefined) return undefined;
  const minimum = minimumContrast(box.style);
  return ratio < minimum ? { ratio, minimum } : undefined;
}

/** A ratio as WCAG writes it, rounded down so a failing ratio never reads as passing: "4.4 to 1". */
export function describeRatio(ratio: number): string {
  return `${Math.floor(ratio * 10) / 10} to 1`;
}
