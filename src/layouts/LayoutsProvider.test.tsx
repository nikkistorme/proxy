import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadPile } from '../actions/loadPile';
import { moveCard } from '../actions/moveCard';
import { cardsFrom, pilesOutOfTheWay, testContext } from '../actions/testing';
import { TableSurface } from '../components/TableSurface';
import type { Layout } from '../model/layout';
import { createSoloSession, type SessionState } from '../model/session';
import { memoryBackend } from '../storage/backends';
import { itemKey, SAVE_VERSION } from '../storage/storage';
import { StorageProvider } from '../storage/StorageProvider';
import { createSessionStore, SessionStoreProvider } from '../store/sessionStore';
import { LAYOUT_SAVE_DELAY, LayoutsProvider, useLayouts, type LayoutItem } from './LayoutsProvider';

const base = import.meta.env.BASE_URL;
const layoutKey = (id: string) => itemKey(base, 'guest', 'layout', id);
const settingsKey = itemKey(base, 'guest', 'settings', 'account');

/** A layout with a fixed title over the card's name, so its face reads "<title>. <name>". */
function titled(id: string, name: string, title: string): Layout {
  const style = { size: 8, weight: 500, align: 'left', valign: 'top', font: 'sans', color: '#000' } as const;
  return {
    id,
    name,
    orientation: 'portrait',
    boxes: [
      { id: 'title', x: 0, y: 0, width: 100, height: 10, content: { kind: 'text', text: title }, style },
      { id: 'name', x: 0, y: 20, width: 100, height: 10, content: { kind: 'column', columns: ['name'], as: 'text' }, style },
    ],
    updatedAt: '',
    version: SAVE_VERSION,
  };
}

const hero = titled('l-hero', 'Hero', 'Hero frame');
const spell = titled('l-spell', 'Spell', 'Spell frame');

/** Calls `saveLayout` with the given layout, as the editor will. */
function SaveButton({ layout }: { layout: LayoutItem }) {
  const { saveLayout } = useLayouts();
  return (
    <button type="button" onClick={() => saveLayout(layout)}>
      Save {layout.name}
    </button>
  );
}

/** Every card of the CSV on the table, over memory storage seeded with `items`. */
async function setup(csv: string, items: Record<string, unknown>, extra?: React.ReactNode) {
  let session: SessionState = loadPile(createSoloSession(), { pileId: 'pile-p1-main', cardSetId: 'set-1', sourceName: 'd.csv', cards: cardsFrom(csv), keepOrder: true }, testContext()).state;
  for (const card of Object.values(session.cards)) session = moveCard(session, { cardId: card.id, to: { zone: 'table' } }).state;
  const backend = memoryBackend(items);
  const list = vi.spyOn(backend, 'keys');
  render(
    <StorageProvider backend={backend}>
      <LayoutsProvider>
        <SessionStoreProvider store={createSessionStore(pilesOutOfTheWay(session), testContext())}>
          <TableSurface />
          {extra}
        </SessionStoreProvider>
      </LayoutsProvider>
    </StorageProvider>,
  );
  await waitFor(() => expect(list).toHaveBeenCalled());
  return backend;
}

const table = () => screen.getByRole('group', { name: /^Table, / });
// Table faces are hidden from screen readers (the card button has its own name), so look past that.
const face = (name: string) => within(table()).findByRole('img', { name, hidden: true });

afterEach(() => {
  vi.useRealTimers();
});

describe('LY-8 table cards use the chosen layout', () => {
  it('draws a card with the stored layout its `layout` column names', async () => {
    await setup('name,layout\nTroll,hero\nGoblin,\n', { [layoutKey('l-hero')]: hero });
    expect(await face('Hero frame. Troll')).toBeInTheDocument();
    // No name, no mapping and no default: the built-in layout.
    expect(await face('Goblin')).toBeInTheDocument();
  });

  it('reads the type mapping and the default from the account settings (AR-7)', async () => {
    await setup('name,type\nTroll,Spell\nGoblin,Creature\n', {
      [layoutKey('l-hero')]: hero,
      [layoutKey('l-spell')]: spell,
      [settingsKey]: { id: 'account', updatedAt: '', version: SAVE_VERSION, options: { layoutByType: { spell: 'l-spell' }, defaultLayout: 'l-hero' } },
    });
    expect(await face('Spell frame. Troll')).toBeInTheDocument();
    expect(await face('Hero frame. Goblin')).toBeInTheDocument();
  });
});

describe('TT-9 landscape layouts', () => {
  it('a landscape card reads sideways on the table and upright when enlarged', async () => {
    const location: Layout = { ...titled('l-location', 'Location', 'Location frame'), orientation: 'landscape' };
    await setup('name,layout\nHarbour,Location\n', { [layoutKey('l-location')]: location });
    const onTable = await face('Location frame. Harbour');
    expect(onTable.querySelector('.card-face__canvas')).not.toBeNull();
    expect(parseFloat(onTable.style.width)).toBeLessThan(parseFloat(onTable.style.height));

    within(table()).getByRole('button', { name: 'Harbour' }).focus();
    await userEvent.keyboard('i');
    const preview = screen.getByRole('dialog', { name: 'Enlarged: Harbour' });
    const enlarged = within(preview).getByRole('img', { name: 'Location frame. Harbour' });
    expect(enlarged.querySelector('.card-face__canvas')).toBeNull();
    expect([enlarged.style.width, enlarged.style.height]).toEqual(['302px', '216px']);
  });
});

describe('LY-10 editing a layout re-renders cards using it', () => {
  it('redraws table cards straight away', async () => {
    await setup('name,layout\nTroll,Hero\nGoblin,\n', { [layoutKey('l-hero')]: hero }, <SaveButton layout={titled('l-hero', 'Hero', 'New frame')} />);
    expect(await face('Hero frame. Troll')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save Hero' }));
    expect(await face('New frame. Troll')).toBeInTheDocument();
    expect(await face('Goblin')).toBeInTheDocument();
  });

  it('a new layout takes over cards that name it', async () => {
    await setup('name,layout\nTroll,Spell\n', {}, <SaveButton layout={spell} />);
    expect(await face('Troll')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save Spell' }));
    expect(await face('Spell frame. Troll')).toBeInTheDocument();
  });
});

describe('PS-1 layouts autosave as their own items', () => {
  it('saves only the changed layout, at most once a second', async () => {
    const edited = titled('l-hero', 'Hero', 'New frame');
    const backend = await setup('name,layout\nTroll,Hero\n', { [layoutKey('l-hero')]: hero, [layoutKey('l-spell')]: spell }, <SaveButton layout={edited} />);
    expect(await face('Hero frame. Troll')).toBeInTheDocument();
    const set = vi.spyOn(backend, 'set');
    vi.useFakeTimers();
    const save = screen.getByRole('button', { name: 'Save Hero' });
    act(() => save.click());
    act(() => save.click());
    act(() => vi.advanceTimersByTime(LAYOUT_SAVE_DELAY - 1));
    expect(set).not.toHaveBeenCalled();
    act(() => save.click());
    await act(async () => vi.advanceTimersByTime(1));
    expect(set).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith(layoutKey('l-hero'), expect.objectContaining({ boxes: edited.boxes, version: SAVE_VERSION }));
    expect(backend.data.get(layoutKey('l-spell'))).toEqual(spell);

    // Nothing more waits, so no further save.
    await act(async () => vi.advanceTimersByTime(LAYOUT_SAVE_DELAY * 3));
    expect(set).toHaveBeenCalledTimes(1);
  });

  it('saves what’s waiting when the page is hidden', async () => {
    const backend = await setup('name\nTroll\n', {}, <SaveButton layout={spell} />);
    await userEvent.click(screen.getByRole('button', { name: 'Save Spell' }));
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    await waitFor(() => expect(backend.data.has(layoutKey('l-spell'))).toBe(true));
  });
});
