import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { gameWithDeck } from '../actions/testing';
import { MoveDialog, type MoveRequest } from './MoveDialog';
import { moveDestinations } from './moveDestinations';

const game = gameWithDeck();
const cardId = game.piles[0]?.cardIds[0] ?? '';
const request: MoveRequest = { cardId, face: { name: 'Imp', fields: {} }, fromName: 'P1 main deck', options: moveDestinations(game, cardId) };

function renderDialog() {
  const user = userEvent.setup();
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  render(<MoveDialog request={request} onConfirm={onConfirm} onClose={onClose} />);
  const search = screen.getByRole('combobox', { name: 'Find a destination' });
  const selected = () => screen.getByRole('option', { selected: true });
  return { user, onConfirm, onClose, search, selected };
}

describe('SP-8 Move to… dialog', () => {
  it('names the card and where it is, and lists the table, hands and piles in groups', () => {
    const { search, selected } = renderDialog();
    const dialog = screen.getByRole('dialog', { name: 'Imp' });
    expect(dialog).toHaveTextContent('Move card · from P1 main deck');
    expect(search).toHaveFocus();
    expect(screen.getAllByRole('group').map((g) => within(g).getAllByRole('option').length)).toEqual([1, 1, 6]);
    expect(screen.getByRole('group', { name: 'Hands' })).toHaveTextContent("Player 1's hand");
    expect(screen.getByRole('group', { name: 'Piles' })).toHaveTextContent('Board cards — bottom');
    // Without onChooseSpot, choosing a spot isn't offered.
    expect(screen.queryByRole('option', { name: /choose a spot/ })).toBeNull();
    expect(selected()).toHaveAccessibleName('Table — next free spot 0 cards');
    expect(search).toHaveAttribute('aria-activedescendant', selected().id);
    expect(screen.getByRole('button', { name: 'Move to Table — next free spot' })).toBeInTheDocument();
    expect(dialog).toHaveTextContent('8 destinations');
  });

  it('keyboard: type to filter, arrows choose, Enter moves', async () => {
    const { user, onConfirm, onClose, search, selected } = renderDialog();
    await user.type(search, 'board');
    expect(screen.getAllByRole('option')).toHaveLength(2);
    expect(screen.getByRole('status')).toHaveTextContent('2 of 8 destinations match');
    expect(selected().querySelector('mark')).toHaveTextContent('Board');

    await user.keyboard('{ArrowDown}');
    expect(selected()).toHaveTextContent('Board cards — bottom');
    expect(search).toHaveAttribute('aria-activedescendant', selected().id);
    await user.keyboard('{ArrowDown}');
    expect(selected()).toHaveTextContent('Board cards — bottom');
    await user.keyboard('{ArrowUp}');
    expect(selected()).toHaveTextContent('Board cards — top');
    await user.keyboard('{ArrowDown}{Enter}');

    expect(onConfirm).toHaveBeenCalledWith({ zone: 'pile', pileId: 'pile-board', position: 'bottom', faceUp: false });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('mouse: a click chooses a row, keeps focus in the search, and the main button moves', async () => {
    const { user, onConfirm, search } = renderDialog();
    await user.click(screen.getByRole('option', { name: "Player 1's hand 0 cards" }));
    expect(search).toHaveFocus();
    await user.click(screen.getByRole('button', { name: "Move to Player 1's hand" }));
    expect(onConfirm).toHaveBeenCalledWith({ zone: 'hand', seatId: 'seat-p1' });
  });

  it('keeps a card face up on a pile when asked', async () => {
    const { user, onConfirm } = renderDialog();
    await user.click(screen.getByRole('option', { name: /^Environment deck — top/ }));
    await user.click(screen.getByRole('checkbox', { name: 'Keep it face up (piles only)' }));
    await user.click(screen.getByRole('button', { name: 'Move to Environment deck — top' }));
    expect(onConfirm).toHaveBeenCalledWith({ zone: 'pile', pileId: 'pile-env', position: 'top', faceUp: true });
  });

  it('does nothing when no destination matches', async () => {
    const { user, onConfirm, onClose, search } = renderDialog();
    await user.type(search, 'nowhere{Enter}');
    expect(screen.getByRole('listbox')).toHaveTextContent('No destination matches.');
    expect(search).not.toHaveAttribute('aria-activedescendant');
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('cancels without moving', async () => {
    const { user, onConfirm, onClose } = renderDialog();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
