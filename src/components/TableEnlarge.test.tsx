import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { flip } from '../actions/cardActions';
import { loadPile } from '../actions/loadPile';
import { moveCard } from '../actions/moveCard';
import { cardsFrom, pilesOutOfTheWay, testContext } from '../actions/testing';
import { createSession, type SessionState } from '../model/session';
import { SOLO_PVE } from '../model/format';
import { createSessionStore, SessionStoreProvider } from '../store/sessionStore';
import { TOUCH_HOLD_MS } from './cardDrag';
import { ENLARGE_HOVER_MS, TableSurface } from './TableSurface';

const csv = 'name,id,back_of,type,text\nTroll,,,Creature,Smash.\nMoonrise Hunter,,hunter,Creature,Night side.\nDaylight Hunter,hunter,,Creature,Day side.\n';

/** Troll and Daylight Hunter on the table. */
function setup() {
  let session: SessionState = loadPile(createSession(SOLO_PVE), { pileId: 'pile-p1-main', cardSetId: 'set-1', source: { kind: 'file', name: 'd.csv' }, cards: cardsFrom(csv), keepOrder: true }, testContext()).state;
  for (const name of ['Troll', 'Daylight Hunter']) {
    const card = Object.values(session.cards).find((c) => session.definitions[c.definitionId]?.front.name === name);
    if (card) session = moveCard(session, { cardId: card.id, to: { zone: 'table' } }).state;
  }
  const store = createSessionStore(pilesOutOfTheWay(session), testContext());
  render(
    <SessionStoreProvider store={store}>
      <TableSurface />
    </SessionStoreProvider>,
  );
  return store;
}

const table = () => screen.getByRole('group', { name: /^Table, / });
const card = (name: string) => within(table()).getByRole('button', { name });
const wait = (ms: number) => act(() => new Promise((resolve) => window.setTimeout(resolve, ms)));
const mouse = { pointerType: 'mouse' };

describe('TT-9 enlarge', () => {
  it('I opens it with focus inside, and I or Escape close it back to the card', async () => {
    setup();
    card('Troll').focus();
    await userEvent.keyboard('i');
    const preview = screen.getByRole('dialog', { name: 'Enlarged: Troll' });
    expect(preview).toHaveFocus();
    expect(within(preview).getByRole('img', { name: 'Troll. Creature. Smash.' })).toBeInTheDocument();
    // A single-faced card has nothing to flip.
    expect(within(preview).queryByRole('button')).toBeNull();
    await userEvent.keyboard('i');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(card('Troll')).toHaveFocus();
    await userEvent.keyboard('I');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(card('Troll')).toHaveFocus();
  });

  it('shows one face of a double-faced card, with a button that flips the preview only', async () => {
    const store = setup();
    card('Daylight Hunter, front face').focus();
    await userEvent.keyboard('i');
    const button = screen.getByRole('button', { name: 'Show back' });
    expect(button).toHaveFocus();
    await userEvent.click(button);
    expect(screen.getByRole('dialog', { name: 'Enlarged: Moonrise Hunter' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show front' })).toHaveFocus();
    // The card on the table hasn't turned over.
    expect(Object.values(store.getState().session.cards).find((c) => c.side === 'back')).toBeUndefined();
  });

  it('starts on the face the card shows', async () => {
    const store = setup();
    const hunter = store.getState().session.table[1]?.cardId ?? '';
    act(() => {
      store.getState().dispatch((g) => flip(g, { cardId: hunter }));
    });
    card('Moonrise Hunter, back face').focus();
    await userEvent.keyboard('i');
    expect(screen.getByRole('dialog', { name: 'Enlarged: Moonrise Hunter' })).toBeInTheDocument();
  });

  it('opens from the card menu', async () => {
    setup();
    card('Troll').focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.click(screen.getByRole('menuitem', { name: 'Enlarge' }));
    expect(screen.getByRole('dialog', { name: 'Enlarged: Troll' })).toHaveFocus();
  });

  it('shows the front of a face-down card by key, but not on hover', async () => {
    const store = setup();
    const troll = store.getState().session.table[0]?.cardId ?? '';
    act(() => {
      store.getState().dispatch((g) => flip(g, { cardId: troll }));
    });
    fireEvent.pointerEnter(card('Face-down card, Player 1'), mouse);
    await wait(ENLARGE_HOVER_MS + 50);
    expect(screen.queryByRole('dialog')).toBeNull();
    card('Face-down card, Player 1').focus();
    await userEvent.keyboard('i');
    expect(screen.getByRole('dialog', { name: 'Enlarged: Troll' })).toHaveFocus();
    // The card stays face down.
    expect(store.getState().session.cards[troll]?.side).toBe('down');
  });

  it('Escape on a card or pile steps back to the table', async () => {
    setup();
    card('Troll').focus();
    await userEvent.keyboard('{Escape}');
    expect(table()).toHaveFocus();
  });

  it('a mouse resting on a card enlarges it after 400ms, without taking focus, and leaving closes it', async () => {
    setup();
    fireEvent.pointerEnter(card('Troll'), mouse);
    await wait(ENLARGE_HOVER_MS - 150);
    expect(screen.queryByRole('dialog')).toBeNull();
    await wait(200);
    const preview = screen.getByRole('dialog', { name: 'Enlarged: Troll' });
    expect(preview).not.toHaveFocus();
    // Moving onto the preview keeps it open.
    fireEvent.pointerLeave(card('Troll'), mouse);
    fireEvent.pointerEnter(preview);
    await wait(200);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.pointerLeave(preview);
    await wait(200);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it("a press on the card cancels a waiting hover, so a right-click's menu stays open", async () => {
    setup();
    fireEvent.pointerEnter(card('Troll'), mouse);
    fireEvent.pointerDown(card('Troll'), { ...mouse, button: 2 });
    fireEvent.contextMenu(card('Troll'));
    await wait(ENLARGE_HOVER_MS + 50);
    expect(screen.getByRole('menu', { name: 'Actions for Troll' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('a press elsewhere closes it', async () => {
    setup();
    card('Troll').focus();
    await userEvent.keyboard('i');
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('a touch hold let go in place opens the card menu, as on a pile', async () => {
    setup();
    const touch = { clientX: 30, clientY: 30, pointerId: 4, pointerType: 'touch' };
    fireEvent.pointerDown(card('Troll'), touch);
    await wait(TOUCH_HOLD_MS + 50);
    fireEvent.pointerUp(document, touch);
    expect(screen.getByRole('menu', { name: 'Actions for Troll' })).toBeInTheDocument();
  });
});

describe('TT-6 double-faced badge', () => {
  it('marks face-up double-faced cards only', () => {
    setup();
    const badges = () => table().querySelectorAll('.table-card__badge--dfc');
    expect(badges()).toHaveLength(1);
    expect(card('Daylight Hunter, front face').closest('.table-card')?.querySelector('.table-card__badge--dfc')).not.toBeNull();
  });
});
