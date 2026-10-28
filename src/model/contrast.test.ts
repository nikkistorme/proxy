import { describe, expect, it } from 'vitest';
import { contrastRatio, contrastWarning, describeRatio, minimumContrast } from './contrast';
import type { LayoutBox } from './layout';
import { newBox } from './layoutBoxes';

const box = (rect: Partial<LayoutBox>, content: LayoutBox['content'], style: Partial<LayoutBox['style']> = {}): LayoutBox => {
  const made = newBox({ x: 10, y: 10, width: 40, height: 20, ...rect });
  return { ...made, content, style: { ...made.style, ...style } };
};
const text = { kind: 'text', text: 'Hero' } as const;

describe('A11Y-9 text contrast in layouts', () => {
  it('works out WCAG contrast ratios', () => {
    expect(contrastRatio('#000', '#fff')).toBeCloseTo(21);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
    expect(contrastRatio('#fff', '#fff')).toBe(1);
    expect(contrastRatio('red', '#fff')).toBeUndefined();
    expect(describeRatio(4.48)).toBe('4.4 to 1');
  });

  it('asks 3:1 of large text and 4.5:1 of the rest', () => {
    const style = newBox({ x: 0, y: 0, width: 10, height: 10 }).style;
    expect(minimumContrast({ ...style, size: 10 })).toBe(4.5);
    expect(minimumContrast({ ...style, size: 18 })).toBe(3);
    expect(minimumContrast({ ...style, size: 14, weight: 700 })).toBe(3);
    expect(minimumContrast({ ...style, size: 14, weight: 600 })).toBe(4.5);
  });

  it('checks text against its own background, a box below that covers it, or the white card', () => {
    expect(contrastWarning([box({}, text, { color: '#777777', background: '#ffffff' })], 0)).toEqual({ ratio: expect.closeTo(4.48, 2), minimum: 4.5 });
    expect(contrastWarning([box({}, text, { color: '#777777', size: 18 })], 0)).toBeUndefined();
    expect(contrastWarning([box({}, text, { color: '#eeeeee' })], 0)).toMatchObject({ minimum: 4.5 });

    const plate = box({ x: 0, y: 0, width: 100, height: 50 }, { kind: 'color' }, { background: '#1e1c1a' });
    const partial = box({ x: 20, y: 0, width: 80, height: 50 }, { kind: 'color' }, { background: '#ffffff' });
    const darkText = box({}, text, { color: '#29303b' });
    // The plate covers the text; the white box below only covers part of it, so the plate counts.
    expect(contrastWarning([plate, partial, darkText], 2)).toMatchObject({ minimum: 4.5 });
    expect(contrastWarning([plate, darkText, partial], 1)).toMatchObject({ minimum: 4.5 });
    expect(contrastWarning([plate, box({}, text, { color: '#ffffff' })], 1)).toBeUndefined();
  });

  it('skips text over art, colours it can’t read, and boxes that aren’t text', () => {
    const art = box({ x: 0, y: 0, width: 100, height: 100 }, { kind: 'column', columns: ['art'], as: 'image' });
    expect(contrastWarning([art, box({}, text, { color: '#ffffff' })], 1)).toBeUndefined();
    expect(contrastWarning([box({}, text, { color: 'rgb(0 0 0)' })], 0)).toBeUndefined();
    expect(contrastWarning([box({}, { kind: 'color' }, { color: '#ffffff' })], 0)).toBeUndefined();
    expect(contrastWarning([box({}, { kind: 'column', columns: ['art'], as: 'image' }, { color: '#ffffff' })], 0)).toBeUndefined();
  });
});
