import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NameDialog } from './NameDialog';

describe('PS-3 name dialog props', () => {
  it('renames by default', () => {
    render(<NameDialog item={{ id: 'a', name: 'Old' }} validateName={() => undefined} onConfirm={() => {}} onClose={() => {}} />);
    expect(screen.getByRole('dialog', { name: 'Rename Old' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Rename' })).toBeInTheDocument();
  });

  it('takes its own title and main button, and Enter saves a preset name straight away', async () => {
    const onConfirm = vi.fn();
    render(
      <NameDialog
        item={{ id: 'new', name: 'Snapshot 1' }}
        title="Save snapshot"
        primaryLabel="Save"
        hint="Enter save · Esc cancel"
        validateName={() => undefined}
        onConfirm={onConfirm}
        onClose={() => {}}
      />,
    );
    expect(screen.getByRole('dialog', { name: 'Save snapshot' })).toBeInTheDocument();
    expect(screen.getByText('Enter save · Esc cancel')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Name' })).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(onConfirm).toHaveBeenCalledWith('Snapshot 1');
  });
});
