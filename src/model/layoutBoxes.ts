import { normaliseColumnName } from '../csv/parseCsv';
import { newItemId } from '../storage/storage';
import type { CardFace } from './card';
import type { BoxContent, LayoutBox } from './layout';

/** The smallest a box gets, in percent of the card on each side (LY-2). */
export const MIN_BOX = 2;
/** How far one arrow key moves or resizes a box with snapping off, in percent of the card (LY-2). */
export const BOX_STEP = 1;
/** The canvas grid's spacing, in percent of the card each way. Boxes snap to it while snapping is on (LY-2). */
export const GRID = 2;

/** A box's place on the card, in percent (LY-6). */
export type BoxRect = Pick<LayoutBox, 'x' | 'y' | 'width' | 'height'>;
export interface Point {
  x: number;
  y: number;
}
export type Corner = 'nw' | 'ne' | 'sw' | 'se';

/** Keeps saved values short, and arrow-key steps free of float drift. */
const tidy = (n: number) => Math.round(n * 100) / 100;
const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

/** The nearest grid line to `n`. */
export const snapToGrid = (n: number) => tidy(Math.round(n / GRID) * GRID);

/** The next grid line past `n` in the direction of `sign`, so a value off the grid steps onto it first. */
function nextLine(n: number, sign: number): number {
  const lines = n / GRID;
  // The small allowance treats values a rounding error off a line as on it.
  return (sign > 0 ? Math.floor(lines + 1e-6) + 1 : Math.ceil(lines - 1e-6) - 1) * GRID;
}

/** The distance from `n` to the next grid line in the direction of `step`, or `step` itself with snapping off. */
function gridStep(n: number, step: number, snap: boolean): number {
  return snap && step !== 0 ? nextLine(n, step) - n : step;
}

/** One arrow-key move: `BOX_STEP` percent, or with snapping on, the top-left corner to the next grid line (LY-2). */
export function stepBox<T extends BoxRect>(box: T, dx: number, dy: number, snap: boolean): T {
  return moveBox(box, gridStep(box.x, dx, snap), gridStep(box.y, dy, snap));
}

/** One Shift + arrow-key resize: `BOX_STEP` percent, or with snapping on, the right or bottom edge to the next grid line (LY-2). */
export function stepSize<T extends BoxRect>(box: T, dw: number, dh: number, snap: boolean): T {
  return resizeBox(box, gridStep(box.x + box.width, dw, snap), gridStep(box.y + box.height, dh, snap));
}

/** A pointer's place, on the nearest grid line each way while snapping is on. */
export function snapPoint(point: Point, snap: boolean): Point {
  return snap ? { x: snapToGrid(point.x), y: snapToGrid(point.y) } : point;
}

/** The box dragged by `dx`, `dy` percent, its top-left corner on the nearest grid line while snapping is on. */
export function dragBox<T extends BoxRect>(box: T, dx: number, dy: number, snap: boolean): T {
  if (!snap) return moveBox(box, dx, dy);
  return moveBox(box, snapToGrid(box.x + dx) - box.x, snapToGrid(box.y + dy) - box.y);
}

/** The box moved by `dx`, `dy` percent, kept on the card at its size. */
export function moveBox<T extends BoxRect>(box: T, dx: number, dy: number): T {
  return {
    ...box,
    x: tidy(clamp(box.x + dx, 0, 100 - box.width)),
    y: tidy(clamp(box.y + dy, 0, 100 - box.height)),
  };
}

/** The box grown by `dw`, `dh` percent from its top-left corner, kept on the card and at least `MIN_BOX`. */
export function resizeBox<T extends BoxRect>(box: T, dw: number, dh: number): T {
  return {
    ...box,
    width: tidy(clamp(box.width + dw, MIN_BOX, 100 - box.x)),
    height: tidy(clamp(box.height + dh, MIN_BOX, 100 - box.y)),
  };
}

/** One side of a rectangle from two points: on the card, at least `MIN_BOX`, grown away from `fixed`. */
function span(fixed: number, moving: number): [number, number] {
  const a = clamp(fixed, 0, 100);
  const b = clamp(moving, 0, 100);
  let start = Math.min(a, b);
  let end = Math.max(a, b);
  if (end - start < MIN_BOX) {
    if (b >= a) end = Math.min(start + MIN_BOX, 100);
    else start = Math.max(end - MIN_BOX, 0);
    if (end - start < MIN_BOX) [start, end] = b >= a ? [100 - MIN_BOX, 100] : [0, MIN_BOX];
  }
  return [tidy(start), tidy(end - start)];
}

/** The box spanning two points, as when drawing one by pointer. */
export function rectFromPoints(fixed: Point, moving: Point): BoxRect {
  const [x, width] = span(fixed.x, moving.x);
  const [y, height] = span(fixed.y, moving.y);
  return { x, y, width, height };
}

/** Whether two points are far enough apart to draw a box, rather than being a click. */
export function isDrawn(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) >= MIN_BOX && Math.abs(a.y - b.y) >= MIN_BOX;
}

/** The box with one corner dragged by `dx`, `dy` percent; the opposite corner stays put. The dragged corner snaps while snapping is on. */
export function resizeFromCorner<T extends BoxRect>(box: T, corner: Corner, dx: number, dy: number, snap = false): T {
  const west = corner === 'nw' || corner === 'sw';
  const north = corner === 'nw' || corner === 'ne';
  const right = box.x + box.width;
  const bottom = box.y + box.height;
  const fixed = { x: west ? right : box.x, y: north ? bottom : box.y };
  const moving = {
    x: (west ? box.x : right) + dx,
    y: (north ? box.y : bottom) + dy,
  };
  return { ...box, ...rectFromPoints(fixed, snapPoint(moving, snap)) };
}

/** A new box's place when added by button: the middle of the card, stepped down and right past boxes already there. Both are on grid lines (LY-2). */
export function addedBoxRect(boxes: readonly BoxRect[]): BoxRect {
  const rect = { x: 30, y: 40, width: 40, height: 20 };
  while (boxes.some((box) => box.x === rect.x && box.y === rect.y) && rect.x + rect.width < 100 && rect.y + rect.height < 100) {
    rect.x += GRID;
    rect.y += GRID;
  }
  return rect;
}

/** A new, empty text box. What it shows is set in the box properties (5g). */
export function newBox(rect: BoxRect): LayoutBox {
  return {
    id: newItemId(),
    ...rect,
    content: { kind: 'text', text: '' },
    style: {
      size: 10,
      weight: 500,
      align: 'left',
      valign: 'top',
      font: 'sans',
      color: '#1e1c1a',
    },
  };
}

const percent = (n: number) => `${Math.round(n)}%`;

/** Where a box is, for its description and announcements. */
export function describeBoxPlace(box: BoxRect): string {
  return `at ${percent(box.x)} across, ${percent(box.y)} down`;
}

/** How big a box is, for its description and announcements. */
export function describeBoxSize(box: BoxRect): string {
  return `${percent(box.width)} wide, ${percent(box.height)} tall`;
}

/** What a box shows, for its name on the canvas (LY-3, LY-5). */
export function describeBoxContent(content: BoxContent): string {
  switch (content.kind) {
    case 'column': {
      const columns = content.columns.length ? content.columns.join(' or ') : 'no column';
      return content.as === 'image' ? `image from ${columns}` : `shows ${columns}`;
    }
    case 'text':
      return content.text.trim() ? `text “${content.text.trim()}”` : 'empty';
    case 'color':
      return 'colour';
  }
}

/** The column names typed in a box's Column field: comma-separated alternatives, matched like CSV headers (CD-2). */
export function parseColumns(text: string): string[] {
  return [...new Set(text.split(',').map(normaliseColumnName).filter(Boolean))];
}

/** A typed hex colour as `#rrggbb`, or undefined if it isn't one. `#rgb` and a missing `#` are accepted. */
export function parseHexColor(text: string): string | undefined {
  const hex = text.trim().replace(/^#/, '').toLowerCase();
  if (/^[0-9a-f]{6}$/.test(hex)) return `#${hex}`;
  if (/^[0-9a-f]{3}$/.test(hex)) return `#${[...hex].map((digit) => digit + digit).join('')}`;
  return undefined;
}

/**
 * The editor's sample card: each column a text box shows reads as its own
 * name in brackets, such as "[cost]", so boxes show their place and style
 * before real cards can be previewed (LY-7).
 */
export function sampleFace(boxes: readonly LayoutBox[]): CardFace {
  const face: CardFace = { name: '', fields: {} };
  for (const { content } of boxes) {
    if (content.kind !== 'column' || content.as !== 'text') continue;
    const column = content.columns[0];
    if (!column || column === 'image') continue;
    const value = `[${column}]`;
    if (column === 'name') face.name = value;
    else if (column === 'layout' || column === 'type') face[column] = value;
    else face.fields[column] = value;
  }
  return face;
}
