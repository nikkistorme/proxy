import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { validatePileName } from '../actions/piles';
import { createSession } from '../model/session';
import { SOLO_PVE } from '../model/format';
import { PileNameDialog, type PileNameRequest } from './PileNameDialog';

const session = createSession(SOLO_PVE);
const board = session.piles.find((p) => p.id === 'pile-board');
if (!board) throw new Error('Solo session has a Board cards pile');

function renderDialog(request: PileNameRequest) {
  const user = userEvent.setup();
  const onConfirm = vi.fn();
  const onClose = vi.fn();
  render(
    <PileNameDialog
      request={request}
      seats={session.seats}
      validateName={(name, except) => validatePileName(session, name, except)}
      onConfirm={onConfirm}
      onClose={onClose}
    />,
  );
  return { user, onConfirm, onClose };
}

describe('SP-4 add a pile', () => {
  it('asks for a name and an owner, defaulting to the active seat', async () => {
    const { user, onConfirm, onClose } = renderDialog({ mode: 'add', defaultOwnerId: 'seat-p1' });
    expect(screen.getByRole('dialog', { name: 'Add a pile' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus();
    expect(screen.getByRole('radio', { name: 'Player 1' })).toBeChecked();
    expect(screen.getAllByRole('radio').map((r) => r.closest('label')?.textContent)).toEqual(['Player 1', 'Environment', 'Shared']);

    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Discard');
    await user.click(screen.getByRole('radio', { name: 'Shared' }));
    await user.click(screen.getByRole('button', { name: 'Add pile' }));
    expect(onConfirm).toHaveBeenCalledWith('Discard', undefined);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('passes the chosen seat as owner', async () => {
    const { user, onConfirm } = renderDialog({ mode: 'add', defaultOwnerId: 'seat-p1' });
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Env discard');
    await user.click(screen.getByRole('radio', { name: 'Environment' }));
    await user.keyboard('{Enter}');
    expect(onConfirm).toHaveBeenCalledWith('Env discard', 'seat-env');
  });

  it('refuses a blank or duplicate name and says why', async () => {
    const { user, onConfirm, onClose } = renderDialog({ mode: 'add', defaultOwnerId: undefined });
    expect(screen.getByRole('radio', { name: 'Shared' })).toBeChecked();
    const field = screen.getByRole('textbox', { name: 'Name' });
    await user.click(screen.getByRole('button', { name: 'Add pile' }));
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription('Error: A pile needs a name.');

    await user.type(field, ' board CARDS ');
    await user.click(screen.getByRole('button', { name: 'Add pile' }));
    expect(field).toHaveAccessibleDescription('Error: There is already a pile called Board cards.');
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('SP-4 rename a pile', () => {
  it('starts with the current name selected and renames on Enter', async () => {
    const { user, onConfirm } = renderDialog({ mode: 'rename', pile: board });
    expect(screen.getByRole('dialog', { name: 'Rename Board cards' })).toBeInTheDocument();
    const field = screen.getByRole('textbox', { name: 'Name' });
    expect(field).toHaveValue('Board cards');
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
    await user.keyboard('Shared board{Enter}');
    expect(onConfirm).toHaveBeenCalledWith('Shared board', undefined);
  });

  it("lets a pile keep its own name but not take another's", async () => {
    const { user, onConfirm } = renderDialog({ mode: 'rename', pile: board });
    const field = screen.getByRole('textbox', { name: 'Name' });
    await user.clear(field);
    await user.type(field, 'P1 MAIN DECK');
    await user.tab();
    expect(field).toHaveAccessibleDescription('Error: There is already a pile called P1 main deck.');
    await user.clear(field);
    await user.type(field, 'BOARD CARDS{Enter}');
    expect(onConfirm).toHaveBeenCalledWith('BOARD CARDS', undefined);
  });
});
