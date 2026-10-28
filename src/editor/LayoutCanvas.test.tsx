import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LayoutsProvider } from '../layouts/LayoutsProvider';
import type { Layout } from '../model/layout';
import { memoryBackend } from '../storage/backends';
import { itemKey, SAVE_VERSION } from '../storage/storage';
import { StorageProvider } from '../storage/StorageProvider';
import LayoutEditor from './LayoutEditor';

const layoutKey = (id: string) => itemKey(import.meta.env.BASE_URL, 'guest', 'layout', id);
const hero: Layout = { id: 'l-hero', name: 'Hero', orientation: 'portrait', boxes: [], updatedAt: '', version: SAVE_VERSION };

/** The layout screen with Hero saved, open on Hero's canvas. */
async function openHero() {
  const backend = memoryBackend({ [layoutKey('l-hero')]: hero });
  const user = userEvent.setup();
  render(
    <StorageProvider backend={backend}>
      <LayoutsProvider>
        <LayoutEditor onClose={vi.fn()} />
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
    const box = screen.getByRole('button', { name: 'Box 1, at 30% across, 40% down, 40% wide, 20% tall' });
    expect(box).toHaveFocus();
    expect(status()).toHaveTextContent('Added Box 1, at 30% across, 40% down, 40% wide, 20% tall.');

    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowUp}');
    expect(status()).toHaveTextContent('Box 1 at 32% across, 39% down.');
    await user.keyboard('{Shift>}{ArrowLeft}{ArrowDown}{ArrowDown}{/Shift}');
    expect(status()).toHaveTextContent('Box 1 39% wide, 22% tall.');
    expect(box).toHaveAccessibleName('Box 1, at 32% across, 39% down, 39% wide, 22% tall');
    expect(box).toHaveFocus();

    await waitFor(() => expect(saved(backend)?.boxes).toMatchObject([{ x: 32, y: 39, width: 39, height: 22 }]), { timeout: 2000 });
  });

  it('adds a second box past the first, and deletes boxes with Delete, focus moving on', async () => {
    const { user } = await openHero();
    await user.click(screen.getByRole('button', { name: 'Add box' }));
    await user.click(screen.getByRole('button', { name: 'Add box' }));
    expect(screen.getByRole('button', { name: /^Box 2, at 32% across, 42% down/ })).toHaveFocus();

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
    const box = screen.getByRole('button', { name: 'Box 1, at 10% across, 10% down, 40% wide, 20% tall' });
    expect(box).toHaveFocus();

    // Moved 10% right.
    fireEvent.pointerDown(box, { button: 0, clientX: 50, clientY: 60, pointerId: 1 });
    fireEvent.pointerMove(overlay, { clientX: 70, clientY: 60, pointerId: 1 });
    fireEvent.pointerUp(overlay, { clientX: 70, clientY: 60, pointerId: 1 });
    expect(box).toHaveAccessibleName('Box 1, at 20% across, 10% down, 40% wide, 20% tall');
    expect(status()).toHaveTextContent('Box 1 at 20% across, 10% down.');

    // The bottom-right corner dragged 10% down.
    const corner = overlay.querySelector('[data-corner="se"]');
    if (!corner) throw new Error('No handle');
    fireEvent.pointerDown(corner, { button: 0, clientX: 120, clientY: 120, pointerId: 1 });
    fireEvent.pointerMove(overlay, { clientX: 120, clientY: 160, pointerId: 1 });
    fireEvent.pointerUp(overlay, { clientX: 120, clientY: 160, pointerId: 1 });
    expect(box).toHaveAccessibleName('Box 1, at 20% across, 10% down, 40% wide, 30% tall');
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
