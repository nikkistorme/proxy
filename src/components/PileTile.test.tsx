import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Pile } from '../model/game';
import { PileTile } from './PileTile';

const pile = (count: number, extra: Partial<Pile> = {}): Pile => ({
  id: 'pile-1',
  name: 'P1 main deck',
  ownerSeatId: 'seat-p1',
  cardIds: Array.from({ length: count }, (_, i) => `c${i}`),
  definitionIds: [],
  ...extra,
});

function renderTile(p: Pile, props: Partial<Parameters<typeof PileTile>[0]> = {}) {
  const onOpenMenu = vi.fn();
  const registerTile = vi.fn();
  render(<PileTile pile={p} ownerName="Player 1" revealedTop={undefined} menuOpen={false} onOpenMenu={onOpenMenu} registerTile={registerTile} {...props} />);
  return { onOpenMenu, registerTile };
}

describe('SP-5 pile tile', () => {
  it('shows the name and count, face down, and names the owner', () => {
    renderTile(pile(24));
    const button = screen.getByRole('button', { name: 'P1 main deck, 24 cards, Player 1' });
    expect(button).toHaveTextContent('P1 main deck 24');
    expect(button).toHaveAttribute('aria-haspopup', 'menu');
    expect(button).toHaveAttribute('aria-expanded', 'false');
  });

  it('says shared for a pile with no owner, and uses singular for one card', () => {
    renderTile(pile(1, { ownerSeatId: undefined }), { ownerName: undefined });
    expect(screen.getByRole('button', { name: 'P1 main deck, 1 card, shared' })).toBeInTheDocument();
  });

  it('shows an empty pile as an outline', () => {
    renderTile(pile(0));
    expect(screen.getByRole('button', { name: 'P1 main deck, empty, 0 cards, Player 1' })).toHaveTextContent('Empty 0');
  });

  it('shows a revealed top card face up and names it', () => {
    renderTile(pile(3), { revealedTop: { name: 'Imp', fields: {} } });
    const button = screen.getByRole('button', { name: 'P1 main deck, 3 cards, Player 1, top card face up: Imp' });
    // The face is drawn under the button; the button itself holds only the plate.
    expect(button).toHaveTextContent('P1 main deck 3');
    expect(document.querySelector('.pile-tile__top .card-face')).toHaveTextContent('Imp');
  });

  it('opens its menu on click and registers its button for focus return', async () => {
    const { onOpenMenu, registerTile } = renderTile(pile(2), { menuOpen: true });
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(button);
    expect(onOpenMenu).toHaveBeenCalledTimes(1);
    expect(registerTile).toHaveBeenCalledWith('pile-1', button);
  });
});
