import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Dialog } from './Dialog';

describe('Dialog', () => {
  it('shows its title, eyebrow and body only while open', () => {
    const { rerender } = render(
      <Dialog open={false} title="Draw from P1 main deck" eyebrow="54 cards" primaryLabel="Done" onClose={() => {}}>
        Body
      </Dialog>,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    rerender(
      <Dialog open title="Draw from P1 main deck" eyebrow="54 cards" primaryLabel="Done" onClose={() => {}}>
        Body
      </Dialog>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Draw from P1 main deck' });
    expect(dialog).toHaveTextContent('54 cards');
    expect(dialog).toHaveTextContent('Body');
  });

  it('focuses the element marked data-autofocus', () => {
    render(
      <Dialog open title="T" primaryLabel="Done" onClose={() => {}}>
        <input aria-label="Count" data-autofocus />
      </Dialog>,
    );
    expect(screen.getByRole('textbox', { name: 'Count' })).toHaveFocus();
  });

  it('closes from the primary, Cancel and close buttons, calling onClose once each time', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const view = (open: boolean) => (
      <Dialog open={open} title="T" primaryLabel="Done" cancelLabel="Cancel" onClose={onClose}>
        Body
      </Dialog>
    );
    const { rerender } = render(view(true));
    for (const name of ['Done', 'Cancel', 'Close']) {
      await user.click(screen.getByRole('button', { name }));
      rerender(view(false));
      rerender(view(true));
    }
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('as a form, submits on Enter and stays open when the submit handler says no', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onSubmit = vi.fn().mockReturnValueOnce(false).mockReturnValueOnce(true);
    render(
      <Dialog open title="T" primaryLabel="Draw" onSubmit={onSubmit} onClose={onClose}>
        <input aria-label="Count" data-autofocus />
      </Dialog>,
    );
    await user.keyboard('{Enter}');
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Draw' }));
    expect(onSubmit).toHaveBeenCalledTimes(2);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores the close event of a dialog opened inside it', async () => {
    const user = userEvent.setup();
    const onOuterClose = vi.fn();
    const onInnerClose = vi.fn();
    render(
      <Dialog open title="Outer" primaryLabel="Done" onClose={onOuterClose}>
        <Dialog open title="Inner" primaryLabel="Close inner" onClose={onInnerClose}>
          Body
        </Dialog>
      </Dialog>,
    );
    await user.click(screen.getByRole('button', { name: 'Close inner' }));
    expect(onInnerClose).toHaveBeenCalledTimes(1);
    // Regression: React passed the inner close event up, which also closed the outer dialog.
    expect(onOuterClose).not.toHaveBeenCalled();
  });
});
