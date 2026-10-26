import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Menu, type MenuEntry } from './Menu';

function setup() {
  const onClose = vi.fn();
  const onLoad = vi.fn();
  const onDraw = vi.fn();
  const onToggle = vi.fn();
  const entries: MenuEntry[] = [
    { kind: 'item', id: 'load', label: 'Load CSV…', onSelect: onLoad },
    { kind: 'checkbox', id: 'keep', label: 'Keep CSV order', checked: true, onToggle },
    { kind: 'separator', id: 'sep' },
    { kind: 'item', id: 'draw', label: 'Draw 1', shortcut: 'D', onSelect: onDraw },
  ];
  render(
    <>
      <button type="button">Outside</button>
      <div>
        <Menu label="Actions for P1 main deck" header="P1 main deck · Player 1 · 3 cards" entries={entries} onClose={onClose} />
      </div>
    </>,
  );
  return { onClose, onLoad, onDraw, onToggle };
}

describe('Action menu', () => {
  it('focuses the first item and moves with the arrow keys, Home and End', async () => {
    const user = userEvent.setup();
    setup();
    expect(screen.getByRole('menu', { name: 'Actions for P1 main deck' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Load CSV…' })).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(screen.getByRole('menuitemcheckbox', { name: 'Keep CSV order' })).toHaveFocus();
    await user.keyboard('{ArrowDown}{ArrowDown}');
    expect(screen.getByRole('menuitem', { name: 'Load CSV…' })).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('menuitem', { name: 'Draw 1' })).toHaveFocus();
    await user.keyboard('{Home}');
    expect(screen.getByRole('menuitem', { name: 'Load CSV…' })).toHaveFocus();
    await user.keyboard('{End}');
    expect(screen.getByRole('menuitem', { name: 'Draw 1' })).toHaveFocus();
    expect(screen.getByRole('menuitem', { name: 'Draw 1' })).toHaveAttribute('aria-keyshortcuts', 'D');
  });

  it('runs an item and closes', async () => {
    const user = userEvent.setup();
    const { onDraw, onClose } = setup();
    await user.keyboard('{End}{Enter}');
    expect(onDraw).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('toggles a checkbox item without closing', async () => {
    const user = userEvent.setup();
    const { onToggle, onClose } = setup();
    const checkbox = screen.getByRole('menuitemcheckbox', { name: 'Keep CSV order' });
    expect(checkbox).toHaveAttribute('aria-checked', 'true');
    await user.click(checkbox);
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on Escape, on Tab and on a press outside', async () => {
    const user = userEvent.setup();
    const { onClose } = setup();
    await user.keyboard('{Escape}');
    await user.keyboard('{Tab}');
    await user.click(screen.getByRole('button', { name: 'Outside' }));
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('ignores other keys', async () => {
    const user = userEvent.setup();
    const { onClose } = setup();
    await user.keyboard('x');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('menuitem', { name: 'Load CSV…' })).toHaveFocus();
  });
});
