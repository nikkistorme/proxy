export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Space kept between the preview, the card and the window edge, in px. */
export const ENLARGE_GAP = 12;

/**
 * TT-9: where the enlarged preview goes, in window px. It sits beside the card,
 * never over it (brief): right, then left, then below, then above, whichever fits
 * first. If none fits, as on a narrow phone with a big card, it takes the side with
 * the most room and stays inside the window.
 */
export function enlargeSpot(card: Box, size: { width: number; height: number }, view: { width: number; height: number }): { left: number; top: number } {
  const g = ENLARGE_GAP;
  const clampX = (x: number) => Math.max(g, Math.min(x, view.width - size.width - g));
  const clampY = (y: number) => Math.max(g, Math.min(y, view.height - size.height - g));
  const room = {
    right: view.width - (card.left + card.width) - 2 * g,
    left: card.left - 2 * g,
    below: view.height - (card.top + card.height) - 2 * g,
    above: card.top - 2 * g,
  };
  const sides = [
    { fits: room.right >= size.width && view.height - 2 * g >= size.height, room: room.right / size.width, spot: { left: card.left + card.width + g, top: clampY(card.top) } },
    { fits: room.left >= size.width && view.height - 2 * g >= size.height, room: room.left / size.width, spot: { left: card.left - g - size.width, top: clampY(card.top) } },
    { fits: room.below >= size.height && view.width - 2 * g >= size.width, room: room.below / size.height, spot: { left: clampX(card.left), top: card.top + card.height + g } },
    { fits: room.above >= size.height && view.width - 2 * g >= size.width, room: room.above / size.height, spot: { left: clampX(card.left), top: card.top - g - size.height } },
  ];
  const fitting = sides.find((side) => side.fits);
  if (fitting) return fitting.spot;
  const roomiest = sides.reduce((best, side) => (side.room > best.room ? side : best));
  return { left: clampX(roomiest.spot.left), top: clampY(roomiest.spot.top) };
}
