import { describe, expect, it } from 'vitest';
import { flip, rotate } from '../actions/cardActions';
import { moveCard } from '../actions/moveCard';
import { cardsFrom, testContext } from '../actions/testing';
import { loadPile } from '../actions/loadPile';
import type { CardSide, SessionState, Rotation } from '../model/session';
import { SOLO_PVE } from '../model/format';
import { createSession } from '../model/session';
import { createTableCardViews, tableCardView } from './tableCardView';

const csv = 'name,id,back_of\nTroll,,\nMoonrise Hunter,,hunter\nDaylight Hunter,hunter,\n';

/** One card on the table, with its side, rotation and definition changed as given. */
function viewOf(name: string, side: CardSide, rotation: Rotation = 0, change: (g: SessionState, definitionId: string) => SessionState = (g) => g) {
  let session = loadPile(createSession(SOLO_PVE), { pileId: 'pile-p1-main', cardSetId: 'set-1', source: { kind: 'file', name: 'd.csv' }, cards: cardsFrom(csv), keepOrder: true }, testContext()).state;
  const card = Object.values(session.cards).find((c) => session.definitions[c.definitionId]?.front.name === name);
  if (!card) throw new Error(name);
  session = moveCard(session, { cardId: card.id, to: { zone: 'table' } }).state;
  session = { ...session, cards: { ...session.cards, [card.id]: { ...card, side } }, table: session.table.map((e) => ({ ...e, rotation })) };
  session = change(session, card.definitionId);
  const entry = session.table[0];
  if (!entry) throw new Error('Nothing on the table');
  return tableCardView(session, entry);
}

describe('A11Y-6 table card names', () => {
  it('names a single-faced card by its name, and adds its rotation', () => {
    expect(viewOf('Troll', 'front').label).toBe('Troll');
    expect(viewOf('Troll', 'front', 90).label).toBe('Troll, rotated 90°');
  });

  it('says which face of a double-faced card shows', () => {
    expect(viewOf('Daylight Hunter', 'front').label).toBe('Daylight Hunter, front face');
    const back = viewOf('Daylight Hunter', 'back', 180);
    expect(back.label).toBe('Moonrise Hunter, back face, rotated 180°');
    expect(back.face?.name).toBe('Moonrise Hunter');
  });

  it("names a face-down card only by its owner's seat, and shows no face", () => {
    const down = viewOf('Daylight Hunter', 'down', 270);
    expect(down.label).toBe('Face-down card, Player 1, rotated 270°');
    expect(down.face).toBeUndefined();
    expect(down.ownerSeatId).toBe('seat-p1');
  });

  it('falls back to the front when the back was lost on re-import', () => {
    const view = viewOf('Daylight Hunter', 'back', 0, (g, id) => {
      const definitions = { ...g.definitions };
      const definition = definitions[id];
      if (definition) definitions[id] = { ...definition, back: undefined };
      return { ...g, definitions };
    });
    expect(view.face?.name).toBe('Daylight Hunter');
    expect(view.label).toBe('Daylight Hunter');
  });

  it('flags a card that is no longer in its CSV', () => {
    const view = viewOf('Troll', 'front', 0, (g, id) => {
      const definition = g.definitions[id];
      return definition ? { ...g, definitions: { ...g.definitions, [id]: { ...definition, missing: true } } } : g;
    });
    expect(view.missing).toBe(true);
    expect(view.label).toBe('Troll, not in the CSV any more');
  });
});

describe('PF-2 table card views keep their identity', () => {
  function twoOnTable() {
    let session = loadPile(createSession(SOLO_PVE), { pileId: 'pile-p1-main', cardSetId: 'set-1', source: { kind: 'file', name: 'd.csv' }, cards: cardsFrom(csv), keepOrder: true }, testContext()).state;
    for (const card of Object.values(session.cards).slice(0, 2)) session = moveCard(session, { cardId: card.id, to: { zone: 'table' } }).state;
    return session;
  }

  it('returns the same view until its card changes, and a new one when it does', () => {
    const viewOf = createTableCardViews();
    const session = twoOnTable();
    const at = (g: SessionState, index: number) => {
      const entry = g.table[index];
      if (!entry) throw new Error('Nothing there');
      return viewOf(g, entry);
    };
    const [a, b] = [at(session, 0), at(session, 1)];
    const rotated = rotate(session, { cardId: session.table[0]?.cardId ?? '', direction: 'clockwise' }).state;
    expect(at(rotated, 1)).toBe(b);
    expect(at(rotated, 0)).not.toBe(a);
    expect(at(rotated, 0).label).toMatch(/rotated 90°/);

    const flipped = flip(rotated, { cardId: rotated.table[1]?.cardId ?? '' }).state;
    expect(at(flipped, 1)).not.toBe(b);
  });

  it("keeps views when a seat counter changes, and refreshes them when the owner's name does", () => {
    const viewOf = createTableCardViews();
    const session = twoOnTable();
    const entry = session.table[0];
    if (!entry) throw new Error('Nothing on the table');
    const view = viewOf(session, entry);
    const counted = { ...session, seats: session.seats.map((seat) => ({ ...seat, counters: seat.counters.map((c) => ({ ...c, value: c.value + 1 })) })) };
    expect(viewOf(counted, entry)).toBe(view);
    const renamed = { ...session, seats: session.seats.map((seat) => ({ ...seat, name: `${seat.name}!` })) };
    expect(viewOf(renamed, entry)).not.toBe(view);
  });
});
