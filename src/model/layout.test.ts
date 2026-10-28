import { describe, expect, it } from 'vitest';
import { faceValue } from './card';
import { boxValue, DEFAULT_LAYOUT, fitTextSize, layoutLabel, MIN_TEXT_PT, type LayoutBox, type LayoutDesign } from './layout';

const style = { size: 10, weight: 400, align: 'left', valign: 'top', font: 'sans', color: '#000' } as const;

function textBox(id: string, x: number, y: number, column: string, label?: string): LayoutBox {
  return { id, x, y, width: 10, height: 10, content: { kind: 'column', columns: [column], as: 'text' }, style, ...(label ? { label } : {}) };
}

describe('LY-3 column values', () => {
  it('reads named columns and fields, trimmed', () => {
    const face = { name: ' Ash ', type: 'Unit', image: 'a.png', fields: { power: ' 3 ' } };
    expect(faceValue(face, 'name')).toBe('Ash');
    expect(faceValue(face, 'type')).toBe('Unit');
    expect(faceValue(face, 'image')).toBe('a.png');
    expect(faceValue(face, 'power')).toBe('3');
    expect(faceValue(face, 'missing')).toBe('');
  });

  it('shows the first listed column that is not empty', () => {
    const face = { name: 'A', fields: { text: ' ', rules: 'Draw a card.' } };
    expect(boxValue(face, { kind: 'column', columns: ['text', 'rules'], as: 'text' })).toBe('Draw a card.');
  });
});

describe('Layout labels', () => {
  it('reads text boxes top to bottom, then left to right, with their labels', () => {
    const layout: LayoutDesign = {
      name: 'Test',
      orientation: 'portrait',
      boxes: [textBox('text', 0, 60, 'text'), textBox('cost', 80, 0, 'cost', 'Cost'), textBox('name', 0, 0, 'name')],
    };
    expect(layoutLabel({ name: 'Ash', fields: { cost: '2', text: 'Go again.' } }, layout)).toBe('Ash. Cost 2. Go again.');
  });

  it('leaves out empty boxes, colour boxes and images', () => {
    expect(layoutLabel({ name: 'Plain', fields: {} }, DEFAULT_LAYOUT)).toBe('Plain');
  });

  it('keeps the default layout label as the default face had it', () => {
    const face = { name: 'Ember Scout', type: 'Unit', fields: { cost: '2', rules: 'Look.', stats: '2 / 2' } };
    expect(layoutLabel(face, DEFAULT_LAYOUT)).toBe('Ember Scout. Cost 2. Unit. Look.. 2 / 2');
  });
});

describe('LY-6 the default layout', () => {
  it('keeps every box on the card', () => {
    for (const box of DEFAULT_LAYOUT.boxes) {
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(100);
      expect(box.y + box.height).toBeLessThanOrEqual(100);
    }
  });
});

describe('LY-4 shrink-to-fit', () => {
  /** Text that fits at `max` points or smaller. */
  const fitsUpTo = (max: number) => (size: number) => size > max;

  it('keeps text that fits at its set size', () => {
    expect(fitTextSize(12, fitsUpTo(20))).toEqual({ size: 12, clipped: false });
  });

  it('shrinks overflowing text to the largest size that fits, to within a quarter point', () => {
    const fit = fitTextSize(14, fitsUpTo(9.6));
    expect(fit.clipped).toBe(false);
    expect(fit.size).toBeLessThanOrEqual(9.6);
    expect(fit.size).toBeGreaterThan(9.6 - 0.25);
  });

  it('stops at the 6 pt minimum and clips', () => {
    expect(MIN_TEXT_PT).toBe(6);
    expect(fitTextSize(14, fitsUpTo(4))).toEqual({ size: 6, clipped: true });
  });

  it('never grows a box set below the minimum', () => {
    expect(fitTextSize(5, fitsUpTo(4))).toEqual({ size: 5, clipped: true });
    expect(fitTextSize(5, fitsUpTo(20))).toEqual({ size: 5, clipped: false });
  });
});
