import { describe, expect, it } from 'vitest';
import sixtyRows from '../../tests/fixtures/csv/sixty-rows-two-dfc.csv?raw';
import { importCards } from '../csv/importCards';
import { createSoloSession, type SessionState } from '../model/session';
import { loadPile } from './loadPile';
import { draw } from './pileActions';
import { cardsFrom, testContext } from './testing';

const MAIN = 'pile-p1-main';

function pileNames(state: SessionState, pileId = MAIN): string[] {
  const pile = state.piles.find((p) => p.id === pileId);
  return (pile?.cardIds ?? []).map((id) => state.definitions[state.cards[id]?.definitionId ?? '']?.front.name ?? '?');
}

function load(state: SessionState, csv: string, options: { keepOrder?: boolean; context?: ReturnType<typeof testContext> } = {}) {
  return loadPile(
    state,
    { pileId: MAIN, sourceName: 'deck.csv', cards: cardsFrom(csv), keepOrder: options.keepOrder ?? false },
    options.context ?? testContext(),
  );
}

describe('SP-3 load a pile', () => {
  it("gives each copy its pile's seat as owner, for its card back", () => {
    const owned = loadPile(createSoloSession(), { pileId: 'pile-p1-main', sourceName: 'a.csv', cards: cardsFrom('name\nImp\n'), keepOrder: true }, testContext()).state;
    expect(Object.values(owned.cards).map((c) => c.ownerSeatId)).toEqual(['seat-p1']);
    const shared = loadPile(createSoloSession(), { pileId: 'pile-board', sourceName: 'a.csv', cards: cardsFrom('name\nImp\n'), keepOrder: true }, testContext()).state;
    expect(Object.values(shared.cards)[0]).not.toHaveProperty('ownerSeatId');
  });

  it('makes one copy per qty, in CSV order when asked', () => {
    const { state, announcement } = load(createSoloSession(), 'name,qty\nImp,2\nOgre,1\nWisp,0\n', { keepOrder: true });
    expect(pileNames(state)).toEqual(['Imp', 'Imp', 'Ogre']);
    expect(Object.values(state.cards).every((card) => card.side === 'down')).toBe(true);
    expect(announcement).toBe('Loaded deck.csv into P1 main deck: 3 cards, in CSV order.');
  });

  it('shuffles on load by default', () => {
    const csv = `name\n${Array.from({ length: 10 }, (_, i) => `Card ${i}`).join('\n')}\n`;
    const { state, announcement } = load(createSoloSession(), csv);
    const names = pileNames(state);
    expect(names).not.toEqual([...names].sort());
    expect([...names].sort()).toEqual(Array.from({ length: 10 }, (_, i) => `Card ${i}`));
    expect(announcement).toBe('Loaded deck.csv into P1 main deck: 10 cards, shuffled.');
  });

  it('keeps every definition in the pile, records the source and leaves other piles alone', () => {
    const before = createSoloSession();
    const { state } = load(before, 'name\nImp\nOgre\n');
    const pile = state.piles.find((p) => p.id === MAIN);
    expect(pile?.sourceName).toBe('deck.csv');
    expect(pile?.definitionIds.map((id) => state.definitions[id]?.front.name)).toEqual(['Imp', 'Ogre']);
    expect(state.piles.filter((p) => p.id !== MAIN)).toEqual(before.piles.filter((p) => p.id !== MAIN));
  });

  it('loads the 60-row acceptance deck as 58 cards', () => {
    const { state } = loadPile(createSoloSession(), { pileId: MAIN, sourceName: 'sixty.csv', cards: importCards(sixtyRows).cards }, testContext());
    expect(state.piles.find((p) => p.id === MAIN)?.cardIds).toHaveLength(58);
  });

  it('does not change the state it was given', () => {
    const before = createSoloSession();
    const copy = structuredClone(before);
    load(before, 'name\nImp\n');
    expect(before).toEqual(copy);
  });

  it('throws for an unknown pile', () => {
    expect(() => loadPile(createSoloSession(), { pileId: 'nope', sourceName: 'x', cards: [] }, testContext())).toThrow('Unknown pile: nope');
  });
});

describe('CD-5 reload into a pile in play', () => {
  it('updates card text without reordering the pile', () => {
    const context = testContext();
    const first = load(createSoloSession(), 'name,rules\nImp,Old\nOgre,Big\nTroll,Huge\n', { context }).state;
    const order = first.piles.find((p) => p.id === MAIN)?.cardIds;

    const { state, merge } = load(first, 'name,rules\nImp,New\nOgre,Big\nTroll,Huge\n', { context });
    expect(state.piles.find((p) => p.id === MAIN)?.cardIds).toEqual(order);
    expect(merge.updated).toHaveLength(3);
    const imp = Object.values(state.definitions).find((d) => d.front.name === 'Imp');
    expect(imp?.front.fields.rules).toBe('New');
  });

  it('adds copies at the bottom when keeping CSV order', () => {
    const context = testContext();
    const first = load(createSoloSession(), 'name,qty\nImp,1\nOgre,1\n', { keepOrder: true, context }).state;
    const { state, announcement } = load(first, 'name,qty\nImp,2\nOgre,1\nWisp,1\n', { keepOrder: true, context });
    expect(pileNames(state)).toEqual(['Imp', 'Ogre', 'Imp', 'Wisp']);
    expect(announcement).toBe('Reloaded deck.csv into P1 main deck: 2 copies added, 0 removed. 4 cards in the pile.');
  });

  it('shuffles new copies in and keeps the existing cards in their order', () => {
    const context = testContext();
    const csv = (extra: string) => `name\n${Array.from({ length: 8 }, (_, i) => `Card ${i}`).join('\n')}\n${extra}`;
    const first = load(createSoloSession(), csv(''), { context }).state;
    const before = pileNames(first);
    const { state } = load(first, csv('New A\nNew B\n'), { context });
    const after = pileNames(state);
    expect(after).toHaveLength(10);
    expect(after.filter((name) => !name.startsWith('New'))).toEqual(before);
    expect(after.slice(-2)).not.toEqual(['New A', 'New B']);
  });

  it('removes extra copies from the bottom of the pile', () => {
    const context = testContext();
    const first = load(createSoloSession(), 'name,qty,rules\nImp,1,top\nOgre,1,\nImp,1,bottom\n', { keepOrder: true, context }).state;
    // Two Imp rows with no id: re-import matches them in order, so drop the second by name.
    const { state, announcement } = load(first, 'name,qty,rules\nImp,1,top\nOgre,1,\n', { keepOrder: true, context });
    expect(pileNames(state)).toEqual(['Imp', 'Ogre']);
    expect(announcement).toBe('Reloaded deck.csv into P1 main deck: 0 copies added, 1 removed. 2 cards in the pile.');
  });

  it('lowers a qty by removing copies from the pile, nearest the bottom first', () => {
    const context = testContext();
    const first = load(createSoloSession(), 'name,qty\nImp,3\nOgre,1\n', { keepOrder: true, context }).state;
    const pileBefore = first.piles.find((p) => p.id === MAIN)?.cardIds ?? [];
    const { state, shortfalls } = load(first, 'name,qty\nImp,1\nOgre,1\n', { keepOrder: true, context });
    expect(state.piles.find((p) => p.id === MAIN)?.cardIds).toEqual([pileBefore[0], pileBefore[3]]);
    expect(Object.keys(state.cards)).toHaveLength(2);
    expect(shortfalls).toEqual([]);
  });

  it('never touches copies outside the pile, and reports what it could not remove', () => {
    const context = testContext();
    const loaded = load(createSoloSession(), 'name,qty\nImp,3\nOgre,1\n', { keepOrder: true, context }).state;
    const drawn = draw(loaded, { pileId: MAIN, count: 2 }).state;
    const hand = drawn.hands['seat-p1'];

    const { state, shortfalls } = load(drawn, 'name,qty\nImp,1\nOgre,1\n', { keepOrder: true, context });
    expect(state.hands['seat-p1']).toEqual(hand);
    expect(pileNames(state)).toEqual(['Ogre']);
    expect(shortfalls).toEqual([{ definitionId: expect.any(String), name: 'Imp', extra: 1 }]);
  });

  it('takes a card removed from the CSV out of the pile but not out of play', () => {
    const context = testContext();
    const loaded = load(createSoloSession(), 'name\nImp\nOgre\n', { keepOrder: true, context }).state;
    const drawn = draw(loaded, { pileId: MAIN }).state; // Imp to hand
    const { state, merge } = load(drawn, 'name\nWisp\n', { keepOrder: true, context });
    expect(pileNames(state)).toEqual(['Wisp']);
    expect(state.hands['seat-p1']).toEqual(drawn.hands['seat-p1']);
    expect(merge.missing).toHaveLength(2);
  });
});
