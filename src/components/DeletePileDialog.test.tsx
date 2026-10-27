import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Pile } from '../model/game';
import { DeletePileDialog, type DeletePileRequest, type MergePilesRequest } from './DeletePileDialog';

const pile = (id: string, name: string, count: number): Pile => ({
  id,
  name,
  cardIds: Array.from({ length: count }, (_, i) => `${id}-${i}`),
  definitionIds: [],
  x: 0,
  y: 0,
});

function renderDialog(request: DeletePileRequest) {
  const user = userEvent.setup();
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  render(<DeletePileDialog request={request} onConfirm={onConfirm} onClose={onClose} />);
  return { user, onConfirm, onClose };
}

describe('SP-4 delete a pile', () => {
  it('confirms deleting an empty pile', async () => {
    const { user, onConfirm, onClose } = renderDialog({ pile: pile('a', 'Discard', 0), targets: [pile('b', 'Board cards', 1)] });
    const dialog = screen.getByRole('dialog', { name: 'Delete Discard?' });
    expect(dialog).toHaveTextContent('This pile is empty.');
    expect(dialog).not.toHaveTextContent('undo');
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Delete pile' }));
    expect(onConfirm).toHaveBeenCalledWith(undefined);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('asks where the cards go, defaulting to the first other pile', async () => {
    const { user, onConfirm } = renderDialog({
      pile: pile('a', 'P1 main deck', 3),
      targets: [pile('b', 'Board cards', 1), pile('c', 'Environment deck', 0)],
    });
    expect(screen.getByRole('dialog')).toHaveTextContent("It has 3 cards. They'll go to the bottom of the pile you choose.");
    expect(screen.getByRole('group', { name: 'Move its cards to' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Board cards 1 card' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Board cards 1 card' })).toHaveFocus();
    await user.click(screen.getByRole('radio', { name: 'Environment deck 0 cards' }));
    await user.keyboard('{Enter}');
    expect(onConfirm).toHaveBeenCalledWith('c');
  });

  it('cannot delete a pile with cards when there is nowhere to put them', async () => {
    const { user, onConfirm, onClose } = renderDialog({ pile: pile('a', 'P1 main deck', 3), targets: [] });
    await user.click(screen.getByRole('button', { name: 'Delete pile' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('cancels without deleting', async () => {
    const { user, onConfirm, onClose } = renderDialog({ pile: pile('a', 'Discard', 0), targets: [] });
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('TT-4 merge piles', () => {
  function renderMerge(request: MergePilesRequest) {
    const user = userEvent.setup();
    const onMerge = vi.fn();
    const onClose = vi.fn();
    render(<DeletePileDialog request={request} onConfirm={vi.fn()} onMerge={onMerge} onClose={onClose} />);
    return { user, onMerge, onClose };
  }
  const request: MergePilesRequest = { mode: 'merge', pile: pile('a', 'Env discard', 2), other: pile('b', 'P1 main deck', 10) };

  it('deletes the dragged pile and puts its cards on top by default', async () => {
    const { user, onMerge, onClose } = renderMerge(request);
    const dialog = screen.getByRole('dialog', { name: 'Merge Env discard and P1 main deck?' });
    expect(dialog).toHaveTextContent('Env discard will be deleted, and its 2 cards will go to the top of P1 main deck.');
    expect(screen.getByRole('radio', { name: 'Env discard 2 cards' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Env discard 2 cards' })).toHaveFocus();
    expect(screen.getByRole('radio', { name: 'Top' })).toBeChecked();
    await user.keyboard('{Enter}');
    expect(onMerge).toHaveBeenCalledWith({ fromPileId: 'a', intoPileId: 'b', end: 'top' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('can delete the other pile instead, and put the cards on the bottom', async () => {
    const { user, onMerge } = renderMerge(request);
    await user.click(screen.getByRole('radio', { name: 'P1 main deck 10 cards' }));
    expect(screen.getByRole('group', { name: 'Put its cards on Env discard' })).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Bottom' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('P1 main deck will be deleted, and its 10 cards will go to the bottom of Env discard.');
    await user.click(screen.getByRole('button', { name: 'Merge piles' }));
    expect(onMerge).toHaveBeenCalledWith({ fromPileId: 'b', intoPileId: 'a', end: 'bottom' });
  });

  it('cancels without merging', async () => {
    const { user, onMerge, onClose } = renderMerge(request);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onMerge).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
