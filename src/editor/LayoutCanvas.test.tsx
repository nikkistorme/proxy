import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LayoutsProvider } from '../layouts/LayoutsProvider';
import { cardsFrom, sessionWithDeck, testContext } from '../actions/testing';
import { loadPile } from '../actions/loadPile';
import type { Layout } from '../model/layout';
import { previewCardSets, type PreviewSet } from '../model/preview';
import { memoryBackend } from '../storage/backends';
import { itemKey, SAVE_VERSION } from '../storage/storage';
import { StorageProvider } from '../storage/StorageProvider';
import LayoutEditor from './LayoutEditor';

const layoutKey = (id: string) => itemKey(import.meta.env.BASE_URL, 'guest', 'layout', id);
const hero: Layout = { id: 'l-hero', name: 'Hero', orientation: 'portrait', boxes: [], updatedAt: '', version: SAVE_VERSION };

/** The layout screen with Hero saved, open on Hero's canvas. */
async function openHero(columns?: string[], previewSets?: PreviewSet[]) {
  const backend = memoryBackend({ [layoutKey('l-hero')]: hero });
  const user = userEvent.setup();
  render(
    <StorageProvider backend={backend}>
      <LayoutsProvider>
        <LayoutEditor onClose={vi.fn()} columns={columns} previewSets={previewSets} />
      </LayoutsProvider>
    </StorageProvider>,
  );
  await user.click(await screen.findByRole('button', { name: 'Edit Hero' }));
  return { user, backend };
}

const boxes = () => within(screen.getByRole('group', { name: 'Boxes on Hero' })).queryAllByRole('button');
const status = () => within(screen.getByRole('dialog', { name: 'Card layouts' })).getByRole('status');
const saved = (backend: ReturnType<typeof memoryBackend>) => backend.data.get(layoutKey('l-hero')) as Layout | undefined;

afterEach(() => {
  vi.restoreAllMocks();
});

describe('LY-2 layout canvas', () => {
  it('Edit opens a layout on the canvas, and Back to layouts returns to its row', async () => {
    const { user } = await openHero();
    expect(screen.getByRole('heading', { name: 'Hero' })).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Card layouts' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New layout' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add box' })).toHaveFocus();
    expect(status()).toHaveTextContent('Editing Hero.');

    await user.click(screen.getByRole('button', { name: 'Back to layouts' }));
    expect(screen.getByRole('list', { name: 'Card layouts' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit Hero' })).toHaveFocus();
  });

  it('adds, moves and resizes boxes by keyboard, announcing each step, and saves them', async () => {
    const { user, backend } = await openHero();
    await user.keyboard('{Enter}');
    expect(boxes()).toHaveLength(1);
    const box = screen.getByRole('button', { name: 'Box 1, empty, at 30% across, 40% down, 40% wide, 20% tall' });
    expect(box).toHaveFocus();
    expect(status()).toHaveTextContent('Added Box 1, at 30% across, 40% down, 40% wide, 20% tall.');

    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowUp}');
    expect(status()).toHaveTextContent('Box 1 at 32% across, 39% down.');
    await user.keyboard('{Shift>}{ArrowLeft}{ArrowDown}{ArrowDown}{/Shift}');
    expect(status()).toHaveTextContent('Box 1 39% wide, 22% tall.');
    expect(box).toHaveAccessibleName('Box 1, empty, at 32% across, 39% down, 39% wide, 22% tall');
    expect(box).toHaveFocus();

    await waitFor(() => expect(saved(backend)?.boxes).toMatchObject([{ x: 32, y: 39, width: 39, height: 22 }]), { timeout: 2000 });
  });

  it('adds a second box past the first, and deletes boxes with Delete, focus moving on', async () => {
    const { user } = await openHero();
    await user.click(screen.getByRole('button', { name: 'Add box' }));
    await user.click(screen.getByRole('button', { name: 'Add box' }));
    expect(screen.getByRole('button', { name: /^Box 2, empty, at 32% across, 42% down/ })).toHaveFocus();

    await user.keyboard('{Delete}');
    expect(status()).toHaveTextContent('Deleted Box 2.');
    expect(boxes()).toHaveLength(1);
    expect(screen.getByRole('button', { name: /^Box 1,/ })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Delete Box 1' }));
    expect(boxes()).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Add box' })).toHaveFocus();

    // With no box chosen it stays in place, so the tools don't reflow, and does nothing.
    const remove = screen.getByRole('button', { name: 'Delete box' });
    expect(remove).toHaveAttribute('aria-disabled', 'true');
    await user.click(remove);
    expect(status()).toHaveTextContent('Deleted Box 1.');
  });

  it('switches the orientation, and the list shows it', async () => {
    const { user, backend } = await openHero();
    const landscape = screen.getByRole('radio', { name: 'Landscape' });
    expect(screen.getByRole('radio', { name: 'Portrait' })).toBeChecked();
    await user.click(landscape);
    expect(landscape).toBeChecked();
    expect(status()).toHaveTextContent('Landscape.');
    await waitFor(() => expect(saved(backend)?.orientation).toBe('landscape'), { timeout: 2000 });
    await user.click(screen.getByRole('button', { name: 'Back to layouts' }));
    expect(screen.getByText('Landscape · 0 boxes')).toBeInTheDocument();
  });

  it('draws, moves and resizes boxes by pointer', async () => {
    await openHero();
    const overlay = screen.getByRole('group', { name: 'Boxes on Hero' });
    vi.spyOn(overlay, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 200, 400));

    // Drawn from 10%, 10% to 50%, 30%.
    fireEvent.pointerDown(overlay, { button: 0, clientX: 20, clientY: 40, pointerId: 1 });
    fireEvent.pointerMove(overlay, { clientX: 100, clientY: 120, pointerId: 1 });
    fireEvent.pointerUp(overlay, { clientX: 100, clientY: 120, pointerId: 1 });
    const box = screen.getByRole('button', { name: 'Box 1, empty, at 10% across, 10% down, 40% wide, 20% tall' });
    expect(box).toHaveFocus();

    // Moved 10% right.
    fireEvent.pointerDown(box, { button: 0, clientX: 50, clientY: 60, pointerId: 1 });
    fireEvent.pointerMove(overlay, { clientX: 70, clientY: 60, pointerId: 1 });
    fireEvent.pointerUp(overlay, { clientX: 70, clientY: 60, pointerId: 1 });
    expect(box).toHaveAccessibleName('Box 1, empty, at 20% across, 10% down, 40% wide, 20% tall');
    expect(status()).toHaveTextContent('Box 1 at 20% across, 10% down.');

    // The bottom-right corner dragged 10% down.
    const corner = overlay.querySelector('[data-corner="se"]');
    if (!corner) throw new Error('No handle');
    fireEvent.pointerDown(corner, { button: 0, clientX: 120, clientY: 120, pointerId: 1 });
    fireEvent.pointerMove(overlay, { clientX: 120, clientY: 160, pointerId: 1 });
    fireEvent.pointerUp(overlay, { clientX: 120, clientY: 160, pointerId: 1 });
    expect(box).toHaveAccessibleName('Box 1, empty, at 20% across, 10% down, 40% wide, 30% tall');
  });

  it('treats a click on the card as a click, not a box', async () => {
    await openHero();
    const overlay = screen.getByRole('group', { name: 'Boxes on Hero' });
    vi.spyOn(overlay, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 200, 400));
    fireEvent.pointerDown(overlay, { button: 0, clientX: 20, clientY: 40, pointerId: 1 });
    fireEvent.pointerUp(overlay, { clientX: 21, clientY: 41, pointerId: 1 });
    expect(boxes()).toHaveLength(0);
  });
});

const panel = () => screen.getByRole('region', { name: /properties$/ });
const savedBox = (backend: ReturnType<typeof memoryBackend>) => saved(backend)?.boxes[0];

describe('LY-3 box properties', () => {
  it('shows a prompt until a box is chosen, then the box’s properties', async () => {
    const { user } = await openHero();
    expect(panel()).toHaveTextContent('Choose a box on the card to set what it shows.');
    await user.click(screen.getByRole('button', { name: 'Add box' }));
    expect(screen.getByRole('heading', { name: 'Box 1 properties' })).toBeInTheDocument();
    expect(within(panel()).getByRole('radio', { name: 'Fixed text' })).toBeChecked();
  });

  it('binds a box to a column by keyboard, shows the column on the sample card, and saves it', async () => {
    const { user, backend } = await openHero();
    await user.keyboard('{Enter}');
    // From the box into the panel: the checked kind, then on to Column as text.
    await user.tab();
    expect(within(panel()).getByRole('radio', { name: 'Fixed text' })).toHaveFocus();
    await user.keyboard('{ArrowUp}{ArrowUp}');
    expect(within(panel()).getByRole('radio', { name: 'Column as text' })).toBeChecked();
    await user.tab();
    const column = within(panel()).getByRole('textbox', { name: 'Column' });
    expect(column).toHaveFocus();
    await user.keyboard('Cost');
    expect(screen.getByRole('button', { name: /^Box 1, shows cost, at/ })).toBeInTheDocument();
    expect(screen.getByText('[cost]')).toBeInTheDocument();

    await user.tab();
    await user.keyboard('Cost');
    expect(within(panel()).getByRole('textbox', { name: 'Spoken label' })).toHaveValue('Cost');
    await waitFor(() => expect(savedBox(backend)).toMatchObject({ content: { kind: 'column', columns: ['cost'], as: 'text' }, label: 'Cost' }), {
      timeout: 2000,
    });
  });

  it('takes alternative columns, keeps them as an image, and suggests loaded columns', async () => {
    const { user, backend } = await openHero(['cost', 'rules text']);
    await user.click(screen.getByRole('button', { name: 'Add box' }));
    await user.click(within(panel()).getByRole('radio', { name: 'Column as text' }));
    // With suggestions, the field is a combobox.
    const column = within(panel()).getByRole('combobox', { name: 'Column' });
    const options = [...(document.getElementById(column.getAttribute('list') ?? '')?.querySelectorAll('option') ?? [])];
    expect(options.map((option) => option.value)).toEqual(['cost', 'rules text']);
    await user.type(column, 'Rules Text, text');
    expect(column).toHaveValue('Rules Text, text');
    await user.click(within(panel()).getByRole('radio', { name: 'Column as image' }));
    expect(screen.getByRole('button', { name: /^Box 1, image from rules text or text, at/ })).toBeInTheDocument();
    expect(within(panel()).queryByRole('textbox', { name: 'Spoken label' })).not.toBeInTheDocument();
    await waitFor(() => expect(savedBox(backend)?.content).toEqual({ kind: 'column', columns: ['rules text', 'text'], as: 'image' }), { timeout: 2000 });
  });

  it('clears the spoken label when its field is emptied', async () => {
    const { user, backend } = await openHero();
    await user.click(screen.getByRole('button', { name: 'Add box' }));
    const label = within(panel()).getByRole('textbox', { name: 'Spoken label' });
    await user.type(label, 'Cost');
    await user.clear(label);
    await waitFor(() => expect(savedBox(backend)).toBeDefined(), { timeout: 2000 });
    expect(savedBox(backend)).not.toHaveProperty('label');
  });
});

describe('LY-5 fixed text and colour boxes', () => {
  it('sets fixed text, and keeps it when switching away and back', async () => {
    const { user, backend } = await openHero();
    await user.click(screen.getByRole('button', { name: 'Add box' }));
    await user.type(within(panel()).getByRole('textbox', { name: 'Text' }), 'Hero');
    expect(screen.getByRole('button', { name: /^Box 1, text “Hero”, at/ })).toBeInTheDocument();
    await user.click(within(panel()).getByRole('radio', { name: 'Column as text' }));
    await user.click(within(panel()).getByRole('radio', { name: 'Fixed text' }));
    expect(within(panel()).getByRole('textbox', { name: 'Text' })).toHaveValue('Hero');
    await waitFor(() => expect(savedBox(backend)?.content).toEqual({ kind: 'text', text: 'Hero' }), { timeout: 2000 });
  });

  it('sets a colour box’s colour by hex code, refusing one that isn’t a colour', async () => {
    const { user, backend } = await openHero();
    await user.click(screen.getByRole('button', { name: 'Add box' }));
    await user.click(within(panel()).getByRole('radio', { name: 'Colour' }));
    const hex = within(panel()).getByRole('textbox', { name: 'Colour' });
    expect(hex).toHaveValue('#e3e7ee');
    expect(within(panel()).getByLabelText('Colour picker')).toHaveValue('#e3e7ee');
    expect(screen.getByRole('button', { name: /^Box 1, colour, at/ })).toBeInTheDocument();

    await user.clear(hex);
    await user.type(hex, 'zz');
    expect(hex).toHaveAttribute('aria-invalid', 'true');
    expect(hex).toHaveAccessibleDescription('Enter a hex colour, such as #29303b.');
    await user.clear(hex);
    await user.type(hex, '#123');
    expect(hex).not.toHaveAttribute('aria-invalid');
    expect(within(panel()).getByLabelText('Colour picker')).toHaveValue('#112233');
    await waitFor(() => expect(savedBox(backend)).toMatchObject({ content: { kind: 'color' }, style: { background: '#112233' } }), { timeout: 2000 });

    fireEvent.input(within(panel()).getByLabelText('Colour picker'), { target: { value: '#29303b' } });
    expect(hex).toHaveValue('#29303b');
  });
});

describe('LY-4 text styles', () => {
  // Many keystrokes: about 2s here, and over the 5s default in CI with coverage on.
  it('sets every text style by keyboard and saves it', async () => {
    const { user, backend } = await openHero();
    await user.click(screen.getByRole('button', { name: 'Add box' }));
    await user.type(within(panel()).getByRole('textbox', { name: 'Text' }), 'Hero');

    const size = within(panel()).getByRole('spinbutton', { name: 'Size (pt)' });
    await user.clear(size);
    await user.type(size, '14.5');
    await user.selectOptions(within(panel()).getByRole('combobox', { name: 'Weight' }), 'Bold');
    // Each choice is a radio group: Tab in, arrow to the next.
    await user.click(within(panel()).getByRole('radio', { name: 'Text' }));
    await user.keyboard('{ArrowRight}');
    expect(within(panel()).getByRole('radio', { name: 'Numbers' })).toBeChecked();
    await user.click(within(panel()).getByRole('radio', { name: 'Left' }));
    await user.keyboard('{ArrowRight}');
    await user.click(within(panel()).getByRole('radio', { name: 'Top' }));
    await user.keyboard('{ArrowRight}{ArrowRight}');
    const color = within(panel()).getByRole('textbox', { name: 'Text colour' });
    await user.clear(color);
    await user.type(color, '#29303b');

    const none = within(panel()).getByRole('checkbox', { name: 'No background' });
    expect(none).toBeChecked();
    await user.click(none);
    const background = within(panel()).getByRole('textbox', { name: 'Background' });
    expect(background).toHaveValue('#ffffff');
    await user.clear(background);
    await user.type(background, '#fbf8f2');

    await waitFor(
      () =>
        expect(savedBox(backend)?.style).toEqual({
          size: 14.5,
          weight: 700,
          align: 'center',
          valign: 'bottom',
          font: 'mono',
          color: '#29303b',
          background: '#fbf8f2',
        }),
      { timeout: 2000 },
    );

    await user.click(none);
    expect(within(panel()).queryByRole('textbox', { name: 'Background' })).not.toBeInTheDocument();
    await waitFor(() => expect(savedBox(backend)?.style).not.toHaveProperty('background'), { timeout: 2000 });
  }, 15_000);

  it('refuses a size out of range', async () => {
    const { user, backend } = await openHero();
    await user.click(screen.getByRole('button', { name: 'Add box' }));
    const size = within(panel()).getByRole('spinbutton', { name: 'Size (pt)' });
    await user.clear(size);
    await user.type(size, '3');
    expect(size).toHaveAttribute('aria-invalid', 'true');
    expect(size).toHaveAccessibleDescription('Enter a size from 4 to 72 pt.');
    await waitFor(() => expect(savedBox(backend)).toBeDefined(), { timeout: 2000 });
    expect(savedBox(backend)?.style.size).toBe(10);
  });

  it('gives image boxes only a background, and colour boxes only their colour', async () => {
    const { user } = await openHero();
    await user.click(screen.getByRole('button', { name: 'Add box' }));
    await user.click(within(panel()).getByRole('radio', { name: 'Column as image' }));
    expect(within(panel()).queryByRole('spinbutton', { name: 'Size (pt)' })).not.toBeInTheDocument();
    expect(within(panel()).getByRole('checkbox', { name: 'No background' })).toBeInTheDocument();
    await user.click(within(panel()).getByRole('radio', { name: 'Colour' }));
    expect(within(panel()).queryByRole('checkbox', { name: 'No background' })).not.toBeInTheDocument();
  });

  it('warns when text is clipped at the smallest size', async () => {
    // jsdom can't lay text out, so every text box measures as overflowing.
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(1000);
    const { user } = await openHero();
    await user.click(screen.getByRole('button', { name: 'Add box' }));
    expect(screen.getByRole('button', { name: /^Box 1, empty,/ })).not.toHaveAccessibleName(/clipped/);
    await user.type(within(panel()).getByRole('textbox', { name: 'Text' }), 'A long rules text');
    expect(await screen.findByRole('button', { name: /^Box 1, text “A long rules text”, .*, text clipped$/ })).toBeInTheDocument();
    expect(panel()).toHaveTextContent("Text is clipped: it doesn't fit even at 6 pt.");
  });
});

describe('A11Y-9 contrast warning', () => {
  it('warns when a text box fails contrast against its background', async () => {
    const { user } = await openHero();
    await user.click(screen.getByRole('button', { name: 'Add box' }));
    await user.type(within(panel()).getByRole('textbox', { name: 'Text' }), 'Hero');
    const color = within(panel()).getByRole('textbox', { name: 'Text colour' });
    await user.clear(color);
    await user.type(color, '#eeeeee');
    expect(screen.getByRole('button', { name: /^Box 1, .*, low contrast 1.1 to 1$/ })).toBeInTheDocument();
    expect(panel()).toHaveTextContent('Low contrast: 1.1 to 1 against the background. Text this size needs at least 4.5 to 1.');

    await user.clear(color);
    await user.type(color, '#1e1c1a');
    expect(screen.getByRole('button', { name: /^Box 1,/ })).not.toHaveAccessibleName(/contrast/);
    expect(panel()).not.toHaveTextContent('Low contrast');
  });
});

/** Definition ids env-1, env-2, … for a second load. */
function envIds() {
  let next = 0;
  return () => `env-${++next}`;
}

describe('LY-7 preview with real cards', () => {
  const deck = () => previewCardSets(sessionWithDeck('name,cost\nImp,1\nOgre,\nTroll,5\n'));
  const preview = () => screen.getByRole('group', { name: 'Preview' });

  it('steps through a card set with Next and Previous, wrapping and announcing each card', async () => {
    const { user } = await openHero(['cost', 'name'], deck());
    expect(preview()).toHaveTextContent('Imp 1 of 3');
    await user.click(within(preview()).getByRole('button', { name: 'Next card' }));
    expect(preview()).toHaveTextContent('Ogre 2 of 3');
    expect(status()).toHaveTextContent('Previewing Ogre, 2 of 3.');
    await user.click(within(preview()).getByRole('button', { name: 'Previous card' }));
    await user.click(within(preview()).getByRole('button', { name: 'Previous card' }));
    expect(preview()).toHaveTextContent('Troll 3 of 3');
    await user.click(within(preview()).getByRole('button', { name: 'Next card' }));
    expect(preview()).toHaveTextContent('Imp 1 of 3');
  });

  it('draws the previewed card, so warnings follow its real text', async () => {
    const { user } = await openHero(['cost', 'name'], deck());
    await user.click(screen.getByRole('button', { name: 'Add box' }));
    await user.click(within(panel()).getByRole('radio', { name: 'Column as text' }));
    await user.type(within(panel()).getByRole('combobox', { name: 'Column' }), 'cost');
    const color = within(panel()).getByRole('textbox', { name: 'Text colour' });
    await user.clear(color);
    await user.type(color, '#eeeeee');
    // Imp has a cost to draw, so its contrast is checked; Ogre has none, so nothing is.
    expect(screen.getByRole('button', { name: /^Box 1, shows cost, .*, low contrast 1.1 to 1$/ })).toBeInTheDocument();
    await user.click(within(preview()).getByRole('button', { name: 'Next card' }));
    expect(screen.getByRole('button', { name: /^Box 1, shows cost,/ })).not.toHaveAccessibleName(/contrast/);
  });

  it('chooses between card sets, and keeps the card when coming back to a layout', async () => {
    const one = sessionWithDeck('name\nImp\nOgre\n');
    const pile = one.piles.find((p) => p.id !== 'pile-p1-main');
    if (!pile) throw new Error('no second pile');
    const two = loadPile(
      one,
      { pileId: pile.id, cardSetId: 'set-2', sourceName: 'env.csv', cards: cardsFrom('name\nStorm\nFlood\n'), keepOrder: true },
      // Its own ids, so the second deck's definitions don't replace the first's.
      { ...testContext(3), newId: envIds() },
    ).state;
    const { user } = await openHero([], previewCardSets(two));
    const sets = within(preview()).getByRole('combobox', { name: 'Card set' });
    await user.selectOptions(sets, 'deck.csv');
    await user.click(within(preview()).getByRole('button', { name: 'Next card' }));
    expect(preview()).toHaveTextContent('Ogre 2 of 2');

    await user.selectOptions(sets, 'env.csv');
    expect(preview()).toHaveTextContent('Storm 1 of 2');
    expect(status()).toHaveTextContent('Previewing Storm, 1 of 2.');
    await user.click(within(preview()).getByRole('button', { name: 'Next card' }));

    await user.click(screen.getByRole('button', { name: 'Back to layouts' }));
    await user.click(screen.getByRole('button', { name: 'Edit Hero' }));
    expect(preview()).toHaveTextContent('Flood 2 of 2');
  });

  it('shows column names until a CSV is loaded, and says how to preview real cards', async () => {
    await openHero();
    expect(screen.queryByRole('group', { name: 'Preview' })).not.toBeInTheDocument();
    expect(screen.getByText(/Load a CSV into a pile to preview the layout with real cards/)).toBeInTheDocument();
  });
});
