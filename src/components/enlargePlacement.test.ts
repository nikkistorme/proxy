import { describe, expect, it } from 'vitest';
import { ENLARGE_GAP, enlargeSpot } from './enlargePlacement';

const size = { width: 238, height: 360 };
const view = { width: 1280, height: 800 };
const g = ENLARGE_GAP;

describe('TT-9 enlarge placement', () => {
  it('goes to the right of the card when there is room', () => {
    expect(enlargeSpot({ left: 100, top: 100, width: 126, height: 176 }, size, view)).toEqual({ left: 226 + g, top: 100 });
  });

  it('goes left near the right edge, and stays inside the window', () => {
    expect(enlargeSpot({ left: 1100, top: 700, width: 126, height: 176 }, size, view)).toEqual({ left: 1100 - g - 238, top: 800 - 360 - g });
  });

  it('goes below or above on a narrow phone', () => {
    const phone = { width: 375, height: 1000 };
    expect(enlargeSpot({ left: 120, top: 40, width: 126, height: 176 }, size, phone)).toEqual({ left: 120, top: 216 + g });
    expect(enlargeSpot({ left: 120, top: 600, width: 126, height: 176 }, size, phone)).toEqual({ left: 120, top: 600 - g - 360 });
  });

  it('takes the roomiest side inside the window when none fits', () => {
    const spot = enlargeSpot({ left: 100, top: 200, width: 176, height: 246 }, size, { width: 375, height: 667 });
    expect(spot.left).toBeGreaterThanOrEqual(g);
    expect(spot.left + 238).toBeLessThanOrEqual(375 - g);
    expect(spot.top).toBeGreaterThanOrEqual(g);
  });
});
