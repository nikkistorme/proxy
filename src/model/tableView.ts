import { CARD_H, CARD_W, TABLE_GAP, type Box } from './tablePlacement';

/** Zoom levels the buttons and keys step through, as fractions of 100% (TT-1). */
export const ZOOM_STEPS = [0.25, 0.33, 0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2] as const;
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 2;

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** The next zoom step in or out. Between steps (after a pinch), it goes to the nearest step that way. */
export function stepZoom(zoom: number, direction: 'in' | 'out'): number {
  const next = direction === 'in' ? ZOOM_STEPS.find((z) => z > zoom + 0.001) : [...ZOOM_STEPS].reverse().find((z) => z < zoom - 0.001);
  return next ?? zoom;
}

export function zoomPercent(zoom: number): string {
  return `${Math.round(zoom * 100)}%`;
}

export interface Scroll {
  left: number;
  top: number;
}

/**
 * Where to scroll after zooming so the table point under `anchor` (a point in
 * the viewport, in screen px) stays under it.
 */
export function scrollAfterZoom(scroll: Scroll, anchor: { x: number; y: number }, from: number, to: number): Scroll {
  return {
    left: Math.max(0, ((scroll.left + anchor.x) / from) * to - anchor.x),
    top: Math.max(0, ((scroll.top + anchor.y) / from) * to - anchor.y),
  };
}

/**
 * TT-1 fit all: the zoom and scroll that frame every card in a viewport of
 * the given size. It zooms out as far as needed but never in past 100%.
 * Undefined when there is nothing to frame.
 */
export function fitAll(boxes: readonly Box[], viewport: { width: number; height: number }): { zoom: number; scroll: Scroll } | undefined {
  if (boxes.length === 0) return undefined;
  const left = Math.min(...boxes.map((b) => b.left)) - TABLE_GAP;
  const top = Math.min(...boxes.map((b) => b.top)) - TABLE_GAP;
  const width = Math.max(...boxes.map((b) => b.right)) + TABLE_GAP - left;
  const height = Math.max(...boxes.map((b) => b.bottom)) + TABLE_GAP - top;
  const zoom = clampZoom(Math.min(1, viewport.width / width, viewport.height / height));
  // Centre the cards in whatever room is left over.
  return {
    zoom,
    scroll: {
      left: Math.max(0, left * zoom - (viewport.width - width * zoom) / 2),
      top: Math.max(0, top * zoom - (viewport.height - height * zoom) / 2),
    },
  };
}

/**
 * TT-2: the snap grid is half an auto-placement cell, so snapped cards line up
 * with auto-placed rows and columns, or sit halfway between them.
 */
export const GRID_X = (CARD_W + TABLE_GAP) / 2;
export const GRID_Y = (CARD_H + TABLE_GAP) / 2;

/** The grid point nearest a card's top-left corner. Never above or left of the table's edge. */
export function snapToGrid(position: { x: number; y: number }): { x: number; y: number } {
  return {
    x: TABLE_GAP + Math.max(0, Math.round((position.x - TABLE_GAP) / GRID_X)) * GRID_X,
    y: TABLE_GAP + Math.max(0, Math.round((position.y - TABLE_GAP) / GRID_Y)) * GRID_Y,
  };
}
