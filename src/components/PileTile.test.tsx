import { createEvent, fireEvent, render, screen } from '@testing-library/react';
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
  x: 0,
  y: 0,
  ...extra,
});

function renderTile(p: Pile, props: Partial<Parameters<typeof PileTile>[0]> = {}) {
  const onOpenMenu = vi.fn();
  const registerTile = vi.fn();
  const onDropFile = vi.fn();
  const onDraw = vi.fn();
  const { container } = render(
    <PileTile
      pile={p}
      ownerName="Player 1"
      revealedTop={undefined}
      menuOpen={false}
      onOpenMenu={onOpenMenu}
      onDraw={onDraw}
      registerTile={registerTile}
      onDropFile={onDropFile}
      {...props}
    />,
  );
  return { onOpenMenu, onDraw, registerTile, onDropFile, tile: container.querySelector('.pile-tile') as HTMLElement };
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

  it('closes its open menu on click and registers its button for focus return', async () => {
    const { onOpenMenu, onDraw, registerTile } = renderTile(pile(2), { menuOpen: true });
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-expanded', 'true');
    await userEvent.click(button);
    expect(onOpenMenu).toHaveBeenCalledTimes(1);
    expect(onDraw).not.toHaveBeenCalled();
    expect(registerTile).toHaveBeenCalledWith('pile-1', button);
  });

  it('draws on click, and opens its menu on right-click, Enter, the menu key or Shift+F10', async () => {
    const user = userEvent.setup();
    const { onOpenMenu, onDraw } = renderTile(pile(2));
    const button = screen.getByRole('button');
    await user.click(button);
    expect(onDraw).toHaveBeenCalledTimes(1);
    expect(onOpenMenu).not.toHaveBeenCalled();
    await user.pointer({ keys: '[MouseRight]', target: button });
    expect(onOpenMenu).toHaveBeenCalledTimes(1);
    button.focus();
    await user.keyboard('{Enter}{ContextMenu}{Shift>}{F10}{/Shift}');
    expect(onOpenMenu).toHaveBeenCalledTimes(4);
    // Enter doesn't click the button, so nothing more is drawn.
    expect(onDraw).toHaveBeenCalledTimes(1);
  });
});

describe('SP-1 drop a CSV on a pile', () => {
  const fileDrag = (files: File[] = []) => ({ dataTransfer: { types: ['Files'], files, dropEffect: 'none' } });

  it('highlights while a file is over it and loads the dropped file', () => {
    const { tile, onDropFile } = renderTile(pile(3));
    const file = new File(['name\nImp\n'], 'deck.csv', { type: 'text/csv' });

    const enter = createEvent.dragEnter(tile, fileDrag());
    fireEvent(tile, enter);
    expect(enter.defaultPrevented).toBe(true);
    expect(tile).toHaveClass('pile-tile--drop-target');
    expect(tile).toHaveTextContent('Drop to load');

    // Moving over a child fires another enter and a leave; the highlight stays.
    fireEvent.dragEnter(tile, fileDrag());
    fireEvent.dragLeave(tile);
    expect(tile).toHaveClass('pile-tile--drop-target');

    const over = createEvent.dragOver(tile, fileDrag());
    fireEvent(tile, over);
    expect(over.defaultPrevented).toBe(true);

    fireEvent.drop(tile, fileDrag([file]));
    expect(onDropFile).toHaveBeenCalledWith('pile-1', file);
    expect(tile).not.toHaveClass('pile-tile--drop-target');
  });

  it('clears the highlight when the drag leaves', () => {
    const { tile } = renderTile(pile(3));
    fireEvent.dragEnter(tile, fileDrag());
    fireEvent.dragLeave(tile);
    expect(tile).not.toHaveClass('pile-tile--drop-target');
  });

  it('ignores drags that carry no files', () => {
    const { tile, onDropFile } = renderTile(pile(3));
    const textDrag = { dataTransfer: { types: ['text/plain'], files: [] } };
    fireEvent.dragEnter(tile, textDrag);
    const over = createEvent.dragOver(tile, textDrag);
    fireEvent(tile, over);
    fireEvent.drop(tile, textDrag);
    expect(over.defaultPrevented).toBe(false);
    expect(tile).not.toHaveClass('pile-tile--drop-target');
    expect(onDropFile).not.toHaveBeenCalled();
  });
});
