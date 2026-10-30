import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import basicJson from '../../tests/fixtures/bundles/basic.json?raw';
import { readBundle } from '../model/bundle';
import { ImportDialogs } from './BundleDialogs';

const read = readBundle(basicJson);
if ('error' in read) throw new Error(read.error);
const pending = { fileName: 'basic.json', bundle: read.bundle };

describe('PS-4 import dialogs', () => {
  it('confirm: says what the file holds and what an import does', () => {
    render(<ImportDialogs pending={pending} error={undefined} onConfirm={() => {}} onClose={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: 'Import basic.json?' });
    expect(dialog).toHaveTextContent('This file holds 1 session, 1 snapshot, 1 card set, 1 layout, 1 format and your settings.');
    expect(dialog).toHaveTextContent('same id are replaced and the rest are added. Nothing else is removed.');
    expect(dialog).toHaveTextContent('Its session replaces this one, and undo history is cleared.');
  });

  it('confirm: Import hands the bundle on', async () => {
    const onConfirm = vi.fn();
    render(<ImportDialogs pending={pending} error={undefined} onConfirm={onConfirm} onClose={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Import' }));
    expect(onConfirm).toHaveBeenCalledWith(pending);
  });

  it('confirm: Cancel changes nothing', async () => {
    const onConfirm = vi.fn();
    const onClose = vi.fn();
    render(<ImportDialogs pending={pending} error={undefined} onConfirm={onConfirm} onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('error: shows the reason with the error icon and label, and OK closes it', async () => {
    const onClose = vi.fn();
    render(<ImportDialogs pending={undefined} error="Couldn't import bad.json. This file isn't a Proxy bundle." onConfirm={() => {}} onClose={onClose} />);
    const dialog = screen.getByRole('dialog', { name: "Can't import" });
    expect(dialog).toHaveTextContent("Error: Couldn't import bad.json. This file isn't a Proxy bundle.");
    expect(dialog.querySelector('.form-error__icon')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
