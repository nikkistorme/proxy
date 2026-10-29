import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { testContext } from '../actions/testing';
import { SessionScreen } from '../components/SessionScreen';
import { PVP_1V1, SOLO_PVE } from '../model/format';
import { createSession } from '../model/session';
import { memoryBackend } from '../storage/backends';
import { itemKey, SAVE_VERSION } from '../storage/storage';
import { StorageProvider } from '../storage/StorageProvider';
import { createSessionStore, SessionStoreProvider } from '../store/sessionStore';
import FormatsScreen from './FormatsScreen';
import { FormatsProvider } from './FormatsProvider';

const formatKey = (id: string) => itemKey(import.meta.env.BASE_URL, 'guest', 'format', id);
const saved = (id: string, name: string) => ({ ...PVP_1V1, id, name, updatedAt: '', version: SAVE_VERSION });

/** The Formats screen over memory storage seeded with `items`, once the saved formats are read. */
async function setup(items: Record<string, unknown> = {}) {
  const backend = memoryBackend(items);
  const list = vi.spyOn(backend, 'keys');
  const onClose = vi.fn();
  const user = userEvent.setup();
  render(
    <StorageProvider backend={backend}>
      <FormatsProvider>
        <FormatsScreen onClose={onClose} />
      </FormatsProvider>
    </StorageProvider>,
  );
  await waitFor(() => expect(list).toHaveBeenCalled());
  return { user, onClose, backend };
}

const screenDialog = () => screen.getByRole('dialog', { name: 'Formats' });
const list = () => within(screenDialog()).getByRole('list', { name: 'Formats' });
const names = () => within(list()).getAllByRole('listitem').map((row) => row.querySelector('.layout-list__name')?.textContent);
const status = () => within(screenDialog()).getByRole('status');

describe('FS-2 formats list', () => {
  it('lists the presets first, read-only with Duplicate, then saved formats sorted by name', async () => {
    await setup({ [formatKey('f-b')]: saved('f-b', 'banana 10'), [formatKey('f-a')]: saved('f-a', 'Apple'), [formatKey('f-c')]: saved('f-c', 'banana 2') });
    await waitFor(() => expect(names()).toEqual(['Solo PvE', 'Co-op PvE', '1v1 PvP', 'Apple', 'banana 2', 'banana 10']));
    const rows = within(list()).getAllByRole('listitem');
    const [, , preset, savedRow] = rows;
    if (!preset || !savedRow) throw new Error('No rows');
    expect(within(preset).getByText('Built in')).toBeInTheDocument();
    expect(within(preset).getByText(/Piles: P1 main deck, P2 main deck, Board cards/)).toBeInTheDocument();
    expect(within(preset).getAllByRole('button').map((b) => b.getAttribute('aria-label'))).toEqual(['Edit a copy of 1v1 PvP']);
    expect(within(savedRow).getAllByRole('button').map((b) => b.textContent)).toEqual(['Edit', 'Rename', 'Duplicate', 'Delete']);
    expect(screen.getByRole('button', { name: 'Back to table' })).toHaveFocus();
  });

  it('duplicates a saved format, saves the copy, announces it and focuses its Rename button', async () => {
    const { user, backend } = await setup({ [formatKey('f-a')]: saved('f-a', 'Apple') });
    await waitFor(() => expect(names()).toContain('Apple'));
    await user.click(screen.getByRole('button', { name: 'Duplicate Apple' }));
    expect(names()).toEqual(['Solo PvE', 'Co-op PvE', '1v1 PvP', 'Apple', 'Apple copy']);
    expect(status()).toHaveTextContent('Duplicated Apple as Apple copy.');
    expect(screen.getByRole('button', { name: 'Rename Apple copy' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Duplicate Apple' }));
    expect(names()).toContain('Apple copy 2');
    await waitFor(() => expect([...backend.data.keys()].filter((k) => k.includes('|format|'))).toHaveLength(3), { timeout: 3000 });
  });

  it('renames a saved format, refusing empty and taken names', async () => {
    const { user } = await setup({ [formatKey('f-a')]: saved('f-a', 'Apple') });
    await waitFor(() => expect(names()).toContain('Apple'));
    await user.click(screen.getByRole('button', { name: 'Rename Apple' }));
    const rename = screen.getByRole('dialog', { name: 'Rename Apple' });
    const field = within(rename).getByRole('textbox', { name: 'Name' });
    await user.clear(field);
    await user.type(field, 'solo pve');
    await user.keyboard('{Enter}');
    expect(within(rename).getByText('Error:')).toBeInTheDocument();
    expect(rename).toHaveTextContent('There is already a format called Solo PvE.');
    await user.clear(field);
    await user.keyboard('{Enter}');
    expect(rename).toHaveTextContent('A format needs a name.');
    await user.type(field, 'Cherry{Enter}');
    expect(names()).toEqual(['Solo PvE', 'Co-op PvE', '1v1 PvP', 'Cherry']);
    expect(status()).toHaveTextContent('Renamed Apple to Cherry.');
    expect(screen.getByRole('button', { name: 'Rename Cherry' })).toHaveFocus();
  });

  it('asks before deleting; Cancel keeps it and returns focus to Delete', async () => {
    const { user } = await setup({ [formatKey('f-a')]: saved('f-a', 'Apple') });
    await waitFor(() => expect(names()).toContain('Apple'));
    await user.click(screen.getByRole('button', { name: 'Delete Apple' }));
    const confirm = screen.getByRole('dialog', { name: 'Delete Apple?' });
    expect(confirm).toHaveTextContent('Sessions already started keep their seats and piles.');
    await user.click(within(confirm).getByRole('button', { name: 'Cancel' }));
    expect(names()).toContain('Apple');
    expect(screen.getByRole('button', { name: 'Delete Apple' })).toHaveFocus();
  });

  it('deletes, then focuses the next row, else the one before, else the last preset’s Duplicate', async () => {
    const { user, backend } = await setup({ [formatKey('f-a')]: saved('f-a', 'Apple'), [formatKey('f-b')]: saved('f-b', 'Berry') });
    await waitFor(() => expect(names()).toContain('Berry'));
    await user.click(screen.getByRole('button', { name: 'Delete Apple' }));
    await user.click(screen.getByRole('button', { name: 'Delete format' }));
    expect(status()).toHaveTextContent('Deleted Apple.');
    expect(screen.getByRole('button', { name: 'Rename Berry' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Delete Berry' }));
    await user.click(screen.getByRole('button', { name: 'Delete format' }));
    expect(names()).toEqual(['Solo PvE', 'Co-op PvE', '1v1 PvP']);
    expect(screen.getByRole('button', { name: 'Edit a copy of 1v1 PvP' })).toHaveFocus();
    await waitFor(() => expect([...backend.data.keys()].some((k) => k.includes('|format|'))).toBe(false));
  });

  it('Back to table closes it', async () => {
    const { user, onClose } = await setup();
    await user.click(screen.getByRole('button', { name: 'Back to table' }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('FS-2 Edit a copy and the editor', () => {
  it('a preset’s Edit a copy saves a copy and opens it in the editor; Back returns to its Edit button', async () => {
    const { user, backend } = await setup();
    await user.click(screen.getByRole('button', { name: 'Edit a copy of 1v1 PvP' }));
    expect(screen.getByRole('textbox', { name: 'Seat 1 name' })).toHaveValue('Player 1');
    expect(screen.getByRole('heading', { name: '1v1 PvP copy' })).toBeInTheDocument();
    expect(status()).toHaveTextContent('Duplicated 1v1 PvP as 1v1 PvP copy. Editing 1v1 PvP copy.');
    expect(screen.getByRole('button', { name: 'Back to formats' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Back to formats' }));
    expect(names()).toEqual(['Solo PvE', 'Co-op PvE', '1v1 PvP', '1v1 PvP copy']);
    expect(screen.getByRole('button', { name: 'Edit 1v1 PvP copy' })).toHaveFocus();
    await waitFor(() => expect([...backend.data.keys()].filter((k) => k.includes('|format|'))).toHaveLength(1), { timeout: 3000 });
  });

  it('Edit opens a saved format; the dialog’s cancel (Esc) goes back to the list, not out of the screen', async () => {
    const { user, onClose } = await setup({ [formatKey('f-a')]: saved('f-a', 'Apple') });
    await waitFor(() => expect(names()).toContain('Apple'));
    await user.click(screen.getByRole('button', { name: 'Edit Apple' }));
    expect(status()).toHaveTextContent('Editing Apple.');
    // jsdom doesn't turn Esc into a cancel event; the E2E test presses the key.
    fireEvent(screenDialog(), new Event('cancel', { cancelable: true }));
    expect(names()).toContain('Apple');
    expect(screen.getByRole('button', { name: 'Edit Apple' })).toHaveFocus();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('FS-2 opening the Formats screen', () => {
  async function renderSession(items: Record<string, unknown> = {}) {
    const store = createSessionStore(createSession(SOLO_PVE), testContext());
    const user = userEvent.setup();
    render(
      <StorageProvider backend={memoryBackend(items)}>
        <FormatsProvider>
          <SessionStoreProvider store={store}>
            <SessionScreen />
          </SessionStoreProvider>
        </FormatsProvider>
      </StorageProvider>,
    );
    await user.click(screen.getByRole('button', { name: 'This session' }));
    await user.click(screen.getByRole('menuitem', { name: 'New session…' }));
    return user;
  }

  it('has no Formats button in the toolbar (UI-3)', () => {
    render(
      <StorageProvider backend={memoryBackend()}>
        <FormatsProvider>
          <SessionStoreProvider store={createSessionStore(createSession(SOLO_PVE), testContext())}>
            <SessionScreen />
          </SessionStoreProvider>
        </FormatsProvider>
      </StorageProvider>,
    );
    expect(screen.queryByRole('button', { name: /^Formats/ })).not.toBeInTheDocument();
  });

  it('Edit formats… opens it, and Back to New session returns to the dialog on the same choice', async () => {
    const user = await renderSession();
    await user.click(screen.getByRole('radio', { name: /^Co-op PvE/ }));
    await user.click(screen.getByRole('button', { name: 'Edit formats…' }));
    expect(await screen.findByRole('dialog', { name: 'Formats' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'New session' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back to New session' }));
    expect(await screen.findByRole('dialog', { name: 'New session' })).toBeInTheDocument();
    const radio = screen.getByRole('radio', { name: /^Co-op PvE/ });
    expect(radio).toBeChecked();
    await waitFor(() => expect(radio).toHaveFocus());
  });

  it('Back selects Solo PvE when the chosen format was deleted', async () => {
    const user = await renderSession({ [formatKey('f-a')]: saved('f-a', 'Apple') });
    await user.click(await screen.findByRole('radio', { name: /^Apple/ }));
    await user.click(screen.getByRole('button', { name: 'Edit formats…' }));
    await user.click(await screen.findByRole('button', { name: 'Delete Apple' }));
    await user.click(screen.getByRole('button', { name: 'Delete format' }));
    await user.click(screen.getByRole('button', { name: 'Back to New session' }));
    expect(await screen.findByRole('radio', { name: /^Solo PvE/ })).toBeChecked();
  });

  it('Edit a copy shows only for presets, opens the copy in the editor and comes back with it selected', async () => {
    const user = await renderSession({ [formatKey('f-a')]: saved('f-a', 'Apple') });
    expect(screen.getByRole('button', { name: 'Edit a copy of Solo PvE' })).toBeInTheDocument();
    await user.click(await screen.findByRole('radio', { name: /^Apple/ }));
    expect(screen.queryByRole('button', { name: /^Edit a copy/ })).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: /^1v1 PvP/ }));
    await user.click(screen.getByRole('button', { name: 'Edit a copy of 1v1 PvP' }));
    const formats = await screen.findByRole('dialog', { name: 'Formats' });
    expect(within(formats).getByRole('status')).toHaveTextContent('Duplicated 1v1 PvP as 1v1 PvP copy.');
    expect(await screen.findByRole('textbox', { name: 'Seat 1 name' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back to formats' }));
    expect(screen.getByRole('button', { name: 'Edit 1v1 PvP copy' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Back to New session' }));
    expect(await screen.findByRole('radio', { name: /^1v1 PvP copy/ })).toBeChecked();
  }, 20000);
});
