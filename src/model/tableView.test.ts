import { describe, expect, it } from 'vitest';
import { cardBox } from './tablePlacement';
import { clampZoom, fitAll, GRID_X, GRID_Y, scrollAfterZoom, snapToGrid, stepZoom, zoomPercent } from './tableView';

const box = (x: number, y: number) => cardBox({ x, y, rotation: 0 });

describe('TT-1 zoom steps', () => {
  it('steps in and out, and stops at 25% and 200%', () => {
    expect(stepZoom(1, 'in')).toBe(1.1);
    expect(stepZoom(1, 'out')).toBe(0.9);
    expect(stepZoom(2, 'in')).toBe(2);
    expect(stepZoom(0.25, 'out')).toBe(0.25);
  });

  it('steps from between steps to the nearest step that way, after a pinch', () => {
    expect(stepZoom(1.2, 'in')).toBe(1.25);
    expect(stepZoom(1.2, 'out')).toBe(1.1);
  });

  it('keeps any zoom within 25% to 200%, and shows it as a whole percentage', () => {
    expect(clampZoom(5)).toBe(2);
    expect(clampZoom(0.01)).toBe(0.25);
    expect(zoomPercent(0.333)).toBe('33%');
  });

  it('keeps the table point under the anchor in place', () => {
    // At 100%, scrolled to 100,50, the anchor at 200,100 is table point 300,150. At 200% that point is at 600,300.
    expect(scrollAfterZoom({ left: 100, top: 50 }, { x: 200, y: 100 }, 1, 2)).toEqual({ left: 400, top: 200 });
    expect(scrollAfterZoom({ left: 0, top: 0 }, { x: 100, y: 100 }, 2, 1)).toEqual({ left: 0, top: 0 });
  });
});

describe('TT-1 fit all', () => {
  it('has nothing to fit on an empty table', () => {
    expect(fitAll([], { width: 800, height: 600 })).toBeUndefined();
  });

  it('never zooms in past 100%, and centres the cards in the spare room', () => {
    const fit = fitAll([box(16, 16)], { width: 800, height: 600 });
    expect(fit?.zoom).toBe(1);
    expect(fit?.scroll).toEqual({ left: 0, top: 0 });
    const far = fitAll([box(1000, 1000)], { width: 800, height: 600 });
    expect(far?.zoom).toBe(1);
    // The card's 158 × 208 frame (with the gap) sits in the middle of the view.
    expect(far?.scroll).toEqual({ left: 984 - (800 - 158) / 2, top: 984 - (600 - 208) / 2 });
  });

  it('zooms out until every card is in view', () => {
    const fit = fitAll([box(16, 16), box(1600, 16)], { width: 860, height: 600 });
    // From x 0 to 1742: half the width fits.
    expect(fit?.zoom).toBeCloseTo(860 / 1742);
    expect(fitAll([box(0, 0), box(20000, 0)], { width: 800, height: 600 })?.zoom).toBe(0.25);
  });
});

describe('TT-2 snap to grid', () => {
  it('snaps a card to the nearest point of a grid half an auto-placement cell wide', () => {
    expect(GRID_X).toBe(71);
    expect(GRID_Y).toBe(96);
    expect(snapToGrid({ x: 16, y: 16 })).toEqual({ x: 16, y: 16 });
    expect(snapToGrid({ x: 120, y: 70 })).toEqual({ x: 16 + 71, y: 16 + 96 });
    expect(snapToGrid({ x: 160, y: 200 })).toEqual({ x: 16 + 142, y: 16 + 192 });
  });

  it('never snaps past the table edge', () => {
    expect(snapToGrid({ x: -300, y: -40 })).toEqual({ x: 16, y: 16 });
  });
});
