import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';

describe('App shell', () => {
  it('renders a main landmark with the app heading', () => {
    render(<App />);
    const main = screen.getByRole('main');
    expect(main).toContainElement(screen.getByRole('heading', { level: 1, name: 'Proxy' }));
  });
});
