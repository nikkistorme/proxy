import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Pile } from '../model/session';
import { PileCountDialog, type CountRequest } from './PileCountDialog';

const pile = (id: string, name: string, count: number): Pile => ({
  id,
  name,
  cardIds: Array.from({ length: count }, (_, i) => `${id}-${i}`),
  definitionIds: [],
  x: 0,
  y: 0,
});

const main = pile('main', 'P1 main deck', 5);
const board = pile('board', 'Board cards', 2);
const env = pile('env', 'Environment deck', 0);

function renderDialog(request: CountRequest) {
  const user = userEvent.setup();
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  render(<PileCountDialog request={request} onConfirm={onConfirm} onClose={onClose} />);
  return { user, onConfirm, onClose };
}

describe('SP-6 draw N', () => {
  it('asks how many to draw into the hand, starting at 1, and draws on Enter', async () => {
    const { user, onConfirm, onClose } = renderDialog({ mode: 'draw', pile: main, handName: 'Player 1' });
    const dialog = screen.getByRole('dialog', { name: 'Draw from P1 main deck' });
    expect(dialog).toHaveTextContent('5 cards in the pile');
    const field = screen.getByRole('spinbutton', { name: "Cards to draw into Player 1's hand" });
    expect(field).toHaveFocus();
    expect(field).toHaveValue(1);

    await user.keyboard('3{Enter}');
    expect(onConfirm).toHaveBeenCalledWith(3, undefined);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('refuses a number outside 1 to the pile size, and says why', async () => {
    const { user, onConfirm, onClose } = renderDialog({ mode: 'draw', pile: main, handName: 'Player 1' });
    const field = screen.getByRole('spinbutton');
    for (const bad of ['0', '6', '2.5', '']) {
      await user.clear(field);
      if (bad) await user.type(field, bad);
      await user.click(screen.getByRole('button', { name: 'Draw' }));
      expect(field).toHaveAttribute('aria-invalid', 'true');
      expect(field).toHaveAccessibleDescription('Enter a whole number from 1 to 5.');
    }
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('cancels without drawing', async () => {
    const { user, onConfirm, onClose } = renderDialog({ mode: 'draw', pile: main, handName: 'Player 1' });
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('SP-6 mill N', () => {
  it('asks how many and which pile, defaulting to the first other pile', async () => {
    const { user, onConfirm } = renderDialog({ mode: 'mill', pile: main, targets: [board, env] });
    expect(screen.getByRole('dialog', { name: 'Mill from P1 main deck' })).toBeInTheDocument();
    const group = screen.getByRole('group', { name: 'Move them to the top of' });
    expect(group).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Board cards 2 cards' })).toBeChecked();

    await user.click(screen.getByRole('radio', { name: 'Environment deck 0 cards' }));
    await user.clear(screen.getByRole('spinbutton', { name: 'Cards to move' }));
    await user.type(screen.getByRole('spinbutton', { name: 'Cards to move' }), '2');
    await user.click(screen.getByRole('button', { name: 'Move' }));
    expect(onConfirm).toHaveBeenCalledWith(2, 'env');
  });

  it('cannot confirm without a pile to move to', async () => {
    const { user, onConfirm } = renderDialog({ mode: 'mill', pile: main, targets: [] });
    await user.click(screen.getByRole('button', { name: 'Move' }));
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('SP-9 peek N', () => {
  it('asks how many to look at, starting at 3', async () => {
    const { user, onConfirm } = renderDialog({ mode: 'peek', pile: main });
    expect(screen.getByRole('dialog', { name: 'Peek at P1 main deck' })).toBeInTheDocument();
    const field = screen.getByRole('spinbutton', { name: 'Cards to look at' });
    expect(field).toHaveValue(3);
    await user.click(screen.getByRole('button', { name: 'Peek' }));
    expect(onConfirm).toHaveBeenCalledWith(3, undefined);
  });

  it('starts at the pile size when the pile has fewer than 3 cards', () => {
    renderDialog({ mode: 'peek', pile: board });
    expect(screen.getByRole('spinbutton', { name: 'Cards to look at' })).toHaveValue(2);
  });
});
