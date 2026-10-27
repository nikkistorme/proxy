import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { LayoutBox, LayoutDesign } from '../model/layout';
import { CardFace } from './CardFace';

describe('Default card face', () => {
  it('shows name, cost, art, type, text and stats, and names the card for screen readers', () => {
    render(
      <CardFace
        face={{ name: 'Ember Scout', type: 'Unit — Scout', fields: { cost: '2', text: 'Look at the top card.', stats: '2 / 2' } }}
      />,
    );
    const card = screen.getByRole('img', { name: 'Ember Scout. Cost 2. Unit — Scout. Look at the top card.. 2 / 2' });
    expect(card).toHaveTextContent('Ember Scout');
    expect(card).toHaveTextContent('2');
    expect(card).toHaveTextContent('Unit — Scout');
    expect(card).toHaveTextContent('Look at the top card.');
  });

  it('reads the text from text, then rules, then rules text, then card text', () => {
    const { rerender } = render(<CardFace face={{ name: 'A', fields: { rules: 'From rules', 'rules text': 'Not this' } }} />);
    expect(screen.getByRole('img')).toHaveTextContent('From rules');
    rerender(<CardFace face={{ name: 'A', fields: { text: '  ', 'rules text': 'From rules text' } }} />);
    expect(screen.getByRole('img')).toHaveTextContent('From rules text');
    rerender(<CardFace face={{ name: 'A', fields: { 'card text': 'From card text' } }} />);
    expect(screen.getByRole('img')).toHaveTextContent('From card text');
  });

  it('leaves out what the card does not have', () => {
    const { container } = render(<CardFace face={{ name: 'Plain', fields: {} }} />);
    expect(screen.getByRole('img', { name: 'Plain' })).toBeInTheDocument();
    expect(container.querySelectorAll('.card-face__box--text')).toHaveLength(1);
  });

  it('CD-6 shows the art placeholder when the card has no art', () => {
    const { container } = render(<CardFace face={{ name: 'Plain', fields: {} }} />);
    expect(container.querySelector('.card-art--placeholder')).toBeInTheDocument();
  });

  it('shows art from an alternative art column', () => {
    const { container } = render(<CardFace face={{ name: 'A', fields: { 'card art': 'https://example.test/a.png' } }} />);
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://example.test/a.png');
  });

  it('scales to the width it is given, keeping the card ratio', () => {
    render(<CardFace face={{ name: 'A', fields: {} }} width={104} />);
    const card = screen.getByRole('img');
    expect(card.style.width).toBe('104px');
    expect(card.style.height).toBe('146px');
  });
});

const style = { size: 10, weight: 400, align: 'left', valign: 'top', font: 'sans', color: '#000' } as const;

function layoutOf(...boxes: LayoutBox[]): LayoutDesign {
  return { name: 'Test', orientation: 'portrait', boxes };
}

describe('LY-3 boxes bound to a column', () => {
  it('shows a column as text', () => {
    const layout = layoutOf({ id: 'p', x: 0, y: 0, width: 50, height: 10, content: { kind: 'column', columns: ['power'], as: 'text' }, style });
    render(<CardFace face={{ name: 'A', fields: { power: '7' } }} layout={layout} />);
    expect(screen.getByRole('img', { name: '7' })).toHaveTextContent('7');
  });

  it('shows a column as an image, without adding to the card name', () => {
    const layout = layoutOf({ id: 'p', x: 0, y: 0, width: 50, height: 50, content: { kind: 'column', columns: ['portrait'], as: 'image' }, style });
    const { container } = render(<CardFace face={{ name: 'A', fields: { portrait: 'https://example.test/p.png' } }} layout={layout} />);
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://example.test/p.png');
    expect(screen.getByRole('img', { name: '' })).toBeInTheDocument();
  });
});

describe('LY-5 fixed text and colour boxes', () => {
  it('shows fixed text on every card, and a colour box with its background', () => {
    const layout = layoutOf(
      { id: 'band', x: 0, y: 90, width: 100, height: 10, content: { kind: 'color' }, style: { ...style, background: 'rgb(255, 0, 0)' } },
      { id: 'mark', x: 0, y: 0, width: 100, height: 10, content: { kind: 'text', text: 'Prototype' }, style },
    );
    const { container } = render(<CardFace face={{ name: 'A', fields: {} }} layout={layout} />);
    expect(screen.getByRole('img', { name: 'Prototype' })).toHaveTextContent('Prototype');
    const band = container.querySelector<HTMLElement>('.card-face__box:not(.card-face__box--text)');
    expect(band?.style.background).toBe('rgb(255, 0, 0)');
  });
});

describe('LY-6 positions in percentages', () => {
  it('places boxes by percentages of the card and sizes text in points on it', () => {
    const layout = layoutOf({ id: 'p', x: 10, y: 20, width: 30, height: 40, content: { kind: 'text', text: 'Hi' }, style: { ...style, size: 12 } });
    const { container } = render(<CardFace face={{ name: 'A', fields: {} }} layout={layout} width={200} />);
    const box = container.querySelector<HTMLElement>('.card-face__box');
    expect([box?.style.left, box?.style.top, box?.style.width, box?.style.height]).toEqual(['10%', '20%', '30%', '40%']);
    expect(box?.style.fontSize).toBe('calc(12 * var(--card-pt))');
  });
});
