import { describe, expect, it } from 'vitest';
import type { SessionState } from '../model/session';
import { createSoloSession } from '../model/session';
import { bringToFront, deleteCard, duplicate, flip, flipKind, rotate, sendToBack } from './cardActions';
import { loadPile } from './loadPile';
import { moveCard } from './moveCard';
import { cardsFrom, tableIds, testContext } from './testing';

const csv = 'name,id,back_of,qty\nTroll,,,2\nMoonrise Hunter,,hunter,\nDaylight Hunter,hunter,,\n';

/** One Troll, then Daylight Hunter, on the table; the other Troll stays in the deck. */
function tableSession(): SessionState {
  let session = loadPile(createSoloSession(), { pileId: 'pile-p1-main', sourceName: 'd.csv', cards: cardsFrom(csv), keepOrder: true }, testContext()).state;
  for (const name of ['Troll', 'Daylight Hunter']) {
    const card = Object.values(session.cards).find((c) => session.definitions[c.definitionId]?.front.name === name && !tableIds(session).includes(c.id));
    if (!card) throw new Error(name);
    session = moveCard(session, { cardId: card.id, to: { zone: 'table' } }).state;
  }
  return session;
}

const troll = (g: SessionState) => g.table[0]?.cardId ?? '';
const hunter = (g: SessionState) => g.table[1]?.cardId ?? '';

describe('TT-5 rotate', () => {
  it('turns a card 90° each way, wrapping round', () => {
    const session = tableSession();
    const once = rotate(session, { cardId: troll(session), direction: 'clockwise' });
    expect(once.state.table[0]?.rotation).toBe(90);
    expect(once.announcement).toBe('Rotated Troll to 90°.');
    const back = rotate(session, { cardId: troll(session), direction: 'counter-clockwise' });
    expect(back.state.table[0]?.rotation).toBe(270);
    let full = session;
    for (let i = 0; i < 4; i++) full = rotate(full, { cardId: troll(session), direction: 'clockwise' }).state;
    expect(full.table[0]?.rotation).toBe(0);
  });

  it('only turns cards on the table', () => {
    const session = tableSession();
    const inDeck = session.piles[0]?.cardIds[0] ?? '';
    expect(() => rotate(session, { cardId: inDeck, direction: 'clockwise' })).toThrow('not on the table');
  });
});

describe('TT-6 flip', () => {
  it('shows the other face of a double-faced card, and back again', () => {
    const session = tableSession();
    expect(flipKind(session, hunter(session))).toBe('to back');
    const toBack = flip(session, { cardId: hunter(session) });
    expect(toBack.state.cards[hunter(session)]?.side).toBe('back');
    expect(toBack.announcement).toBe('Flipped Daylight Hunter to its back: Moonrise Hunter.');
    expect(flipKind(toBack.state, hunter(session))).toBe('to front');
    const toFront = flip(toBack.state, { cardId: hunter(session) });
    expect(toFront.state.cards[hunter(session)]?.side).toBe('front');
    expect(toFront.announcement).toBe('Flipped Moonrise Hunter to its front: Daylight Hunter.');
  });

  it('turns a single-faced card face down without naming it later, and face up again', () => {
    const session = tableSession();
    const down = flip(session, { cardId: troll(session) });
    expect(down.state.cards[troll(session)]?.side).toBe('down');
    expect(down.announcement).toBe('Turned Troll face down.');
    expect(rotate(down.state, { cardId: troll(session), direction: 'clockwise' }).announcement).toBe('Rotated a face-down card to 90°.');
    const up = flip(down.state, { cardId: troll(session) });
    expect(up.state.cards[troll(session)]?.side).toBe('front');
    expect(up.announcement).toBe('Turned a face-down card face up: Troll.');
  });

  it('treats a card whose back was lost on re-import as single-faced', () => {
    const session = flip(tableSession(), { cardId: hunter(tableSession()) }).state;
    const card = session.cards[hunter(session)];
    const definitions = { ...session.definitions };
    const definition = card && definitions[card.definitionId];
    if (card && definition) definitions[card.definitionId] = { ...definition, back: undefined };
    const lost = { ...session, definitions };
    expect(flipKind(lost, hunter(session))).toBe('face down');
    expect(flip(lost, { cardId: hunter(session) }).announcement).toBe('Turned Daylight Hunter face down.');
  });
});

describe('TT-10 stacking order', () => {
  it('brings a card to the front and sends it to the back', () => {
    const session = tableSession();
    const front = bringToFront(session, { cardId: troll(session) });
    expect(tableIds(front.state)).toEqual([hunter(session), troll(session)]);
    expect(front.announcement).toBe('Brought Troll to the front.');
    expect(bringToFront(front.state, { cardId: troll(session) })).toMatchObject({ state: front.state, announcement: 'Troll is already in front.' });
    const back = sendToBack(front.state, { cardId: troll(session) });
    expect(tableIds(back.state)).toEqual([troll(session), hunter(session)]);
    expect(sendToBack(back.state, { cardId: troll(session) }).announcement).toBe('Troll is already at the back.');
  });
});

describe('TT-11 duplicate and delete', () => {
  it('duplicates a card on top, offset, the same way up and turned', () => {
    let session = flip(tableSession(), { cardId: hunter(tableSession()) }).state;
    session = rotate(session, { cardId: hunter(session), direction: 'clockwise' }).state;
    const copy = duplicate(session, { cardId: hunter(session) }, testContext());
    const original = session.table[1];
    expect(copy.state.table.at(-1)).toEqual({ cardId: copy.cardId, x: (original?.x ?? 0) + 24, y: (original?.y ?? 0) + 24, rotation: 90 });
    expect(copy.state.cards[copy.cardId]).toMatchObject({ side: 'back', duplicate: true, definitionId: session.cards[hunter(session)]?.definitionId });
    expect(copy.announcement).toBe('Duplicated Moonrise Hunter.');
  });

  it("doesn't count duplicates as the deck's copies when the pile reloads", () => {
    const session = tableSession();
    const copied = duplicate(session, { cardId: troll(session) }, testContext()).state;
    const reloaded = loadPile(copied, { pileId: 'pile-p1-main', sourceName: 'd.csv', cards: cardsFrom(csv), keepOrder: true }, testContext(7)).state;
    // Two Trolls in the deck's count, both still there, plus the duplicate.
    const trolls = Object.values(reloaded.cards).filter((c) => reloaded.definitions[c.definitionId]?.front.name === 'Troll');
    expect(trolls).toHaveLength(3);
    expect(reloaded.piles[0]?.cardIds).toHaveLength(session.piles[0]?.cardIds.length ?? -1);
  });

  it('deletes a table card from the session', () => {
    const session = tableSession();
    const deleted = deleteCard(session, { cardId: troll(session) });
    expect(tableIds(deleted.state)).toEqual([hunter(session)]);
    expect(deleted.state.cards[troll(session)]).toBeUndefined();
    expect(deleted.announcement).toBe('Deleted Troll from the table.');
    const down = flip(session, { cardId: troll(session) }).state;
    expect(deleteCard(down, { cardId: troll(session) }).announcement).toBe('Deleted a face-down card from the table.');
  });
});
