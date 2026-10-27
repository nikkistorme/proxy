import { describe, expect, it } from 'vitest';
import type { GameState } from '../model/game';
import { createSoloGame } from '../model/game';
import { bringToFront, deleteCard, duplicate, flip, flipKind, rotate, sendToBack } from './cardActions';
import { loadPile } from './loadPile';
import { moveCard } from './moveCard';
import { cardsFrom, tableIds, testContext } from './testing';

const csv = 'name,id,back_of,qty\nTroll,,,2\nMoonrise Hunter,,hunter,\nDaylight Hunter,hunter,,\n';

/** One Troll, then Daylight Hunter, on the table; the other Troll stays in the deck. */
function tableGame(): GameState {
  let game = loadPile(createSoloGame(), { pileId: 'pile-p1-main', sourceName: 'd.csv', cards: cardsFrom(csv), keepOrder: true }, testContext()).state;
  for (const name of ['Troll', 'Daylight Hunter']) {
    const card = Object.values(game.cards).find((c) => game.definitions[c.definitionId]?.front.name === name && !tableIds(game).includes(c.id));
    if (!card) throw new Error(name);
    game = moveCard(game, { cardId: card.id, to: { zone: 'table' } }).state;
  }
  return game;
}

const troll = (g: GameState) => g.table[0]?.cardId ?? '';
const hunter = (g: GameState) => g.table[1]?.cardId ?? '';

describe('TT-5 rotate', () => {
  it('turns a card 90° each way, wrapping round', () => {
    const game = tableGame();
    const once = rotate(game, { cardId: troll(game), direction: 'clockwise' });
    expect(once.state.table[0]?.rotation).toBe(90);
    expect(once.announcement).toBe('Rotated Troll to 90°.');
    const back = rotate(game, { cardId: troll(game), direction: 'counter-clockwise' });
    expect(back.state.table[0]?.rotation).toBe(270);
    let full = game;
    for (let i = 0; i < 4; i++) full = rotate(full, { cardId: troll(game), direction: 'clockwise' }).state;
    expect(full.table[0]?.rotation).toBe(0);
  });

  it('only turns cards on the table', () => {
    const game = tableGame();
    const inDeck = game.piles[0]?.cardIds[0] ?? '';
    expect(() => rotate(game, { cardId: inDeck, direction: 'clockwise' })).toThrow('not on the table');
  });
});

describe('TT-6 flip', () => {
  it('shows the other face of a double-faced card, and back again', () => {
    const game = tableGame();
    expect(flipKind(game, hunter(game))).toBe('to back');
    const toBack = flip(game, { cardId: hunter(game) });
    expect(toBack.state.cards[hunter(game)]?.side).toBe('back');
    expect(toBack.announcement).toBe('Flipped Daylight Hunter to its back: Moonrise Hunter.');
    expect(flipKind(toBack.state, hunter(game))).toBe('to front');
    const toFront = flip(toBack.state, { cardId: hunter(game) });
    expect(toFront.state.cards[hunter(game)]?.side).toBe('front');
    expect(toFront.announcement).toBe('Flipped Moonrise Hunter to its front: Daylight Hunter.');
  });

  it('turns a single-faced card face down without naming it later, and face up again', () => {
    const game = tableGame();
    const down = flip(game, { cardId: troll(game) });
    expect(down.state.cards[troll(game)]?.side).toBe('down');
    expect(down.announcement).toBe('Turned Troll face down.');
    expect(rotate(down.state, { cardId: troll(game), direction: 'clockwise' }).announcement).toBe('Rotated a face-down card to 90°.');
    const up = flip(down.state, { cardId: troll(game) });
    expect(up.state.cards[troll(game)]?.side).toBe('front');
    expect(up.announcement).toBe('Turned a face-down card face up: Troll.');
  });

  it('treats a card whose back was lost on re-import as single-faced', () => {
    const game = flip(tableGame(), { cardId: hunter(tableGame()) }).state;
    const card = game.cards[hunter(game)];
    const definitions = { ...game.definitions };
    const definition = card && definitions[card.definitionId];
    if (card && definition) definitions[card.definitionId] = { ...definition, back: undefined };
    const lost = { ...game, definitions };
    expect(flipKind(lost, hunter(game))).toBe('face down');
    expect(flip(lost, { cardId: hunter(game) }).announcement).toBe('Turned Daylight Hunter face down.');
  });
});

describe('TT-10 stacking order', () => {
  it('brings a card to the front and sends it to the back', () => {
    const game = tableGame();
    const front = bringToFront(game, { cardId: troll(game) });
    expect(tableIds(front.state)).toEqual([hunter(game), troll(game)]);
    expect(front.announcement).toBe('Brought Troll to the front.');
    expect(bringToFront(front.state, { cardId: troll(game) })).toMatchObject({ state: front.state, announcement: 'Troll is already in front.' });
    const back = sendToBack(front.state, { cardId: troll(game) });
    expect(tableIds(back.state)).toEqual([troll(game), hunter(game)]);
    expect(sendToBack(back.state, { cardId: troll(game) }).announcement).toBe('Troll is already at the back.');
  });
});

describe('TT-11 duplicate and delete', () => {
  it('duplicates a card on top, offset, the same way up and turned', () => {
    let game = flip(tableGame(), { cardId: hunter(tableGame()) }).state;
    game = rotate(game, { cardId: hunter(game), direction: 'clockwise' }).state;
    const copy = duplicate(game, { cardId: hunter(game) }, testContext());
    const original = game.table[1];
    expect(copy.state.table.at(-1)).toEqual({ cardId: copy.cardId, x: (original?.x ?? 0) + 24, y: (original?.y ?? 0) + 24, rotation: 90 });
    expect(copy.state.cards[copy.cardId]).toMatchObject({ side: 'back', duplicate: true, definitionId: game.cards[hunter(game)]?.definitionId });
    expect(copy.announcement).toBe('Duplicated Moonrise Hunter.');
  });

  it("doesn't count duplicates as the deck's copies when the pile reloads", () => {
    const game = tableGame();
    const copied = duplicate(game, { cardId: troll(game) }, testContext()).state;
    const reloaded = loadPile(copied, { pileId: 'pile-p1-main', sourceName: 'd.csv', cards: cardsFrom(csv), keepOrder: true }, testContext(7)).state;
    // Two Trolls in the deck's count, both still there, plus the duplicate.
    const trolls = Object.values(reloaded.cards).filter((c) => reloaded.definitions[c.definitionId]?.front.name === 'Troll');
    expect(trolls).toHaveLength(3);
    expect(reloaded.piles[0]?.cardIds).toHaveLength(game.piles[0]?.cardIds.length ?? -1);
  });

  it('deletes a table card from the game', () => {
    const game = tableGame();
    const deleted = deleteCard(game, { cardId: troll(game) });
    expect(tableIds(deleted.state)).toEqual([hunter(game)]);
    expect(deleted.state.cards[troll(game)]).toBeUndefined();
    expect(deleted.announcement).toBe('Deleted Troll from the table.');
    const down = flip(game, { cardId: troll(game) }).state;
    expect(deleteCard(down, { cardId: troll(game) }).announcement).toBe('Deleted a face-down card from the table.');
  });
});
