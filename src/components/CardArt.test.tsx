import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CardArt } from './CardArt';

describe('CD-6 card art placeholder', () => {
  it('shows the art with the card name as alt text', () => {
    render(<CardArt name="Ember Imp" image="https://x.test/imp.png" />);
    const art = screen.getByRole('img', { name: 'Ember Imp' });
    expect(art.tagName).toBe('IMG');
    expect(art).toHaveAttribute('src', 'https://x.test/imp.png');
  });

  it('shows a placeholder with the card name when there is no image', () => {
    render(<CardArt name="Ember Imp" />);
    const placeholder = screen.getByRole('img', { name: 'Ember Imp' });
    expect(placeholder.tagName).toBe('DIV');
    expect(placeholder).toHaveTextContent('Ember Imp');
  });

  it('swaps to the placeholder when the image fails to load', () => {
    render(<CardArt name="Ember Imp" image="https://x.test/broken.png" />);
    fireEvent.error(screen.getByRole('img', { name: 'Ember Imp' }));
    const placeholder = screen.getByRole('img', { name: 'Ember Imp' });
    expect(placeholder.tagName).toBe('DIV');
    expect(placeholder).toHaveTextContent('Ember Imp');
  });

  it('tries again when the image URL changes', () => {
    const { rerender } = render(<CardArt name="Ember Imp" image="https://x.test/broken.png" />);
    fireEvent.error(screen.getByRole('img'));
    rerender(<CardArt name="Ember Imp" image="https://x.test/fixed.png" />);
    expect(screen.getByRole('img', { name: 'Ember Imp' })).toHaveAttribute('src', 'https://x.test/fixed.png');
  });
});

describe('PF-1 card art loading', () => {
  it('is lazy-loaded and decoded asynchronously', () => {
    render(<CardArt name="Ember Imp" image="https://x.test/imp.png" />);
    const art = screen.getByRole('img', { name: 'Ember Imp' });
    expect(art).toHaveAttribute('loading', 'lazy');
    expect(art).toHaveAttribute('decoding', 'async');
  });

  it('sets loading before src, as some browsers start loading at src', () => {
    render(<CardArt name="Ember Imp" image="https://x.test/imp.png" />);
    const names = screen.getByRole('img', { name: 'Ember Imp' }).getAttributeNames();
    expect(names.indexOf('loading')).toBeGreaterThanOrEqual(0);
    expect(names.indexOf('loading')).toBeLessThan(names.indexOf('src'));
  });

  it('CD-6 still shows the placeholder when a lazy image fails', () => {
    render(<CardArt name="Ember Imp" image="https://x.test/broken.png" />);
    fireEvent.error(screen.getByRole('img', { name: 'Ember Imp' }));
    expect(screen.getByRole('img', { name: 'Ember Imp' }).tagName).toBe('DIV');
  });
});
