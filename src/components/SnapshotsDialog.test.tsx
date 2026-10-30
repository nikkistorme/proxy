import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { testContext } from '../actions/testing';
import { PVP_1V1, SOLO_PVE } from '../model/format';
import { createSession } from '../model/session';
import type { NewItem } from '../storage/storage';
import { createSessionStore, SessionStoreProvider } from '../store/sessionStore';
import type { SnapshotItem } from '../store/snapshotItem';
import { formatSavedAt, SnapshotsDialog } from './SnapshotsDialog';

const solo = createSession(SOLO_PVE);
const pvp = createSession(PVP_1V1);

function snap(id: string, name: string, savedAt: number, state = solo): NewItem<SnapshotItem> {
  return { id, name, state, log: [{ id: 1, text: `Rolled ${name}`, at: savedAt }], savedAt };
}

const oldest = snap('a', 'Opening', Date.UTC(2026, 9, 29, 10));
const middle = snap('b', 'Turn 4, before combat', Date.UTC(2026, 9, 29, 12), pvp);
const newest = snap('c', 'Endgame', Date.UTC(2026, 9, 29, 14));

function renderDialog(initial: NewItem<SnapshotItem>[]) {
  const user = userEvent.setup();
  const store = createSessionStore(createSession(SOLO_PVE), testContext());
  const handlers = { onRename: vi.fn(), onDelete: vi.fn(), onLoaded: vi.fn(), onClose: vi.fn() };
  const view = render(
    <SessionStoreProvider store={store}>
      <SnapshotsDialog open snapshots={initial} {...handlers} />
    </SessionStoreProvider>,
  );
  const again = (next: NewItem<SnapshotItem>[]) =>
    view.rerender(
      <SessionStoreProvider store={store}>
        <SnapshotsDialog open snapshots={next} {...handlers} />
      </SessionStoreProvider>,
    );
  return { user, store, again, ...handlers };
}

describe('PS-3 snapshots dialog', () => {
  it('lists snapshots newest first with when they were saved and their format', () => {
    renderDialog([oldest, newest, middle]);
    const rows = within(screen.getByRole('list', { name: 'Snapshots, newest first' })).getAllByRole('listitem');
    expect(rows.map((row) => row.querySelector('.snapshots__name')?.textContent)).toEqual(['Endgame', 'Turn 4, before combat', 'Opening']);
    expect(rows[1]).toHaveTextContent(`${formatSavedAt(middle.savedAt)} · ${PVP_1V1.name}`);
    expect(rows[0]).toHaveTextContent(SOLO_PVE.name);
    expect(screen.getByRole('button', { name: 'Load Turn 4, before combat' })).toBeInTheDocument();
  });

  it('says there are none and how to save one', () => {
    renderDialog([]);
    expect(screen.getByText(/No snapshots yet\./)).toHaveTextContent('Save snapshot…');
  });

  it('Load loads the snapshot through the store and asks to close', async () => {
    const { user, store, onLoaded } = renderDialog([oldest, middle]);
    await user.click(screen.getByRole('button', { name: 'Load Turn 4, before combat' }));
    expect(store.getState().session).toBe(middle.state);
    expect(store.getState().log).toBe(middle.log);
    expect(store.getState().announcement.text).toBe('Loaded snapshot Turn 4, before combat.');
    expect(onLoaded).toHaveBeenCalled();
  });

  it('Rename asks for a new name and announces it', async () => {
    const { user, store, onRename } = renderDialog([oldest]);
    await user.click(screen.getByRole('button', { name: 'Rename Opening' }));
    const field = screen.getByRole('textbox', { name: 'Name' });
    await user.clear(field);
    await user.type(field, 'Setup done');
    await user.click(screen.getByRole('button', { name: 'Rename' }));
    expect(onRename).toHaveBeenCalledWith({ ...oldest, name: 'Setup done' });
    expect(store.getState().announcement.text).toBe('Renamed snapshot Opening to Setup done.');
  });

  it('Rename needs a name of at most 60 characters', async () => {
    const { user, onRename } = renderDialog([oldest]);
    await user.click(screen.getByRole('button', { name: 'Rename Opening' }));
    const field = screen.getByRole('textbox', { name: 'Name' });
    await user.clear(field);
    await user.click(screen.getByRole('button', { name: 'Rename' }));
    expect(screen.getByText(/A snapshot needs a name/)).toBeInTheDocument();
    await user.type(field, 'x'.repeat(61));
    await user.click(screen.getByRole('button', { name: 'Rename' }));
    expect(screen.getByText(/at most 60 characters/)).toBeInTheDocument();
    expect(onRename).not.toHaveBeenCalled();
  });

  it('Delete asks first, announces, and moves focus to the next row, then the previous, then the dialog', async () => {
    const { user, store, again, onDelete } = renderDialog([oldest, middle, newest]);
    await user.click(screen.getByRole('button', { name: 'Delete Endgame' }));
    expect(screen.getByRole('dialog', { name: 'Delete snapshot Endgame?' })).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onDelete).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Delete Endgame' }));
    await user.click(screen.getByRole('button', { name: 'Delete snapshot' }));
    expect(onDelete).toHaveBeenCalledWith('c');
    expect(store.getState().announcement.text).toBe('Deleted snapshot Endgame.');
    again([oldest, middle]);
    expect(screen.getByRole('button', { name: 'Delete Turn 4, before combat' })).toHaveFocus();

    // The last row has no next row, so the previous one takes focus.
    await user.click(screen.getByRole('button', { name: 'Delete Opening' }));
    await user.click(screen.getByRole('button', { name: 'Delete snapshot' }));
    again([middle]);
    expect(screen.getByRole('button', { name: 'Delete Turn 4, before combat' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Delete Turn 4, before combat' }));
    await user.click(screen.getByRole('button', { name: 'Delete snapshot' }));
    again([]);
    expect(screen.getByText(/No snapshots yet\./)).toHaveFocus();
  });
});
