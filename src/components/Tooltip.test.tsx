import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Tooltip, TOOLTIP_DELAY_MS } from './Tooltip';

function setup() {
  render(
    <>
      <button type="button">Before</button>
      <Tooltip label="Undo (Ctrl+Z)">
        <button type="button" aria-label="Undo (Ctrl+Z)">
          ↶
        </button>
      </Tooltip>
    </>,
  );
  return screen.getByRole('button', { name: 'Undo (Ctrl+Z)' });
}

const tip = () => screen.queryByText('Undo (Ctrl+Z)');

describe('Icon button tooltips', () => {
  afterEach(() => vi.useRealTimers());

  it('shows on mouse hover after a short delay, and hides when the pointer leaves', () => {
    vi.useFakeTimers();
    const button = setup();
    fireEvent.pointerEnter(button, { pointerType: 'mouse' });
    expect(tip()).toBeNull();
    act(() => vi.advanceTimersByTime(TOOLTIP_DELAY_MS));
    expect(tip()).toBeInTheDocument();
    expect(tip()?.closest('[aria-hidden="true"]')).not.toBeNull();
    fireEvent.pointerLeave(button, { pointerType: 'mouse' });
    expect(tip()).toBeNull();
  });

  it('does not show for touch', () => {
    vi.useFakeTimers();
    const button = setup();
    fireEvent.pointerEnter(button, { pointerType: 'touch' });
    act(() => vi.advanceTimersByTime(TOOLTIP_DELAY_MS * 2));
    expect(tip()).toBeNull();
  });

  it('shows at once on keyboard focus, hides on Esc and on leaving', async () => {
    const button = setup();
    await userEvent.tab();
    await userEvent.tab();
    expect(button).toHaveFocus();
    expect(tip()).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(tip()).toBeNull();
    expect(button).toHaveFocus();

    await userEvent.tab({ shift: true });
    await userEvent.tab();
    expect(tip()).toBeInTheDocument();
    await userEvent.tab({ shift: true });
    expect(tip()).toBeNull();
  });

  it('leaves the control its own accessible name', () => {
    const button = setup();
    button.focus();
    expect(screen.getAllByRole('button', { name: 'Undo (Ctrl+Z)' })).toHaveLength(1);
  });
});
