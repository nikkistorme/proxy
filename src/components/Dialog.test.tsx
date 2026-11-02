import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Dialog } from './Dialog';
import { isTextField } from './touchScreen';

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

describe('A11Y-12 touch focus', () => {
  afterEach(() => vi.unstubAllGlobals());
  const touch = () => vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(pointer: coarse)', media: query }));
  const view = (field: ReactNode) => (
    <Dialog open title="T" primaryLabel="Done" onClose={() => {}}>
      {field}
    </Dialog>
  );

  // jsdom's showModal() doesn't move focus itself; the e2e spec checks the browser lands on Close.
  it('skips a text field marked data-autofocus', () => {
    touch();
    render(view(<input aria-label="Count" data-autofocus />));
    expect(screen.getByRole('textbox', { name: 'Count' })).not.toHaveFocus();
  });

  it('still focuses a button marked data-autofocus', () => {
    touch();
    render(view(<button type="button" data-autofocus>Go</button>));
    expect(screen.getByRole('button', { name: 'Go' })).toHaveFocus();
  });

  it('focuses the text field on a desktop', () => {
    render(view(<input aria-label="Count" data-autofocus />));
    expect(screen.getByRole('textbox', { name: 'Count' })).toHaveFocus();
  });
});

describe('A11Y-12 isTextField', () => {
  const make = (html: string) => {
    const host = document.createElement('div');
    host.innerHTML = html;
    return host.firstElementChild as Element;
  };

  it.each(['<input>', '<input type="text">', '<input type="search">', '<input type="number">', '<input type="url">', '<input type="email">', '<input type="tel">', '<input type="password">', '<textarea></textarea>'])(
    'is true for %s',
    (html) => expect(isTextField(make(html))).toBe(true),
  );

  it.each(['<input type="radio">', '<input type="checkbox">', '<input type="range">', '<input type="color">', '<input type="file">', '<input type="button">', '<button></button>', '<select></select>'])(
    'is false for %s',
    (html) => expect(isTextField(make(html))).toBe(false),
  );
});
