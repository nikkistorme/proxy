import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import badBox from '../../tests/fixtures/layouts/bad-box.json?raw';
import twoLayouts from '../../tests/fixtures/layouts/two-layouts.json?raw';
import { testContext } from '../actions/testing';
import { SessionScreen } from '../components/SessionScreen';
import { LayoutsProvider } from '../layouts/LayoutsProvider';
import type { Layout } from '../model/layout';
import { memoryBackend } from '../storage/backends';
import { itemKey, SAVE_VERSION } from '../storage/storage';
import { StorageProvider } from '../storage/StorageProvider';
import { createSessionStore, SessionStoreProvider } from '../store/sessionStore';
import LayoutEditor from './LayoutEditor';

const layoutKey = (id: string) => itemKey(import.meta.env.BASE_URL, 'guest', 'layout', id);
const hero: Layout = { id: 'l-hero', name: 'Hero', orientation: 'landscape', boxes: [], updatedAt: '', version: SAVE_VERSION };

/** The layout screen over memory storage seeded with `items`, once the saved layouts are read. */
async function setup(items: Record<string, unknown> = {}, types?: string[]) {
  const backend = memoryBackend(items);
  const list = vi.spyOn(backend, 'keys');
  const onClose = vi.fn();
  const user = userEvent.setup();
  render(
    <StorageProvider backend={backend}>
      <LayoutsProvider>
        <LayoutEditor onClose={onClose} types={types} />
      </LayoutsProvider>
    </StorageProvider>,
  );
  await waitFor(() => expect(list).toHaveBeenCalled());
  return { user, onClose, backend };
}

const editor = () => screen.getByRole('dialog', { name: 'Card layouts' });
const list = () => within(editor()).getByRole('list', { name: 'Card layouts' });
const names = () => within(list()).getAllByRole('listitem').map((row) => row.querySelector('.layout-list__name')?.textContent);
const status = () => within(editor()).getByRole('status');

describe('LY-1 layout list', () => {
  it('lists the built-in layout first, which can only be duplicated, then the saved ones', async () => {
    await setup({ [layoutKey('l-hero')]: hero });
    await waitFor(() => expect(names()).toEqual(['Default', 'Hero']));
    const [builtIn] = within(list()).getAllByRole('listitem');
    if (!builtIn) throw new Error('No rows');
    expect(within(builtIn).getByText(/^Built in · Portrait/)).toBeInTheDocument();
    expect(within(builtIn).getAllByRole('button').map((b) => b.textContent)).toEqual(['Duplicate']);
    expect(within(list()).getByText('Landscape · 0 boxes')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New layout' })).toHaveFocus();
  });

  it('creates a blank layout, announces it and focuses its Rename button', async () => {
    const { user, backend } = await setup();
    await user.click(screen.getByRole('button', { name: 'New layout' }));
    expect(names()).toEqual(['Default', 'Layout 1']);
    expect(status()).toHaveTextContent('Created Layout 1.');
    expect(screen.getByRole('button', { name: 'Rename Layout 1' })).toHaveFocus();
    screen.getByRole('button', { name: 'New layout' }).focus();
    await user.keyboard('{Enter}');
    expect(names()).toEqual(['Default', 'Layout 1', 'Layout 2']);
    await waitFor(() => expect([...backend.data.keys()].filter((key) => key.includes('|layout|'))).toHaveLength(2), { timeout: 2000 });
  });

  it('renames a layout by keyboard, and refuses an empty or taken name', async () => {
    const { user } = await setup({ [layoutKey('l-hero')]: hero, [layoutKey('l-spell')]: { ...hero, id: 'l-spell', name: 'Spell' } });
    await user.click(await screen.findByRole('button', { name: 'Rename Hero' }));
    const dialog = screen.getByRole('dialog', { name: 'Rename Hero' });
    const field = within(dialog).getByRole('textbox', { name: 'Name' });
    await user.clear(field);
    await user.type(field, ' spell {Enter}');
    expect(within(dialog).getByText('There is already a layout called Spell.')).toBeInTheDocument();
    await user.clear(field);
    await user.type(field, 'default{Enter}');
    expect(within(dialog).getByText('There is already a layout called Default.')).toBeInTheDocument();
    await user.clear(field);
    await user.type(field, '  Unit  {Enter}');
    expect(names()).toEqual(['Default', 'Spell', 'Unit']);
    expect(status()).toHaveTextContent('Renamed Hero to Unit.');
    expect(screen.getByRole('button', { name: 'Rename Unit' })).toHaveFocus();
  });

  it('duplicates a layout, the built-in one included', async () => {
    const { user } = await setup({ [layoutKey('l-hero')]: hero });
    await user.click(await screen.findByRole('button', { name: 'Duplicate Hero' }));
    expect(names()).toEqual(['Default', 'Hero', 'Hero copy']);
    expect(within(list()).getAllByText('Landscape · 0 boxes')).toHaveLength(2);
    expect(status()).toHaveTextContent('Duplicated Hero as Hero copy.');
    await user.click(screen.getByRole('button', { name: 'Duplicate Default' }));
    expect(names()).toEqual(['Default', 'Default copy', 'Hero', 'Hero copy']);
    expect(screen.getByRole('button', { name: 'Rename Default copy' })).toHaveFocus();
  });

  it('deletes a layout after confirming, and focus moves to the next row', async () => {
    const { user, backend } = await setup({ [layoutKey('l-hero')]: hero, [layoutKey('l-spell')]: { ...hero, id: 'l-spell', name: 'Spell' } });
    await user.click(await screen.findByRole('button', { name: 'Delete Hero' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Delete Hero?' })).getByRole('button', { name: 'Cancel' }));
    expect(names()).toEqual(['Default', 'Hero', 'Spell']);
    expect(screen.getByRole('button', { name: 'Delete Hero' })).toHaveFocus();

    await user.keyboard('{Enter}');
    await user.click(within(screen.getByRole('dialog', { name: 'Delete Hero?' })).getByRole('button', { name: 'Delete layout' }));
    expect(names()).toEqual(['Default', 'Spell']);
    expect(status()).toHaveTextContent('Deleted Hero.');
    expect(screen.getByRole('button', { name: 'Rename Spell' })).toHaveFocus();
    await waitFor(() => expect(backend.data.has(layoutKey('l-hero'))).toBe(false));

    await user.click(screen.getByRole('button', { name: 'Delete Spell' }));
    await user.click(screen.getByRole('button', { name: 'Delete layout' }));
    expect(names()).toEqual(['Default']);
    expect(screen.getByRole('button', { name: 'New layout' })).toHaveFocus();
  });

  it('Back to table closes it', async () => {
    const { user, onClose } = await setup();
    await user.click(screen.getByRole('button', { name: 'Back to table' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('LY-1 opening the layout screen', () => {
  async function renderSession() {
    const user = userEvent.setup();
    render(
      <StorageProvider backend={memoryBackend()}>
        <LayoutsProvider>
          <SessionStoreProvider store={createSessionStore(undefined, testContext())}>
            <SessionScreen />
          </SessionStoreProvider>
        </LayoutsProvider>
      </StorageProvider>,
    );
    return user;
  }

  it('opens from the toolbar and focus goes back there when it closes', async () => {
    const user = await renderSession();
    const button = screen.getByRole('button', { name: 'Card layouts (L)' });
    await user.click(button);
    expect(await screen.findByRole('dialog', { name: 'Card layouts' }, { timeout: 5000 })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Back to table' }));
    expect(screen.queryByRole('dialog', { name: 'Card layouts' })).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });

  it('L opens it from the table tools', async () => {
    const user = await renderSession();
    screen.getByRole('button', { name: 'Card layouts (L)' }).focus();
    await user.keyboard('l');
    expect(await screen.findByRole('dialog', { name: 'Card layouts' }, { timeout: 5000 })).toBeInTheDocument();
  });
});

describe('LY-8 choosing layouts by type and by default', () => {
  const settingsKey = itemKey(import.meta.env.BASE_URL, 'guest', 'settings', 'account');
  const villain: Layout = { ...hero, id: 'l-villain', name: 'Villain' };
  const seeded = (options: object = {}) => ({
    [layoutKey('l-hero')]: hero,
    [layoutKey('l-villain')]: villain,
    [settingsKey]: { id: 'account', updatedAt: '', version: SAVE_VERSION, options },
  });
  const choices = () => within(editor()).getByRole('region', { name: 'Choosing layouts' });
  const typeList = () => within(choices()).getByRole('list', { name: 'Card types' });
  const savedOptions = (backend: ReturnType<typeof memoryBackend>) => (backend.data.get(settingsKey) as { options?: object } | undefined)?.options;

  it('maps a loaded type to a layout and back to the default, saving each choice', async () => {
    const { user, backend } = await setup(seeded(), ['Monster', 'Hero']);
    await within(list()).findByText('Villain');
    expect(
      within(typeList())
        .getAllByRole('listitem')
        .map((row) => within(row).getByRole('combobox').getAttribute('aria-label')),
    ).toEqual(['Layout for Hero cards', 'Layout for Monster cards']);
    const monster = within(choices()).getByRole('combobox', { name: 'Layout for Monster cards' });
    expect(monster).toHaveValue('');
    await user.selectOptions(monster, 'Villain');
    expect(status()).toHaveTextContent('Monster cards use Villain.');
    await waitFor(() => expect(savedOptions(backend)).toEqual({ layoutByType: { monster: 'l-villain' } }));

    await user.selectOptions(monster, 'Use default layout');
    expect(status()).toHaveTextContent('Monster cards use the default layout.');
    await waitFor(() => expect(savedOptions(backend)).toEqual({ layoutByType: {} }));
  });

  it('sets the default layout, and the built-in one again', async () => {
    const { user, backend } = await setup(seeded());
    await within(list()).findByText('Villain');
    const fallback = within(choices()).getByRole('combobox', { name: 'Default layout' });
    expect(fallback).toHaveDisplayValue('Default (built in)');
    await user.selectOptions(fallback, 'Hero');
    expect(status()).toHaveTextContent('Cards with no other layout use Hero.');
    await waitFor(() => expect(savedOptions(backend)).toEqual({ defaultLayout: 'l-hero' }));
    await user.selectOptions(fallback, 'Default (built in)');
    expect(status()).toHaveTextContent('Cards with no other layout use Default.');
    await waitFor(() => expect(savedOptions(backend)).toEqual({ defaultLayout: null }));
  });

  it('lists mapped types no loaded card has, and shows a mapping to a deleted layout as the default', async () => {
    await setup(seeded({ layoutByType: { boss: 'l-villain', minion: 'l-gone' } }));
    await within(list()).findByText('Villain');
    expect(within(choices()).getByRole('combobox', { name: 'Layout for boss cards' })).toHaveDisplayValue('Villain');
    expect(within(choices()).getByRole('combobox', { name: 'Layout for minion cards' })).toHaveDisplayValue('Use default layout');
  });

  it('adds a type by hand, focusing its picker, and refuses blanks and repeats', async () => {
    const { user } = await setup(seeded(), ['Monster']);
    await within(list()).findByText('Villain');
    const field = within(choices()).getByRole('textbox', { name: 'Card type' });
    await user.click(within(choices()).getByRole('button', { name: 'Add type' }));
    expect(field).toHaveAccessibleDescription('Error: Enter a card type.');
    await user.type(field, ' monster {Enter}');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription('Error: Monster is already listed.');
    await user.clear(field);
    await user.type(field, 'Boss{Enter}');
    expect(within(choices()).getByRole('combobox', { name: 'Layout for Boss cards' })).toHaveFocus();
    expect(status()).toHaveTextContent('Added Boss. Choose its layout.');
    expect(field).toHaveValue('');
    expect(field).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('says how to add types when there are none', async () => {
    await setup();
    expect(within(choices()).getByText('No card types yet. Load a CSV with a type column, or add a type.')).toBeInTheDocument();
  });
});

describe('LY-9 exporting and importing layouts', () => {
  const files = () => screen.getByRole('region', { name: 'Layout files' });
  const villain: Layout = { ...hero, id: 'l-villain', name: 'Villain', orientation: 'portrait' };

  it('exports the saved layouts to a JSON file', async () => {
    const blobs: Blob[] = [];
    const createUrl = vi.fn((blob: Blob) => {
      blobs.push(blob);
      return 'blob:layouts';
    });
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: createUrl, revokeObjectURL: vi.fn() }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const { user } = await setup({ [layoutKey('l-hero')]: hero, [layoutKey('l-villain')]: villain });
    await within(list()).findByText('Villain');
    await user.click(within(files()).getByRole('button', { name: 'Export layouts' }));
    expect(click).toHaveBeenCalledOnce();
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe('proxy-layouts.json');
    const file = JSON.parse(await (blobs[0] as Blob).text());
    expect(file).toMatchObject({ format: 'proxy-layouts', version: 1 });
    expect(file.layouts.map((layout: Layout) => layout.name)).toEqual(['Hero', 'Villain']);
    expect(file.layouts[0]).not.toHaveProperty('updatedAt');
    expect(within(files()).getByText('Exported 2 layouts to proxy-layouts.json.')).toBeInTheDocument();
    expect(status()).toHaveTextContent('Exported 2 layouts to proxy-layouts.json.');
    click.mockRestore();
    vi.unstubAllGlobals();
  });

  it('shows Export as off while there are no saved layouts, and says why when pressed', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const { user } = await setup();
    const button = within(files()).getByRole('button', { name: 'Export layouts' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    await user.click(button);
    expect(click).not.toHaveBeenCalled();
    expect(status()).toHaveTextContent('There are no saved layouts to export yet.');
    click.mockRestore();
  });

  it('imports a file into the list and saves each layout, renaming a taken name', async () => {
    const { user, backend } = await setup({ [layoutKey('l-hero')]: hero });
    await within(list()).findByText('Hero');
    await user.upload(screen.getByTestId('layout-file'), new File([twoLayouts], 'two-layouts.json', { type: 'application/json' }));
    expect(await within(files()).findByText(/^Imported 2 layouts from two-layouts.json\./)).toHaveTextContent(
      'Imported 2 layouts from two-layouts.json. Names already in use were changed: Hero to Hero copy.',
    );
    expect(names()).toEqual(['Default', 'Hero', 'Hero copy', 'Site']);
    await waitFor(() => expect(backend.data.get(layoutKey('fixture-site'))).toMatchObject({ name: 'Site', orientation: 'landscape' }), { timeout: 2000 });
  });

  it('says why a file is refused, and leaves the layouts as they were', async () => {
    const { user } = await setup({ [layoutKey('l-hero')]: hero });
    await within(list()).findByText('Hero');
    await user.upload(screen.getByTestId('layout-file'), new File([badBox], 'bad-box.json', { type: 'application/json' }));
    const error = (await within(files()).findByText(/^Couldn't import/)).closest('p');
    expect(error).toHaveTextContent("Error: Couldn't import bad-box.json. Box 1 of layout Broken in this file isn't valid.");
    expect(error).toHaveClass('form-error');
    expect(status()).toHaveTextContent("Couldn't import bad-box.json.");
    expect(names()).toEqual(['Default', 'Hero']);
  });
});
