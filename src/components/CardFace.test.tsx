import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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

  it('reads the text from text, then rules, then rules text', () => {
    const { rerender } = render(<CardFace face={{ name: 'A', fields: { rules: 'From rules', 'rules text': 'Not this' } }} />);
    expect(screen.getByRole('img')).toHaveTextContent('From rules');
    rerender(<CardFace face={{ name: 'A', fields: { text: '  ', 'rules text': 'From rules text' } }} />);
    expect(screen.getByRole('img')).toHaveTextContent('From rules text');
  });

  it('leaves out what the card does not have', () => {
    const { container } = render(<CardFace face={{ name: 'Plain', fields: {} }} />);
    expect(screen.getByRole('img', { name: 'Plain' })).toBeInTheDocument();
    expect(container.querySelector('.card-face__cost, .card-face__type, .card-face__stats')).toBeNull();
  });

  it('scales to the width it is given, keeping the card ratio', () => {
    render(<CardFace face={{ name: 'A', fields: {} }} width={104} />);
    const card = screen.getByRole('img');
    expect(card.style.width).toBe('104px');
    expect(card.style.height).toBe('146px');
  });
});
