import { describe, expect, it } from 'vitest';
import { addedBoxRect, describeBoxPlace, describeBoxSize, isDrawn, MIN_BOX, moveBox, newBox, rectFromPoints, resizeBox, resizeFromCorner } from './layoutBoxes';

const box = { x: 10, y: 20, width: 30, height: 40 };

describe('LY-2 box geometry', () => {
  it('moves a box, keeping it on the card at its size', () => {
    expect(moveBox(box, 1, -1)).toEqual({
      x: 11,
      y: 19,
      width: 30,
      height: 40,
    });
    expect(moveBox(box, -50, 90)).toEqual({
      x: 0,
      y: 60,
      width: 30,
      height: 40,
    });
  });

  it('steps without float drift', () => {
    let moved = { ...box, x: 3.75 };
    for (let i = 0; i < 10; i++) moved = moveBox(moved, 0.1, 0);
    expect(moved.x).toBe(4.75);
  });

  it('resizes from the top-left corner, no smaller than the minimum and no further than the card edge', () => {
    expect(resizeBox(box, 1, -1)).toEqual({
      x: 10,
      y: 20,
      width: 31,
      height: 39,
    });
    expect(resizeBox(box, -40, 0).width).toBe(MIN_BOX);
    expect(resizeBox(box, 100, 100)).toEqual({
      x: 10,
      y: 20,
      width: 90,
      height: 80,
    });
  });

  it('draws a box between two points in any direction, on the card', () => {
    expect(rectFromPoints({ x: 50, y: 60 }, { x: 20, y: 10 })).toEqual({
      x: 20,
      y: 10,
      width: 30,
      height: 50,
    });
    expect(rectFromPoints({ x: 90, y: 90 }, { x: 120, y: -5 })).toEqual({
      x: 90,
      y: 0,
      width: 10,
      height: 90,
    });
  });

  it('keeps a drawn box at least the minimum size, even at the card edge', () => {
    expect(rectFromPoints({ x: 50, y: 50 }, { x: 50.5, y: 49 })).toEqual({
      x: 50,
      y: 48,
      width: MIN_BOX,
      height: MIN_BOX,
    });
    expect(rectFromPoints({ x: 100, y: 0 }, { x: 100, y: 0 })).toEqual({
      x: 98,
      y: 0,
      width: MIN_BOX,
      height: MIN_BOX,
    });
  });

  it('counts a short drag as a click, not a drawn box', () => {
    expect(isDrawn({ x: 10, y: 10 }, { x: 11, y: 30 })).toBe(false);
    expect(isDrawn({ x: 10, y: 10 }, { x: 12, y: 12 })).toBe(true);
  });

  it('resizes from any corner, with the opposite corner fixed', () => {
    expect(resizeFromCorner(box, 'se', 5, 5)).toEqual({
      x: 10,
      y: 20,
      width: 35,
      height: 45,
    });
    expect(resizeFromCorner(box, 'nw', 5, -5)).toEqual({
      x: 15,
      y: 15,
      width: 25,
      height: 45,
    });
    expect(resizeFromCorner(box, 'ne', -40, 0)).toEqual({
      x: 0,
      y: 20,
      width: 10,
      height: 40,
    });
  });

  it('adds boxes in the middle of the card, stepping past boxes already there', () => {
    const first = addedBoxRect([]);
    expect(first).toEqual({ x: 30, y: 40, width: 40, height: 20 });
    expect(addedBoxRect([first])).toEqual({
      x: 32,
      y: 42,
      width: 40,
      height: 20,
    });
  });

  it('makes a new box an empty text box with its own id', () => {
    const a = newBox(box);
    expect(a).toMatchObject({ ...box, content: { kind: 'text', text: '' } });
    expect(newBox(box).id).not.toBe(a.id);
  });

  it('describes where a box is and how big, in whole percent', () => {
    expect(describeBoxPlace({ ...box, x: 3.75 })).toBe('at 4% across, 20% down');
    expect(describeBoxSize(box)).toBe('30% wide, 40% tall');
  });
});
