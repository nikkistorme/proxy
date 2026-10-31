import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { createSession } from '../model/session';
import { SOLO_PVE } from '../model/format';
import { LoadUrlDialog, type LoadUrlRequest } from './LoadUrlDialog';

const pile = createSession(SOLO_PVE).piles[0] as LoadUrlRequest['pile'];
const PUBLISHED = 'https://docs.google.com/spreadsheets/d/e/2PACX-abc/pub?gid=0&output=csv';

function renderDialog(request: Partial<LoadUrlRequest> = {}, onLoad = vi.fn().mockResolvedValue(undefined)) {
  const user = userEvent.setup();
  const onClose = vi.fn();
  render(<LoadUrlDialog request={{ pile, keepsData: false, ...request }} onLoad={onLoad} onClose={onClose} />);
  return { user, onLoad, onClose };
}

describe('CD-7 Load from URL dialog', () => {
  it('has a URL field with phone-friendly attributes, focused on a desktop', () => {
    renderDialog();
    const field = screen.getByRole('textbox', { name: 'Published CSV address' });
    expect(field).toHaveAttribute('type', 'url');
    expect(field).toHaveAttribute('inputmode', 'url');
    expect(field).toHaveAttribute('autocapitalize', 'off');
    expect(field).toHaveAttribute('spellcheck', 'false');
    expect(field).toHaveFocus();
  });

  it('loads the address and stays open while fetching', async () => {
    let finish: (error?: string) => void = () => undefined;
    const onLoad = vi.fn().mockReturnValue(new Promise((resolve) => (finish = resolve)));
    const { user, onClose } = renderDialog({}, onLoad);
    await user.type(screen.getByRole('textbox'), PUBLISHED);
    await user.keyboard('{Enter}');
    expect(onLoad).toHaveBeenCalledWith(pile.id, PUBLISHED, expect.any(AbortSignal));
    expect(screen.getByRole('button', { name: 'Loading…' })).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    finish();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Load' })).toBeInTheDocument());
  });

  it('aborts the fetch on Cancel', async () => {
    const onLoad = vi.fn().mockReturnValue(new Promise(() => undefined));
    const { user, onClose } = renderDialog({}, onLoad);
    await user.type(screen.getByRole('textbox'), PUBLISHED);
    await user.keyboard('{Enter}');
    const signal = onLoad.mock.calls[0]?.[2] as AbortSignal;
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(signal.aborted).toBe(true);
    expect(onClose).toHaveBeenCalled();
  });

  it('shows a failed fetch under the field and lets the user retry', async () => {
    const onLoad = vi.fn().mockResolvedValueOnce('The server answered 404.').mockResolvedValue(undefined);
    const { user } = renderDialog({}, onLoad);
    await user.type(screen.getByRole('textbox'), PUBLISHED);
    await user.keyboard('{Enter}');
    expect(await screen.findByText(/The server answered 404/)).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveAccessibleDescription('Error: The server answered 404.');
    await user.click(screen.getByRole('button', { name: 'Load' }));
    expect(onLoad).toHaveBeenCalledTimes(2);
  });

  it('refuses text that is not an address without fetching', async () => {
    const { user, onLoad } = renderDialog();
    await user.type(screen.getByRole('textbox'), 'hello{Enter}');
    expect(screen.getByRole('textbox')).toHaveAccessibleDescription(/^Error:/);
    expect(onLoad).not.toHaveBeenCalled();
  });
});

describe('CD-8 edit links', () => {
  it('shows the publish steps and makes no request', async () => {
    const { user, onLoad } = renderDialog();
    await user.type(screen.getByRole('textbox'), 'https://docs.google.com/spreadsheets/d/abc/edit?usp=sharing{Enter}');
    expect(onLoad).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'In the sheet, choose File → Share → Publish to web.',
      'Choose the tab, and choose Comma-separated values (.csv).',
      'Choose Publish.',
      'Copy the link and paste it here.',
    ]);
  });
});

describe('CD-9 CD-11 a pile loaded from a URL', () => {
  it('fills in the URL and shows the fetch time and the Google note', () => {
    renderDialog({ url: PUBLISHED, fetchedAt: Date.UTC(2026, 9, 31, 12, 0) });
    expect(screen.getByRole('textbox')).toHaveValue(PUBLISHED);
    expect(screen.getByText(/Last fetched/)).toHaveTextContent('Google can take a few minutes to update published data after an edit.');
  });

  it('after a failed reload shows the error and that the pile keeps its last good data', () => {
    renderDialog({ url: PUBLISHED, error: 'The server answered 404.', keepsData: true });
    expect(screen.getByRole('textbox')).toHaveValue(PUBLISHED);
    expect(screen.getByText(/The server answered 404/)).toBeInTheDocument();
    expect(screen.getByText('P1 main deck keeps its last good data.')).toBeInTheDocument();
  });
});
